<script setup lang="ts">
import { onMounted, watch } from 'vue'
import StateBlock from '@/components/ui/StateBlock.vue'
import { useDac7List } from '@/features/dac7/composables/useDac7List'
import { dac7Service } from '@/features/dac7/services/dac7Service'
import { DAC7_UNAVAILABLE, anomalyTypeLabel, fmtDay, refundSourceLabel } from '@/features/dac7/types/index'
import type { Dac7AnomalyRow } from '@/features/dac7/types/index'
import { gate, toHref, userRoute } from '@/lib/adminLinks'
import { useAuthStore } from '@/stores/auth'

/** Lignes du calcul à vérifier à la main avant tout export. */
const props = defineProps<{ year: number }>()
const auth = useAuthStore()
const list = useDac7List<Dac7AnomalyRow>(y => dac7Service.anomalies(y), 'Impossible de charger les anomalies')

const reload = () => list.load(props.year)
onMounted(reload)
watch(() => props.year, reload)

function link(r: Dac7AnomalyRow): string | null {
  const route = gate(p => auth.can(p), 'USER_VIEW', userRoute(r.travelerId))
  return route ? toHref(route) : null
}
</script>

<template>
  <section aria-label="Anomalies" data-test="dac7-anomalies-panel" class="flex flex-col gap-3">
    <p class="text-sm text-text-muted text-pretty">
      Lignes du calcul à vérifier à la main avant de générer le fichier.
    </p>
    <p v-if="list.unavailable.value" data-test="dac7-unavailable" class="rounded-card border border-border bg-surface p-6 text-sm text-text-muted">
      {{ DAC7_UNAVAILABLE }}
    </p>
    <div v-else class="overflow-hidden rounded-card border border-border bg-surface">
      <div class="overflow-x-auto">
        <table v-if="list.items.value.length" class="w-full min-w-[720px]">
          <thead class="bg-surface-elevated text-left text-xs uppercase text-text-muted">
            <tr>
              <th class="px-4 py-2 font-medium">Anomalie</th>
              <th class="px-4 py-2 font-medium">Voyageur</th>
              <th class="px-4 py-2 font-medium">Origine</th>
              <th class="px-4 py-2 font-medium">Devise</th>
              <th class="px-4 py-2 font-medium">Jour</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in list.items.value" :key="i" data-test="dac7-anomaly-row" class="border-b border-border last:border-b-0">
              <td class="px-4 py-3 text-sm text-pretty">{{ anomalyTypeLabel(r.type) }}</td>
              <td class="px-4 py-3 text-sm">
                <span :class="r.displayName ? 'font-medium' : 'italic text-text-muted'">{{ r.displayName || 'Nom non renseigné' }}</span>
                <NuxtLink
                  v-if="link(r)" :to="link(r)!" :data-test="`dac7-anomaly-open-${r.travelerId}`"
                  class="ml-2 text-xs text-primary underline-offset-2 hover:underline"
                >Ouvrir la fiche</NuxtLink>
              </td>
              <td class="px-4 py-3 text-sm">{{ refundSourceLabel(r.source) }}</td>
              <td class="px-4 py-3 text-sm tabular-nums">{{ r.currency || '–' }}</td>
              <td class="px-4 py-3 text-sm tabular-nums text-text-muted">{{ fmtDay(r.day) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <StateBlock
        :loading="list.isLoading.value && list.items.value.length === 0" :error="list.error.value"
        :empty="!list.isLoading.value && !list.error.value && list.items.value.length === 0"
        empty-label="Aucune anomalie" empty-test="dac7-anomalies-empty" @retry="reload"
      />
    </div>
  </section>
</template>
