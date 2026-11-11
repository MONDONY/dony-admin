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
import type { Dac7Seller } from '@/features/dac7/types/index'
import { useDac7Overview } from '@/features/dac7/composables/useDac7Overview'
import { DAC7_UNAVAILABLE, currentUtcYear, defaultYear, yearOptions } from '@/features/dac7/types/index'

definePageMeta({
  middleware: 'admin-only', permission: 'DAC7_REPORT',
  pageTitle: 'Déclaration DAC7', pageSubtitle: 'Préparer, vérifier et exporter la déclaration annuelle des voyageurs',
})

type Section = 'sellers' | 'refunds' | 'anomalies' | 'export'

// Année UTC, celle que le serveur compare (il refuse une année postérieure, 422) ; en janvier on
// ouvre l'année écoulée, celle de la déclaration due le 31 janvier.
const years = yearOptions(currentUtcYear())
const year = ref(defaultYear())
/** Un export ou un envoi est en cours : le sélecteur d'année est verrouillé. */
const working = ref(false)
const exportBusy = ref(false)
const statementsBusy = ref(false)
watch([exportBusy, statementsBusy], () => { working.value = exportBusy.value || statementsBusy.value })
const section = ref<Section>('sellers')
const summary = useDac7Overview()
/** Les onglets attendent la première réponse de la synthèse : un ancien back ne reçoit alors qu'une requête. */
const settled = ref(false)
/** Noms des voyageurs déjà chargés, par identifiant : nomment les voyageurs d'un refus d'export. */
const names = ref<Record<string, string>>({})
function onSellersLoaded(rows: Dac7Seller[]) {
  const next = { ...names.value }
  for (const r of rows) if (r.displayName) next[r.userId] = r.displayName
  names.value = next
}

const tabs = computed<TabItem<Section>[]>(() => [
  { id: 'sellers', label: 'Voyageurs' },
  { id: 'refunds', label: 'Remboursements à réconcilier', count: summary.overview.value?.refundsToReconcile, alert: true },
  { id: 'anomalies', label: 'Anomalies', count: summary.overview.value?.anomalies, alert: true },
  { id: 'export', label: 'Fichier et récapitulatifs' },
])

const reload = () => summary.load(year.value)
onMounted(async () => { await reload(); settled.value = true })
watch(year, () => { names.value = {}; void reload() })
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
            v-model.number="year" data-test="dac7-year" :disabled="working"
            class="rounded-btn border border-border bg-bg px-3 py-1.5 text-sm text-text"
          >
            <option v-for="y in years" :key="y" :value="y">{{ y }}</option>
          </select>
        </label>
      </div>

      <Dac7Summary :overview="summary.overview.value" :loading="summary.isLoading.value" :error="summary.error.value" @retry="reload" />

      <template v-if="settled">
        <TabBar v-model="section" :tabs="tabs" variant="underline" aria-label="Sections de la déclaration" test-prefix="dac7-tab" />

        <Dac7SellersPanel v-if="section === 'sellers'" :year="year" @changed="reload" @loaded="onSellersLoaded" />
        <Dac7RefundsPanel v-else-if="section === 'refunds'" :year="year" />
        <Dac7AnomaliesPanel v-else-if="section === 'anomalies'" :year="year" />
        <!-- Monté dès l'arrivée et seulement masqué : un fichier non chiffré déjà téléchargé reste signalé en changeant d'onglet. -->
        <div v-show="section === 'export'" class="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <Dac7ExportPanel :year="year" :blockers-count="summary.overview.value?.blockers?.length ?? 0" :names="names" @busy="exportBusy = $event" />
          <Dac7StatementsPanel :year="year" :names="names" @busy="statementsBusy = $event" />
        </div>
      </template>
    </template>
  </div>
</template>
