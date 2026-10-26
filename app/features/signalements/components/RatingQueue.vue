<script setup lang="ts">
import StateBlock from '@/components/ui/StateBlock.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { reportAge } from '@/features/signalements/reportWorkbench'
import type { AdminRating } from '@/features/signalements/types/index'

const props = withDefaults(defineProps<{
  ratings: AdminRating[]
  loading: boolean
  /** Avis ouvert dans le dossier. */
  selectedId?: string | null
  /** Horloge injectable (tests) pour l'ancienneté. */
  now?: number
}>(), { selectedId: null, now: undefined })
const emit = defineEmits<{ select: [id: string] }>()

function stars(n: number) { return '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n)) }
function age(r: AdminRating) { return reportAge(r.createdAt, props.now).label }
</script>

<template>
  <div class="flex min-h-0 flex-col">
    <ul v-if="ratings.length" class="flex flex-col gap-0.5 overflow-y-auto p-1.5" data-test="rating-queue">
      <li v-for="r in ratings" :key="r.id" :data-test="`rating-row-${r.id}`" :data-selected="selectedId === r.id ? 'true' : undefined">
        <button
          type="button" :data-test="`rating-open-${r.id}`"
          :aria-current="selectedId === r.id ? 'true' : undefined"
          :class="['w-full rounded-btn border px-3 py-2.5 text-left transition-[background-color,border-color,scale] active:scale-[0.99]',
            selectedId === r.id ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-surface-elevated',
            r.deletedAt ? 'text-text-muted' : '']"
          @click="emit('select', r.id)"
        >
          <span class="flex items-baseline justify-between gap-2">
            <span class="text-sm tabular-nums text-warning" :aria-label="`${r.score} étoile${r.score > 1 ? 's' : ''} sur 5`" role="img">{{ stars(r.score) }}</span>
            <span class="shrink-0 text-xs text-text-muted tabular-nums">{{ age(r) }}</span>
          </span>
          <span :class="['mt-1 line-clamp-2 block text-sm text-pretty', r.excluded ? 'text-text-muted line-through' : '']">{{ r.comment ?? 'Sans commentaire' }}</span>
          <span class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted">
            <span class="truncate">{{ r.raterName ?? 'Anonyme' }} → {{ r.ratedName ?? 'Compte supprimé' }}</span>
            <span v-if="r.flagged" :data-test="`flagged-${r.id}`"><StatusBadge label="Signalé" tone="danger" /></span>
            <StatusBadge v-if="r.excluded && !r.deletedAt" label="Exclu" tone="warning" />
            <StatusBadge v-if="r.deletedAt" label="Supprimé" tone="neutral" />
          </span>
        </button>
      </li>
    </ul>

    <StateBlock :loading="loading" :empty="ratings.length === 0" empty-label="Aucun avis" />
  </div>
</template>
