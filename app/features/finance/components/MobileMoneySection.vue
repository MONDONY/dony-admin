<script setup lang="ts">
import PaginationControls from '@/components/ui/PaginationControls.vue'
import FinanceViewTabs from './FinanceViewTabs.vue'
import ListCountsError from './ListCountsError.vue'
import MobileMoneyFilters from './MobileMoneyFilters.vue'
import MobileMoneyTable from './MobileMoneyTable.vue'
import { MOBILE_MONEY_VIEWS } from '@/features/finance/lib/mobileMoneyViews'
import type { useMobileMoney } from '@/features/finance/composables/useMobileMoney'
import type { MobileMoneyView } from '@/features/finance/types/index'

/** Onglet Opérations mobile money : vues à nombres, recherche, type, opérateur, liste paginée. */
const props = defineProps<{ list: ReturnType<typeof useMobileMoney> }>()
const { rows, isLoading, error, totalPages, currentPage, filters, counts, countsError, viewsReady, providers } = props.list
</script>

<template>
  <div>
    <div class="mb-4 space-y-3">
      <!-- Vues : seulement une fois les nombres reçus, jamais face à un ancien back (liste « Toutes »). -->
      <FinanceViewTabs
        v-if="viewsReady" :views="MOBILE_MONEY_VIEWS" :counts="counts" :model-value="filters.view"
        v-bind="{ ariaLabel: 'Vues des opérations mobile money' }" test-prefix="mm-view" @update:model-value="props.list.setView($event as MobileMoneyView)"
      />
      <ListCountsError v-if="countsError" test-prefix="mm" @retry="props.list.reload()" />
      <MobileMoneyFilters
        :query="filters.query" :kind="filters.kind" :provider="filters.provider" :providers="providers"
        @update:query="props.list.setQuery" @update:kind="props.list.setKind" @update:provider="props.list.setProvider"
      />
    </div>
    <p v-if="error" data-test="mm-error" class="mb-3 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{{ error }}</p>
    <MobileMoneyTable
      :payments="rows" :loading="isLoading"
      :empty-label="viewsReady && filters.view === 'FAILED' ? 'Aucune opération en échec' : 'Aucune opération'"
    />
    <div class="mt-4"><PaginationControls :page="currentPage" :total-pages="totalPages" @change="props.list.goToPage" /></div>
  </div>
</template>
