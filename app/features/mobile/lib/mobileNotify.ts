import { isUuid } from '@/lib/safeInput'
import type { AdminUserListItem, UserStatus } from '@/features/users/types/index'

/** Limites du back : titre 120, message 500. */
export const NOTIFY_TITLE_MAX = 120
export const NOTIFY_BODY_MAX = 500
/** Après un échec incertain, le même envoi reste verrouillé ce temps-là. */
export const NOTIFY_RETRY_LOCK_MS = 10_000

export interface NotifyDraft { userId: string; title: string; body: string }

/** Vrai si l'envoi est permis : un seul identifiant valide, titre et message non vides après trim, dans les limites. */
export function canSendNotification(d: NotifyDraft): boolean {
  const title = d.title.trim()
  const body = d.body.trim()
  return isUuid(d.userId)
    && title.length > 0 && title.length <= NOTIFY_TITLE_MAX
    && body.length > 0 && body.length <= NOTIFY_BODY_MAX
}

type Identity = Pick<AdminUserListItem, 'firstName' | 'lastName'>

export const NAMELESS_RECIPIENT = 'Utilisateur sans nom'

/**
 * Nom affiché d'un destinataire : prénom et nom, sinon « Utilisateur sans nom ». Jamais l'e-mail ni le
 * téléphone en clair (la ligne d'identification montre l'e-mail masqué et le suffixe d'identifiant).
 */
export function recipientName(u: Identity): string {
  return [u.firstName, u.lastName].map(p => (p ?? '').trim()).filter(Boolean).join(' ') || NAMELESS_RECIPIENT
}

/** `#ab12cd` : les 6 derniers caractères de l'identifiant, pour départager deux homonymes. */
export function idSuffix(id: string): string {
  return `#${id.slice(-6).toLowerCase()}`
}

/** `ai…@domaine.com` : 2 premiers caractères, puis le domaine. */
export function maskEmail(email: string | null | undefined): string | null {
  const e = (email ?? '').trim()
  const at = e.lastIndexOf('@')
  if (at < 1) return null
  return `${e.slice(0, Math.min(2, at))}…${e.slice(at)}`
}

/** Seconde ligne d'identification : e-mail masqué s'il existe, et TOUJOURS le suffixe d'identifiant. */
export function identityLine(id: string, email?: string | null): string {
  return [maskEmail(email), idSuffix(id)].filter(Boolean).join(' · ')
}

export interface AccountInfo { label: string; blocked: boolean }

/** Le back exclut BANNED et PENDING_DELETION d'une cible nominative ; SUSPENDED reste joignable. */
export function accountInfo(status: UserStatus | string | null | undefined): AccountInfo {
  switch (status) {
    case 'ACTIVE': return { label: 'Compte actif', blocked: false }
    case 'SUSPENDED': return { label: 'Compte suspendu (joignable)', blocked: false }
    case 'BANNED': return { label: 'Compte banni', blocked: true }
    case 'PENDING_DELETION': return { label: 'Suppression du compte demandée', blocked: true }
    default: return { label: 'Statut du compte inconnu', blocked: true }
  }
}

export const NOTIFY_UNREACHABLE = 'Ce compte ne peut pas être notifié'
export const NOTIFY_NO_RECIPIENT = 'Aucun destinataire joignable'
export const NOTIFY_MAYBE_SENT = 'La notification a peut-être été envoyée. Vérifiez avant de renvoyer.'

function statusOf(e: unknown): number | undefined {
  const err = e as { statusCode?: number; status?: number } | undefined
  return err?.statusCode ?? err?.status
}

/** Échec dont on ne sait pas si le serveur a agi : pas de statut (réseau, délai), 408, 429 ou 5xx. */
export function isAmbiguousFailure(e: unknown): boolean {
  const s = statusOf(e)
  return s === undefined || s === 408 || s === 429 || s >= 500
}

function genericLabel(s: number | undefined): string {
  if (s === undefined) return 'Connexion perdue ou serveur injoignable.'
  if (s === 400 || s === 422) return 'Le serveur a refusé ce message ou ce destinataire.'
  if (s === 403) return 'Vous n’avez pas le droit d’envoyer des notifications.'
  if (s === 404) return 'Utilisateur introuvable ou envoi indisponible sur ce serveur.'
  if (s === 405) return 'L’envoi n’est pas disponible sur ce serveur. Utilisez l’ordinateur.'
  if (s === 409) return 'Conflit : cet envoi est peut-être déjà en cours ou déjà fait.'
  if (s === 408 || s === 429) return 'Le serveur est occupé ou a mis trop de temps à répondre.'
  if (s >= 500) return 'Le serveur a rencontré une erreur.'
  return 'Envoi impossible'
}

/** Message d'échec : le détail du back s'il existe, sinon une phrase française par classe de statut (jamais la chaîne ofetch). */
export function notifyErrorMessage(e: unknown): string {
  const detail = (e as { data?: { detail?: unknown } } | undefined)?.data?.detail
  const base = typeof detail === 'string' && detail.trim() ? detail.trim() : genericLabel(statusOf(e))
  return isAmbiguousFailure(e) ? `${base} ${NOTIFY_MAYBE_SENT}` : base
}
