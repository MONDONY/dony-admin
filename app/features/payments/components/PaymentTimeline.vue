<script setup lang="ts">
import { ref, watch } from 'vue'
import { paymentsService } from '@/features/payments/services/paymentsService'
import { timelineActionLabel } from '@/features/payments/lib/paymentLabels'
import type { PaymentTimelineEntry } from '@/features/payments/types/index'
import { extractProblemMessage } from '@/lib/problemDetail'
import { isEndpointMissing } from '@/lib/endpointMissing'
import { parseServerDate } from '@/lib/serverDate'

/** Chronologie d'un paiement : dates du paiement et journal d'audit, chargés à l'ouverture. */
const props = defineProps<{ paymentId: string }>()

const entries = ref<PaymentTimelineEntry[] | null>(null)
const error = ref<string | null>(null)
const loading = ref(false)

async function load(id: string) {
  loading.value = true; error.value = null; entries.value = null
  try {
    const result = await paymentsService.timeline(id)
    if (props.paymentId === id) entries.value = result
  } catch (e) {
    if (props.paymentId !== id) return
    error.value = isEndpointMissing(e)
      ? 'Chronologie disponible après la mise à jour du serveur.'
      : extractProblemMessage(e, 'Impossible de charger la chronologie')
  } finally { loading.value = false }
}
watch(() => props.paymentId, (id) => { if (id) void load(id) }, { immediate: true })

function fmt(d: string) {
  const ms = parseServerDate(d)
  return Number.isNaN(ms) ? '—' : new Date(ms).toLocaleString('fr-FR')
}
/** Motif, montant, code d'échec… : les champs du journal utiles à l'admin, sans les identifiants. */
function details(e: PaymentTimelineEntry): string | null {
  const keys = ['reason', 'overrideReason', 'note', 'amount', 'refundedAmount', 'failureCode', 'status', 'source']
  const parts = keys.filter(k => e.payload?.[k] !== undefined && e.payload[k] !== null && e.payload[k] !== '')
    .map(k => `${k} : ${String(e.payload[k])}`)
  return parts.length ? parts.join(' · ') : null
}
</script>

<template>
  <section class="mt-6" data-test="payment-timeline">
    <h3 class="mb-2 text-sm font-semibold">Chronologie</h3>
    <p v-if="loading" class="text-sm text-text-muted">Chargement…</p>
    <p v-else-if="error" class="text-sm text-text-muted" data-test="payment-timeline-error">{{ error }}</p>
    <p v-else-if="entries && entries.length === 0" class="text-sm text-text-muted">Aucun évènement enregistré.</p>
    <ol v-else-if="entries" class="relative space-y-3 border-l border-border pl-4">
      <li v-for="(e, i) in entries" :key="i" :data-test="`timeline-${e.action}`">
        <span class="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-surface" :class="e.source === 'PAYMENT' ? 'bg-primary' : 'bg-text-muted'" />
        <p class="text-sm font-medium">{{ timelineActionLabel(e.action) }}</p>
        <p class="text-xs text-text-muted tabular-nums">
          {{ fmt(e.at) }}<span v-if="e.actorLabel"> · {{ e.actorKind === 'ADMIN' ? 'admin' : 'par' }} {{ e.actorLabel }}</span>
        </p>
        <p v-if="details(e)" class="text-xs text-text-muted break-words">{{ details(e) }}</p>
      </li>
    </ol>
  </section>
</template>
