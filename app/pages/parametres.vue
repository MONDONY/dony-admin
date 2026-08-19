<script setup lang="ts">
import { onMounted } from 'vue'
import SettingsForm from '@/features/settings/components/SettingsForm.vue'
import { usePlatformSettings } from '@/features/settings/composables/usePlatformSettings'

definePageMeta({
  middleware: 'admin-only',
  permission: 'CONFIG_MANAGE',
  pageTitle: 'Paramètres plateforme',
  pageSubtitle: 'Réglages globaux de la marketplace',
})

const { settings, isLoading, busy, error, load, update } = usePlatformSettings()

onMounted(load)
</script>

<template>
  <div>
    <p
      v-if="error" data-test="settings-error"
      class="mb-3 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
    >{{ error }}</p>

    <p v-if="isLoading" class="text-sm text-text-muted">Chargement…</p>
    <SettingsForm v-else :settings="settings" :busy="busy" @update="update" />
  </div>
</template>
