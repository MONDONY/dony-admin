<script setup lang="ts">
import { onMounted, watch } from 'vue'
import AuditTable from '@/features/audit/components/AuditTable.vue'
import PaginationControls from '@/components/ui/PaginationControls.vue'
import { useAudit } from '@/features/audit/composables/useAudit'
import { readAuditQuery, writeAuditQuery } from '@/features/audit/lib/auditQuery'

definePageMeta({ middleware: 'admin-only', permission: 'AUDIT_VIEW', pageTitle: 'Audit', pageSubtitle: 'Journal des actions sensibles' })

const { entries, isLoading, totalPages, currentPage, filters, fetchAudit, goToPage, applyFilters, reset, restore } = useAudit()

// Les filtres appliqués vivent dans l'URL (`?entityType=PAYMENT&entityId=<uuid>` depuis le tiroir
// paiement) : la vue se partage et se recharge. Écriture par `router.replace`, sans pile d'historique.
const route = useRoute()
const router = useRouter()
const query = () => (route.query ?? {}) as Record<string, unknown>
const sameAsUrl = () => JSON.stringify(writeAuditQuery(query(), filters)) === JSON.stringify(writeAuditQuery(query(), readAuditQuery(query())))

function writeUrl() {
  const next = writeAuditQuery(query(), filters)
  if (sameAsUrl()) return
  void router.replace({ query: next })
}

async function onApply() { writeUrl(); await applyFilters() }
async function onReset() { await reset(); writeUrl() }

onMounted(async () => {
  restore(readAuditQuery(query()))
  await fetchAudit()
})
// Page déjà ouverte : un nouveau lien (query seule) applique ses filtres ; nos propres écritures
// laissent l'URL égale à l'état et ne rechargent pas une seconde fois.
// Une fois la page quittée, la query d'une autre page n'est pas lue comme des filtres.
const onThisPage = () => /^\/audit\/?$/.test(route.path ?? '')
watch(() => JSON.stringify(readAuditQuery(query())), () => {
  if (!onThisPage() || sameAsUrl()) return
  restore(readAuditQuery(query()))
  void fetchAudit()
})
</script>

<template>
  <div>
    <!-- Filtres -->
    <form
      class="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7 rounded-card border border-border bg-surface p-4"
      @submit.prevent="onApply"
    >
      <input
        v-model="filters.action" data-test="filter-action" type="text" placeholder="Action" aria-label="Action"
        class="rounded-btn border border-border bg-bg p-2 text-sm lg:col-span-1"
      >
      <input
        v-model="filters.entityType" data-test="filter-entity" type="text" placeholder="Type d'entité" aria-label="Type d'entité"
        class="rounded-btn border border-border bg-bg p-2 text-sm lg:col-span-1"
      >
      <input
        v-model="filters.entityId" data-test="filter-entity-id" type="text" placeholder="ID entité" aria-label="ID entité"
        spellcheck="false" autocomplete="off"
        class="rounded-btn border border-border bg-bg p-2 font-mono text-sm lg:col-span-1"
      >
      <input
        v-model="filters.actorId" data-test="filter-actor" type="text" placeholder="ID acteur" aria-label="ID acteur"
        class="rounded-btn border border-border bg-bg p-2 text-sm lg:col-span-1"
      >
      <input
        v-model="filters.from" data-test="filter-from" type="date" aria-label="Du"
        class="rounded-btn border border-border bg-bg p-2 text-sm lg:col-span-1"
      >
      <input
        v-model="filters.to" data-test="filter-to" type="date" aria-label="Au"
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
          @click="onReset"
        >Réinitialiser</button>
      </div>
    </form>

    <AuditTable :entries="entries" :loading="isLoading" />

    <div class="mt-4">
      <PaginationControls :page="currentPage" :total-pages="totalPages" @change="goToPage" />
    </div>
  </div>
</template>
