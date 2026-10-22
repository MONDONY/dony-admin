<script setup lang="ts">
import { computed, onMounted } from 'vue'
import OverviewKpiCard from './OverviewKpiCard.vue'
import OverviewQueueCard from './OverviewQueueCard.vue'
import OverviewVolumesTable from './OverviewVolumesTable.vue'
import { useOverview } from '@/features/overview/composables/useOverview'
import { pendingTotal, sortQueues } from '@/features/overview/lib/sortQueues'

const { kpis, volumes, queues, isLoading, error, fetchOverview } = useOverview()
onMounted(fetchOverview)

// À traiter en premier : c'est ce pour quoi on ouvre l'admin. Les files vides restent
// affichées (grisées) pour qu'on voie aussi que tout est à jour.
const sortedQueues = computed(() => sortQueues(queues.value))
const pending = computed(() => pendingTotal(queues.value))
</script>

<template>
  <div class="space-y-8">
    <p v-if="error" class="text-danger text-sm">{{ error }}</p>
    <template v-else>
      <section>
        <div class="mb-4 flex items-baseline justify-between gap-3">
          <h2 class="text-sm font-semibold text-text-muted uppercase tracking-wider">À traiter</h2>
          <p v-if="!isLoading && queues.length" data-test="queues-summary" class="text-sm text-text-muted tabular-nums">
            <template v-if="pending > 0">{{ pending }} en attente</template>
            <template v-else>Rien en attente, tout est à jour</template>
          </p>
        </div>
        <div v-if="isLoading" class="text-sm text-text-muted">Chargement…</div>
        <div v-else class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          <OverviewQueueCard v-for="q in sortedQueues" :key="q.id" :data-test="`queue-${q.id}`" :card="q" />
        </div>
      </section>
      <section>
        <h2 class="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">Indicateurs</h2>
        <div v-if="isLoading" class="text-sm text-text-muted">Chargement…</div>
        <div v-else class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <OverviewKpiCard v-for="k in kpis" :key="k.id" :data-test="`kpi-${k.id}`" v-bind="k" />
        </div>
      </section>
      <section>
        <h2 class="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">Volumes par devise</h2>
        <OverviewVolumesTable v-if="!isLoading" :rows="volumes" />
      </section>
    </template>
  </div>
</template>
