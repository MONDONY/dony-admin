<script setup lang="ts">
import { onMounted } from 'vue'
import OverviewKpiCard from './OverviewKpiCard.vue'
import OverviewQueueCard from './OverviewQueueCard.vue'
import { useOverview } from '@/features/overview/composables/useOverview'

const { kpis, queues, isLoading, error, fetchOverview } = useOverview()
onMounted(fetchOverview)
</script>

<template>
  <div class="space-y-8">
    <p v-if="error" class="text-danger text-sm">{{ error }}</p>
    <template v-else>
      <section>
        <h2 class="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">Indicateurs</h2>
        <div v-if="isLoading" class="text-sm text-text-muted">Chargement…</div>
        <div v-else class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <OverviewKpiCard v-for="k in kpis" :key="k.id" :data-test="`kpi-${k.id}`" v-bind="k" />
        </div>
      </section>
      <section>
        <h2 class="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">Files d'action</h2>
        <div class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          <OverviewQueueCard v-for="q in queues" :key="q.id" :data-test="`queue-${q.id}`" :card="q" />
        </div>
      </section>
    </template>
  </div>
</template>
