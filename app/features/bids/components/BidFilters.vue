<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { bidStatusMeta } from './bidStatus'
import { bidPaymentMethodLabel } from '@/features/bids/lib/bidLabels'
import { BID_PAYMENT_METHODS } from '@/features/bids/lib/bidPageFilters'
import type { BidsFilterState, BidStatus, BidStatusFilter } from '@/features/bids/types/index'

const props = defineProps<{ filters: BidsFilterState; viewsAvailable: boolean }>()
const emit = defineEmits<{
  'update:status': [BidStatusFilter]
  'update:dateRange': [string | null, string | null]
  'update:paymentMethod': [string | null]
  'update:content': [string]
  reset: []
}>()

const STATUSES: BidStatus[] = [
  'AWAITING_PAYMENT', 'PENDING', 'PAYMENT_ESCROWED', 'ACCEPTED', 'HANDED_OVER', 'IN_TRANSIT', 'ARRIVED',
  'COMPLETED', 'REJECTED', 'CANCELLED', 'NO_SHOW', 'PARCEL_REFUSED', 'EXPIRED',
]
const statusOptions = STATUSES.map(value => ({ value, label: bidStatusMeta(value).label }))
// Valeurs de `PaymentMethod` côté back.
const PAYMENTS = ['STRIPE', 'CASH', 'WAVE', 'ORANGE_MONEY', 'MOBILE_MONEY', 'PAWAPAY']
const paymentOptions = PAYMENTS.map(value => ({ value, label: bidPaymentMethodLabel(value) }))

// Les champs suivent les filtres : ils peuvent venir de l'URL, d'une puce retirée ou d'une réinitialisation.
const dateFrom = ref(props.filters.dateFrom ?? '')
const dateTo = ref(props.filters.dateTo ?? '')
const content = ref(props.filters.content ?? '')
watch(() => props.filters.dateFrom, v => { dateFrom.value = v ?? '' })
watch(() => props.filters.dateTo, v => { dateTo.value = v ?? '' })
watch(() => props.filters.content, v => { content.value = v ?? '' })

const isActive = computed(() => props.filters.status !== 'TOUS' || !!props.filters.dateFrom || !!props.filters.dateTo
  || !!props.filters.paymentMethod || !!props.filters.content)

// Au blur : n'émet que si la valeur a changé (Entrée suivie d'un blur ne recharge pas deux fois).
function applyContent() {
  const v = content.value.trim()
  if (v !== (props.filters.content ?? '')) emit('update:content', v)
}
function applyDates() {
  emit('update:dateRange', dateFrom.value || null, dateTo.value || null)
}
function clearDates() {
  dateFrom.value = ''
  dateTo.value = ''
  emit('update:dateRange', null, null)
}

const field = 'min-h-10 rounded-btn border border-border bg-surface px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary'
</script>

<template>
  <div class="flex flex-wrap items-end gap-3">
    <label class="flex flex-col gap-1 text-xs font-medium text-text-muted">
      Statut précis
      <select
        data-test="filter-status" aria-label="Statut précis" :value="filters.status" :class="[field, 'text-text']"
        @change="emit('update:status', ($event.target as HTMLSelectElement).value as BidStatusFilter)"
      >
        <option value="TOUS">Tous les statuts</option>
        <option v-for="s in statusOptions" :key="s.value" :value="s.value">{{ s.label }}</option>
      </select>
    </label>

    <div class="flex flex-col gap-1 text-xs font-medium text-text-muted">
      <span>Période</span>
      <div class="flex items-center gap-2">
        <input v-model="dateFrom" type="date" data-test="date-from" aria-label="Date de début" :class="[field, 'text-text']" @change="applyDates">
        <span aria-hidden="true">→</span>
        <input v-model="dateTo" type="date" data-test="date-to" aria-label="Date de fin" :class="[field, 'text-text']" @change="applyDates">
        <button
          v-if="filters.dateFrom || filters.dateTo" type="button" data-test="date-clear"
          class="inline-flex min-h-10 items-center rounded-btn px-3 text-sm text-text-muted transition-[background-color,transform] hover:bg-surface-elevated hover:text-text active:scale-[0.96] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          @click="clearDates"
        >Effacer</button>
      </div>
    </div>

    <template v-if="viewsAvailable">
      <label class="flex flex-col gap-1 text-xs font-medium text-text-muted">
        Mode de paiement
        <select
          data-test="filter-payment" aria-label="Mode de paiement" :value="filters.paymentMethod ?? ''" :class="[field, 'text-text']"
          @change="emit('update:paymentMethod', ($event.target as HTMLSelectElement).value || null)"
        >
          <option value="">Tous les modes</option>
          <option v-for="p in paymentOptions" :key="p.value" :value="p.value">{{ p.label }}</option>
        </select>
      </label>

      <label class="flex flex-col gap-1 text-xs font-medium text-text-muted">
        Contenu
        <input
          v-model="content" type="search" data-test="filter-content" aria-label="Contenu" placeholder="Ex. vêtements" :class="[field, 'min-w-[180px] text-text']"
          @keydown.enter.prevent="emit('update:content', content.trim())" @blur="applyContent" @search="emit('update:content', content.trim())"
        >
      </label>
    </template>

    <button
      v-if="isActive" type="button" data-test="filters-reset"
      class="inline-flex min-h-10 items-center rounded-btn px-3 text-sm text-primary transition-[background-color,transform] hover:bg-primary/10 active:scale-[0.96] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      @click="emit('reset')"
    >Réinitialiser</button>
  </div>
</template>
