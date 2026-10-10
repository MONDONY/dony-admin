<script setup lang="ts">
import { computed, watch } from 'vue'
import { useStripeResync } from '@/features/payments/composables/useStripeResync'
import { RESYNC_UNAVAILABLE, resyncActionLabel, stripeStatusLabel } from '@/features/payments/lib/stripeResync'
import { paymentStatusMeta } from './paymentStatus'
import { formatMoney } from '@/features/payments/types/index'
import type { PaymentStatus, StripeResyncResult, StripeResyncState } from '@/features/payments/types/index'
import { parseServerDate } from '@/lib/serverDate'
import { useAuthStore } from '@/stores/auth'

/**
 * Bouton « Resynchroniser avec Stripe » et son résultat (avant / après). Réservé aux
 * super-admins (ADMIN_MANAGE, comme le back) : désactivé avec explication pour les autres.
 */
const props = defineProps<{ paymentId: string; currency?: string | null }>()
const emit = defineEmits<{ done: [result: StripeResyncResult] }>()
const auth = useAuthStore()
const { result, error, busy, unavailable, resync, reset } = useStripeResync()

watch(() => props.paymentId, reset)

async function run() {
  const r = await resync(props.paymentId)
  if (r) emit('done', r)
}

function statusLabel(s: string | null): string {
  if (!s) return '—'
  return paymentStatusMeta(s as PaymentStatus)?.label ?? s
}
function capturedLabel(s: StripeResyncState): string {
  const ms = parseServerDate(s.capturedAt)
  return Number.isNaN(ms) ? 'Non encaissé' : new Date(ms).toLocaleString('fr-FR')
}
function capturableLabel(s: StripeResyncState): string {
  return s.amountCapturable == null ? '—' : formatMoney(s.amountCapturable, props.currency ?? undefined)
}

const rows = computed(() => {
  const r = result.value
  if (!r) return []
  return [
    { key: 'status', label: 'Statut Yadony', before: statusLabel(r.before.status), after: statusLabel(r.after.status) },
    { key: 'captured', label: 'Encaissé le', before: capturedLabel(r.before), after: capturedLabel(r.after) },
    { key: 'stripe', label: 'Statut Stripe', before: stripeStatusLabel(r.before.stripeStatus), after: stripeStatusLabel(r.after.stripeStatus) },
    { key: 'capturable', label: 'Montant capturable', before: capturableLabel(r.before), after: capturableLabel(r.after) },
  ]
})
</script>

<template>
  <div data-test="stripe-resync">
    <p v-if="unavailable" data-test="resync-unavailable" class="text-sm text-text-muted text-pretty">{{ RESYNC_UNAVAILABLE }}</p>
    <template v-else>
      <button
        type="button" data-test="resync-stripe" :disabled="busy || !auth.can('ADMIN_MANAGE')" :aria-busy="busy"
        class="rounded-btn px-4 py-2 text-sm bg-primary text-white transition-[background-color,transform] hover:bg-primary/90 active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100"
        @click="run"
      >{{ busy ? 'Resynchronisation…' : 'Resynchroniser avec Stripe' }}</button>
      <p v-if="!auth.can('ADMIN_MANAGE')" data-test="resync-forbidden" class="mt-1 text-xs text-text-muted text-pretty">
        Réservé aux super-administrateurs : demandez à l’un d’eux de lancer la resynchronisation.
      </p>
    </template>
    <p v-if="error" data-test="resync-error" class="mt-2 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger text-pretty">{{ error }}</p>
    <div v-if="result" data-test="resync-result" class="mt-3 rounded-card border border-border bg-surface p-3 text-sm">
      <p class="font-medium" :class="result.changed ? 'text-success' : 'text-text'" data-test="resync-action">{{ resyncActionLabel(result.action) }}</p>
      <p v-if="result.message" class="mt-1 text-text-muted text-pretty" data-test="resync-message">{{ result.message }}</p>
      <table class="mt-2 w-full text-xs" data-test="resync-table">
        <thead class="text-left text-text-muted">
          <tr><th class="py-1 pr-2 font-medium" /><th class="py-1 pr-2 font-medium">Avant</th><th class="py-1 font-medium">Après</th></tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.key" :data-test="`resync-row-${row.key}`" class="border-t border-border">
            <th scope="row" class="py-1 pr-2 text-left font-normal text-text-muted">{{ row.label }}</th>
            <td class="py-1 pr-2 tabular-nums">{{ row.before }}</td>
            <td class="py-1 tabular-nums">{{ row.after }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
