<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import PaginationControls from '@/components/ui/PaginationControls.vue'
import KeyHint from '@/components/ui/KeyHint.vue'
import RatingQueue from './RatingQueue.vue'
import RatingCase from './RatingCase.vue'
import RatingDecisionPanel from './RatingDecisionPanel.vue'
import { useRatings } from '@/features/signalements/composables/useRatings'
import { useRatingContext } from '@/features/signalements/composables/useRatingContext'
import { useWorkbenchShortcuts } from '@/features/signalements/composables/useWorkbenchShortcuts'
import {
  defaultRatingId,
  followingRatingId,
  neighbourRatingId,
  type RatingAction,
} from '@/features/signalements/ratingWorkbench'

/**
 * Onglet Avis : la même disposition que les signalements, file à gauche, dossier au centre,
 * décision à droite. Les données ne se chargent qu'à la première ouverture de l'onglet.
 */
const props = defineProps<{ active: boolean }>()
const emit = defineEmits<{ openReport: [id: string] }>()

const rt = useRatings()
const ctx = useRatingContext()
const selectedId = ref<string | null>(null)
const decisionPanel = ref<InstanceType<typeof RatingDecisionPanel> | null>(null)
const busy = ref(false)
/** Refus d'un geste (403, 409, 422) : montré dans le panneau, saisie conservée. */
const decisionError = ref<string | null>(null)
const doneMessage = ref('')
const restored = ref(false)

let loaded = false
watch(() => props.active, (active) => {
  if (active && !loaded) {
    loaded = true
    void rt.fetchRatings()
  }
}, { immediate: true })

const selected = computed(() => rt.ratings.value.find((r) => r.id === selectedId.value) ?? null)
const superseded = computed(() => !!selected.value && rt.supersededIds.value.includes(selected.value.id))
const hasNext = computed(() => followingRatingId(rt.ratings.value, selectedId.value) !== null)

// Un dossier est toujours ouvert quand la liste en contient un : au chargement, après un changement
// de filtre ou de page, ou quand celui qui était ouvert a disparu (avis supprimé).
watch(() => rt.ratings.value, (list) => {
  if (!list.some((r) => r.id === selectedId.value)) selectedId.value = defaultRatingId(list)
})
watch(selectedId, (id) => { void ctx.load(id) })

function scrollTo(id: string) {
  void nextTick(() => document.querySelector(`[data-test="rating-row-${CSS.escape(id)}"]`)?.scrollIntoView?.({ block: 'nearest' }))
}
/** Choix de l'admin (clic ou J / K) : le résultat du geste précédent n'a plus d'objet. */
function selectRating(id: string) {
  if (id === selectedId.value) return
  decisionError.value = null
  doneMessage.value = ''
  restored.value = false
  selectedId.value = id
  scrollTo(id)
}

const DONE_MESSAGES: Record<RatingAction, string> = {
  EXCLUDE: 'Avis exclu de la moyenne.',
  REINTEGRATE: 'Avis réintégré dans la moyenne.',
  DELETE: 'Avis supprimé.',
  RESTORE: 'Avis restauré : la note moyenne du voyageur est recalculée.',
}

async function confirm(action: RatingAction, reason: string) {
  const id = selectedId.value
  if (!id) return
  // Le suivant se lit AVANT le geste : un avis supprimé quitte la liste.
  const next = followingRatingId(rt.ratings.value, id)
  busy.value = true
  decisionError.value = null
  doneMessage.value = ''
  restored.value = false
  let ok: boolean
  if (action === 'EXCLUDE') ok = await rt.exclude(id, true, reason)
  else if (action === 'REINTEGRATE') ok = await rt.exclude(id, false, reason)
  else if (action === 'DELETE') ok = await rt.remove(id, reason)
  else ok = await rt.restore(id, reason)
  busy.value = false
  if (!ok) {
    // Le refus se lit dans le panneau, pas en double dans le bandeau de la liste.
    decisionError.value = rt.reasonError.value ?? rt.error.value
    rt.reasonError.value = null
    rt.error.value = null
    return
  }
  doneMessage.value = DONE_MESSAGES[action]
  restored.value = action === 'RESTORE'
  const list = rt.ratings.value
  const target = next && list.some((r) => r.id === next) ? next : (list.some((r) => r.id === id) ? id : defaultRatingId(list))
  if (target === id) void ctx.load(id) // même dossier : sa chronologie doit montrer le geste
  else selectedId.value = target
  if (target) scrollTo(target)
}

// ---- Filtres ----
async function toggleFlagged() { resetFeedback(); await rt.setFlaggedOnly(!rt.filters.flaggedOnly) }
async function toggleLow() { resetFeedback(); await rt.setLowOnly(!rt.filters.lowOnly) }
async function toggleDeleted() { resetFeedback(); await rt.setDeletedFilter(!rt.filters.deleted) }
function resetFeedback() {
  decisionError.value = null
  doneMessage.value = ''
  restored.value = false
}

// ---- Raccourcis : J / K, 1 à 9, ⏎ ; inactifs hors de l'onglet ----
useWorkbenchShortcuts({
  enabled: () => props.active,
  move: (step) => {
    const id = neighbourRatingId(rt.ratings.value, selectedId.value, step)
    if (id) selectRating(id)
  },
  pick: (n) => decisionPanel.value?.pick(n),
  confirm: () => decisionPanel.value?.submit(),
})

const chip = (on: boolean) => ['rounded-full px-3 py-1 text-sm transition-colors',
  on ? 'bg-primary text-white' : 'bg-surface-elevated text-text-muted hover:text-text']
</script>

<template>
  <div data-test="ratings-workbench">
    <p
      v-if="rt.deletedFilterUnsupported.value" data-test="ratings-deleted-filter-unsupported"
      class="mb-3 rounded-btn border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning text-pretty"
    >Filtre disponible après mise à jour du serveur : il ne sait pas encore isoler les avis supprimés.</p>
    <p
      v-if="rt.restoreUnavailable.value" data-test="ratings-restore-unavailable"
      class="mb-3 rounded-btn border border-border bg-surface-elevated px-3 py-2 text-sm text-text-muted text-pretty"
    >Restauration indisponible tant que le serveur n’est pas mis à jour.</p>
    <p
      v-if="restored" data-test="ratings-restored" role="status"
      class="mb-3 rounded-btn border border-success/40 bg-success/10 px-3 py-2 text-sm text-success"
    >{{ doneMessage }}</p>
    <p
      v-else-if="doneMessage" data-test="ratings-done" role="status"
      class="mb-3 rounded-btn border border-success/40 bg-success/10 px-3 py-2 text-sm text-success"
    >{{ doneMessage }}</p>
    <p
      v-if="rt.error.value" data-test="ratings-error" role="alert"
      class="mb-3 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger text-pretty"
    >{{ rt.error.value }}</p>

    <!-- Trois colonnes à toute largeur, comme l'onglet Signalements -->
    <div class="overflow-x-auto">
      <div class="grid min-w-[840px] grid-cols-[minmax(240px,1fr)_minmax(300px,1.6fr)_minmax(280px,1.1fr)] items-start gap-4">
        <!-- 1. File des avis -->
        <section
          aria-label="File des avis" data-test="rating-queue-panel"
          class="flex max-h-[calc(100vh-13rem)] min-h-[24rem] flex-col overflow-hidden rounded-card border border-border bg-surface"
        >
          <div class="flex flex-wrap gap-1 border-b border-border p-3">
            <button
              type="button" data-test="flagged-only" :aria-pressed="rt.filters.flaggedOnly ? 'true' : 'false'"
              :class="chip(rt.filters.flaggedOnly)" @click="toggleFlagged"
            >Signalés</button>
            <button
              type="button" data-test="low-only" :aria-pressed="rt.filters.lowOnly ? 'true' : 'false'"
              :class="chip(!!rt.filters.lowOnly)" @click="toggleLow"
            >Notes basses</button>
            <button
              type="button" data-test="ratings-deleted-only" :aria-pressed="rt.filters.deleted ? 'true' : 'false'"
              :class="rt.filters.deleted ? 'rounded-full bg-danger px-3 py-1 text-sm text-white transition-colors' : chip(false)"
              @click="toggleDeleted"
            >Supprimés</button>
          </div>

          <RatingQueue
            class="min-h-0 flex-1 overflow-hidden"
            :ratings="rt.ratings.value" :loading="rt.isLoading.value" :selected-id="selectedId"
            @select="selectRating"
          />

          <div class="flex flex-col gap-2 border-t border-border bg-bg/50 p-3">
            <PaginationControls :page="rt.currentPage.value" :total-pages="rt.totalPages.value" @change="rt.goToPage" />
            <p class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
              <span class="inline-flex items-center gap-1"><KeyHint>J</KeyHint><KeyHint>K</KeyHint> naviguer</span>
              <span class="inline-flex items-center gap-1"><KeyHint>⏎</KeyHint> confirmer</span>
            </p>
          </div>
        </section>

        <!-- 2. Dossier -->
        <div class="max-h-[calc(100vh-13rem)] min-h-[24rem] overflow-y-auto">
          <RatingCase
            :rating="selected" :context="ctx.context.value" :context-loading="ctx.isLoading.value" :context-error="ctx.error.value"
            @open-report="(id) => emit('openReport', id)"
          />
        </div>

        <!-- 3. Décision -->
        <div class="sticky top-0">
          <RatingDecisionPanel
            ref="decisionPanel"
            :rating="selected" :context="ctx.context.value" :busy="busy" :error="decisionError" :has-next="hasNext"
            :restore-unavailable="rt.restoreUnavailable.value" :superseded="superseded"
            @confirm="confirm"
          />
        </div>
      </div>
    </div>
  </div>
</template>
