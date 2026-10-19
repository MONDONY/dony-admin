<script setup lang="ts">
import { onMounted, ref } from 'vue'
import SettingsForm from '@/features/settings/components/SettingsForm.vue'
import { usePlatformSettings } from '@/features/settings/composables/usePlatformSettings'
import ExchangeRatesTable from '@/features/exchange-rates/components/ExchangeRatesTable.vue'
import { useExchangeRates } from '@/features/exchange-rates/composables/useExchangeRates'
import PhotoStorageCard from '@/features/photo-storage/components/PhotoStorageCard.vue'
import MaintenanceCard from '@/features/maintenance/components/MaintenanceCard.vue'
import { useAuthStore } from '@/stores/auth'
import { commissionGridService } from '@/features/commission-grid/services/commissionGridService'

definePageMeta({
  middleware: 'admin-only',
  permission: 'CONFIG_MANAGE',
  pageTitle: 'Paramètres plateforme',
  pageSubtitle: 'Réglages globaux de la marketplace',
})

const { settings, isLoading, busy, error, load, update } = usePlatformSettings()
const {
  rates, isLoading: ratesLoading, busy: ratesBusy, error: ratesError,
  load: loadRates, update: updateRate,
  syncing: ratesSyncing, syncMessage: ratesSyncMessage, sync: syncRates,
} = useExchangeRates()
const auth = useAuthStore()

// La carte Stockage photos garde son propre statut : on la recharge dès que la purge change
// d'état ici, sinon elle afficherait « À blanc » alors que la suppression réelle est active.
const photoCard = ref<{ refresh: () => Promise<void> } | null>(null)
async function onUpdate(key: string, value: string) {
  const saved = await update(key, value)
  if (saved && key === 'photo_purge_enabled') void photoCard.value?.refresh()
}

// Une grille par paliers en vigueur remplace le taux unique : la carte `commission_rate` renvoie
// alors vers l'onglet Tarification. Back sans l'endpoint ou erreur : on garde le champ.
const commissionGridActive = ref(false)
async function loadCommissionGrid() {
  try {
    commissionGridActive.value = !!(await commissionGridService.list(0, 1)).current
  } catch { commissionGridActive.value = false }
}

onMounted(() => {
  load()
  loadRates()
  void loadCommissionGrid()
})
</script>

<template>
  <div class="space-y-8">
    <MaintenanceCard />

    <div>
      <p
        v-if="error" data-test="settings-error"
        class="mb-3 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
      >{{ error }}</p>

      <p v-if="isLoading" class="text-sm text-text-muted">Chargement…</p>
      <SettingsForm v-else :settings="settings" :busy="busy" :commission-grid-active="commissionGridActive" @update="onUpdate" />
      <PhotoStorageCard ref="photoCard" class="mt-6" />
    </div>

    <div>
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 class="font-display text-base font-semibold">Taux de change</h2>
        <button
          v-if="auth.can('CONFIG_MANAGE')" type="button" data-test="rates-sync"
          :disabled="ratesSyncing || ratesLoading"
          class="rounded-btn border border-border px-3 py-1.5 text-sm transition-colors hover:bg-surface-elevated active:scale-[0.97] disabled:opacity-40"
          @click="syncRates"
        >{{ ratesSyncing ? 'Synchronisation…' : 'Synchroniser avec la BCE' }}</button>
      </div>
      <p
        v-if="ratesSyncMessage" data-test="rates-sync-result" role="status"
        class="mb-3 rounded-btn border border-success/40 bg-success/10 px-3 py-2 text-sm text-success"
      >{{ ratesSyncMessage }}</p>
      <p
        v-if="ratesError" data-test="rates-error"
        class="mb-3 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
      >{{ ratesError }}</p>

      <p v-if="ratesLoading" class="text-sm text-text-muted">Chargement…</p>
      <ExchangeRatesTable v-else :rates="rates" :busy="ratesBusy" @update="updateRate" />
    </div>
  </div>
</template>
