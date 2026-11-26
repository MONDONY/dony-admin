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
  /** Vrai pour les tuiles qui dépendent de la période choisie (estompées pendant le rechargement d'une période). */
  period: boolean
  /** Précision affichée sous le libellé (« à l’instant » pour un instantané). */
  caption?: string
}

export interface QueueRow { id: 'disputes' | 'noshows' | 'heldPayouts'; label: string; value: number }

/**
 * Définitions des tuiles (le back fait les comptes) :
 *  - « Inscrits » : comptes créés sur la période, y compris ceux supprimés depuis (`period.signups`) ;
 *  - « Comptes supprimés » : suppressions sur la période (`period.deletedAccounts`) ;
 *  - « Colis en cours » : offres acceptées + en transit (`bids.accepted + bids.inTransit`), instantané. Le
 *    tableau de bord ordinateur n'a pas de carte de ce nom : c'est la définition mobile, sur les offres ;
 *  - « Colis annulés » : annulations sur la période (`period.parcelsCancelled`) ;
 *  - « Identités en cours » : vérifications d'identité en cours au moment de la lecture
 *    (`period.kycInProgress`). Le back la range dans le bloc `period`, mais la période n'y change rien :
 *    instantané, marqué « à l’instant », jamais estompé par les puces de période ;
 *  - « Alertes ouvertes » : alertes non résolues, instantané.
 * Sans bloc `period` (ancien back), les tuiles qui en viennent sont omises, jamais inventées.
 */
export function buildTiles(o: AdminOverview): OverviewTile[] {
  const tiles: OverviewTile[] = []
  const p = o.period
  if (p) tiles.push({ id: 'signups', label: 'Inscrits', value: p.signups, period: true })
  if (p) tiles.push({ id: 'deleted', label: 'Comptes supprimés', value: p.deletedAccounts, period: true })
  tiles.push({ id: 'inProgress', label: 'Colis en cours', value: (o.bids?.inTransit ?? 0) + (o.bids?.accepted ?? 0), period: false })
  if (p) tiles.push({ id: 'cancelled', label: 'Colis annulés', value: p.parcelsCancelled, period: true })
  if (p) tiles.push({ id: 'kyc', label: 'Identités en cours', value: p.kycInProgress, period: false, caption: 'à l’instant' })
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
