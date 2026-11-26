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
/**
 * Délai d'inactivité (décision du propriétaire), réglable par `NUXT_PUBLIC_IDLE_LOCK_MINUTES` :
 * 30 minutes par défaut, borné entre 5 minutes et 12 heures. Jamais désactivable.
 */
export const IDLE_MINUTES_DEFAULT = 30
export const IDLE_MINUTES_MIN = 5
export const IDLE_MINUTES_MAX = 720
export const DEFAULT_IDLE_MS = IDLE_MINUTES_DEFAULT * 60 * 1000
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

/** Avance d'horloge tolérée sur une activité enregistrée ; au-delà, elle compte comme périmée. */
export const FUTURE_TOLERANCE_MS = 5 * 60 * 1000

let memoryActivity = 0
let memoryMarker: LockMarker | null = null
let memoryContext: LockContext = { path: null, email: null }

/**
 * Durée d'inactivité configurée, en minutes entières : `runtimeConfig.public.idleLockMinutes`
 * (nombre, ou chaîne telle que Nuxt la reçoit de l'environnement). Absente, vide, non numérique,
 * NaN ou <= 0 : 30 minutes. Sinon arrondie à la minute inférieure et bornée à [5, 720].
 */
export function resolveIdleMinutes(raw: unknown): number {
  let n = Number.NaN
  if (typeof raw === 'number') n = raw
  else if (typeof raw === 'string' && raw.trim() !== '') n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return IDLE_MINUTES_DEFAULT
  return Math.min(IDLE_MINUTES_MAX, Math.max(IDLE_MINUTES_MIN, Math.floor(n)))
}

/** {@link resolveIdleMinutes} en millisecondes. */
export function resolveIdleMs(rawMinutes: unknown): number {
  return resolveIdleMinutes(rawMinutes) * 60 * 1000
}

/** Mémoire du module remise à zéro, comme dans un nouveau document (tests). */
export function _resetLockStateMemory(): void {
  memoryActivity = 0
  memoryMarker = null
  memoryContext = { path: null, email: null }
}

/**
 * Vrai si l'activité enregistrée date d'au moins `idleMs` (limite comprise). Une activité dans le
 * futur au-delà de {@link FUTURE_TOLERANCE_MS} (horloge reculée, stockage modifié) compte aussi
 * comme périmée : sinon la session ne fermerait jamais. 0, négatif ou non fini : aucune activité.
 */
export function isActivityStale(lastActivity: number, now: number, idleMs: number = DEFAULT_IDLE_MS): boolean {
  if (!Number.isFinite(lastActivity) || lastActivity <= 0) return false
  if (lastActivity > now + FUTURE_TOLERANCE_MS) return true
  return now - lastActivity >= idleMs
}

/** Horodatage écrit par {@link writeLastActivity} : des chiffres seulement, sinon aucune activité. */
function parseActivity(raw: string | null): number {
  if (raw === null || !/^\d{1,15}$/.test(raw)) return 0
  return Number(raw)
}

/**
 * Dernière activité connue ; 0 si aucune. Le maximum du stockage (partagé entre onglets) et de la
 * mémoire de cette page : si le stockage est plein, l'écriture échoue mais la lecture marche, et
 * la valeur périmée restée dans le stockage ne doit pas l'emporter sur l'activité réelle (sinon
 * connexion, puis verrouillage immédiat, en boucle). Stockage illisible : mémoire seule.
 */
export function readLastActivity(): number {
  let stored: number
  try { stored = parseActivity(localStorage.getItem(ACTIVITY_KEY)) } catch { return memoryActivity }
  return Math.max(stored, memoryActivity)
}

export function writeLastActivity(at: number): void {
  memoryActivity = at
  try {
    localStorage.setItem(ACTIVITY_KEY, String(at))
  } catch {
    // Stockage plein : la valeur périmée ne doit pas survivre (au prochain démarrage elle fermerait
    // une session active). On la retire, ce qui libère sa place, puis on retente une fois.
    try {
      localStorage.removeItem(ACTIVITY_KEY)
      localStorage.setItem(ACTIVITY_KEY, String(at))
    } catch { /* mémoire seule */ }
  }
}

export function markLocked(reason: LockReason | null, at: number = Date.now()): void {
  memoryMarker = { at, reason }
  try { localStorage.setItem(LOCKED_KEY, JSON.stringify(memoryMarker)) } catch { /* mémoire seule */ }
}

function parseMarker(raw: string): LockMarker {
  try {
    const p = JSON.parse(raw) as { at?: unknown, reason?: unknown } | null
    if (p && typeof p === 'object') {
      return { at: typeof p.at === 'number' ? p.at : 0, reason: p.reason === 'idle' ? 'idle' : null }
    }
  } catch { /* valeur libre : le marqueur reste posé */ }
  return { at: 0, reason: null }
}

/**
 * Marqueur posé, ou null. Toute valeur non vide compte (« 1 » compris). Le marqueur posé par cette
 * page l'emporte (écriture refusée par un stockage plein) ; sinon celui du stockage.
 */
export function readLockMarker(): LockMarker | null {
  let raw: string | null
  try { raw = localStorage.getItem(LOCKED_KEY) } catch { return memoryMarker }
  if (memoryMarker) return memoryMarker
  return raw ? parseMarker(raw) : null
}

export function clearLockMarker(): void {
  memoryMarker = null
  try {
    localStorage.removeItem(LOCKED_KEY)
  } catch {
    // Retrait refusé : une valeur vide compte comme « pas de marqueur », il ne survit pas à la connexion.
    try { localStorage.setItem(LOCKED_KEY, '') } catch { /* rien à faire */ }
  }
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

/** Mémorise la page mobile où revenir après la connexion (null si le chemin n'est pas sûr), e-mail gardé. */
export function rememberReturnPath(path: string): void {
  rememberLockContext({ path: isSafeReturnPath(path) ? path : null, email: readLockContext().email })
}

/**
 * Où envoyer un admin dont la session vient de disparaître : la page de verrouillage pour la
 * section mobile (jamais `/login`, hors de la portée de l'app installée), en retenant la page ;
 * `/login` pour la console de bureau.
 */
export function sessionEndRoute(appPath: string): string {
  if (!isMobileAppPath(appPath)) return '/login'
  rememberReturnPath(appPath)
  return LOCK_ROUTE
}
