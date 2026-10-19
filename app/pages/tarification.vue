<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import CommissionGridPanel from '@/features/commission-grid/components/CommissionGridPanel.vue'
import MarginSimulator from '@/features/commission-grid/components/MarginSimulator.vue'
import CommissionGridHistory from '@/features/commission-grid/components/CommissionGridHistory.vue'
import { useCommissionGrids } from '@/features/commission-grid/composables/useCommissionGrids'
import { COMMISSION_GRID_UNAVAILABLE } from '@/features/commission-grid/types/index'
import { settingsService } from '@/features/settings/services/settingsService'

definePageMeta({
  middleware: 'admin-only',
  permission: 'CONFIG_MANAGE',
  pageTitle: 'Tarification',
  pageSubtitle: 'Commission par paliers, simulation de marge et historique',
})

type Tab = 'grille' | 'simulateur' | 'historique'
const TABS: { value: Tab; label: string }[] = [
  { value: 'grille', label: 'Grille' },
  { value: 'simulateur', label: 'Simulateur' },
  { value: 'historique', label: 'Historique' },
]
const route = useRoute()
const router = useRouter()
const tabFrom = (q: unknown): Tab => (TABS.some(t => t.value === q) ? q as Tab : 'grille')
const tab = ref<Tab>(tabFrom(route.query?.tab))

// Navigation vers la même page avec un autre ?tab= (recherche ⌘K depuis l'onglet) : la page
// n'est pas remontée, seul l'onglet change.
watch(() => route.query?.tab, (q) => { tab.value = tabFrom(q) })

const grids = useCommissionGrids()

// Taux unique du réglage `commission_rate`, affiché tant qu'aucune grille n'est en vigueur.
const flatRate = ref<string | null>(null)
async function loadFlatRate() {
  try {
    flatRate.value = (await settingsService.list()).find(s => s.key === 'commission_rate')?.value ?? null
  } catch { /* la carte dira « taux unique » sans le chiffre */ }
}

/** L'onglet vit dans l'URL (?tab=simulateur) : liens profonds et recherche ⌘K. */
function setTab(next: Tab) {
  tab.value = next
  const query: Record<string, string> = {}
  for (const [k, v] of Object.entries(route.query ?? {})) {
    if (k !== 'tab' && typeof v === 'string') query[k] = v
  }
  if (next !== 'grille') query.tab = next
  router.replace({ query })
}

onMounted(() => {
  void grids.load(0)
  void loadFlatRate()
})

const tabClass = (t: Tab) => tab.value === t ? 'border-b-2 border-primary text-text' : 'text-text-muted hover:text-text'
</script>

<template>
  <div>
    <div class="mb-4 flex gap-1 border-b border-border" role="tablist">
      <button
        v-for="t in TABS" :key="t.value" type="button" role="tab" :aria-selected="tab === t.value"
        :data-test="`tarification-tab-${t.value}`" class="rounded-t-btn px-4 py-2 text-sm" :class="tabClass(t.value)"
        @click="setTab(t.value)"
      >{{ t.label }}</button>
    </div>

    <p
      v-if="grids.unavailable.value" data-test="tarification-unavailable"
      class="rounded-card border border-border bg-surface-elevated px-4 py-6 text-center text-sm text-text-muted"
    >{{ COMMISSION_GRID_UNAVAILABLE }}</p>

    <template v-else>
      <p
        v-if="grids.message.value" data-test="tarification-message" role="status"
        class="mb-3 rounded-btn border border-success/40 bg-success/10 px-3 py-2 text-sm text-success"
      >{{ grids.message.value }}</p>
      <p
        v-if="grids.error.value" data-test="tarification-error" role="alert"
        class="mb-3 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
      >{{ grids.error.value }}</p>

      <p v-if="!grids.loaded.value && grids.isLoading.value" class="text-sm text-text-muted">Chargement…</p>
      <template v-else-if="grids.loaded.value">
        <CommissionGridPanel
          v-if="tab === 'grille'"
          :current="grids.current.value" :scheduled="grids.scheduled.value" :flat-rate="flatRate"
          :cancelling="grids.cancelling.value"
          @cancel="grids.cancel" @scheduled="grids.onScheduled"
        />
        <MarginSimulator
          v-else-if="tab === 'simulateur'"
          :current="grids.current.value" :scheduled="grids.scheduled.value" :flat-rate="flatRate"
        />
        <CommissionGridHistory
          v-else
          :items="grids.history.value" :current-id="grids.current.value?.id ?? null"
          :page="grids.currentPage.value" :total-pages="grids.totalPages.value" :loading="grids.isLoading.value"
          @page="grids.goToPage"
        />
      </template>
    </template>
  </div>
</template>
