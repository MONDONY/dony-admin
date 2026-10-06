<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import type { PaymentStatusFilter, PaymentMethodFilter, PaymentCurrencyFilter } from '@/features/payments/types/index'

const props = defineProps<{
  modelStatus: PaymentStatusFilter; modelMethod: PaymentMethodFilter; modelCurrency: PaymentCurrencyFilter; modelDateFrom: string | null; modelDateTo: string | null
  modelHeld?: boolean
  modelQuery?: string
  modelHideAbandoned?: boolean
}>()
const emit = defineEmits<{
  'update:held': [boolean]
  'update:query': [string]
  'update:hideAbandoned': [boolean]
  'update:status': [PaymentStatusFilter]
  'update:method': [PaymentMethodFilter]
  'update:currency': [PaymentCurrencyFilter]
  'update:dateRange': [string | null, string | null]
}>()

const statusChips: { value: PaymentStatusFilter; label: string }[] = [
  { value: 'TOUS', label: 'Tous' },
  { value: 'PENDING', label: 'En attente' },
  { value: 'ESCROW', label: 'Escrow' },
  { value: 'RELEASED', label: 'Libéré' },
  { value: 'REFUNDED', label: 'Remboursé' },
  { value: 'FAILED', label: 'Échoué' },
  { value: 'CANCELLED', label: 'Annulé' },
]
// Les deux rails que le backend connaît. Les anciens boutons Cash, Wave et Orange Money
// envoyaient des valeurs sans rail correspondant : toujours une liste vide.
const methodChips: { value: PaymentMethodFilter; label: string }[] = [
  { value: 'TOUS', label: 'Tous' },
  { value: 'STRIPE', label: 'Carte' },
  { value: 'PAWAPAY', label: 'Mobile money' },
]
// Une devise à la fois : des montants en EUR et en XOF dans la même colonne ne se lisent
// pas, et ne s'additionnent jamais.
const currencyChips: { value: PaymentCurrencyFilter; label: string }[] = [
  { value: 'TOUTES', label: 'Toutes' },
  { value: 'EUR', label: 'EUR' },
  { value: 'USD', label: 'USD' },
  { value: 'CAD', label: 'CAD' },
  { value: 'GBP', label: 'GBP' },
  { value: 'CHF', label: 'CHF' },
  { value: 'XOF', label: 'XOF (F CFA ouest)' },
  { value: 'XAF', label: 'XAF (F CFA central)' },
]

// Recherche envoyée 300 ms après la dernière frappe, ou tout de suite sur Entrée.
const search = ref(props.modelQuery ?? '')
let searchTimer: ReturnType<typeof setTimeout> | null = null
function flushSearch() {
  if (searchTimer) { clearTimeout(searchTimer); searchTimer = null }
  emit('update:query', search.value.trim())
}
watch(search, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(flushSearch, 300)
})
onBeforeUnmount(() => { if (searchTimer) clearTimeout(searchTimer) })

const dateFrom = ref('')
const dateTo = ref('')

function applyDates() {
  emit('update:dateRange', dateFrom.value || null, dateTo.value || null)
}
function clearDates() {
  dateFrom.value = ''
  dateTo.value = ''
  emit('update:dateRange', null, null)
}
</script>

<template>
  <div class="space-y-3 mb-4">
    <div class="flex flex-wrap items-center gap-2">
      <span class="text-xs text-text-muted font-medium w-16 shrink-0">Recherche</span>
      <input
        v-model="search" type="search" data-test="payment-search" autocomplete="off"
        placeholder="ID paiement / colis / négociation, pi_…, nom ou @pseudo"
        class="w-full max-w-md rounded-btn border border-border bg-surface px-3 py-1.5 text-sm"
        @keydown.enter.prevent="flushSearch"
      >
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <span class="text-xs text-text-muted font-medium w-16 shrink-0">Statut</span>
      <div class="flex flex-wrap gap-1">
        <button
          v-for="c in statusChips" :key="c.value" type="button" :data-test="`chip-status-${c.value}`"
          :class="['rounded-full px-3 py-1 text-xs transition-colors',
            modelStatus === c.value ? 'bg-primary text-white' : 'bg-surface-elevated text-text-muted hover:text-text']"
          @click="emit('update:status', c.value)"
        >{{ c.label }}</button>
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <span class="text-xs text-text-muted font-medium w-16 shrink-0">Méthode</span>
      <div class="flex flex-wrap gap-1">
        <button
          v-for="c in methodChips" :key="c.value" type="button" :data-test="`chip-method-${c.value}`"
          :class="['rounded-full px-3 py-1 text-xs transition-colors',
            modelMethod === c.value ? 'bg-primary text-white' : 'bg-surface-elevated text-text-muted hover:text-text']"
          @click="emit('update:method', c.value)"
        >{{ c.label }}</button>
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <span class="text-xs text-text-muted font-medium w-16 shrink-0">Devise</span>
      <div class="flex flex-wrap gap-1">
        <button
          v-for="c in currencyChips" :key="c.value" type="button" :data-test="`chip-currency-${c.value}`"
          :class="['rounded-full px-3 py-1 text-xs transition-colors',
            modelCurrency === c.value ? 'bg-primary text-white' : 'bg-surface-elevated text-text-muted hover:text-text']"
          @click="emit('update:currency', c.value)"
        >{{ c.label }}</button>
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <span class="text-xs text-text-muted font-medium w-16 shrink-0">Blocage</span>
      <button
        type="button" data-test="chip-held" :aria-pressed="modelHeld ? 'true' : 'false'"
        :class="['rounded-full px-3 py-1 text-xs transition-colors',
          modelHeld ? 'bg-danger text-white' : 'bg-surface-elevated text-text-muted hover:text-text']"
        @click="emit('update:held', !modelHeld)"
      >Versements retenus</button>
      <button
        type="button" data-test="chip-abandoned" :aria-pressed="modelHideAbandoned ? 'false' : 'true'"
        title="Paiements restés en attente plus de 24 h : le client n’a jamais terminé le paiement"
        :class="['rounded-full px-3 py-1 text-xs transition-colors',
          !modelHideAbandoned ? 'bg-primary text-white' : 'bg-surface-elevated text-text-muted hover:text-text']"
        @click="emit('update:hideAbandoned', !modelHideAbandoned)"
      >{{ modelHideAbandoned ? 'Afficher les checkouts abandonnés' : 'Checkouts abandonnés affichés' }}</button>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <span class="text-xs text-text-muted font-medium w-16 shrink-0">Période</span>
      <div class="flex items-center gap-2">
        <input
          v-model="dateFrom" type="date" data-test="date-from"
          class="rounded-btn border border-border bg-surface px-2 py-1 text-sm"
          @change="applyDates"
        >
        <span class="text-text-muted text-sm">→</span>
        <input
          v-model="dateTo" type="date" data-test="date-to"
          class="rounded-btn border border-border bg-surface px-2 py-1 text-sm"
          @change="applyDates"
        >
        <button
          v-if="modelDateFrom || modelDateTo" type="button"
          class="text-xs text-text-muted hover:text-text"
          @click="clearDates"
        >Effacer</button>
      </div>
    </div>
  </div>
</template>
