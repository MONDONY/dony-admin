<script setup lang="ts">
import { ref, watch } from 'vue'
import { KYC_PROVIDERS, KYC_QUEUE_STATUS_TABS, kycProviderLabel } from '@/features/kyc/types/index'
import type { KycProvider, KycQueueFilters, KycQueueStatus } from '@/features/kyc/types/index'

const props = defineProps<{ filters: KycQueueFilters }>()

/** Libellés courts : la file tient dans une colonne de 350 px. */
const SHORT_LABELS: Record<KycQueueStatus, string> = {
  IN_REVIEW: 'À décider', IN_PROGRESS: 'En cours', REJECTED: 'Refusées', VERIFIED: 'Validées', NOT_STARTED: 'Non commencées',
}
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
  if (f || t) moreOpen.value = true
})

/** Fournisseur et période servent peu : repliés par défaut pour laisser la place à la file, ouverts si un filtre est posé. */
const moreOpen = ref(Boolean(props.filters.provider || props.filters.from || props.filters.to))
const moreActive = () => Boolean(props.filters.provider || props.filters.from || props.filters.to)

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
  <div class="flex flex-col gap-2 border-b border-border p-3">
    <div class="flex flex-wrap gap-1" role="tablist" aria-label="Statut des vérifications">
      <button
        v-for="t in KYC_QUEUE_STATUS_TABS" :key="t.value" type="button" role="tab"
        :data-test="`kyc-tab-${t.value}`" :aria-selected="filters.status === t.value" :title="t.label"
        :class="['rounded-full px-3 py-1 text-sm transition-colors',
          filters.status === t.value ? 'bg-primary text-white' : 'bg-surface-elevated text-text-muted hover:text-text']"
        @click="emit('update:status', t.value)"
      >{{ SHORT_LABELS[t.value] }}</button>
    </div>

    <input
      v-model="q" type="search" placeholder="Nom, identifiant, +221 77…" data-test="kyc-search"
      aria-label="Rechercher un utilisateur"
      class="w-full rounded-btn border border-border bg-bg px-3 py-1.5 text-sm"
      @keyup.enter="emit('update:query', q)"
      @search="emit('update:query', q)"
    >

    <button
      type="button" data-test="kyc-more-filters" :aria-expanded="moreOpen"
      class="flex w-fit items-center gap-1.5 text-xs font-medium text-text-muted hover:text-text"
      @click="moreOpen = !moreOpen"
    >
      {{ moreOpen ? 'Moins de filtres' : 'Plus de filtres' }}
      <span v-if="!moreOpen && moreActive()" data-test="kyc-more-active" class="rounded-full bg-primary/15 px-1.5 text-primary">actifs</span>
    </button>
    <div v-if="moreOpen" class="flex flex-col gap-2.5" data-test="kyc-more-panel">
    <div class="flex flex-wrap items-center gap-2">
      <label class="flex items-center gap-1.5 text-xs font-medium text-text-muted">
        Fournisseur
        <select
          data-test="kyc-provider" :value="filters.provider ?? ''"
          class="rounded-btn border border-border bg-surface px-2 py-1 text-sm text-text"
          @change="onProvider"
        >
          <option value="">Tous</option>
          <option v-for="p in KYC_PROVIDERS" :key="p" :value="p">{{ kycProviderLabel(p) }}</option>
        </select>
      </label>
    </div>
    <div class="flex flex-wrap items-center gap-1.5">
      <span class="text-xs font-medium text-text-muted">Soumises du</span>
      <input
        v-model="dateFrom" type="date" data-test="kyc-date-from" aria-label="Soumises à partir du"
        class="rounded-btn border border-border bg-surface px-2 py-1 text-sm"
        @change="applyDates"
      >
      <span class="text-xs font-medium text-text-muted">au</span>
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
