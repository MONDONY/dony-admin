<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import CancellationFeeDialog from './CancellationFeeDialog.vue'
import { useCancellationFee } from '@/features/payments/composables/useCancellationFee'
import {
  feeGestures, feeReasonLabel, feeStatusLabel, feeStatusTone, formatFeeAmount, formatFeeRate,
  type FeeGestureId,
} from '@/features/payments/lib/cancellationFee'
import { parseServerDate } from '@/lib/serverDate'
import { useAuthStore } from '@/stores/auth'

/**
 * Carte « Frais d'annulation » de la fiche paiement : la retenue faite à l'expéditeur fautif et
 * ses deux gestes. Absente quand le colis n'a pas de retenue (cas normal) ou que le paiement n'a
 * pas de colis (fil de négociation). Se charge seule, sans jamais bloquer la fiche.
 */
const props = defineProps<{ bidId: string | null | undefined }>()
const auth = useAuthStore()
const state = useCancellationFee()
const { fee, loadError, busy, actionError, notice } = state

const dialog = ref<FeeGestureId | null>(null)
watch(() => props.bidId, (id) => { dialog.value = null; void state.load(id) }, { immediate: true })

const gestures = computed(() => (fee.value ? feeGestures(fee.value, p => auth.can(p)) : []))

function ask(g: { id: FeeGestureId; enabled: boolean }) {
  if (!g.enabled || busy.value) return
  state.clearAction()
  dialog.value = g.id
}
async function confirm(reason: string) {
  const ok = dialog.value === 'waive' ? await state.waive(reason) : await state.retryPayout(reason)
  if (ok) dialog.value = null
}
function cancel() { if (!busy.value) { dialog.value = null; state.clearAction() } }

function fmtDate(d: string | null | undefined) {
  const ms = parseServerDate(d)
  return Number.isNaN(ms) ? null : new Date(ms).toLocaleString('fr-FR')
}
const lines = computed(() => fee.value
  ? [
      { key: 'gross', label: 'Frais retenus à l’expéditeur', value: fee.value.grossFee },
      { key: 'refund-fees', label: 'Frais du prestataire', value: fee.value.refundFees },
      { key: 'commission', label: 'Commission Yadony', value: fee.value.commission },
      { key: 'net', label: 'Net versé au voyageur', value: fee.value.travelerNet },
    ]
  : [])
</script>

<template>
  <section v-if="fee || loadError" data-test="fee-card" aria-labelledby="fee-card-title" class="rounded-card border border-border bg-surface p-4">
    <p v-if="loadError && !fee" data-test="fee-load-error" role="alert" class="text-sm text-danger text-pretty">
      Frais d’annulation : {{ loadError }}
    </p>
    <template v-else-if="fee">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 id="fee-card-title" class="text-sm font-semibold">Frais d’annulation</h3>
        <span data-test="fee-status"><StatusBadge :label="feeStatusLabel(fee.status)" :tone="feeStatusTone(fee.status)" /></span>
      </div>
      <dl class="grid grid-cols-2 gap-3 text-sm">
        <div><dt class="text-text-muted">Motif</dt><dd data-test="fee-reason-label">{{ feeReasonLabel(fee.reason) }}</dd></div>
        <div><dt class="text-text-muted">Taux</dt><dd data-test="fee-rate" class="tabular-nums">{{ formatFeeRate(fee.rate) }}</dd></div>
        <div v-for="l in lines" :key="l.key">
          <dt class="text-text-muted">{{ l.label }}</dt>
          <dd class="tabular-nums" :class="l.key === 'net' ? 'font-medium' : ''" :data-test="`fee-${l.key}`">{{ formatFeeAmount(l.value, fee.currency) }}</dd>
        </div>
        <div v-if="fmtDate(fee.createdAt)"><dt class="text-text-muted">Créée le</dt><dd class="tabular-nums" data-test="fee-created">{{ fmtDate(fee.createdAt) }}</dd></div>
        <div v-if="fmtDate(fee.updatedAt)"><dt class="text-text-muted">Mise à jour le</dt><dd class="tabular-nums" data-test="fee-updated">{{ fmtDate(fee.updatedAt) }}</dd></div>
      </dl>
      <p
        v-if="fee.status === 'PAYOUT_PENDING'" data-test="fee-pending-reason"
        class="mt-3 rounded-btn border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-pretty"
      >Versement en attente{{ fee.payoutPendingReason ? ` : ${fee.payoutPendingReason}` : '.' }}</p>

      <p v-if="notice" data-test="fee-notice" role="status" class="mt-3 rounded-btn border border-success/40 bg-success/10 px-3 py-2 text-sm text-success text-pretty">{{ notice }}</p>

      <ul v-if="gestures.length" class="mt-3 flex flex-col gap-2">
        <li v-for="g in gestures" :key="g.id" class="flex flex-col items-start gap-1">
          <button
            type="button" :data-test="`fee-action-${g.id}`" :disabled="!g.enabled || busy"
            :aria-describedby="g.reason ? `fee-reason-${g.id}` : undefined"
            class="min-h-10 whitespace-nowrap rounded-btn border border-border px-4 text-sm font-medium transition-[background-color,transform] hover:bg-surface-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.96] disabled:opacity-50 disabled:active:scale-100 motion-reduce:active:scale-100"
            @click="ask(g)"
          >{{ g.label }}</button>
          <span v-if="g.reason" :id="`fee-reason-${g.id}`" :data-test="`fee-action-${g.id}-reason`" class="text-xs text-text-muted text-pretty">{{ g.reason }}</span>
        </li>
      </ul>

      <CancellationFeeDialog
        :open="dialog !== null" :action="dialog ?? 'waive'" :busy="busy" :error="actionError"
        @confirm="confirm" @cancel="cancel"
      />
    </template>
  </section>
</template>
