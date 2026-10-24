/** Fiche paiement complète (nouveau back) et lien NuxtLink rendu en vrai `href`, pour les onglets du tiroir. */
import { computed } from 'vue'
import { toHref, type AdminRoute } from '@/lib/adminLinks'
import type { AdminPaymentDetail, PaymentInsight } from '@/features/payments/types/index'

export const IDS = {
  PAY: '00000000-1111-4111-8111-000000000001',
  SENDER: '11111111-2222-4333-8444-555555555555',
  TRAVELER: '99999999-8888-4777-8666-555555555555',
  BID: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
  ANN: 'cccccccc-1111-4222-8333-444444444444',
  DISPUTE: 'dddddddd-1111-4222-8333-444444444444',
  CANCEL: 'eeeeeeee-1111-4222-8333-444444444444',
  CB: 'ffffffff-1111-4222-8333-444444444444',
  PR: '12121212-1111-4222-8333-444444444444',
  ALERT1: '34343434-1111-4222-8333-444444444444',
  ALERT2: '56565656-1111-4222-8333-444444444444',
  CONV: 'conv_Abc-123',
} as const

/** `<a href>` à l'URL que NuxtLink produirait (route du registre sérialisée). */
export const NuxtLink = {
  name: 'NuxtLink', props: ['to'],
  setup(p: { to: string | AdminRoute }) { return { href: computed(() => (typeof p.to === 'string' ? p.to : toHref(p.to))) } },
  template: '<a :href="href"><slot /></a>',
}
export const linkGlobal = { stubs: { NuxtLink } }

export const insightOf = (over: Partial<PaymentInsight> = {}): PaymentInsight => ({
  kind: 'BID', bidId: IDS.BID, negotiationThreadId: 'thread-1', sender: { id: IDS.SENDER, name: 'Awa Diallo' }, traveler: { id: IDS.TRAVELER, name: 'Ibrahima Ndiaye' },
  departureCity: 'Paris', arrivalCity: 'Dakar', bidStatus: 'IN_TRANSIT', abandoned: false, netTravelerCents: 19440, capturedAt: '2026-10-19T14:05:00',
  fxExchangeRate: null, stripeChargeId: 'ch_1', stripeDashboardUrl: 'https://dashboard.stripe.com/test/payments/pi_1', ...over,
})

/** Ancien back : ni `links`, ni `openAlerts`, ni `chargeback`, ni `alert`. */
export const oldPayment = (over: Partial<AdminPaymentDetail> = {}): AdminPaymentDetail => ({
  id: IDS.PAY, bidId: null, status: 'ESCROW', method: 'STRIPE', amountCents: 21300, commissionCents: 1860, currency: 'EUR',
  createdAt: '2026-10-19T14:02:00', refundedCents: 0, stripePaymentIntentId: 'pi_1', escrowReleasedAt: null, disputed: false,
  insight: insightOf(), ...over,
})

/** Nouveau back, tout autorisé : chaque bloc et chaque lien a sa donnée. */
export const fullPayment = (over: Partial<AdminPaymentDetail> = {}): AdminPaymentDetail => oldPayment({
  alert: 'HELD', trackingNumber: 'YD-8F3K2Q', announcementId: IDS.ANN,
  payoutHeldAt: '2026-10-19T10:00:00Z', beneficiaryHeld: true, beneficiaryHoldReason: 'BANNED', travelerId: IDS.TRAVELER,
  disputed: true,
  links: {
    announcementId: IDS.ANN, disputeId: IDS.DISPUTE, disputeStatus: 'OPEN', cancellationId: IDS.CANCEL, conversationId: IDS.CONV,
    chargebackId: IDS.CB, packageRequestId: IDS.PR,
  },
  openAlerts: [{ id: IDS.ALERT1, type: 'ESCROW_J48_TIMEOUT', severity: 'WARN' }, { id: IDS.ALERT2, type: 'MONEY_INVARIANT_INV-02', severity: 'CRITICAL' }],
  chargeback: { id: IDS.CB, status: 'OPEN', reason: 'fraudulent', openedAt: '2026-10-20T08:00:00' },
  ...over,
})
