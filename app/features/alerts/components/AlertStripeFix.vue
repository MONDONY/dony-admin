<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import ConfirmActionDialog from '@/components/ui/ConfirmActionDialog.vue'
import StripeResyncPanel from '@/features/payments/components/StripeResyncPanel.vue'
import { paymentsService } from '@/features/payments/services/paymentsService'
import { forceReleaseErrorMessage } from '@/features/payments/lib/stripeResync'
import { formatMoney } from '@/features/payments/types/index'
import type { AdminPaymentDetail, StripeResyncResult } from '@/features/payments/types/index'
import type { AdminAlert } from '@/features/alerts/types/index'
import { useAuthStore } from '@/stores/auth'

/**
 * Section « Corriger » d'une alerte qui vise un paiement : resynchroniser avec Stripe, forcer
 * le versement au voyageur quand le paiement est en séquestre, liens vers le paiement et le colis.
 */
const props = defineProps<{ alert: AdminAlert; paymentId: string }>()
const emit = defineEmits<{
  /** Alertes résolues par le back pendant la resynchronisation : à marquer dans la liste. */
  'auto-resolved': [ids: string[]]
  resolve: [id: string]
  /** Versement forcé : le back a pu résoudre d'autres alertes, la liste est à recharger. */
  changed: []
}>()
const auth = useAuthStore()

const payment = ref<AdminPaymentDetail | null>(null)
const resync = ref<StripeResyncResult | null>(null)
const releaseOpen = ref(false)
const releaseBusy = ref(false)
const releaseError = ref<string | null>(null)
const released = ref(false)

async function loadPayment() {
  if (!auth.can('PAYMENT_VIEW')) return
  try { payment.value = await paymentsService.get(props.paymentId) } catch { /* fiche indisponible : les gestes restent possibles */ }
}
onMounted(loadPayment)

/** Statut le plus frais : celui de la resynchronisation, sinon celui de la fiche paiement. */
const status = computed(() => (released.value || resync.value?.released ? 'RELEASED' : resync.value?.after.status ?? payment.value?.status ?? null))
const autoResolved = computed(() => !!resync.value?.resolvedAlertIds.includes(props.alert.id))
const canOfferResolve = computed(() =>
  !!resync.value?.alertResolvable && !autoResolved.value && !props.alert.resolved && auth.can('ALERT_RESOLVE'))
const canRelease = computed(() => auth.can('ADMIN_MANAGE') && auth.can('PAYMENT_RELEASE'))

const bidId = computed(() => payment.value?.insight?.bidId ?? payment.value?.bidId ?? null)
const threadId = computed(() => payment.value?.negotiationThreadId ?? payment.value?.insight?.negotiationThreadId ?? null)
const recipient = computed(() => payment.value?.insight?.traveler?.name ?? payment.value?.insight?.traveler?.id ?? payment.value?.travelerId ?? null)
const netAmount = computed(() => {
  const p = payment.value
  if (!p) return null
  return formatMoney(p.insight?.netTravelerCents ?? p.amountCents - p.commissionCents, p.currency)
})
const releaseMessage = computed(() => {
  const amount = netAmount.value ?? 'le montant net'
  const who = recipient.value ? `au voyageur ${recipient.value}` : 'au voyageur'
  return `${amount} seront versés ${who}. La carte de l’expéditeur est encaissée d’abord si besoin. Ce geste est définitif : vérifiez que le colis a bien été livré.`
})

async function onResynced(r: StripeResyncResult) {
  resync.value = r
  if (r.resolvedAlertIds.length) emit('auto-resolved', r.resolvedAlertIds)
  await loadPayment()
}

async function confirmRelease() {
  if (releaseBusy.value) return
  releaseBusy.value = true
  releaseError.value = null
  try {
    payment.value = await paymentsService.forceRelease(props.paymentId)
    released.value = true
    emit('changed')
  } catch (e) {
    releaseError.value = forceReleaseErrorMessage(e)
  } finally {
    releaseBusy.value = false
    releaseOpen.value = false
  }
}
</script>

<template>
  <section class="mb-5 rounded-card border border-border bg-surface-elevated/40 p-4" data-test="alert-fix">
    <h3 class="text-sm font-semibold mb-2">Corriger</h3>
    <StripeResyncPanel :payment-id="paymentId" :currency="payment?.currency" @done="onResynced" />

    <p v-if="autoResolved" data-test="alert-fix-auto-resolved" class="mt-3 text-sm text-success text-pretty">
      Alerte résolue automatiquement : l’écart a disparu après la resynchronisation.
    </p>
    <div v-else-if="canOfferResolve" class="mt-3 flex flex-wrap items-center gap-2" data-test="alert-fix-resolvable">
      <p class="text-sm text-pretty">Le paiement est aligné sur Stripe. Si plus rien n’est à faire, clôturez l’alerte.</p>
      <button
        type="button" data-test="alert-fix-resolve"
        class="rounded-btn px-3 py-1.5 text-sm bg-success/20 text-success hover:bg-success/30"
        @click="emit('resolve', alert.id)"
      >Marquer comme résolue</button>
    </div>

    <div v-if="status === 'ESCROW'" class="mt-4" data-test="alert-fix-release-block">
      <button
        type="button" data-test="alert-fix-release" :disabled="!canRelease || releaseBusy" :aria-busy="releaseBusy"
        class="rounded-btn px-4 py-2 text-sm border border-success/40 text-success transition-[background-color,transform] hover:bg-success/10 active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100"
        @click="releaseOpen = true"
      >{{ releaseBusy ? 'Versement en cours…' : 'Forcer le versement au voyageur' }}</button>
      <p v-if="!canRelease" data-test="alert-fix-release-forbidden" class="mt-1 text-xs text-text-muted">Réservé aux super-administrateurs.</p>
    </div>
    <p v-if="released || resync?.released" data-test="alert-fix-released" class="mt-3 text-sm text-success">Versement envoyé au voyageur : le paiement est libéré.</p>
    <p v-if="releaseError" data-test="alert-fix-release-error" class="mt-2 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger text-pretty">{{ releaseError }}</p>

    <div class="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
      <NuxtLink :to="{ path: '/transactions', query: { open: paymentId } }" data-test="alert-fix-payment-link" class="text-primary hover:underline">Voir le paiement</NuxtLink>
      <NuxtLink v-if="bidId" :to="{ path: '/colis', query: { open: bidId } }" data-test="alert-fix-bid-link" class="text-primary hover:underline">Voir le colis</NuxtLink>
      <span v-if="threadId" data-test="alert-fix-thread" class="text-text-muted">
        Négociation <span class="font-mono text-xs break-all">{{ threadId }}</span>
      </span>
    </div>

    <ConfirmActionDialog
      :open="releaseOpen"
      title="Forcer le versement au voyageur"
      :message="releaseMessage"
      confirm-label="Verser au voyageur"
      confirm-tone="primary"
      @confirm="confirmRelease"
      @cancel="releaseOpen = false"
    />
  </section>
</template>
