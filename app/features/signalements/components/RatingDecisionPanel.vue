<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { TriangleAlert } from 'lucide-vue-next'
import KeyHint from '@/components/ui/KeyHint.vue'
import { useAuthStore } from '@/stores/auth'
import {
  averageEffect,
  averageEffectText,
  isDestructiveRatingAction,
  isRatingReasonRequired,
  RATING_ACTION_HELP,
  RATING_ACTION_LABELS,
  RATING_REASON_MAX,
  ratingActionConsequence,
  ratingActions,
  ratingReasonError,
  type RatingAction,
} from '@/features/signalements/ratingWorkbench'
import { RESTORE_REASON_MAX, RESTORE_REASON_MIN } from '@/lib/restoreReason'
import type { AdminRating, RatingContext } from '@/features/signalements/types/index'

const props = withDefaults(defineProps<{
  /** Avis à traiter ; null = rien de sélectionné. */
  rating: AdminRating | null
  /** Contexte du dossier : la personne notée donne l'effet sur sa moyenne. */
  context?: RatingContext | null
  busy?: boolean
  /** Refus du back (403, 409, 422) à montrer sans perdre la saisie. */
  error?: string | null
  /** Un autre avis attend après celui-ci : le bouton le dit. */
  hasNext?: boolean
  /** POST /admin/ratings/{id}/restore absent (ancien back) : la restauration disparaît. */
  restoreUnavailable?: boolean
  /** Avis supplanté par une nouvelle note : plus restaurable. */
  superseded?: boolean
}>(), { context: null, busy: false, error: null, hasNext: true, restoreUnavailable: false, superseded: false })
const emit = defineEmits<{ confirm: [action: RatingAction, reason: string] }>()

const auth = useAuthStore()
const chosen = ref<RatingAction | null>(null)
const reason = ref('')
const acknowledged = ref(false)

const actions = computed<RatingAction[]>(() => (props.rating
  ? ratingActions(props.rating, { can: auth.can, restoreUnavailable: props.restoreUnavailable, superseded: props.superseded })
  : []))
const options = computed(() => actions.value.map((value, index) => ({
  value, key: index + 1, label: RATING_ACTION_LABELS[value], help: RATING_ACTION_HELP[value],
  strong: isDestructiveRatingAction(value),
})))

// Un autre avis repart de zéro : première action pré-sélectionnée (aucune ne détruit sans motif ni case cochée).
watch(() => props.rating?.id, () => {
  chosen.value = actions.value[0] ?? null
  reason.value = ''
  acknowledged.value = false
}, { immediate: true })
// Changer de geste réarme la confirmation : la case cochée pour supprimer ne vaut pas pour autre chose.
watch(chosen, () => { acknowledged.value = false })

const required = computed(() => (chosen.value ? isRatingReasonRequired(chosen.value) : false))
const reasonProblem = computed(() => (chosen.value ? ratingReasonError(chosen.value, reason.value) : null))
const strong = computed(() => (chosen.value ? isDestructiveRatingAction(chosen.value) : false))
const consequence = computed(() => (chosen.value ? ratingActionConsequence(chosen.value, props.rating?.ratedName) : null))
const effect = computed(() => {
  if (!chosen.value || !props.rating) return null
  const e = averageEffect(chosen.value, props.rating, props.context?.rated)
  return e ? averageEffectText(e, props.context?.rated?.displayName ?? props.rating.ratedName) : null
})
const canConfirm = computed(() => {
  if (!chosen.value || props.busy) return false
  if (reasonProblem.value) return false
  if (strong.value && !acknowledged.value) return false
  return true
})
const chosenLabel = computed(() => (chosen.value ? RATING_ACTION_LABELS[chosen.value] : 'Confirmer'))
const confirmLabel = computed(() => (props.hasNext ? `${chosenLabel.value} et passer au suivant` : chosenLabel.value))
const placeholder = computed(() => {
  if (chosen.value === 'RESTORE') return `Motif (${RESTORE_REASON_MIN} à ${RESTORE_REASON_MAX} caractères, journalisé)`
  return required.value ? 'Motif (obligatoire)' : 'Motif (facultatif)'
})

/** Motifs en un clic pour les gestes courants ; une restauration demande 10 caractères au moins. */
const QUICK_REASONS: Record<RatingAction, string[]> = {
  EXCLUDE: ['Propos injurieux', 'Hors sujet', 'Représailles', 'Soupçon de faux avis'],
  REINTEGRATE: [],
  DELETE: ['Contenu illicite', 'Faux avis', 'Doublon'],
  RESTORE: ['Suppression par erreur'],
}
const quickReasons = computed(() => (chosen.value ? QUICK_REASONS[chosen.value] : []))

function onConfirm() {
  if (!canConfirm.value || !chosen.value) return
  emit('confirm', chosen.value, reason.value.trim())
}

/** Raccourcis clavier : la page choisit le geste n° `n` (1 = premier) ou confirme. */
function pick(n: number) {
  const option = options.value[n - 1]
  if (option) chosen.value = option.value
}
defineExpose({ pick, submit: onConfirm, canConfirm })
</script>

<template>
  <section
    aria-labelledby="rating-decision-title" data-test="rating-decision-panel"
    class="flex max-h-[calc(100vh-13rem)] min-h-0 flex-col overflow-hidden rounded-card border border-border bg-surface"
  >
    <div class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
      <div class="flex items-baseline justify-between gap-2">
        <h2 id="rating-decision-title" class="font-display text-lg font-semibold text-balance">Décision</h2>
        <span v-if="options.length > 1" class="text-xs text-text-muted">Touches 1 à {{ options.length }}</span>
      </div>

      <p
        v-if="!rating" data-test="rating-decision-empty"
        class="rounded-btn border border-border bg-surface-elevated px-3 py-2 text-sm text-text-muted text-pretty"
      >Sélectionne un avis dans la liste pour le modérer.</p>

      <p
        v-else-if="options.length === 0" data-test="rating-no-action"
        class="rounded-btn border border-border bg-surface-elevated px-3 py-2 text-sm text-text-muted text-pretty"
      >{{ rating.deletedAt && superseded
        ? 'L’auteur a noté de nouveau cette livraison : cet avis ne peut plus être restauré.'
        : 'Aucune action disponible pour cet avis avec votre rôle.' }}</p>

      <template v-else>
        <fieldset class="space-y-1.5">
          <legend class="sr-only">Action</legend>
          <label
            v-for="o in options" :key="o.value" :data-test="`rating-action-${o.value}`"
            :class="['flex cursor-pointer items-start gap-3 rounded-btn border px-3 py-2.5 transition-[background-color,border-color,scale] active:scale-[0.985]',
              chosen === o.value
                ? (o.strong ? 'border-danger bg-danger/5' : 'border-primary bg-primary/5')
                : 'border-border hover:bg-surface-elevated']"
          >
            <input v-model="chosen" type="radio" name="rating-action" :value="o.value" class="sr-only">
            <KeyHint class="mt-0.5">{{ o.key }}</KeyHint>
            <span class="min-w-0">
              <span data-test="rating-action-label" :class="['block text-sm font-medium', o.strong ? 'text-danger' : '']">{{ o.label }}</span>
              <span class="block text-xs text-text-muted text-pretty">{{ o.help }}</span>
            </span>
          </label>
        </fieldset>

        <div
          v-if="strong && consequence" data-test="rating-consequence" role="note"
          class="rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          <p class="flex items-start gap-2 text-pretty">
            <TriangleAlert class="mt-0.5 size-4 shrink-0" aria-hidden="true" /><span>{{ consequence }}</span>
          </p>
          <label class="mt-2 flex cursor-pointer items-center gap-2 text-xs">
            <input v-model="acknowledged" data-test="rating-acknowledge" type="checkbox">
            J’ai compris la conséquence de cette action
          </label>
        </div>

        <div>
          <label for="rating-reason" class="mb-1 block text-xs font-medium">Motif <span class="font-normal text-text-muted">— conservé dans l’audit</span></label>
          <textarea
            id="rating-reason" v-model="reason" data-test="rating-reason" rows="2"
            :placeholder="placeholder" :aria-invalid="reason.trim() && reasonProblem ? 'true' : 'false'"
            class="w-full rounded-btn border border-border bg-bg p-2 text-sm"
          />
          <p
            v-if="reason.trim() && reasonProblem" data-test="rating-reason-problem"
            class="mt-1 text-xs text-warning text-pretty"
          >{{ reasonProblem }}</p>
          <p v-else-if="chosen !== 'RESTORE'" class="mt-1 text-right text-xs text-text-muted tabular-nums">{{ reason.trim().length }}/{{ RATING_REASON_MAX }}</p>
          <div v-if="quickReasons.length" class="mt-2 flex flex-wrap gap-1.5" data-test="rating-quick-reasons">
            <button
              v-for="q in quickReasons" :key="q" type="button" :data-test="`rating-quick-${q}`"
              class="rounded-full border border-border px-2.5 py-1 text-xs text-text-muted transition-[background-color,scale] hover:bg-surface-elevated hover:text-text active:scale-[0.96]"
              @click="reason = q"
            >{{ q }}</button>
          </div>
        </div>

        <!-- Ce que le geste change, et ce qui part : rien -->
        <div data-test="rating-preview" class="space-y-1.5 rounded-btn bg-surface-elevated p-3 text-xs">
          <p v-if="effect" data-test="rating-effect" class="font-medium tabular-nums">{{ effect }}</p>
          <p class="text-text-muted text-pretty">Personne n’est prévenu : ni le notant ni la personne notée.</p>
        </div>
      </template>
    </div>

    <!-- Le geste principal reste sous la main : seul le contenu au-dessus défile -->
    <div v-if="rating && options.length > 0" class="flex flex-col gap-2 border-t border-border bg-surface p-4">
      <p
        v-if="error" data-test="rating-error" role="alert"
        class="rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger text-pretty"
      >{{ error }}</p>
      <button
        type="button" data-test="rating-confirm" :disabled="!canConfirm" :aria-busy="busy ? 'true' : 'false'"
        :class="['w-full rounded-btn px-4 py-3 text-sm font-medium text-white transition-[background-color,scale] active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100',
          strong ? 'bg-danger hover:bg-danger/90' : 'bg-primary hover:bg-primary/90']"
        @click="onConfirm"
      >{{ confirmLabel }} <KeyHint tone="inverse" class="ml-1">⏎</KeyHint></button>
    </div>
  </section>
</template>
