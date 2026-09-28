<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import ConfirmActionDialog from '@/components/ui/ConfirmActionDialog.vue'
import PayoutOverrideDialog from './PayoutOverrideDialog.vue'
import { paymentStatusMeta } from './paymentStatus'
import { formatMoney, isPaymentHeld, paymentMethodLabel } from '@/features/payments/types/index'
import type { AdminPaymentDetail, PayoutAction, PayoutOverride } from '@/features/payments/types/index'
import type { PayoutOverrideRequest } from '@/features/payments/composables/usePaymentDetail'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{
  payment: AdminPaymentDetail; open: boolean; error?: string | null; busy?: boolean
  /** 409 de blocage reçu du back : le geste concerné repasse par la dérogation. */
  overrideRequest?: PayoutOverrideRequest | null
  /** Refus du motif de dérogation (422) : le dialogue reste ouvert pour corriger. */
  overrideError?: string | null
}>()
// Les deux gestes qui paient le voyageur émettent la dérogation quand il y en a une, rien sinon.
const emit = defineEmits<{
  close: []; 'force-release': [override?: PayoutOverride]; refund: []; 'retry-payout': [override?: PayoutOverride]; 'retry-refund': []
  'override-dismiss': []
}>()

type PendingAction = 'release' | 'refund' | 'retry-payout' | 'retry-refund'

const auth = useAuthStore()
const pending = ref<PendingAction | null>(null)

/**
 * Relances mobile money, calquées sur les gardes du back (AdminPaymentController) : rail
 * pawaPay, statut éligible, et une opération du bon type déjà connue (sans elle le serveur
 * répond « introuvable »). Les deux relances exigent PAYMENT_RELEASE, y compris celle du
 * remboursement. Le back refuse encore si la dernière tentative n'est pas morte : son
 * `detail` s'affiche alors dans le bandeau d'erreur.
 */
const isMobileMoney = computed(() => props.payment.method === 'PAWAPAY')
const canRetryPayout = computed(() =>
  isMobileMoney.value && props.payment.status === 'RELEASED'
  && props.payment.pawapayPayoutId != null && auth.can('PAYMENT_RELEASE'))
const canRetryRefund = computed(() =>
  isMobileMoney.value && (props.payment.status === 'REFUNDED' || props.payment.status === 'CANCELLED')
  && props.payment.pawapayRefundId != null && auth.can('PAYMENT_RELEASE'))

const DIALOGS: Record<PendingAction, { title: string; message: string; confirmLabel: string; requireReason: boolean }> = {
  release: { title: 'Débloquer le paiement', message: 'Le paiement sera libéré au voyageur.', confirmLabel: 'Débloquer', requireReason: true },
  refund: { title: 'Rembourser l\'expéditeur', message: 'Le paiement sera remboursé.', confirmLabel: 'Rembourser', requireReason: true },
  'retry-payout': {
    title: 'Relancer le versement',
    message: 'Un nouveau versement mobile money du même montant sera envoyé au voyageur. Le serveur le refuse si la dernière tentative n\'a pas échoué.',
    confirmLabel: 'Relancer le versement',
    requireReason: false,
  },
  'retry-refund': {
    title: 'Relancer le remboursement',
    message: 'Un nouveau remboursement mobile money du dépôt d\'origine sera envoyé à l\'expéditeur. Le serveur le refuse si la dernière tentative n\'a pas échoué.',
    confirmLabel: 'Relancer le remboursement',
    requireReason: false,
  },
}
const dialog = computed(() => DIALOGS[pending.value ?? 'release'])

/**
 * Paiement retenu (nouveau back) : le déblocage et la relance passent d'emblée par la
 * dérogation. Sinon le dialogue habituel, sans case ni corps ; la dérogation n'apparaît
 * qu'après un 409 de blocage (`overrideRequest`), jamais d'avance face à un ancien back.
 */
const held = computed(() => isPaymentHeld(props.payment))
const overridePending = ref<PayoutAction | null>(null)
watch(() => props.overrideRequest, (r) => { overridePending.value = r?.action ?? null }, { immediate: true })

function ask(action: PayoutAction) {
  if (held.value) overridePending.value = action
  else pending.value = action === 'release' ? 'release' : 'retry-payout'
}
// Le dialogue reste ouvert pendant l'appel : il ne se ferme qu'une fois la réponse reçue, et
// reste ouvert (saisie conservée) si le serveur refuse le motif. Toute autre issue le ferme :
// succès, ou erreur affichée dans le bandeau du panneau.
const overrideSubmitted = ref(false)
function confirmOverride(override: PayoutOverride) {
  overrideSubmitted.value = true
  if (overridePending.value === 'release') emit('force-release', override)
  else emit('retry-payout', override)
}
watch(() => props.busy, (now, before) => {
  if (!before || now || !overrideSubmitted.value) return
  overrideSubmitted.value = false
  if (!props.overrideError) overridePending.value = null
})
function cancelOverride() {
  overrideSubmitted.value = false
  overridePending.value = null
  emit('override-dismiss')
}

/**
 * Blocages montrés dans la dérogation : ceux du 409 s'il les énumère, sinon déduits de son
 * code, sinon lus sur le paiement (gel du voyageur, plus litige bancaire s'il y en a un).
 */
const overrideBlockers = computed<string[]>(() => {
  const r = props.overrideRequest
  if (r?.blockers.length) return r.blockers
  if (r?.code === 'payment-disputed') return ['DISPUTED']
  if (r?.code === 'payout-beneficiary-held') return ['BENEFICIARY_HELD']
  return props.payment.disputed ? ['BENEFICIARY_HELD', 'DISPUTED'] : ['BENEFICIARY_HELD']
})
const overrideHoldReasons = computed<string[]>(() => {
  if (props.overrideRequest?.holdReasons.length) return props.overrideRequest.holdReasons
  return props.payment.beneficiaryHoldReason ? [props.payment.beneficiaryHoldReason] : []
})

const holdWho = computed(() => {
  if (props.payment.beneficiaryHoldReason === 'BANNED') return 'Le voyageur a été banni.'
  if (props.payment.beneficiaryHoldReason === 'KYC_REVOKED') return 'L’identité du voyageur a été révoquée.'
  return 'Le voyageur est bloqué.'
})
const heldSince = computed(() => props.payment.payoutHeldAt
  ? new Date(props.payment.payoutHeldAt).toLocaleDateString('fr-FR')
  : null)

function confirm() {
  // Sans argument : la forme émise par le dialogue habituel reste celle d'avant.
  if (pending.value === 'release') emit('force-release')
  else if (pending.value === 'refund') emit('refund')
  else if (pending.value === 'retry-payout') emit('retry-payout')
  else if (pending.value === 'retry-refund') emit('retry-refund')
  pending.value = null
}
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-40 flex justify-end bg-black/30" @click.self="emit('close')">
    <aside class="h-full w-full max-w-md bg-surface border-l border-border overflow-y-auto p-6">
      <div class="flex items-start justify-between mb-4">
        <h2 class="font-display text-xl font-bold">Paiement</h2>
        <StatusBadge v-bind="paymentStatusMeta(payment.status)" />
      </div>
      <dl class="grid grid-cols-2 gap-3 text-sm mb-6">
        <div><dt class="text-text-muted">Bid</dt><dd>{{ payment.bidId ?? '—' }}</dd></div>
        <div><dt class="text-text-muted">Méthode</dt><dd>{{ paymentMethodLabel(payment.method) }}</dd></div>
        <div><dt class="text-text-muted">Montant</dt><dd class="tabular-nums" data-test="payment-detail-amount">{{ formatMoney(payment.amountCents, payment.currency) }}</dd></div>
        <div><dt class="text-text-muted">Commission</dt><dd class="tabular-nums">{{ formatMoney(payment.commissionCents, payment.currency) }}</dd></div>
        <div><dt class="text-text-muted">Remboursé</dt><dd class="tabular-nums">{{ formatMoney(payment.refundedCents, payment.currency) }}</dd></div>
        <div><dt class="text-text-muted">Stripe PI</dt><dd class="truncate">{{ payment.stripePaymentIntentId ?? '—' }}</dd></div>
      </dl>
      <section
        v-if="held" data-test="payment-hold-notice"
        class="mb-4 rounded-card border border-danger/30 bg-danger/5 p-4 text-sm"
      >
        <p class="font-semibold text-danger">Versement retenu</p>
        <p class="mt-1 text-pretty">
          {{ holdWho }}
          <span v-if="heldSince" data-test="payment-hold-since">Retenu depuis le <span class="tabular-nums">{{ heldSince }}</span>.</span>
        </p>
        <p class="mt-1 text-text-muted text-pretty">
          L’argent reste chez Yadony et ne repartira pas tout seul. Remboursez l’expéditeur, ou payez le voyageur par une dérogation motivée.
        </p>
        <NuxtLink
          v-if="payment.travelerId" data-test="payment-hold-traveler-link"
          :to="`/users?query=${payment.travelerId}&open=${payment.travelerId}`"
          class="mt-2 inline-block font-medium text-primary underline-offset-2 hover:underline"
        >Voir la fiche du voyageur</NuxtLink>
      </section>
      <p v-if="error" data-test="payment-error" class="mb-3 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{{ error }}</p>
      <div v-if="payment.status === 'ESCROW'" class="flex flex-wrap gap-2">
        <button v-if="auth.can('PAYMENT_RELEASE')" type="button" data-test="action-release" :disabled="busy" class="rounded-btn px-4 py-2 text-sm bg-success/20 text-success hover:bg-success/30 disabled:opacity-40" @click="ask('release')">{{ busy ? 'En cours…' : 'Débloquer (force-release)' }}</button>
        <button v-if="auth.can('PAYMENT_REFUND')" type="button" data-test="action-refund" :disabled="busy" class="rounded-btn px-4 py-2 text-sm bg-warning/20 text-warning hover:bg-warning/30 disabled:opacity-40" @click="pending = 'refund'">{{ busy ? 'En cours…' : 'Rembourser' }}</button>
      </div>
      <div v-if="canRetryPayout || canRetryRefund" class="flex flex-wrap gap-2">
        <button v-if="canRetryPayout" type="button" data-test="action-retry-payout" :disabled="busy" class="rounded-btn px-4 py-2 text-sm bg-primary/15 text-primary transition-colors hover:bg-primary/25 active:scale-[0.97] disabled:opacity-40" @click="ask('retry-payout')">{{ busy ? 'En cours…' : 'Relancer le versement' }}</button>
        <button v-if="canRetryRefund" type="button" data-test="action-retry-refund" :disabled="busy" class="rounded-btn px-4 py-2 text-sm bg-warning/20 text-warning transition-colors hover:bg-warning/30 active:scale-[0.97] disabled:opacity-40" @click="pending = 'retry-refund'">{{ busy ? 'En cours…' : 'Relancer le remboursement' }}</button>
      </div>
      <button type="button" data-test="payment-close" class="mt-6 rounded-btn px-4 py-2 text-sm border border-border" @click="emit('close')">Fermer</button>
      <ConfirmActionDialog
        :open="pending !== null"
        :title="dialog.title"
        :message="dialog.message"
        :confirm-label="dialog.confirmLabel"
        :require-reason="dialog.requireReason"
        @confirm="confirm"
        @cancel="pending = null"
      />
      <PayoutOverrideDialog
        :open="overridePending !== null"
        :action="overridePending ?? 'release'"
        :blockers="overrideBlockers"
        :hold-reasons="overrideHoldReasons"
        :error="overrideError ?? null"
        :busy="busy"
        @confirm="confirmOverride"
        @cancel="cancelOverride"
      />
    </aside>
  </div>
</template>
