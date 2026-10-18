<script setup lang="ts">
import { computed, useId } from 'vue'
import { currencyDecimals } from '@/features/incidents/types/index'
import type { AdminWalletRefundRequest, RetryWalletRefundBody, WalletRefundRetryPreview } from '@/features/finance/types/index'
import { countryLabel, retryBlocker } from '@/features/finance/components/walletRefundRetry'

/**
 * Relance d'un remboursement de solde mobile money passé en manuel : verse réellement l'argent
 * sur le numéro qui a servi à recharger, par pawaPay. Le montant versé est toujours le dû entier
 * (brut moins les frais du barème) : un versement partiel ferait perdre l'écart à l'utilisateur,
 * dont le solde est débité en entier. Si le wallet pawaPay ne le couvre pas en sécurité, la
 * fenêtre dit ce qu'il manque et l'envoi reste fermé jusqu'à ce qu'il soit alimenté.
 */
const props = defineProps<{
  open: boolean
  request: AdminWalletRefundRequest | null
  preview: WalletRefundRetryPreview | null
  loading?: boolean
  previewError?: string | null
  busy?: boolean
  error?: string | null
}>()
const emit = defineEmits<{ confirm: [body: RetryWalletRefundBody]; cancel: []; refresh: [] }>()

const fieldId = useId()

function num(amount: number, currency: string) {
  const d = currencyDecimals(currency)
  return amount.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d })
}
function fmt(amount: number | null | undefined, currency: string) {
  return amount == null ? '—' : num(amount, currency) + ' ' + currency
}
/** Solde pawaPay tel quel : il peut porter des centimes même en XOF (487,50), jamais arrondi. */
function fmtBalance(amount: number | null | undefined, currency: string) {
  if (amount == null || Number.isInteger(amount)) return fmt(amount, currency)
  return amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + currency
}

const currency = computed(() => props.preview?.currency ?? props.request?.currency ?? '')
const blocker = computed(() => retryBlocker(props.preview))
const topUp = computed(() => {
  const p = props.preview
  return p && p.topUpNeeded != null && p.topUpNeeded > 0 ? p.topUpNeeded : null
})
const amountText = computed(() => props.preview?.suggestedAmount != null ? num(props.preview.suggestedAmount, currency.value) : '')
const canConfirm = computed(() => !props.busy && !props.loading && props.preview != null && blocker.value === null)

function onConfirm() {
  const p = props.preview
  if (!canConfirm.value || !p || p.suggestedAmount == null) return
  emit('confirm', { amount: p.suggestedAmount })
}
</script>

<template>
  <div v-if="open && request" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
    <div
      data-test="wrr-retry-dialog" role="dialog" aria-modal="true" :aria-labelledby="`${fieldId}-title`"
      class="w-full max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto rounded-card border border-border bg-surface p-6 shadow-xl"
    >
      <h2 :id="`${fieldId}-title`" class="font-display text-lg font-semibold mb-1 text-balance">Relancer le remboursement</h2>
      <p class="text-sm text-text-muted mb-4 text-pretty">
        L’argent part réellement, par pawaPay, sur le numéro mobile money qui a servi à recharger le solde de
        {{ request.userName || 'l’utilisateur' }}.
      </p>

      <p v-if="loading" data-test="wrr-retry-loading" class="py-6 text-center text-sm text-text-muted">Lecture du solde pawaPay…</p>
      <p
        v-else-if="previewError" data-test="wrr-retry-preview-error" role="alert"
        class="mb-3 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger text-pretty"
      >{{ previewError }}</p>

      <template v-else-if="preview">
        <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt class="text-text-muted">Montant dû</dt>
          <dd class="text-right font-medium tabular-nums" data-test="wrr-retry-due">{{ fmt(preview.amountDue, currency) }}</dd>
          <dt class="text-text-muted">Solde pawaPay</dt>
          <dd class="text-right tabular-nums" data-test="wrr-retry-balance">
            {{ fmtBalance(preview.walletBalance, currency) }}
            <span class="block text-xs text-text-muted">{{ countryLabel(preview.country) }}, {{ preview.currency }}</span>
          </dd>
          <dt class="text-text-muted">Montant sûr</dt>
          <dd class="text-right tabular-nums" data-test="wrr-retry-safe">{{ fmt(preview.maxSafeAmount, currency) }}</dd>
          <dt class="text-text-muted">Numéro</dt>
          <dd class="text-right tabular-nums" data-test="wrr-retry-msisdn">{{ preview.msisdnMasked || '—' }}</dd>
        </dl>

        <label class="mt-4 block text-xs text-text-muted" :for="`${fieldId}-amount`">Montant à verser</label>
        <div class="mt-1 flex items-center gap-2">
          <input
            :id="`${fieldId}-amount`" data-test="wrr-retry-amount" type="text" readonly
            :value="amountText"
            :placeholder="blocker ? 'Indisponible' : ''"
            class="w-full rounded-btn border border-border bg-surface-elevated p-2 text-sm text-text tabular-nums"
          >
          <span class="shrink-0 text-sm text-text-muted">{{ currency }}</span>
        </div>
        <p class="mt-1 text-xs text-text-muted text-pretty">
          Toujours le montant dû entier : un versement partiel ferait perdre l’écart à l’utilisateur, dont le solde est débité en entier.
        </p>

        <p
          v-if="topUp" data-test="wrr-retry-topup"
          class="mt-4 rounded-btn border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-text text-pretty"
        >
          Il manque <span class="font-medium tabular-nums">{{ fmt(topUp, currency) }}</span> dans le wallet pawaPay
          {{ countryLabel(preview.country) }} pour verser le montant dû. Alimentez-le sur le tableau de bord pawaPay,
          puis actualisez.
        </p>
        <p v-else-if="blocker" data-test="wrr-retry-blocker" class="mt-4 text-sm text-text-muted text-pretty">{{ blocker }}</p>
      </template>

      <p
        v-if="error" data-test="wrr-retry-error" role="alert"
        class="mt-4 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger text-pretty"
      >{{ error }}</p>

      <div class="mt-6 flex flex-wrap justify-end gap-2">
        <button
          type="button" data-test="wrr-retry-cancel"
          class="rounded-btn px-4 py-2 text-sm border border-border transition-colors hover:bg-surface-elevated"
          @click="emit('cancel')"
        >Annuler</button>
        <button
          v-if="preview && blocker" type="button" data-test="wrr-retry-refresh" :disabled="loading || busy"
          class="rounded-btn px-4 py-2 text-sm border border-border transition-colors hover:bg-surface-elevated disabled:opacity-40"
          @click="emit('refresh')"
        >Actualiser</button>
        <button
          type="button" data-test="wrr-retry-confirm" :disabled="!canConfirm"
          class="rounded-btn bg-primary px-4 py-2 text-sm text-white transition-[background-color,scale] hover:bg-primary/90 active:scale-[0.96] disabled:opacity-40 disabled:active:scale-100"
          @click="onConfirm"
        >{{ busy ? 'Envoi…' : 'Verser maintenant' }}</button>
      </div>
    </div>
  </div>
</template>
