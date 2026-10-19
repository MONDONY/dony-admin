<script setup lang="ts">
import { ref } from 'vue'
import { ChevronDown } from 'lucide-vue-next'
import PaginationControls from '@/components/ui/PaginationControls.vue'
import CommissionGridSummary from './CommissionGridSummary.vue'
import { GRID_STATE_LABELS } from '@/features/commission-grid/types/index'
import type { CommissionGrid, GridState } from '@/features/commission-grid/types/index'
import { gridState } from '@/features/commission-grid/utils/grid'
import { formatParis } from '@/features/commission-grid/utils/parisTime'
import { useAuthStore } from '@/stores/auth'

/** Onglet « Historique » : toutes les grilles, annulées comprises, la plus récente d'abord. */
defineProps<{
  items: CommissionGrid[]
  currentId: string | null
  page: number
  totalPages: number
  loading?: boolean
}>()
const emit = defineEmits<{ page: [page: number] }>()

const auth = useAuthStore()
const openId = ref<string | null>(null)
const toggle = (id: string) => { openId.value = openId.value === id ? null : id }

const STATE_CLASS: Record<GridState, string> = {
  current: 'bg-success/15 text-success',
  scheduled: 'bg-primary/15 text-primary',
  past: 'bg-surface-elevated text-text-muted',
  cancelled: 'bg-danger/10 text-danger',
}

/** Le back ne sert que l'identifiant de l'auteur : « Vous » pour soi, sinon l'identifiant abrégé. */
function author(id: string | null | undefined): string {
  if (!id) return 'Inconnu'
  if (auth.user?.id === id) return 'Vous'
  return `Admin ${id.slice(0, 8)}`
}
</script>

<template>
  <div>
    <p v-if="loading && !items.length" class="text-sm text-text-muted">Chargement…</p>
    <p
      v-else-if="!items.length" data-test="history-empty"
      class="rounded-card border border-border bg-surface px-4 py-6 text-center text-sm text-text-muted"
    >Aucune grille programmée pour l’instant.</p>
    <ul v-else class="divide-y divide-border rounded-card border border-border bg-surface" data-test="history-list">
      <li v-for="g in items" :key="g.id" :data-test="`history-row-${g.id}`">
        <button
          type="button" class="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left transition-colors hover:bg-surface-elevated"
          :aria-expanded="openId === g.id" :data-test="`history-toggle-${g.id}`" @click="toggle(g.id)"
        >
          <span class="text-sm font-medium tabular-nums">{{ formatParis(g.effectiveFrom) }}</span>
          <span
            class="rounded-full px-2 py-0.5 text-xs font-medium" :class="STATE_CLASS[gridState(g, currentId)]"
            :data-test="`history-state-${g.id}`"
          >{{ GRID_STATE_LABELS[gridState(g, currentId)] }}</span>
          <span class="text-xs text-text-muted" :title="g.createdBy ?? undefined">{{ author(g.createdBy) }}</span>
          <span class="min-w-0 flex-1 truncate text-xs text-text-muted">{{ g.note ?? '' }}</span>
          <ChevronDown class="h-4 w-4 shrink-0 text-text-muted transition-transform" :class="openId === g.id ? 'rotate-180' : ''" />
        </button>
        <div v-if="openId === g.id" class="space-y-3 px-4 pb-4" :data-test="`history-detail-${g.id}`">
          <p v-if="g.note" class="text-sm text-pretty">{{ g.note }}</p>
          <p class="text-xs text-text-muted">
            Programmée le {{ formatParis(g.createdAt) }}<template v-if="g.cancelledAt">, annulée le {{ formatParis(g.cancelledAt) }}</template>.
          </p>
          <CommissionGridSummary :grid="g" />
        </div>
      </li>
    </ul>
    <div v-if="totalPages > 1" class="mt-4">
      <PaginationControls :page="page" :total-pages="totalPages" @change="(p: number) => emit('page', p)" />
    </div>
  </div>
</template>
