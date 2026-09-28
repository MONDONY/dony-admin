import type { AdminNoShow } from '@/features/incidents/types/index'

export const noShow = (over: Partial<AdminNoShow> = {}): AdminNoShow => ({
  id: 'c1', bidId: '89125c9c-aaaa-bbbb-cccc-dddddddddddd', legacy: false, scope: 'HANDOVER', reason: 'SENDER_NO_SHOW',
  status: 'PENDING_CONFIRMATION', contestationDeadline: '2026-09-28T15:00:00Z', remainingMinutes: 300, createdAt: '2026-09-28T10:00:00Z',
  declarant: { userId: 't1', name: 'Awa D.', role: 'TRAVELER' }, accused: { userId: 's1', name: 'Moussa K.', role: 'SENDER' },
  trip: { departureCity: 'Bamako', arrivalCity: 'Abidjan', departureDate: '2026-09-15' },
  handoverAt: '2026-09-15T12:30:00Z', amount: 45, currency: 'EUR', paymentMethod: 'CASH', paymentStatus: 'ESCROW', bidStatus: 'ACCEPTED',
  dispute: null, canConfirm: true, canReject: true,
  ...over,
})

export const NuxtLink = { name: 'NuxtLink', props: ['to'], template: '<a :href="to" data-stub="nuxt-link"><slot /></a>' }
