<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AlertsTable from '@/features/alerts/components/AlertsTable.vue'
import AlertDetailPanel from '@/features/alerts/components/AlertDetailPanel.vue'
import PaginationControls from '@/components/ui/PaginationControls.vue'
import ConfirmActionDialog from '@/components/ui/ConfirmActionDialog.vue'
import { useAlerts } from '@/features/alerts/composables/useAlerts'
import { alertGuide } from '@/features/alerts/lib/alertCatalog'
import type { AdminAlert, AlertSeverity, ResolvedFilter } from '@/features/alerts/types/index'

definePageMeta({ middleware: 'admin-only', permission: 'ALERT_VIEW', pageTitle: 'Alertes', pageSubtitle: 'Alertes opérationnelles' })

const { alerts, isLoading, totalPages, currentPage, filters, fetchAlerts, goToPage, setResolvedFilter, setSeverityFilter, resolve, markResolvedLocally } = useAlerts()
const pendingId = ref<string | null>(null)
const selected = ref<AdminAlert | null>(null)

const tabs: { value: ResolvedFilter; label: string }[] = [
  { value: 'OPEN', label: 'Ouvertes' },
  { value: 'RESOLVED', label: 'Résolues' },
  { value: 'ALL', label: 'Toutes' },
]

const severities: { value: AlertSeverity | null; label: string }[] = [
  { value: null, label: 'Toutes sévérités' },
  { value: 'CRITICAL', label: 'Critique' },
  { value: 'WARN', label: 'Attention' },
  { value: 'INFO', label: 'Info' },
]

const pendingTitle = () => {
  const a = alerts.value.find(x => x.id === pendingId.value) ?? selected.value
  return a ? alertGuide(a.type).title : ''
}

async function confirmResolve(note: string) {
  if (pendingId.value) {
    const id = pendingId.value
    await resolve(id, note)
    if (selected.value?.id === id) selected.value = null
  }
  pendingId.value = null
}

/** Résolution automatique par la resynchronisation Stripe : liste et fiche ouverte à jour. */
function onAutoResolved(ids: string[]) {
  const at = new Date().toISOString()
  markResolvedLocally(ids, at)
  if (selected.value && ids.includes(selected.value.id) && !selected.value.resolved) {
    selected.value = { ...selected.value, resolved: true, resolvedAt: at }
  }
}

/** Versement forcé : le back a pu résoudre d'autres alertes du paiement, on recharge. */
async function onChanged() {
  await fetchAlerts()
  const fresh = alerts.value.find(a => a.id === selected.value?.id)
  if (fresh) selected.value = fresh
}

onMounted(fetchAlerts)
</script>

<template>
  <div>
    <div class="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4">
      <div class="flex gap-1">
        <button
          v-for="t in tabs" :key="t.value" type="button" :data-test="`tab-${t.value}`"
          :class="['rounded-full px-3 py-1.5 text-sm transition-colors',
            filters.resolved === t.value ? 'bg-primary text-white' : 'bg-surface-elevated text-text-muted hover:text-text']"
          @click="setResolvedFilter(t.value)"
        >{{ t.label }}</button>
      </div>
      <div class="flex gap-1">
        <button
          v-for="s in severities" :key="s.label" type="button" :data-test="`severity-${s.value ?? 'ALL'}`"
          :class="['rounded-full px-3 py-1.5 text-sm transition-colors',
            filters.severity === s.value ? 'bg-primary/15 text-primary font-medium' : 'bg-surface-elevated text-text-muted hover:text-text']"
          @click="setSeverityFilter(s.value)"
        >{{ s.label }}</button>
      </div>
    </div>
    <p class="mb-4 text-sm text-text-muted text-pretty">
      Cliquez sur une alerte pour voir ce qui s’est passé, les étapes à suivre et les liens vers le paiement, le colis ou l’utilisateur concerné.
    </p>

    <AlertsTable :alerts="alerts" :loading="isLoading" @resolve="(id) => pendingId = id" @open="(a) => selected = a" />

    <div class="mt-4">
      <PaginationControls :page="currentPage" :total-pages="totalPages" @change="goToPage" />
    </div>

    <AlertDetailPanel
      :alert="selected" @close="selected = null" @resolve="(id) => pendingId = id"
      @auto-resolved="onAutoResolved" @changed="onChanged"
    />

    <ConfirmActionDialog
      :open="pendingId !== null"
      title="Résoudre l'alerte"
      :message="`Marquer « ${pendingTitle()} » comme résolue. Indiquez ce qui a été fait (visible dans l’Audit).`"
      confirm-label="Résoudre"
      :require-reason="true"
      @confirm="confirmResolve"
      @cancel="pendingId = null"
    />
  </div>
</template>
