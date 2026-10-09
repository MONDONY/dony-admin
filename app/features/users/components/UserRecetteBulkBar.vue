<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RECETTE_BULK_MAX } from '@/features/users/composables/useRecetteBulk'

/**
 * Barre d'actions de la sélection (yadony-back#465) : passe les comptes cochés en mode recette,
 * ou les en retire, après une confirmation légère qui rappelle le nombre de comptes visés.
 * Montée par la page seulement pour un super-admin, en staging.
 */
const props = defineProps<{
  count: number
  /** Résultats du filtre courant, toutes pages confondues. */
  totalMatching: number
  busy: boolean
  selectingAll: boolean
  truncated: boolean
}>()
const emit = defineEmits<{ apply: [enabled: boolean]; clear: []; 'select-all-matching': [] }>()

/** Valeur demandée, en attente de confirmation ; null hors confirmation. */
const pending = ref<boolean | null>(null)
watch(() => props.count, (n) => { if (n === 0) pending.value = null })

const accounts = (n: number) => `${n} compte${n > 1 ? 's' : ''}`
const canSelectAll = computed(() =>
  !props.truncated && props.totalMatching > props.count && props.count < RECETTE_BULK_MAX)
const selectAllLabel = computed(() => props.totalMatching > RECETTE_BULK_MAX
  ? `Sélectionner les ${RECETTE_BULK_MAX} premiers résultats du filtre`
  : `Sélectionner les ${props.totalMatching} résultats du filtre`)
const question = computed(() => pending.value
  ? `Passer ${accounts(props.count)} en mode recette ?`
  : `Retirer ${accounts(props.count)} du mode recette ?`)

function confirm() {
  const next = pending.value
  pending.value = null
  if (next !== null) emit('apply', next)
}
</script>

<template>
  <div
    data-test="recette-bulk-bar" role="region" aria-label="Actions sur la sélection"
    class="mb-3 rounded-card bg-surface-elevated px-4 py-3 shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.06),0_4px_12px_rgba(0,0,0,0.04)]"
    :aria-busy="busy || selectingAll"
  >
    <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
      <p class="text-sm font-medium tabular-nums" data-test="recette-bulk-count">
        {{ count }} sélectionné{{ count > 1 ? 's' : '' }}
      </p>
      <button
        v-if="canSelectAll" type="button" data-test="recette-select-all"
        class="text-sm text-primary underline-offset-2 hover:underline disabled:opacity-60"
        :disabled="selectingAll || busy" @click="emit('select-all-matching')"
      >{{ selectingAll ? 'Sélection…' : selectAllLabel }}</button>
      <p v-if="truncated" data-test="recette-truncated" class="text-xs text-text-muted text-pretty">
        Limité aux {{ RECETTE_BULK_MAX }} premiers résultats : affinez le filtre pour le reste.
      </p>

      <div v-if="pending === null" class="ml-auto flex flex-wrap items-center gap-2">
        <button
          type="button" data-test="recette-bulk-clear"
          class="rounded-btn px-3 py-1.5 text-sm text-text-muted transition-[background-color,scale] hover:bg-surface active:scale-[0.96]"
          :disabled="busy" @click="emit('clear')"
        >Désélectionner</button>
        <button
          type="button" data-test="recette-bulk-disable"
          class="rounded-btn border border-border px-3 py-1.5 text-sm transition-[background-color,scale] hover:bg-surface active:scale-[0.96] disabled:opacity-60"
          :disabled="busy || selectingAll" @click="pending = false"
        >Désactiver le mode recette</button>
        <button
          type="button" data-test="recette-bulk-enable"
          class="rounded-btn bg-primary px-3 py-1.5 text-sm text-white transition-[background-color,scale] hover:bg-primary/90 active:scale-[0.96] disabled:opacity-60"
          :disabled="busy || selectingAll" @click="pending = true"
        >{{ busy ? 'Enregistrement…' : 'Activer le mode recette' }}</button>
      </div>

      <div v-else data-test="recette-bulk-confirm" class="ml-auto flex flex-wrap items-center gap-2">
        <p class="text-sm text-pretty">{{ question }}</p>
        <button
          type="button" data-test="recette-bulk-cancel"
          class="rounded-btn border border-border px-3 py-1.5 text-sm transition-[background-color,scale] hover:bg-surface active:scale-[0.96]"
          @click="pending = null"
        >Annuler</button>
        <button
          type="button" data-test="recette-bulk-confirm-button"
          class="rounded-btn bg-primary px-3 py-1.5 text-sm text-white transition-[background-color,scale] hover:bg-primary/90 active:scale-[0.96]"
          @click="confirm"
        >{{ pending ? 'Activer' : 'Désactiver' }}</button>
      </div>
    </div>
  </div>
</template>
