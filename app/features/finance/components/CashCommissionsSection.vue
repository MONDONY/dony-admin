<script setup lang="ts">
import ActiveFilters from '@/components/ui/ActiveFilters.vue'
import PaginationControls from '@/components/ui/PaginationControls.vue'
import FinanceSearchField from './FinanceSearchField.vue'
import FinanceViewTabs from './FinanceViewTabs.vue'
import ListCountsError from './ListCountsError.vue'
import SectionError from './SectionError.vue'
import CashCommissionsTable from './CashCommissionsTable.vue'
import { CASH_COMMISSION_STATUS_OPTIONS, CASH_COMMISSION_VIEWS } from '@/features/finance/lib/cashCommissionViews'
import type { useCashCommissions } from '@/features/finance/composables/useCashCommissions'

/** Onglet Commissions cash : vues À traiter / Toutes à nombres, recherche, statut, voyageur (puce). */
const props = defineProps<{ list: ReturnType<typeof useCashCommissions> }>()
const { rows, isLoading, error, filters, chips, counts, countsError, viewsReady, currentPage, totalPages } = props.list

const selectClass = 'min-h-10 rounded-btn border border-border bg-surface px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary'
</script>

<template>
  <div>
    <div class="mb-4 space-y-3">
      <!-- Vues : seulement une fois les nombres reçus, jamais face à un ancien back (liste « Toutes »). -->
      <FinanceViewTabs
        v-if="viewsReady" :views="CASH_COMMISSION_VIEWS" :counts="counts" :model-value="filters.view"
        v-bind="{ ariaLabel: 'Vues des commissions cash' }" test-prefix="cash-view" @update:model-value="props.list.setView"
      />
      <ListCountsError v-if="countsError" test-prefix="cash" @retry="props.list.reload()" />
      <FinanceSearchField
        :query="filters.query" test-prefix="cash" placeholder="Chercher : n° de suivi, voyageur, trajet"
        v-bind="{ ariaLabel: 'Rechercher une commission cash' }" @update:query="props.list.setFilter('query', $event)"
      />
      <div class="flex flex-wrap items-center gap-2">
        <select
          :value="filters.status" data-test="cash-filter-status" aria-label="Statut de la commission" :class="selectClass"
          @change="props.list.setFilter('status', ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="o in CASH_COMMISSION_STATUS_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
      </div>
      <ActiveFilters :chips="chips" @remove="props.list.removeChip" @clear="props.list.clearChips()" />
    </div>
    <SectionError :message="error" />
    <CashCommissionsTable
      :commissions="rows" :loading="isLoading" :failed="!!error"
      :empty-label="viewsReady && filters.view === 'ATTENTION' ? 'Rien à traiter' : 'Aucune commission cash'"
    />
    <div class="mt-4"><PaginationControls :page="currentPage" :total-pages="totalPages" @change="props.list.goToPage" /></div>
  </div>
</template>
