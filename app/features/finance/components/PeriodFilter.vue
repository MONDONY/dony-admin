<script setup lang="ts">
import { ref, watch } from 'vue'

/**
 * Sélecteur de période au jour près, sur le patron des dates du filtre Paiements : chaque
 * changement de borne est appliqué aussitôt, « Effacer » rend la période par défaut du back.
 */
const props = defineProps<{ modelDateFrom: string | null; modelDateTo: string | null }>()
const emit = defineEmits<{ 'update:dateRange': [string | null, string | null] }>()

const dateFrom = ref(props.modelDateFrom ?? '')
const dateTo = ref(props.modelDateTo ?? '')
watch(() => props.modelDateFrom, (v) => { dateFrom.value = v ?? '' })
watch(() => props.modelDateTo, (v) => { dateTo.value = v ?? '' })

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
  <div class="mb-4 flex flex-wrap items-center gap-2">
    <span class="text-xs text-text-muted font-medium w-16 shrink-0">Période</span>
    <div class="flex flex-wrap items-center gap-2">
      <input
        v-model="dateFrom" type="date" data-test="period-from" aria-label="Début de la période"
        class="rounded-btn border border-border bg-surface px-2 py-1 text-sm tabular-nums"
        @change="applyDates"
      >
      <span class="text-text-muted text-sm" aria-hidden="true">→</span>
      <input
        v-model="dateTo" type="date" data-test="period-to" aria-label="Fin de la période"
        class="rounded-btn border border-border bg-surface px-2 py-1 text-sm tabular-nums"
        @change="applyDates"
      >
      <button
        v-if="modelDateFrom || modelDateTo" type="button" data-test="period-clear"
        class="text-xs text-text-muted hover:text-text"
        @click="clearDates"
      >Effacer</button>
      <span v-else class="text-xs text-text-muted">Par défaut : les 12 derniers mois</span>
    </div>
  </div>
</template>
