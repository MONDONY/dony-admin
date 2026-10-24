<script setup lang="ts">
import ActiveFilters from '@/components/ui/ActiveFilters.vue'
import PaginationControls from '@/components/ui/PaginationControls.vue'
import FinanceSearchField from './FinanceSearchField.vue'
import SectionError from './SectionError.vue'
import WalletsTable from './WalletsTable.vue'
import { WALLET_BALANCE_SIGN_OPTIONS, WALLET_CURRENCY_OPTIONS } from '@/features/finance/lib/walletFilters'
import type { useWallets } from '@/features/finance/composables/useWallets'

/** Onglet Portefeuilles : recherche, devise, signe du solde, titulaire (puce) et liste paginée. */
const props = defineProps<{ list: ReturnType<typeof useWallets> }>()
const { rows, isLoading, error, filters, chips, currentPage, totalPages } = props.list

const selectClass = 'min-h-10 rounded-btn border border-border bg-surface px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary'
const value = (e: Event) => (e.target as HTMLSelectElement).value
</script>

<template>
  <div>
    <div class="mb-4 space-y-3">
      <FinanceSearchField
        :query="filters.query" test-prefix="wallets" placeholder="Chercher : nom, pseudo ou identifiant du titulaire"
        v-bind="{ ariaLabel: 'Rechercher un portefeuille' }" @update:query="props.list.setFilter('query', $event)"
      />
      <div class="flex flex-wrap items-center gap-2">
        <select :value="filters.currency" data-test="wallets-filter-currency" aria-label="Devise" :class="selectClass" @change="props.list.setFilter('currency', value($event))">
          <option v-for="o in WALLET_CURRENCY_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
        <select :value="filters.balanceSign" data-test="wallets-filter-sign" aria-label="Signe du solde" :class="selectClass" @change="props.list.setFilter('balanceSign', value($event))">
          <option v-for="o in WALLET_BALANCE_SIGN_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
      </div>
      <ActiveFilters :chips="chips" @remove="props.list.removeChip" @clear="props.list.clearChips()" />
    </div>
    <SectionError :message="error" />
    <WalletsTable :wallets="rows" :loading="isLoading" :failed="!!error" />
    <div class="mt-4"><PaginationControls :page="currentPage" :total-pages="totalPages" @change="props.list.goToPage" /></div>
  </div>
</template>
