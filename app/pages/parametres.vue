<script setup lang="ts">
import { onMounted } from 'vue'
import SettingsForm from '@/features/settings/components/SettingsForm.vue'
import { usePlatformSettings } from '@/features/settings/composables/usePlatformSettings'
import ExchangeRatesTable from '@/features/exchange-rates/components/ExchangeRatesTable.vue'
import { useExchangeRates } from '@/features/exchange-rates/composables/useExchangeRates'

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
} = useExchangeRates()

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
      <h2 class="font-display text-base font-semibold mb-3">Taux de change</h2>
      <p
        v-if="ratesError" data-test="rates-error"
        class="mb-3 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
      >{{ ratesError }}</p>

      <p v-if="ratesLoading" class="text-sm text-text-muted">Chargement…</p>
      <ExchangeRatesTable v-else :rates="rates" :busy="ratesBusy" @update="updateRate" />
    </div>
  </div>
</template>
