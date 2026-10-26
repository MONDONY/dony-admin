import type { AdminDisputeDetail, AdminDisputeListItem, AdminNoShow } from '@/features/incidents/types/index'

export const noShow = (over: Partial<AdminNoShow> = {}): AdminNoShow => ({
  id: 'c1', bidId: '89125c9c-aaaa-bbbb-cccc-dddddddddddd', legacy: false, scope: 'HANDOVER', reason: 'SENDER_NO_SHOW',
  status: 'PENDING_CONFIRMATION', contestationDeadline: '2026-09-28T15:00:00Z', remainingMinutes: 300, createdAt: '2026-09-28T10:00:00Z',
  declarant: { userId: 't1', name: 'Awa D.', role: 'TRAVELER' }, accused: { userId: 's1', name: 'Moussa K.', role: 'SENDER' },
  trip: { departureCity: 'Bamako', arrivalCity: 'Abidjan', departureDate: '2026-09-15' },
  handoverAt: '2026-09-15T12:30:00Z', amount: 45, currency: 'EUR', paymentMethod: 'CASH', paymentStatus: 'ESCROW', bidStatus: 'ACCEPTED',
  dispute: null, canConfirm: true, canReject: true,
  commissionStatus: null, adminDecision: null, decidedAt: null, decisionReason: null,
  ...over,
})

export const NuxtLink = { name: 'NuxtLink', props: ['to'], template: '<a :href="to" data-stub="nuxt-link"><slot /></a>' }

const SENDER_ID = '11111111-1111-4111-8111-111111111111'
const TRAVELER_ID = '22222222-2222-4222-8222-222222222222'
export const BID_ID = '89125c9c-aaaa-4bbb-8ccc-dddddddddddd'

export const dispute = (over: Partial<AdminDisputeListItem> = {}): AdminDisputeListItem => ({
  id: 'd1', bidId: BID_ID, type: 'TRAVELER_DELIVERY_NO_SHOW', status: 'OPEN',
  senderName: 'Koro DIAKITE', travelerName: 'Ibra DIANE', refundFrozen: true, createdAt: '2026-10-17T21:04:00',
  ...over,
})

export const disputeDetail = (over: Partial<AdminDisputeDetail> = {}): AdminDisputeDetail => ({
  ...dispute(), resolution: null, resolvedAt: null, resolutionNote: null, beneficiaryUserId: null,
  senderId: SENDER_ID, travelerId: TRAVELER_ID, bidCurrency: 'EUR',
  ...over,
})
