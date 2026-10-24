<script setup lang="ts">
import { ref, useId, watch } from 'vue'
import { fromCents, toCents } from '@/features/payments/lib/paymentPageFilters'
import type { PaymentMethodFilter, PaymentCurrencyFilter } from '@/features/payments/types/index'

const props = withDefaults(defineProps<{
  modelMethod: PaymentMethodFilter; modelCurrency: PaymentCurrencyFilter; modelDateFrom: string | null; modelDateTo: string | null
  /** Bornes du montant, en centimes. */
  modelAmountMin?: number | null
  modelAmountMax?: number | null
  modelHeld?: boolean
  modelHideAbandoned?: boolean
}>(), {
  // Sans valeur explicite (et non `false` par conversion des booléens) : « Plus de filtres » reste fermé.
  modelAmountMin: null, modelAmountMax: null, modelHeld: false, modelHideAbandoned: undefined,
})
const emit = defineEmits<{
  'update:held': [boolean]
  'update:hideAbandoned': [boolean]
  'update:method': [PaymentMethodFilter]
  'update:currency': [PaymentCurrencyFilter]
  'update:dateRange': [string | null, string | null]
  'update:amountRange': [number | null, number | null]
}>()

// Les deux rails que le backend connaît. Les anciens boutons Cash, Wave et Orange Money
// envoyaient des valeurs sans rail correspondant : toujours une liste vide.
const methods: { value: PaymentMethodFilter; label: string }[] = [
  { value: 'TOUS', label: 'Toutes' },
  { value: 'STRIPE', label: 'Carte' },
  { value: 'PAWAPAY', label: 'Mobile money' },
]
// Une devise à la fois : des montants en EUR et en XOF dans la même colonne ne se lisent
// pas, et ne s'additionnent jamais.
const currencies: { value: PaymentCurrencyFilter; label: string }[] = [
  { value: 'TOUTES', label: 'Toutes' },
  { value: 'EUR', label: 'EUR' },
  { value: 'USD', label: 'USD' },
  { value: 'CAD', label: 'CAD' },
  { value: 'GBP', label: 'GBP' },
  { value: 'CHF', label: 'CHF' },
  { value: 'XOF', label: 'XOF (F CFA ouest)' },
  { value: 'XAF', label: 'XAF (F CFA central)' },
]

const dateFrom = ref(props.modelDateFrom ?? '')
const dateTo = ref(props.modelDateTo ?? '')
watch(() => props.modelDateFrom, v => { dateFrom.value = v ?? '' })
watch(() => props.modelDateTo, v => { dateTo.value = v ?? '' })

function applyDates() {
  emit('update:dateRange', dateFrom.value || null, dateTo.value || null)
}
function clearDates() {
  dateFrom.value = ''
  dateTo.value = ''
  emit('update:dateRange', null, null)
}

// Montant saisi en unités principales, émis en centimes. Une saisie invalide (texte, négatif,
// plus de deux décimales) est ignorée : la dernière borne valide reste en vigueur.
const minText = ref(fromCents(props.modelAmountMin))
const maxText = ref(fromCents(props.modelAmountMax))
let minCents = props.modelAmountMin ?? null
let maxCents = props.modelAmountMax ?? null
watch(() => props.modelAmountMin, (v) => {
  minCents = v ?? null
  if (toCents(minText.value) !== minCents) minText.value = fromCents(minCents)
})
watch(() => props.modelAmountMax, (v) => {
  maxCents = v ?? null
  if (toCents(maxText.value) !== maxCents) maxText.value = fromCents(maxCents)
})
function onAmount(bound: 'min' | 'max') {
  const text = bound === 'min' ? minText.value : maxText.value
  if (text.trim() === '') {
    if (bound === 'min') minCents = null; else maxCents = null
  } else {
    const c = toCents(text)
    if (c === null) return
    if (bound === 'min') minCents = c; else maxCents = c
  }
  emit('update:amountRange', minCents, maxCents)
}

// « Plus de filtres » : ouvert d'office quand un de ses filtres est actif (lien entrant compris).
const moreActive = () => !!props.modelHeld || props.modelHideAbandoned === false
const moreOpen = ref(moreActive())
watch(moreActive, (a) => { if (a) moreOpen.value = true })
const moreId = `payment-more-filters-${useId()}`

const field = 'min-h-10 rounded-btn border border-border bg-surface px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary'
const toggle = 'inline-flex min-h-10 items-center rounded-full px-4 text-sm transition-[background-color,color,transform] active:scale-[0.96] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
</script>

<template>
  <div class="mb-4 space-y-3">
    <div class="flex flex-wrap items-end gap-x-4 gap-y-3">
      <label class="flex flex-col gap-1 text-xs font-medium text-text-muted">
        Méthode
        <select
          data-test="filter-method" :value="modelMethod" :class="[field, 'text-text']"
          @change="emit('update:method', ($event.target as HTMLSelectElement).value as PaymentMethodFilter)"
        >
          <option v-for="m in methods" :key="m.value" :value="m.value">{{ m.label }}</option>
        </select>
      </label>

      <label class="flex flex-col gap-1 text-xs font-medium text-text-muted">
        Devise
        <select
          data-test="filter-currency" :value="modelCurrency" :class="[field, 'text-text']"
          @change="emit('update:currency', ($event.target as HTMLSelectElement).value as PaymentCurrencyFilter)"
        >
          <option v-for="c in currencies" :key="c.value" :value="c.value">{{ c.label }}</option>
        </select>
      </label>

      <fieldset class="flex flex-col gap-1">
        <legend class="mb-1 text-xs font-medium text-text-muted">Période</legend>
        <div class="flex items-center gap-2">
          <input v-model="dateFrom" type="date" data-test="date-from" aria-label="Du" :class="field" @change="applyDates">
          <span class="text-sm text-text-muted" aria-hidden="true">→</span>
          <input v-model="dateTo" type="date" data-test="date-to" aria-label="Au" :class="field" @change="applyDates">
          <button
            v-if="modelDateFrom || modelDateTo" type="button" data-test="dates-clear"
            class="inline-flex min-h-10 items-center rounded-btn px-3 text-sm text-text-muted transition-[background-color,transform] hover:bg-surface-elevated hover:text-text active:scale-[0.96] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            @click="clearDates"
          >Effacer</button>
        </div>
      </fieldset>

      <fieldset class="flex flex-col gap-1">
        <legend class="mb-1 text-xs font-medium text-text-muted">Montant (unités de la devise)</legend>
        <div class="flex items-center gap-2">
          <input
            v-model="minText" type="text" inputmode="decimal" data-test="amount-min" aria-label="Montant minimum" placeholder="Min"
            :class="[field, 'w-24 tabular-nums']" @input="onAmount('min')"
          >
          <span class="text-sm text-text-muted" aria-hidden="true">–</span>
          <input
            v-model="maxText" type="text" inputmode="decimal" data-test="amount-max" aria-label="Montant maximum" placeholder="Max"
            :class="[field, 'w-24 tabular-nums']" @input="onAmount('max')"
          >
        </div>
      </fieldset>

      <button
        type="button" data-test="more-filters" :aria-expanded="moreOpen" :aria-controls="moreId"
        class="inline-flex min-h-10 items-center gap-1 rounded-btn px-3 text-sm text-primary transition-[background-color,transform] hover:bg-primary/10 active:scale-[0.96] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        @click="moreOpen = !moreOpen"
      >Plus de filtres<span aria-hidden="true">{{ moreOpen ? ' ▴' : ' ▾' }}</span></button>
    </div>

    <div v-show="moreOpen" :id="moreId" data-test="more-filters-panel" class="flex flex-wrap items-center gap-2">
      <button
        type="button" data-test="chip-held" :aria-pressed="modelHeld ? 'true' : 'false'"
        :class="[toggle, modelHeld ? 'bg-danger text-white' : 'bg-surface-elevated text-text-muted hover:text-text']"
        @click="emit('update:held', !modelHeld)"
      >Versements retenus</button>
      <button
        type="button" data-test="chip-abandoned" :aria-pressed="modelHideAbandoned ? 'false' : 'true'"
        title="Paiements restés en attente plus de 24 h : le client n’a jamais terminé le paiement"
        :class="[toggle, !modelHideAbandoned ? 'bg-primary text-white' : 'bg-surface-elevated text-text-muted hover:text-text']"
        @click="emit('update:hideAbandoned', !modelHideAbandoned)"
      >{{ modelHideAbandoned ? 'Afficher les checkouts abandonnés' : 'Checkouts abandonnés affichés' }}</button>
    </div>
  </div>
</template>
