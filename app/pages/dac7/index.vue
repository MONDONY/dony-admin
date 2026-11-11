<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import TabBar from '@/components/ui/TabBar.vue'
import type { TabItem } from '@/components/ui/TabBar.vue'
import Dac7AnomaliesPanel from '@/features/dac7/components/Dac7AnomaliesPanel.vue'
import Dac7ExportPanel from '@/features/dac7/components/Dac7ExportPanel.vue'
import Dac7RefundsPanel from '@/features/dac7/components/Dac7RefundsPanel.vue'
import Dac7SellersPanel from '@/features/dac7/components/Dac7SellersPanel.vue'
import Dac7StatementsPanel from '@/features/dac7/components/Dac7StatementsPanel.vue'
import Dac7Summary from '@/features/dac7/components/Dac7Summary.vue'
import { useDac7Overview } from '@/features/dac7/composables/useDac7Overview'
import { DAC7_UNAVAILABLE, yearOptions } from '@/features/dac7/types/index'

definePageMeta({
  middleware: 'admin-only', permission: 'DAC7_REPORT',
  pageTitle: 'Déclaration DAC7', pageSubtitle: 'Préparer, vérifier et exporter la déclaration annuelle des voyageurs',
})

type Section = 'sellers' | 'refunds' | 'anomalies' | 'export'

const currentYear = new Date().getFullYear()
const years = yearOptions(currentYear)
const year = ref(currentYear)
const section = ref<Section>('sellers')
const summary = useDac7Overview()
/** Les onglets attendent la première réponse de la synthèse : un ancien back ne reçoit alors qu'une requête. */
const settled = ref(false)

const tabs = computed<TabItem<Section>[]>(() => [
  { id: 'sellers', label: 'Voyageurs' },
  { id: 'refunds', label: 'Remboursements à réconcilier', count: summary.overview.value?.refundsToReconcile, alert: true },
  { id: 'anomalies', label: 'Anomalies', count: summary.overview.value?.anomalies, alert: true },
  { id: 'export', label: 'Fichier et récapitulatifs' },
])

const reload = () => summary.load(year.value)
onMounted(async () => { await reload(); settled.value = true })
watch(year, reload)
</script>

<template>
  <div class="flex flex-col gap-5">
    <p
      v-if="summary.unavailable.value" data-test="dac7-page-unavailable"
      class="rounded-card border border-border bg-surface p-6 text-sm text-text-muted"
    >{{ DAC7_UNAVAILABLE }}</p>

    <template v-else>
      <div class="flex flex-wrap items-center gap-3">
        <label class="flex items-center gap-2 text-sm text-text-muted">
          Année
          <select
            v-model.number="year" data-test="dac7-year"
            class="rounded-btn border border-border bg-bg px-3 py-1.5 text-sm text-text"
          >
            <option v-for="y in years" :key="y" :value="y">{{ y }}</option>
          </select>
        </label>
      </div>

      <Dac7Summary :overview="summary.overview.value" :loading="summary.isLoading.value" :error="summary.error.value" @retry="reload" />

      <template v-if="settled">
        <TabBar v-model="section" :tabs="tabs" variant="underline" aria-label="Sections de la déclaration" test-prefix="dac7-tab" />

        <Dac7SellersPanel v-if="section === 'sellers'" :year="year" @changed="reload" />
        <Dac7RefundsPanel v-else-if="section === 'refunds'" :year="year" />
        <Dac7AnomaliesPanel v-else-if="section === 'anomalies'" :year="year" />
        <div v-else class="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <Dac7ExportPanel :year="year" :blockers-count="summary.overview.value?.blockers?.length ?? 0" />
          <Dac7StatementsPanel :year="year" />
        </div>
      </template>
    </template>
  </div>
</template>
