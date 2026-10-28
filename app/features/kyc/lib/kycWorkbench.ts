import { KYC_QUEUE_STATUS_TABS, formatWaiting, isOverdue } from '@/features/kyc/types/index'
import type { AdminKycQueueItem, KycQueueStatus } from '@/features/kyc/types/index'

export type KycGroupKey = 'OVERDUE' | 'ON_TIME' | 'ALL'
export interface KycQueueGroup { key: KycGroupKey; title: string; items: AdminKycQueueItem[] }

/** Attente la plus longue d'abord : c'est l'ordre dans lequel on traite la file « À décider ». */
function byWaitingDesc(a: AdminKycQueueItem, b: AdminKycQueueItem): number {
  return (b.waitingHours ?? -1) - (a.waitingHours ?? -1)
}

/**
 * Découpe la file. « À décider » sépare les dossiers en retard (plus de 48 h) de ceux dans les temps,
 * les plus anciens en tête. Les autres onglets n'ont pas de notion de retard : un seul groupe, dans
 * l'ordre du serveur, titré du nom de l'onglet.
 */
export function groupKycQueue(items: readonly AdminKycQueueItem[], status: KycQueueStatus): KycQueueGroup[] {
  if (items.length === 0) return []
  if (status !== 'IN_REVIEW') {
    const title = KYC_QUEUE_STATUS_TABS.find((t) => t.value === status)?.label ?? 'Vérifications'
    return [{ key: 'ALL', title, items: [...items] }]
  }
  const sorted = [...items].sort(byWaitingDesc)
  const groups: KycQueueGroup[] = [
    { key: 'OVERDUE', title: 'En retard', items: sorted.filter((i) => isOverdue(i.waitingHours)) },
    { key: 'ON_TIME', title: 'Dans les temps', items: sorted.filter((i) => !isOverdue(i.waitingHours)) },
  ]
  return groups.filter((g) => g.items.length > 0)
}

/** Dossiers dans l'ordre d'affichage (groupes mis bout à bout) : base de J / K et du dossier ouvert par défaut. */
export function kycQueueOrder(groups: readonly KycQueueGroup[]): AdminKycQueueItem[] {
  return groups.flatMap((g) => g.items)
}

export function defaultKycUserId(order: readonly AdminKycQueueItem[]): string | null {
  return order[0]?.userId ?? null
}

/** Dossier voisin de `currentId` dans `order` ; sans dossier ouvert (ou hors file), J prend le premier, K le dernier. */
export function neighbourKycUserId(order: readonly AdminKycQueueItem[], currentId: string | null, step: 1 | -1): string | null {
  if (order.length === 0) return null
  const at = order.findIndex((i) => i.userId === currentId)
  if (at === -1) return (step === 1 ? order[0] : order[order.length - 1])?.userId ?? null
  const next = order[at + step]
  return next ? next.userId : null
}

export interface KycSummary {
  /** Dossiers en attente selon le serveur (toutes pages). */
  total: number
  /** En retard sur la page chargée. */
  overdue: number
  /** Attente la plus longue de la page chargée. */
  longest: { label: string; name: string } | null
  /** La page chargée ne contient pas tout : retard et attente la plus longue sont des minimums. */
  partial: boolean
}

export function summarizeKycQueue(items: readonly AdminKycQueueItem[], total: number): KycSummary {
  let longest: AdminKycQueueItem | null = null
  for (const i of items) {
    if (typeof i.waitingHours !== 'number') continue
    if (!longest || i.waitingHours > (longest.waitingHours ?? -1)) longest = i
  }
  return {
    total,
    overdue: items.filter((i) => isOverdue(i.waitingHours)).length,
    longest: longest ? { label: formatWaiting(longest.waitingHours), name: kycDisplayName(longest) } : null,
    partial: total > items.length,
  }
}

export function kycDisplayName(item: Pick<AdminKycQueueItem, 'userName'>): string {
  return item.userName?.trim() || 'Nom non renseigné'
}

/** Pourquoi le dossier est devant l'admin, d'après l'état de la file et la présence d'une session chez le fournisseur. */
export type KycSituation = 'REVIEW' | 'NO_SESSION' | 'VERIFIED' | 'REJECTED' | 'OTHER'

export function kycSituation(
  kycStatus: string | null | undefined,
  queueStatus: string | null | undefined,
  hasSession: boolean,
): KycSituation {
  const status = queueStatus ?? kycStatus
  if (status === 'VERIFIED') return 'VERIFIED'
  if (status === 'REJECTED') return 'REJECTED'
  if (!hasSession) return 'NO_SESSION'
  if (status === 'IN_REVIEW' || status === 'PENDING') return 'REVIEW'
  return 'OTHER'
}
