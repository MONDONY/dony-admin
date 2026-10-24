<script setup lang="ts">
import PaginationControls from '@/components/ui/PaginationControls.vue'
import FinanceSearchField from '@/features/finance/components/FinanceSearchField.vue'
import FinanceViewTabs from '@/features/finance/components/FinanceViewTabs.vue'
import ListCountsError from '@/features/finance/components/ListCountsError.vue'
import OpenRowMissing from '@/features/finance/components/OpenRowMissing.vue'
import SectionError from '@/features/finance/components/SectionError.vue'
import ChargebacksTable from './ChargebacksTable.vue'
import { CHARGEBACK_VIEWS } from '@/features/finance/lib/chargebackViews'
import type { useChargebacks } from '@/features/payments/composables/useChargebacks'

/** Section Litiges bancaires : vues à nombres, recherche, ligne ouverte par lien, liste paginée. */
const props = defineProps<{ list: ReturnType<typeof useChargebacks> }>()
const { rows, isLoading, error, filters, counts, countsError, viewsReady, openId, openMissing, currentPage, totalPages } = props.list
</script>

<template>
  <div>
    <div class="mb-4 space-y-3">
      <FinanceViewTabs
        v-if="viewsReady" :views="CHARGEBACK_VIEWS" :counts="counts" :model-value="filters.view"
        v-bind="{ ariaLabel: 'Vues des litiges bancaires' }" test-prefix="cb-view" @update:model-value="props.list.setView"
      />
      <ListCountsError v-if="countsError" test-prefix="cb" @retry="props.list.reload()" />
      <FinanceSearchField
        :query="filters.query" test-prefix="cb" placeholder="Chercher : n° de suivi, nom, trajet"
        v-bind="{ ariaLabel: 'Rechercher un litige bancaire' }" @update:query="props.list.setFilter('query', $event)"
      />
    </div>
    <SectionError :message="error" />
    <OpenRowMissing :show="openMissing" label="Ce litige n’est pas dans cette page de la liste." />
    <ChargebacksTable
      :chargebacks="rows" :loading="isLoading" :failed="!!error" :highlight-id="openId"
      :empty-label="viewsReady && filters.view === 'OPEN' ? 'Aucun litige ouvert' : 'Aucun litige bancaire'"
    />
    <div class="mt-4"><PaginationControls :page="currentPage" :total-pages="totalPages" @change="props.list.goToPage" /></div>
  </div>
</template>
