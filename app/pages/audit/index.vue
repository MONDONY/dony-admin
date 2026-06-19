<script setup lang="ts">
import { onMounted } from 'vue'
import AuditTable from '@/features/audit/components/AuditTable.vue'
import PaginationControls from '@/components/ui/PaginationControls.vue'
import { useAudit } from '@/features/audit/composables/useAudit'

definePageMeta({ middleware: 'admin-only', pageTitle: 'Audit', pageSubtitle: 'Journal des actions sensibles' })

const { entries, isLoading, totalPages, currentPage, filters, fetchAudit, goToPage, applyFilters, reset } = useAudit()

onMounted(fetchAudit)
</script>

<template>
  <div>
    <!-- Filtres -->
    <form
      class="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6 rounded-card border border-border bg-surface p-4"
      @submit.prevent="applyFilters"
    >
      <input
        v-model="filters.action" data-test="filter-action" type="text" placeholder="Action"
        class="rounded-btn border border-border bg-bg p-2 text-sm lg:col-span-1"
      >
      <input
        v-model="filters.entityType" data-test="filter-entity" type="text" placeholder="Type d'entité"
        class="rounded-btn border border-border bg-bg p-2 text-sm lg:col-span-1"
      >
      <input
        v-model="filters.actorId" data-test="filter-actor" type="text" placeholder="ID acteur"
        class="rounded-btn border border-border bg-bg p-2 text-sm lg:col-span-1"
      >
      <input
        v-model="filters.from" data-test="filter-from" type="date"
        class="rounded-btn border border-border bg-bg p-2 text-sm lg:col-span-1"
      >
      <input
        v-model="filters.to" data-test="filter-to" type="date"
        class="rounded-btn border border-border bg-bg p-2 text-sm lg:col-span-1"
      >
      <div class="flex gap-2 lg:col-span-1">
        <button
          type="submit" data-test="apply-filters"
          class="flex-1 rounded-btn px-3 py-2 text-sm bg-primary text-white hover:bg-primary/90"
        >Filtrer</button>
        <button
          type="button" data-test="reset-filters"
          class="rounded-btn px-3 py-2 text-sm border border-border hover:bg-surface-elevated"
          @click="reset"
        >Réinitialiser</button>
      </div>
    </form>

    <AuditTable :entries="entries" :loading="isLoading" />

    <div class="mt-4">
      <PaginationControls :page="currentPage" :total-pages="totalPages" @change="goToPage" />
    </div>
  </div>
</template>
