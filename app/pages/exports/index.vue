<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useExports } from '@/features/exports/composables/useExports'
import { EXPORT_TYPES } from '@/features/exports/types/index'

definePageMeta({ middleware: 'admin-only', pageTitle: 'Exports', pageSubtitle: 'Exports CSV pour conformité et comptabilité' })

const { isLoading, error, filters, run } = useExports()

// Le bouton reste désactivé tant que la page n'est pas hydratée côté client :
// évite tout clic « perdu » avant l'attachement des handlers (SSR).
const ready = ref(false)
onMounted(() => { ready.value = true })
</script>

<template>
  <div class="max-w-xl">
    <form class="rounded-card border border-border bg-surface p-6 flex flex-col gap-4" @submit.prevent="run">
      <label class="text-sm text-text-muted">Type d'export
        <select v-model="filters.type" data-test="export-type" class="mt-1 w-full rounded-btn border border-border bg-bg p-2 text-sm">
          <option v-for="t in EXPORT_TYPES" :key="t.value" :value="t.value">{{ t.label }}</option>
        </select>
      </label>

      <div class="flex gap-3">
        <label class="text-sm text-text-muted flex-1">Du
          <input v-model="filters.from" data-test="export-from" type="date" class="mt-1 w-full rounded-btn border border-border bg-bg p-2 text-sm">
        </label>
        <label class="text-sm text-text-muted flex-1">Au
          <input v-model="filters.to" data-test="export-to" type="date" class="mt-1 w-full rounded-btn border border-border bg-bg p-2 text-sm">
        </label>
      </div>

      <p class="text-xs text-text-muted">
        Laisse les dates vides pour exporter l'intégralité de la période.
      </p>

      <p v-if="error" data-test="export-error" class="text-sm text-danger">{{ error }}</p>

      <button
        type="submit" data-test="export-run" :disabled="isLoading || !ready"
        class="self-start rounded-btn px-4 py-2 text-sm bg-primary text-white disabled:opacity-40 hover:bg-primary/90"
      >{{ isLoading ? 'Génération…' : 'Exporter en CSV' }}</button>
    </form>
  </div>
</template>
