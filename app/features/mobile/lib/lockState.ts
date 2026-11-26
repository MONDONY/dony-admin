/**
 * État du verrou de l'app mobile, partagé entre le plugin Firebase (démarrage à froid), le
 * middleware d'authentification, la connexion et le composable d'inactivité.
 *
 * SANS dépendance (ni Vue, ni Nuxt, ni Firebase) : le plugin `firebase.client.ts` l'importe et ne
 * doit pas tirer le code mobile dans le bundle du bureau. Toute lecture ou écriture du stockage
 * passe par try/catch avec un repli en mémoire (navigation privée, stockage bloqué).
 */

/** Page de verrouillage : publique, hors onglets. */
export const LOCK_ROUTE = '/m/verrouille'
/** Délai d'inactivité de l'app mobile (décision du propriétaire). */
export const DEFAULT_IDLE_MS = 30 * 60 * 1000
/** Dernière activité dans l'app mobile (ms epoch), partagée entre onglets. */
export const ACTIVITY_KEY = 'yadony-admin-last-activity'
/**
 * Marqueur « session verrouillée » : posé AVANT la déconnexion Firebase, effacé seulement par une
 * connexion réussie. Tant qu'il est là, le plugin ne restaure aucune session (même si la
 * déconnexion Firebase a échoué), sur toutes les pages.
 */
export const LOCKED_KEY = 'yadony-admin-locked'
/** Page à retrouver (et e-mail à préremplir) après le verrouillage : session de l'onglet seulement. */
export const LOCK_CONTEXT_KEY = 'yadony-admin-lock-context'

export type LockReason = 'idle'
export interface LockMarker { at: number, reason: LockReason | null }
export interface LockContext { path: string | null, email: string | null }

let memoryActivity = 0
let memoryMarker: LockMarker | null = null
let memoryContext: LockContext = { path: null, email: null }

/** Vrai si une activité a été enregistrée et qu'elle date d'au moins `idleMs`. */
export function isActivityStale(lastActivity: number, now: number, idleMs: number = DEFAULT_IDLE_MS): boolean {
  return lastActivity > 0 && now - lastActivity >= idleMs
}

/** Dernière activité connue ; 0 si aucune. Stockage illisible : valeur gardée en mémoire. */
export function readLastActivity(): number {
  try {
    const n = Number(localStorage.getItem(ACTIVITY_KEY))
    return Number.isFinite(n) && n > 0 ? n : 0
  } catch { return memoryActivity }
}

export function writeLastActivity(at: number): void {
  memoryActivity = at
  try { localStorage.setItem(ACTIVITY_KEY, String(at)) } catch { /* mémoire seule */ }
}

export function markLocked(reason: LockReason | null, at: number = Date.now()): void {
  memoryMarker = { at, reason }
  try { localStorage.setItem(LOCKED_KEY, JSON.stringify(memoryMarker)) } catch { /* mémoire seule */ }
}

/** Marqueur posé, ou null. Toute valeur non vide compte (« 1 » compris). */
export function readLockMarker(): LockMarker | null {
  let raw: string | null
  try { raw = localStorage.getItem(LOCKED_KEY) } catch { return memoryMarker }
  if (!raw) return null
  try {
    const p = JSON.parse(raw) as { at?: unknown, reason?: unknown } | null
    if (p && typeof p === 'object') {
      return { at: typeof p.at === 'number' ? p.at : 0, reason: p.reason === 'idle' ? 'idle' : null }
    }
  } catch { /* valeur libre : le marqueur reste posé */ }
  return { at: 0, reason: null }
}

export function clearLockMarker(): void {
  memoryMarker = null
  try { localStorage.removeItem(LOCKED_KEY) } catch { /* rien à faire */ }
}

/** Connexion réussie : le verrou est levé et l'inactivité repart de maintenant. */
export function noteSignedIn(now: number = Date.now()): void {
  clearLockMarker()
  writeLastActivity(now)
}

/** Chemin applicatif (sans baseURL) de la section mobile : `/m`, `/m/...`, `/m?...`, `/m#...`. */
export function isMobileAppPath(path: string): boolean {
  return /^\/m(?:[/?#]|$)/.test(path)
}

/** Chemin applicatif courant (baseURL retirée), requête et ancre comprises. */
export function appPathFromLocation(baseURL: string | undefined): string {
  const { pathname, search, hash } = window.location
  const base = (baseURL || '/').replace(/\/?$/, '/')
  const path = pathname.startsWith(base) ? `/${pathname.slice(base.length)}` : pathname
  return `${path}${search}${hash}`
}

/**
 * Chemin applicatif sûr pour revenir après le verrouillage : jamais une URL absolue ni `//hôte`
 * (redirection ouverte), uniquement l'app mobile (`/m...`), et pas la page de verrouillage elle-même.
 */
export function isSafeReturnPath(path: unknown): path is string {
  if (typeof path !== 'string' || path.length === 0) return false
  if (!isMobileAppPath(path)) return false
  // eslint-disable-next-line no-control-regex
  if (/[\\\u0000-\u001f]/.test(path)) return false
  // Pas de remontée de dossier, de `//` après le premier caractère, ni de `/` ou `\` encodés.
  if (path.includes('//') || /%2f|%5c/i.test(path)) return false
  if (path.split(/[?#]/)[0]!.split('/').some(seg => seg === '..' || seg === '%2e%2e')) return false
  if (path === LOCK_ROUTE || path.startsWith(`${LOCK_ROUTE}?`) || path.startsWith(`${LOCK_ROUTE}#`)
    || path.startsWith(`${LOCK_ROUTE}/`)) return false
  return true
}

export function rememberLockContext(ctx: LockContext): void {
  memoryContext = ctx
  try { sessionStorage.setItem(LOCK_CONTEXT_KEY, JSON.stringify(ctx)) } catch { /* mémoire seule */ }
}

export function readLockContext(): LockContext {
  try {
    const raw = sessionStorage.getItem(LOCK_CONTEXT_KEY)
    if (raw) {
      const p = JSON.parse(raw) as { path?: unknown, email?: unknown }
      return {
        path: typeof p.path === 'string' ? p.path : null,
        email: typeof p.email === 'string' ? p.email : null,
      }
    }
  } catch { /* repli mémoire */ }
  return memoryContext
}

export function clearLockContext(): void {
  memoryContext = { path: null, email: null }
  try { sessionStorage.removeItem(LOCK_CONTEXT_KEY) } catch { /* rien à faire */ }
}
