<script setup lang="ts">
import { computed } from 'vue'
import SuggestSearchBox, { type SuggestGroup } from '@/components/ui/SuggestSearchBox.vue'
import { formatMoney } from '@/features/payments/types/index'
import { paymentStatusMeta } from './paymentStatus'
import type { PaymentStatus, PaymentSuggest } from '@/features/payments/types/index'

export type PaymentSuggestionKind = 'sender' | 'traveler' | 'trip' | 'parcel'
type Payload = PaymentSuggest['senders'][number] | PaymentSuggest['trips'][number] | PaymentSuggest['parcels'][number]

const props = defineProps<{
  modelQuery: string
  suggestions: PaymentSuggest | null
  suggestionsDisabled: boolean
  resetKey?: number
}>()
const emit = defineEmits<{
  'update:query': [string]
  type: [string]
  pick: [PaymentSuggestionKind, Payload]
  'open-payment': [string]
}>()

// `ariaLabel` en camelCase : vue-tsc traite `aria-label` comme un attribut natif, pas comme la prop.
const ARIA_LABEL = 'Rechercher un paiement'

const groups = computed<SuggestGroup[]>(() => {
  const s = props.suggestions
  if (!s) return []
  return [
    { key: 'sender', label: 'Expéditeurs', items: s.senders.map((p, i) => ({ key: String(i), title: p.name, count: p.count })) },
    { key: 'traveler', label: 'Voyageurs', items: s.travelers.map((p, i) => ({ key: String(i), title: p.name, count: p.count })) },
    { key: 'trip', label: 'Trajets', items: s.trips.map((p, i) => ({ key: String(i), title: p.label, count: p.count })) },
    { key: 'parcel', label: 'N° de suivi', items: s.parcels.map((p, i) => ({
      key: String(i), title: p.trackingNumber || 'Sans numéro', mono: true,
      sub: `${paymentStatusMeta(p.status as PaymentStatus)?.label ?? p.status} · ${formatMoney(p.amountCents, p.currency)}`,
    })) },
  ]
})

function onPick(groupKey: string, itemKey: string) {
  const s = props.suggestions
  const list: Payload[] | undefined = groupKey === 'sender' ? s?.senders : groupKey === 'traveler' ? s?.travelers
    : groupKey === 'trip' ? s?.trips : groupKey === 'parcel' ? s?.parcels : undefined
  const payload = list?.[Number(itemKey)]
  if (payload) emit('pick', groupKey as PaymentSuggestionKind, payload)
}

// Entrée sans option active : une référence exacte (paiement, pi_…) ouvre directement la fiche.
function onSubmit(q: string) {
  const exact = props.suggestionsDisabled ? undefined : props.suggestions?.exactPaymentId
  if (exact) emit('open-payment', exact)
  else emit('update:query', q)
}
</script>

<template>
  <SuggestSearchBox
    :model-query="modelQuery" :groups="groups" :disabled="suggestionsDisabled" :reset-key="resetKey"
    :count-unit="['paiement', 'paiements']" test-prefix="payment"
    placeholder="N° de suivi, référence, personne, trajet…" v-bind="{ ariaLabel: ARIA_LABEL }"
    @type="emit('type', $event)" @update:query="onSubmit" @pick="onPick"
  />
</template>
