<script setup lang="ts">
import { onMounted, watch } from 'vue'
import StateBlock from '@/components/ui/StateBlock.vue'
import { useDac7List } from '@/features/dac7/composables/useDac7List'
import { dac7Service } from '@/features/dac7/services/dac7Service'
import { DAC7_UNAVAILABLE, NOT_AVAILABLE, eurLabel, fmtDay, refundSourceLabel } from '@/features/dac7/types/index'
import type { Dac7RefundRow } from '@/features/dac7/types/index'
import { gate, toHref, userRoute } from '@/lib/adminLinks'
import { useAuthStore } from '@/stores/auth'

/**
 * Remboursements à l'expéditeur liés à une opération versée au voyageur. Le système ne les
 * déduit jamais : l'équipe les réconcilie à la main (rectification éventuelle d'une autre année).
 */
const props = defineProps<{ year: number }>()
const auth = useAuthStore()
const list = useDac7List<Dac7RefundRow>(y => dac7Service.refunds(y), 'Impossible de charger les remboursements')

const reload = () => list.load(props.year)
onMounted(reload)
watch(() => props.year, reload)

function link(r: Dac7RefundRow): string | null {
  const route = gate(p => auth.can(p), 'USER_VIEW', userRoute(r.travelerId))
  return route ? toHref(route) : null
}
</script>

<template>
  <section aria-label="Remboursements à réconcilier" data-test="dac7-refunds-panel" class="flex flex-col gap-3">
    <p class="text-sm text-text-muted text-pretty">
      Remboursements à l’expéditeur sur des opérations déjà versées au voyageur. Ils ne sont jamais déduits
      automatiquement : à réconcilier à la main.
    </p>
    <p v-if="list.unavailable.value" data-test="dac7-unavailable" class="rounded-card border border-border bg-surface p-6 text-sm text-text-muted">
      {{ DAC7_UNAVAILABLE }}
    </p>
    <div v-else class="overflow-hidden rounded-card border border-border bg-surface">
      <div class="overflow-x-auto">
        <table v-if="list.items.value.length" class="w-full min-w-[820px]">
          <thead class="bg-surface-elevated text-left text-xs uppercase text-text-muted">
            <tr>
              <th class="px-4 py-2 font-medium">Voyageur</th>
              <th class="px-4 py-2 font-medium">Origine</th>
              <th class="px-4 py-2 text-right font-medium">Montant</th>
              <th class="px-4 py-2 text-right font-medium">En euros</th>
              <th class="px-4 py-2 font-medium">Opération</th>
              <th class="px-4 py-2 font-medium">Remboursement</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in list.items.value" :key="i" data-test="dac7-refund-row" class="border-b border-border last:border-b-0">
              <td class="px-4 py-3 text-sm">
                <span :class="r.displayName ? 'font-medium' : 'italic text-text-muted'">{{ r.displayName || 'Nom non renseigné' }}</span>
                <NuxtLink
                  v-if="link(r)" :to="link(r)!" :data-test="`dac7-refund-open-${r.travelerId}`"
                  class="ml-2 text-xs text-primary underline-offset-2 hover:underline"
                >Ouvrir la fiche</NuxtLink>
              </td>
              <td class="px-4 py-3 text-sm">{{ refundSourceLabel(r.source) }}</td>
              <td class="px-4 py-3 text-right text-sm tabular-nums">{{ r.amount ?? NOT_AVAILABLE }} {{ r.currency }}</td>
              <td class="px-4 py-3 text-right text-sm tabular-nums">{{ eurLabel(r.amountEur) }}</td>
              <td class="px-4 py-3 text-sm tabular-nums text-text-muted">{{ fmtDay(r.operationPaidAt) }}<span v-if="r.operationYear"> ({{ r.operationYear }})</span></td>
              <td class="px-4 py-3 text-sm tabular-nums text-text-muted">
                {{ fmtDay(r.refundedAt) }}<span v-if="r.refundYear"> ({{ r.refundYear }})</span>
                <span v-if="r.beforeRelease" class="block text-xs text-warning">Avant le versement</span>
                <span v-if="r.refundDateEstimated" class="block text-xs text-warning">Date estimée</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <StateBlock
        :loading="list.isLoading.value && list.items.value.length === 0" :error="list.error.value"
        :empty="!list.isLoading.value && !list.error.value && list.items.value.length === 0"
        empty-label="Aucun remboursement à réconcilier" empty-test="dac7-refunds-empty" @retry="reload"
      />
    </div>
  </section>
</template>
