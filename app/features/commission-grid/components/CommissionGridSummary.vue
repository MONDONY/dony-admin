<script setup lang="ts">
import { computed } from 'vue'
import { COMMISSION_CURRENCIES } from '@/features/commission-grid/types/index'
import type { CommissionGrid } from '@/features/commission-grid/types/index'
import { formatAmount, formatPercent, tierRangeLabel } from '@/features/commission-grid/utils/grid'

/** Lecture seule d'une grille : tranches marginales puis minimum par devise. */
const props = defineProps<{ grid: CommissionGrid }>()

const minimums = computed(() =>
  COMMISSION_CURRENCIES
    .filter(c => props.grid.minimums?.[c] !== undefined && props.grid.minimums?.[c] !== null)
    .map(c => ({ currency: c, label: formatAmount(props.grid.minimums[c], c) })),
)
</script>

<template>
  <div class="grid gap-4 sm:grid-cols-2">
    <div>
      <p class="mb-1 text-xs font-medium text-text-muted">Tranches (taux marginal)</p>
      <table class="w-full text-sm" data-test="grid-summary-tiers">
        <tbody>
          <tr v-for="(t, i) in grid.tiers" :key="i" class="border-b border-border last:border-0">
            <td class="py-1.5 pr-3 tabular-nums">{{ tierRangeLabel(grid, i) }}</td>
            <td class="py-1.5 text-right font-medium tabular-nums">{{ formatPercent(t.rate) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div>
      <p class="mb-1 text-xs font-medium text-text-muted">Commission minimum</p>
      <ul class="flex flex-wrap gap-1.5" data-test="grid-summary-minimums">
        <li
          v-for="m in minimums" :key="m.currency"
          class="rounded-btn border border-border bg-bg px-2 py-1 text-xs tabular-nums"
        >{{ m.label }}</li>
      </ul>
    </div>
  </div>
</template>
