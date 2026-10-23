import type { AdminBidDetail, BidStatus } from '../types'

export type BidStep = {
  id: 'created' | 'paid' | 'accepted' | 'handed' | 'transit' | 'delivered'
  label: string
  state: 'done' | 'current' | 'todo'
  at?: string | null
}
export type BidStepperModel = { steps: BidStep[]; ended: { label: string; tone: 'danger' | 'neutral' } | null }

const STEPS: { id: BidStep['id']; label: string }[] = [
  { id: 'created', label: 'Créé' },
  { id: 'paid', label: 'Payé' },
  { id: 'accepted', label: 'Accepté' },
  { id: 'handed', label: 'Remis' },
  { id: 'transit', label: 'En transit' },
  { id: 'delivered', label: 'Livré' },
]

/** Statut en cours : `done` étapes faites, puis l'étape courante (aucune si tout est fait). */
const ACTIVE: Partial<Record<BidStatus, number>> = {
  AWAITING_PAYMENT: 0, PENDING: 1, PAYMENT_ESCROWED: 2, ACCEPTED: 3,
  HANDED_OVER: 4, IN_TRANSIT: 4, ARRIVED: 4, COMPLETED: 6,
}

/** Statut terminal : libellé et nombre minimal d'étapes atteintes avant l'arrêt. */
const ENDED: Partial<Record<BidStatus, { label: string; tone: 'danger' | 'neutral'; reached: number }>> = {
  REJECTED: { label: 'Refusé', tone: 'neutral', reached: 1 },
  CANCELLED: { label: 'Annulé', tone: 'neutral', reached: 1 },
  EXPIRED: { label: 'Expiré', tone: 'neutral', reached: 1 },
  PARCEL_REFUSED: { label: 'Colis refusé', tone: 'danger', reached: 5 },
  NO_SHOW: { label: 'No-show', tone: 'danger', reached: 3 },
}

export function bidStepper(bid: AdminBidDetail): BidStepperModel {
  const ended = ENDED[bid.status] ?? null
  let done: number
  if (ended) {
    // Les traces du colis (paiement, remise, livraison) prolongent le minimum du statut.
    done = Math.max(
      ended.reached,
      bid.money ? 2 : 0,
      bid.milestones?.handoverLocation ? 4 : 0,
      bid.milestones?.deliveredAt ? 6 : 0,
    )
  } else {
    done = ACTIVE[bid.status] ?? 0
    // En attente d'acceptation : le paiement est fait dès que le montant est capturé.
    if (bid.status === 'PENDING' && bid.money) done = 2
  }
  const dates: Partial<Record<BidStep['id'], string | null | undefined>> = {
    created: bid.createdAt, paid: bid.money?.capturedAt, delivered: bid.milestones?.deliveredAt,
  }
  const steps = STEPS.map((s, i): BidStep => {
    const state = i < done ? 'done' : i === done && !ended ? 'current' : 'todo'
    const at = state === 'todo' ? undefined : dates[s.id]
    return at ? { ...s, state, at } : { ...s, state }
  })
  return { steps, ended: ended ? { label: ended.label, tone: ended.tone } : null }
}
