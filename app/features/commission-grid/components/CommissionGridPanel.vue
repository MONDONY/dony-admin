<script setup lang="ts">
import { computed, ref } from 'vue'
import ConfirmActionDialog from '@/components/ui/ConfirmActionDialog.vue'
import CommissionGridSummary from './CommissionGridSummary.vue'
import CommissionGridEditor from './CommissionGridEditor.vue'
import type { CommissionGrid } from '@/features/commission-grid/types/index'
import { formatPercent } from '@/features/commission-grid/utils/grid'
import { formatParis } from '@/features/commission-grid/utils/parisTime'

/**
 * Onglet « Grille » : grille en vigueur (lecture seule), grille programmée (annulable) et
 * préparation d'une nouvelle grille. `flatRate` : taux unique du réglage `commission_rate`
 * (fraction), appliqué tant qu'aucune grille n'est en vigueur.
 */
const props = defineProps<{
  current: CommissionGrid | null
  scheduled: CommissionGrid | null
  flatRate?: string | null
  cancelling?: boolean
}>()
const emit = defineEmits<{ cancel: [id: string]; scheduled: [grid: CommissionGrid] }>()

const editing = ref(false)
const confirmCancel = ref(false)

const flatLabel = computed(() => {
  const p = formatPercent(props.flatRate)
  return p ? `taux unique de ${p}` : 'taux unique'
})

function onScheduled(grid: CommissionGrid) {
  editing.value = false
  emit('scheduled', grid)
}
function doCancel() {
  confirmCancel.value = false
  if (props.scheduled) emit('cancel', props.scheduled.id)
}
</script>

<template>
  <div class="space-y-4">
    <section class="rounded-card border border-border bg-surface p-4" data-test="grid-current">
      <template v-if="current">
        <p class="mb-3 text-sm font-semibold">En vigueur depuis le {{ formatParis(current.effectiveFrom) }}</p>
        <CommissionGridSummary :grid="current" />
      </template>
      <p v-else class="text-sm text-text-muted text-pretty" data-test="grid-current-empty">
        Aucune grille : {{ flatLabel }} (réglage Paramètres).
      </p>
    </section>

    <section v-if="scheduled" class="rounded-card border border-primary/40 bg-surface p-4" data-test="grid-scheduled">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p class="text-sm font-semibold">Programmée pour le {{ formatParis(scheduled.effectiveFrom) }}</p>
        <button
          type="button" data-test="grid-scheduled-cancel" :disabled="cancelling"
          class="rounded-btn border border-danger/40 px-3 py-1.5 text-sm text-danger transition-colors hover:bg-danger/10 active:scale-[0.97] disabled:opacity-40"
          @click="confirmCancel = true"
        >{{ cancelling ? 'Annulation…' : 'Annuler la programmation' }}</button>
      </div>
      <CommissionGridSummary :grid="scheduled" />
    </section>

    <CommissionGridEditor
      v-if="editing" :initial="current" :has-scheduled="!!scheduled"
      @scheduled="onScheduled" @close="editing = false"
    />
    <button
      v-else type="button" data-test="grid-prepare"
      class="rounded-btn bg-primary px-4 py-2 text-sm text-white transition-colors hover:bg-primary/90 active:scale-[0.97]"
      @click="editing = true"
    >Préparer une nouvelle grille</button>

    <ConfirmActionDialog
      :open="confirmCancel"
      title="Annuler la grille programmée"
      :message="scheduled
        ? `La grille prévue le ${formatParis(scheduled.effectiveFrom)} ne prendra pas effet. La grille en vigueur reste appliquée.`
        : ''"
      confirm-label="Confirmer l’annulation"
      @confirm="doCancel"
      @cancel="confirmCancel = false"
    />
  </div>
</template>
