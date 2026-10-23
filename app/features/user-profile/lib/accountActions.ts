import type { AdminUserDetail } from '@/features/users/types/index'
import type { CanFn } from './userProfileTabs'

export type AccountActionId =
  | 'notify' | 'writeSupport' | 'suspend' | 'ban' | 'unsuspend' | 'unban'
  | 'suspendPublishing' | 'liftPublishing' | 'mute' | 'unmute'
export type AccountActionGroup = 'Communiquer' | 'Compte' | 'Activité'

export interface AccountAction {
  id: AccountActionId
  group: AccountActionGroup
  label: string
  hint: string
  danger: boolean
  requiresReason: boolean
}

export const GROUP_ORDER: AccountActionGroup[] = ['Communiquer', 'Compte', 'Activité']

const A = (id: AccountActionId, group: AccountActionGroup, label: string, hint: string, danger = false, requiresReason = false): AccountAction =>
  ({ id, group, label, hint, danger, requiresReason })

const CATALOG: Record<AccountActionId, AccountAction> = {
  notify: A('notify', 'Communiquer', 'Envoyer une notification', 'Message poussé à cet utilisateur'),
  writeSupport: A('writeSupport', 'Communiquer', 'Écrire à l’utilisateur', 'Ouvre une conversation avec le support'),
  suspend: A('suspend', 'Compte', 'Suspendre', 'Bloque l’accès, réversible', true, true),
  ban: A('ban', 'Compte', 'Bannir', 'Définitif : retient aussi les versements', true, true),
  unsuspend: A('unsuspend', 'Compte', 'Réactiver', 'Rend l’accès au compte'),
  unban: A('unban', 'Compte', 'Lever le bannissement', 'Le compte redevient actif'),
  suspendPublishing: A('suspendPublishing', 'Activité', 'Suspendre la publication', 'Plus de trajets ni de colis publiés', true, true),
  liftPublishing: A('liftPublishing', 'Activité', 'Lever la suspension de publication', 'Autorise de nouveau la publication'),
  mute: A('mute', 'Activité', 'Couper la messagerie', 'Durée choisie à la confirmation', true, true),
  unmute: A('unmute', 'Activité', 'Rétablir la messagerie', 'Autorise de nouveau les échanges'),
}

/**
 * Gestes du menu « Actions du compte » : mêmes règles que l'ancien tiroir (le serveur reste
 * l'autorité, l'interface masque ce qu'il refuserait).
 */
export function availableActions(user: AdminUserDetail, can: CanFn): AccountAction[] {
  const ids: AccountActionId[] = []
  const active = user.status === 'ACTIVE'
  if (can('NOTIFICATION_SEND')) ids.push('notify')
  // Pas d'écriture vers un compte dont la suppression est engagée : il sera anonymisé.
  if (can('SUPPORT_TICKET_MANAGE') && user.status !== 'PENDING_DELETION') ids.push('writeSupport')
  if (active && can('USER_SUSPEND')) ids.push('suspend')
  if (active && can('USER_BAN')) ids.push('ban')
  if (user.status === 'SUSPENDED' && can('USER_SUSPEND')) ids.push('unsuspend')
  // Même endpoint que la levée de suspension, mais le back exige les deux droits pour un banni.
  if (user.status === 'BANNED' && can('USER_SUSPEND') && can('USER_BAN')) ids.push('unban')
  if (!user.publishingSuspended && can('USER_SUSPEND')) ids.push('suspendPublishing')
  if (user.publishingSuspended && can('USER_SUSPEND')) ids.push('liftPublishing')
  if (can('USER_MESSAGE_MUTE')) ids.push('mute')
  if (user.messagingMutedUntil != null && can('USER_MESSAGE_MUTE')) ids.push('unmute')
  return ids.map(id => CATALOG[id])
}

/** Groupes non vides, dans l'ordre d'affichage. */
export function groupActions(actions: AccountAction[]): { group: AccountActionGroup, actions: AccountAction[] }[] {
  return GROUP_ORDER
    .map(group => ({ group, actions: actions.filter(a => a.group === group) }))
    .filter(g => g.actions.length > 0)
}
