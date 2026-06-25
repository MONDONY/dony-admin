<script setup lang="ts">
import { ref } from 'vue'
import type { BidStatusFilter } from '@/features/bids/types/index'

defineProps<{ modelStatus: BidStatusFilter; modelQuery: string; modelDateFrom: string | null; modelDateTo: string | null }>()
const emit = defineEmits<{
  'update:status': [BidStatusFilter]
  'update:query': [string]
  'update:dateRange': [string | null, string | null]
}>()

const statusChips: { value: BidStatusFilter; label: string }[] = [
  { value: 'TOUS', label: 'Tous' },
  { value: 'AWAITING_PAYMENT', label: 'Att. paiement' },
  { value: 'PENDING', label: 'En attente' },
  { value: 'PAYMENT_ESCROWED', label: 'Escrow' },
  { value: 'ACCEPTED', label: 'Accepté' },
  { value: 'HANDED_OVER', label: 'Remis' },
  { value: 'IN_TRANSIT', label: 'En transit' },
  { value: 'COMPLETED', label: 'Livré' },
  { value: 'REJECTED', label: 'Refusé' },
  { value: 'CANCELLED', label: 'Annulé' },
  { value: 'NO_SHOW', label: 'No-show' },
  { value: 'EXPIRED', label: 'Expiré' },
]

const q = ref('')
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
      <span class="text-xs text-text-muted font-medium w-16 shrink-0">Recherche</span>
      <input
        v-model="q" type="search" placeholder="N° de suivi…" data-test="search"
        class="rounded-btn border border-border bg-surface px-3 py-1.5 text-sm min-w-[220px]"
        @keyup.enter="emit('update:query', q)"
        @search="emit('update:query', q)"
      >
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
