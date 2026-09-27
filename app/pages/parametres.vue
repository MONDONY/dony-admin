<script setup lang="ts">
import { onMounted } from 'vue'
import SettingsForm from '@/features/settings/components/SettingsForm.vue'
import { usePlatformSettings } from '@/features/settings/composables/usePlatformSettings'
import ExchangeRatesTable from '@/features/exchange-rates/components/ExchangeRatesTable.vue'
import { useExchangeRates } from '@/features/exchange-rates/composables/useExchangeRates'
import { useAuthStore } from '@/stores/auth'

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

onMounted(() => {
  load()
  loadRates()
})
</script>

<template>
  <div class="space-y-8">
    <div>
      <p
        v-if="error" data-test="settings-error"
        class="mb-3 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
      >{{ error }}</p>

      <p v-if="isLoading" class="text-sm text-text-muted">Chargement…</p>
      <SettingsForm v-else :settings="settings" :busy="busy" @update="update" />
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
