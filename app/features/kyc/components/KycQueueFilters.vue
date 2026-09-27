<script setup lang="ts">
import { ref, watch } from 'vue'
import { KYC_PROVIDERS, KYC_QUEUE_STATUS_TABS, kycProviderLabel } from '@/features/kyc/types/index'
import type { KycProvider, KycQueueFilters, KycQueueStatus } from '@/features/kyc/types/index'

const props = defineProps<{ filters: KycQueueFilters }>()
const emit = defineEmits<{
  'update:status': [KycQueueStatus]
  'update:provider': [KycProvider | null]
  'update:query': [string]
  'update:dateRange': [string | null, string | null]
}>()

const q = ref(props.filters.query)
const dateFrom = ref(props.filters.from ?? '')
const dateTo = ref(props.filters.to ?? '')
watch(() => [props.filters.from, props.filters.to], ([f, t]) => {
  dateFrom.value = f ?? ''
  dateTo.value = t ?? ''
})

function onProvider(e: Event) {
  const v = (e.target as HTMLSelectElement).value
  emit('update:provider', v ? v as KycProvider : null)
}
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
    <div class="flex flex-wrap gap-1" role="tablist" aria-label="Statut des vérifications">
      <button
        v-for="t in KYC_QUEUE_STATUS_TABS" :key="t.value" type="button" role="tab"
        :data-test="`kyc-tab-${t.value}`" :aria-selected="filters.status === t.value"
        :class="['rounded-full px-3 py-1.5 text-sm transition-colors',
          filters.status === t.value ? 'bg-primary text-white' : 'bg-surface-elevated text-text-muted hover:text-text']"
        @click="emit('update:status', t.value)"
      >{{ t.label }}</button>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <label class="flex items-center gap-2 text-xs text-text-muted font-medium">
        Fournisseur
        <select
          data-test="kyc-provider" :value="filters.provider ?? ''"
          class="rounded-btn border border-border bg-surface px-2 py-1.5 text-sm text-text"
          @change="onProvider"
        >
          <option value="">Tous</option>
          <option v-for="p in KYC_PROVIDERS" :key="p" :value="p">{{ kycProviderLabel(p) }}</option>
        </select>
      </label>
      <input
        v-model="q" type="search" placeholder="Nom, identifiant, +221 77…" data-test="kyc-search"
        aria-label="Rechercher un utilisateur"
        class="rounded-btn border border-border bg-surface px-3 py-1.5 text-sm min-w-[240px]"
        @keyup.enter="emit('update:query', q)"
        @search="emit('update:query', q)"
      >
      <div class="flex items-center gap-2">
        <span class="text-xs text-text-muted font-medium">Soumises du</span>
        <input
          v-model="dateFrom" type="date" data-test="kyc-date-from" aria-label="Soumises à partir du"
          class="rounded-btn border border-border bg-surface px-2 py-1 text-sm"
          @change="applyDates"
        >
        <span class="text-xs text-text-muted font-medium">au</span>
        <input
          v-model="dateTo" type="date" data-test="kyc-date-to" aria-label="Soumises jusqu’au"
          class="rounded-btn border border-border bg-surface px-2 py-1 text-sm"
          @change="applyDates"
        >
        <button
          v-if="filters.from || filters.to" type="button" data-test="kyc-dates-clear"
          class="text-xs text-text-muted hover:text-text"
          @click="clearDates"
        >Effacer</button>
      </div>
    </div>
  </div>
</template>
