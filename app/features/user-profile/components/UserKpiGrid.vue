<script setup lang="ts">
import { computed } from 'vue'
import { formatAmount } from '@/features/finance/types/index'
import type { UserOverviewKpis } from '@/features/user-profile/types/index'

const props = defineProps<{ kpis: UserOverviewKpis }>()

/** Un champ null = permission absente : la carte n'existe pas (jamais 0). */
const rating = computed(() => props.kpis.averageRating === null
  ? null
  : props.kpis.averageRating.toFixed(1).replace('.', ','))
</script>

<template>
  <div class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
    <div v-if="kpis.parcelsInProgress !== null" data-test="kpi-parcels" class="flex min-w-0 flex-col gap-1 rounded-card border border-border bg-surface p-4">
      <span class="text-xs font-semibold text-text-muted">Colis en cours</span>
      <span class="text-2xl font-bold tabular-nums">{{ kpis.parcelsInProgress }}</span>
    </div>
    <div v-if="kpis.activeTrips !== null" data-test="kpi-trips" class="flex min-w-0 flex-col gap-1 rounded-card border border-border bg-surface p-4">
      <span class="text-xs font-semibold text-text-muted">Trajets actifs</span>
      <span class="text-2xl font-bold tabular-nums">{{ kpis.activeTrips }}</span>
    </div>
    <div v-if="kpis.heldByCurrency !== null" data-test="kpi-held" class="flex min-w-0 flex-col gap-1 rounded-card border border-border bg-surface p-4">
      <span class="text-xs font-semibold text-text-muted">Argent retenu</span>
      <span v-if="kpis.heldByCurrency.length === 0" class="text-2xl font-bold tabular-nums">Aucun</span>
      <span
        v-for="m in kpis.heldByCurrency" :key="m.currency" data-test="kpi-held-line"
        class="text-lg font-bold tabular-nums"
      >{{ formatAmount(m.amountCents, m.currency) }}</span>
    </div>
    <div v-if="kpis.openDisputes !== null" data-test="kpi-disputes" class="flex min-w-0 flex-col gap-1 rounded-card border border-border bg-surface p-4">
      <span class="text-xs font-semibold text-text-muted">Litiges ouverts</span>
      <span class="text-2xl font-bold tabular-nums">{{ kpis.openDisputes }}</span>
      <span v-if="kpis.totalDisputes !== null" class="text-xs text-text-muted tabular-nums">sur {{ kpis.totalDisputes }} au total</span>
    </div>
    <div v-if="kpis.reportsReceived !== null" data-test="kpi-reports" class="flex min-w-0 flex-col gap-1 rounded-card border border-border bg-surface p-4">
      <span class="text-xs font-semibold text-text-muted">Signalements reçus</span>
      <span class="text-2xl font-bold tabular-nums">{{ kpis.reportsReceived }}</span>
      <span v-if="kpis.reportsPending !== null && kpis.reportsPending > 0" class="text-xs text-text-muted tabular-nums">{{ kpis.reportsPending }} en attente</span>
    </div>
    <div v-if="rating !== null" data-test="kpi-rating" class="flex min-w-0 flex-col gap-1 rounded-card border border-border bg-surface p-4">
      <span class="text-xs font-semibold text-text-muted">Note moyenne</span>
      <span class="text-2xl font-bold tabular-nums">{{ rating }} / 5</span>
      <span v-if="kpis.ratingCount !== null" class="text-xs text-text-muted tabular-nums">{{ kpis.ratingCount }} avis</span>
    </div>
  </div>
</template>
