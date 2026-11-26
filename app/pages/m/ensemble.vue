<script setup lang="ts">
import { onMounted } from 'vue'
import PeriodChips from '@/features/mobile/components/PeriodChips.vue'
import { useMobileOverview } from '@/features/mobile/composables/useMobileOverview'
import { formatCount } from '@/features/mobile/lib/mobileOverview'

definePageMeta({ layout: 'mobile', middleware: 'admin-only', permission: 'METRICS_VIEW', pageTitle: 'Vue d’ensemble' })

const { period, tiles, queueRows, hasPeriod, canOpenAlerts, data, isLoading, error, load, selectPeriod } = useMobileOverview()

onMounted(load)
</script>

<template>
  <div class="space-y-4">
    <PeriodChips v-if="hasPeriod || !data" :model-value="period" @update:model-value="selectPeriod" />
    <p v-else data-test="period-hint" class="text-sm text-text-muted">Données de période indisponibles</p>

    <p v-if="error" data-test="overview-error" class="text-sm text-danger" role="alert">{{ error }}</p>
    <p v-else-if="isLoading && !data" class="text-sm text-text-muted">Chargement…</p>

    <template v-if="data">
      <ul class="grid grid-cols-2 gap-3" :class="isLoading ? 'opacity-60' : ''">
        <li v-for="t in tiles" :key="t.id">
          <component
            :is="t.id === 'alerts' && canOpenAlerts ? 'NuxtLink' : 'div'"
            :to="t.id === 'alerts' && canOpenAlerts ? '/m/alertes' : undefined"
            :data-test="`tile-${t.id}`"
            class="block min-h-[88px] rounded-xl border border-border bg-surface px-3 py-3"
          >
            <span
              data-test="tile-value" class="block text-3xl font-bold tabular-nums"
              :class="t.id === 'alerts' && t.value > 0 ? 'text-danger' : 'text-text'"
              style="font-variant-numeric: tabular-nums"
            >{{ formatCount(t.value) }}</span>
            <span class="mt-1 block truncate text-sm text-text-muted">{{ t.label }}</span>
          </component>
        </li>
      </ul>

      <section aria-labelledby="a-traiter" class="rounded-xl border border-border bg-surface px-3">
        <h2 id="a-traiter" class="pt-3 text-sm font-bold text-text">À traiter</h2>
        <ul class="divide-y divide-border">
          <li v-for="r in queueRows" :key="r.id" data-test="queue-row" class="flex min-h-[44px] items-center justify-between gap-3 py-2">
            <span class="whitespace-nowrap text-sm text-text">{{ r.label }}</span>
            <span class="text-base font-bold tabular-nums text-text" style="font-variant-numeric: tabular-nums">{{ formatCount(r.value) }}</span>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
