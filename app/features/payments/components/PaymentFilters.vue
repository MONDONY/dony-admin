<script setup lang="ts">
import { ref } from 'vue'
import type { PaymentStatusFilter, PaymentMethodFilter } from '@/features/payments/types/index'

defineProps<{ modelStatus: PaymentStatusFilter; modelMethod: PaymentMethodFilter; modelDateFrom: string | null; modelDateTo: string | null }>()
const emit = defineEmits<{
  'update:status': [PaymentStatusFilter]
  'update:method': [PaymentMethodFilter]
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
const methodChips: { value: PaymentMethodFilter; label: string }[] = [
  { value: 'TOUS', label: 'Tous' },
  { value: 'STRIPE', label: 'Stripe' },
  { value: 'CASH', label: 'Cash' },
  { value: 'WAVE', label: 'Wave' },
  { value: 'ORANGE_MONEY', label: 'Orange Money' },
]

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
