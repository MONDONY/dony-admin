<script setup lang="ts">
import { computed } from 'vue'
import type { AdminPaymentDetail, PaymentAlertCode } from '@/features/payments/types/index'
import { isPaymentHeld } from '@/features/payments/types/index'
import { paymentAlertMeta } from '@/features/payments/lib/paymentViews'
import type { PaymentAction, PaymentActionId } from '@/features/payments/lib/paymentActions'
import { chargebackRoute, gate } from '@/lib/adminLinks'
import { parseServerDate } from '@/lib/serverDate'
import { useAuthStore } from '@/stores/auth'

/**
 * Bandeau « ce qui bloque » en haut du tiroir : l'alerte la plus urgente calculée par le back
 * (`payment.alert`), jamais recalculée ici. Un ancien back n'envoie pas le champ : la retenue se
 * lit alors sur ses champs de retenue. Versement retenu : la cause, depuis quand, et les deux
 * gestes possibles (les dialogues habituels, ouverts par la coquille). Checkout abandonné sans
 * alerte : le bandeau neutre « rien à faire » d'avant.
 */
const props = defineProps<{ payment: AdminPaymentDetail; actions: PaymentAction[] }>()
const emit = defineEmits<{ act: [id: PaymentActionId] }>()
const auth = useAuthStore()

const code = computed<PaymentAlertCode | null>(() => {
  const alert = props.payment.alert
  if (alert === undefined) return isPaymentHeld(props.payment) ? 'HELD' : null
  return paymentAlertMeta(alert) ? alert : null
})
const meta = computed(() => paymentAlertMeta(code.value))

const heldSince = computed(() => {
  const ms = parseServerDate(props.payment.payoutHeldAt)
  return Number.isNaN(ms) ? null : new Date(ms).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
})
const holdCause = computed(() => {
  if (props.payment.beneficiaryHoldReason === 'BANNED') return 'Le voyageur a été banni.'
  if (props.payment.beneficiaryHoldReason === 'KYC_REVOKED') return 'L’identité du voyageur a été révoquée.'
  return 'Le voyageur est bloqué.'
})
const HINTS: Partial<Record<PaymentAlertCode, string>> = {
  CHARGEBACK_OPEN: 'Le porteur de la carte conteste ce paiement auprès de sa banque.',
  MM_FAILED: 'Le dernier versement mobile money au voyageur a échoué : relancez-le depuis « Actions ».',
  ESCROW_J48: 'Vérifiez la livraison avant de débloquer ou de rembourser.',
}
const headline = computed(() => {
  if (code.value === 'HELD') return `À traiter : versement retenu${heldSince.value ? ` depuis le ${heldSince.value}` : ''}.`
  const label = meta.value?.label ?? ''
  return `À traiter : ${label.charAt(0).toLowerCase()}${label.slice(1)}.`
})
const chargeback = computed(() => (code.value === 'CHARGEBACK_OPEN'
  ? gate(c => auth.can(c), 'PAYMENT_VIEW', chargebackRoute(props.payment.links?.chargebackId))
  : null))

/** « Payer le voyageur » : déblocage en séquestre, sinon relance du versement, par la dérogation. */
const refund = computed(() => props.actions.find(a => a.id === 'refund') ?? null)
const payTraveler = computed(() => {
  const possible = props.actions.find(a => (a.id === 'release' || a.id === 'retry-payout') && a.enabled)
  return possible ?? props.actions.find(a => a.id === 'release') ?? null
})
interface BannerButton { key: string; test: string; label: string; action: PaymentAction; primary: boolean }
const buttons = computed(() => {
  const out: BannerButton[] = []
  if (refund.value) out.push({ key: 'refund', test: 'banner-refund', label: 'Rembourser l’expéditeur', action: refund.value, primary: false })
  if (payTraveler.value) out.push({ key: 'override', test: 'banner-override', label: 'Payer le voyageur (dérogation)', action: payTraveler.value, primary: true })
  return out
})
function act(a: PaymentAction) {
  if (a.enabled) emit('act', a.id)
}
</script>

<template>
  <div
    v-if="meta" data-test="payment-alert-banner" :data-code="code" :data-tone="meta.tone" role="status"
    :class="['rounded-card border px-4 py-3', meta.tone === 'danger' ? 'border-danger/30 bg-danger/5' : 'border-warning/30 bg-warning/5']"
  >
    <p class="text-sm text-pretty">
      <strong :class="['font-semibold', meta.tone === 'danger' ? 'text-danger' : 'text-warning']">{{ headline }}</strong>
      <span v-if="code === 'HELD'" data-test="banner-cause">{{ ` ${holdCause}` }}</span>
    </p>
    <p v-if="code === 'HELD'" class="mt-1 text-sm text-text-muted text-pretty">
      L’argent reste chez Yadony et ne repartira pas tout seul : remboursez l’expéditeur, ou payez le voyageur par une dérogation motivée.
    </p>
    <p v-else-if="code && HINTS[code]" class="mt-1 text-sm text-text-muted text-pretty" data-test="banner-hint">{{ HINTS[code] }}</p>

    <div v-if="code === 'HELD' && buttons.length" class="mt-3 flex flex-wrap items-start gap-2">
      <div v-for="b in buttons" :key="b.key" class="flex max-w-full flex-col gap-1">
        <button
          type="button" :data-test="b.test"
          :aria-disabled="b.action.enabled ? undefined : 'true'"
          :aria-describedby="b.action.reason ? `payment-banner-${b.key}-reason` : undefined"
          :class="['inline-flex min-h-10 items-center rounded-btn px-4 text-sm font-medium transition-[background-color,transform] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.96] motion-reduce:active:scale-100 aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:active:scale-100',
                   b.primary ? 'bg-primary text-white hover:bg-primary/90' : 'border border-danger/40 bg-surface text-danger hover:bg-danger/5']"
          @click="act(b.action)"
        >{{ b.label }}</button>
        <p v-if="b.action.reason" :id="`payment-banner-${b.key}-reason`" class="text-xs text-text-muted text-pretty">{{ b.action.reason }}</p>
      </div>
    </div>
    <NuxtLink
      v-if="chargeback" :to="chargeback" data-test="banner-chargeback-link"
      class="mt-2 inline-flex min-h-10 items-center rounded-btn px-2 text-sm font-medium text-primary transition-[background-color,transform] hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.96] motion-reduce:active:scale-100"
    >Voir le litige bancaire</NuxtLink>
  </div>
  <p
    v-else-if="payment.insight?.abandoned" data-test="payment-abandoned-notice"
    class="rounded-card border border-border bg-surface-elevated p-3 text-sm text-pretty"
  >Checkout abandonné : le paiement est en attente depuis plus de 24 h, le client ne l’a jamais terminé. Aucun argent n’a bougé, rien à faire.</p>
</template>
