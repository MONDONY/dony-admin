<script setup lang="ts">
import { ref, watch } from 'vue'
import type { PackageRequestFilters, PackageRequestStatusFilter } from '@/features/package-requests/types/index'

const props = defineProps<{ filters: PackageRequestFilters }>()
const emit = defineEmits<{
  'update:status': [PackageRequestStatusFilter]
  'update:query': [string]
  'update:reportedOnly': [boolean]
  'update:dateRange': [string | null, string | null]
}>()

const statusChips: { value: PackageRequestStatusFilter; label: string }[] = [
  { value: 'ALL', label: 'Toutes' },
  { value: 'OPEN', label: 'Ouvertes' },
  { value: 'NEGOTIATING', label: 'En négociation' },
  { value: 'ACCEPTED', label: 'Acceptées' },
  { value: 'COMPLETED', label: 'Terminées' },
  { value: 'EXPIRED', label: 'Expirées' },
  { value: 'CANCELLED', label: 'Annulées' },
  { value: 'DRAFT', label: 'Brouillons' },
  { value: 'REMOVED_BY_ADMIN', label: 'Retirées' },
]

const q = ref(props.filters.query)
const dateFrom = ref(props.filters.from ?? '')
const dateTo = ref(props.filters.to ?? '')
watch(() => [props.filters.from, props.filters.to], ([f, t]) => {
  dateFrom.value = f ?? ''
  dateTo.value = t ?? ''
})

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
          v-for="c in statusChips" :key="c.value" type="button" :data-test="`pr-chip-status-${c.value}`"
          :class="['rounded-full px-3 py-1 text-xs transition-colors',
            filters.status === c.value ? 'bg-primary text-white' : 'bg-surface-elevated text-text-muted hover:text-text']"
          @click="emit('update:status', c.value)"
        >{{ c.label }}</button>
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <span class="text-xs text-text-muted font-medium w-16 shrink-0">Recherche</span>
      <input
        v-model="q" type="search" placeholder="Ville, expéditeur, description…" data-test="pr-search"
        class="rounded-btn border border-border bg-surface px-3 py-1.5 text-sm min-w-[240px]"
        @keyup.enter="emit('update:query', q)"
        @search="emit('update:query', q)"
      >
      <label class="ml-2 flex items-center gap-2 text-sm text-text-muted cursor-pointer select-none">
        <input
          type="checkbox" data-test="pr-reported-only" :checked="filters.reportedOnly"
          @change="emit('update:reportedOnly', ($event.target as HTMLInputElement).checked)"
        >
        Signalées seulement
      </label>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <span class="text-xs text-text-muted font-medium w-16 shrink-0">Période</span>
      <div class="flex items-center gap-2">
        <input
          v-model="dateFrom" type="date" data-test="pr-date-from" aria-label="Créées à partir du"
          class="rounded-btn border border-border bg-surface px-2 py-1 text-sm"
          @change="applyDates"
        >
        <span class="text-text-muted text-sm">→</span>
        <input
          v-model="dateTo" type="date" data-test="pr-date-to" aria-label="Créées jusqu’au"
          class="rounded-btn border border-border bg-surface px-2 py-1 text-sm"
          @change="applyDates"
        >
        <button
          v-if="filters.from || filters.to" type="button" data-test="pr-dates-clear"
          class="text-xs text-text-muted hover:text-text"
          @click="clearDates"
        >Effacer</button>
      </div>
    </div>
  </div>
</template>
