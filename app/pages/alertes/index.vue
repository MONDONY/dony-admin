<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AlertsTable from '@/features/alerts/components/AlertsTable.vue'
import PaginationControls from '@/components/ui/PaginationControls.vue'
import ConfirmActionDialog from '@/components/ui/ConfirmActionDialog.vue'
import { useAlerts } from '@/features/alerts/composables/useAlerts'
import type { ResolvedFilter } from '@/features/alerts/types/index'

definePageMeta({ middleware: 'admin-only', permission: 'ALERT_VIEW', pageTitle: 'Alertes', pageSubtitle: 'Alertes opérationnelles' })

const { alerts, isLoading, totalPages, currentPage, filters, fetchAlerts, goToPage, setResolvedFilter, resolve } = useAlerts()
const pendingId = ref<string | null>(null)

const tabs: { value: ResolvedFilter; label: string }[] = [
  { value: 'OPEN', label: 'Ouvertes' },
  { value: 'RESOLVED', label: 'Résolues' },
  { value: 'ALL', label: 'Toutes' },
]

async function confirmResolve(note: string) {
  if (pendingId.value) await resolve(pendingId.value, note)
  pendingId.value = null
}

onMounted(fetchAlerts)
</script>

<template>
  <div>
    <div class="flex gap-1 mb-4">
      <button
        v-for="t in tabs" :key="t.value" type="button" :data-test="`tab-${t.value}`"
        :class="['rounded-full px-3 py-1.5 text-sm transition-colors',
          filters.resolved === t.value ? 'bg-primary text-white' : 'bg-surface-elevated text-text-muted hover:text-text']"
        @click="setResolvedFilter(t.value)"
      >{{ t.label }}</button>
    </div>

    <AlertsTable :alerts="alerts" :loading="isLoading" @resolve="(id) => pendingId = id" />

    <div class="mt-4">
      <PaginationControls :page="currentPage" :total-pages="totalPages" @change="goToPage" />
    </div>

    <ConfirmActionDialog
      :open="pendingId !== null"
      title="Résoudre l'alerte"
      message="Marquer cette alerte comme résolue."
      confirm-label="Résoudre"
      :require-reason="true"
      @confirm="confirmResolve"
      @cancel="pendingId = null"
    />
  </div>
</template>
