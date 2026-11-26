import type { AdminOverview, OverviewPeriod } from '@/features/overview/types/index'

export const DEFAULT_PERIOD: OverviewPeriod = 'D7'

export const PERIOD_CHIPS: readonly { key: OverviewPeriod; label: string }[] = [
  { key: 'TODAY', label: 'Aujourd’hui' },
  { key: 'D7', label: '7 jours' },
  { key: 'D30', label: '30 jours' },
]

export interface OverviewTile {
  id: 'signups' | 'deleted' | 'inProgress' | 'cancelled' | 'kyc' | 'alerts'
  label: string
  value: number
  /** Vrai pour les tuiles qui dépendent de la période choisie. */
  period: boolean
}

export interface QueueRow { id: 'disputes' | 'noshows' | 'heldPayouts'; label: string; value: number }

/**
 * « Colis en cours » = offres acceptées + en transit (`bids.accepted + bids.inTransit`). Le tableau
 * de bord ordinateur n'a pas de carte de ce nom : c'est la définition mobile, sur les offres.
 * Sans bloc `period` (ancien back), les quatre tuiles de période sont omises, jamais inventées.
 */
export function buildTiles(o: AdminOverview): OverviewTile[] {
  const tiles: OverviewTile[] = []
  const p = o.period
  if (p) tiles.push({ id: 'signups', label: 'Inscrits', value: p.signups, period: true })
  if (p) tiles.push({ id: 'deleted', label: 'Comptes supprimés', value: p.deletedAccounts, period: true })
  tiles.push({ id: 'inProgress', label: 'Colis en cours', value: (o.bids?.inTransit ?? 0) + (o.bids?.accepted ?? 0), period: false })
  if (p) tiles.push({ id: 'cancelled', label: 'Colis annulés', value: p.parcelsCancelled, period: true })
  if (p) tiles.push({ id: 'kyc', label: 'Identités en cours', value: p.kycInProgress, period: true })
  tiles.push({ id: 'alerts', label: 'Alertes ouvertes', value: o.queues?.unresolvedAlerts ?? 0, period: false })
  return tiles
}

export function buildQueueRows(o: AdminOverview): QueueRow[] {
  const q = o.queues
  return [
    { id: 'disputes', label: 'Litiges ouverts', value: q?.openDisputes ?? 0 },
    { id: 'noshows', label: 'No-shows à arbitrer', value: q?.pendingNoShows ?? 0 },
    { id: 'heldPayouts', label: 'Versements retenus', value: q?.heldPayouts ?? 0 },
  ]
}

export const formatCount = (n: number): string => n.toLocaleString('fr-FR')
