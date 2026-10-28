<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import KeyHint from '@/components/ui/KeyHint.vue'
import GuaranteeFundForm from './GuaranteeFundForm.vue'
import SplitResolutionForm from './SplitResolutionForm.vue'
import { decisionEffect, decisionSummary } from './noShowLabels'
import {
  hasOwnForm, INCIDENT_ACTION_HELP, INCIDENT_ACTION_LABELS, INCIDENT_QUICK_NOTES, incidentActionsFor, incidentNoteError,
  isNoShowAction, noShowDecisionOf, NOTE_MAX, disputeResolutionLabel, type Incident, type IncidentAction,
} from '@/features/incidents/lib/incidentWorkbench'
import { NOSHOW_REASON_MAX } from '@/features/incidents/types/index'
import type { AdminDisputeDetail, AdminDisputeSplitOptions, DisputeResolution, NoShowDecision } from '@/features/incidents/types/index'
import { useAuthStore } from '@/stores/auth'

const props = withDefaults(defineProps<{
  incident: Incident | null
  /** Fiche du litige affiché : devise, parties du fonds de garantie, partage en cours. */
  detail?: AdminDisputeDetail | null
  /** Montants répartissables ; null (ancien back, lecture impossible) masque le partage. */
  splitOptions?: AdminDisputeSplitOptions | null
  busy?: boolean
  /** Refus du back à montrer sans perdre la saisie. */
  error?: string | null
  /** Un autre incident attend après celui-ci : le bouton le dit. */
  hasNext?: boolean
}>(), { detail: null, splitOptions: null, busy: false, error: null, hasNext: true })
const emit = defineEmits<{
  resolve: [resolution: DisputeResolution, note: string]
  split: [senderRefund: number, travelerPayout: number, note: string]
  guarantee: [amountCents: number, beneficiaryUserId: string, reason: string]
  'decide-noshow': [decision: NoShowDecision, reason: string]
  'retry-split': []
}>()

const auth = useAuthStore()
const chosen = ref<IncidentAction | null>(null)
const note = ref('')

const canResolve = computed(() => auth.can('DISPUTE_RESOLVE'))
/** Partager déplace de l'argent dans les deux sens : mêmes droits que la libération et le remboursement. */
const canSplit = computed(() => auth.can('PAYMENT_RELEASE') && auth.can('PAYMENT_REFUND'))
const fiche = computed(() => (props.detail && props.detail.id === props.incident?.dispute?.id ? props.detail : null))
const actions = computed<IncidentAction[]>(() => {
  const i = props.incident
  if (!i) return []
  return incidentActionsFor(i, { resolve: canResolve.value, split: canSplit.value && !!props.splitOptions })
    .filter((a) => a !== 'SPLIT' || !!props.splitOptions)
})
const options = computed(() => actions.value.map((value, n) => ({ value, key: n + 1, label: INCIDENT_ACTION_LABELS[value], help: INCIDENT_ACTION_HELP[value] })))
const row = computed(() => props.incident?.noshow ?? null)
const legacyConfirm = computed(() => !!row.value?.legacy)
/** Une confirmation sur l'ancien back n'envoie pas de motif : on n'en réclame pas un qui serait perdu. */
const noteRequired = computed(() => !!chosen.value && !hasOwnForm(chosen.value) && !(legacyConfirm.value && chosen.value === 'NOSHOW_CONFIRM'))
const noteProblem = computed(() => (chosen.value ? incidentNoteError(note.value, chosen.value, legacyConfirm.value) : null))
const noteMax = computed(() => (chosen.value && isNoShowAction(chosen.value) ? NOSHOW_REASON_MAX : NOTE_MAX))
const canConfirm = computed(() => !props.busy && !!chosen.value && !hasOwnForm(chosen.value) && !noteProblem.value)
const consequence = computed<string[]>(() => {
  const a = chosen.value
  if (!a) return []
  if (isNoShowAction(a) && row.value) return decisionEffect(row.value, noShowDecisionOf(a))
  return [INCIDENT_ACTION_HELP[a]]
})
const quickNotes = computed(() => (chosen.value && isNoShowAction(chosen.value) ? INCIDENT_QUICK_NOTES.noshow : INCIDENT_QUICK_NOTES.dispute))
const baseLabel = computed(() => (chosen.value ? INCIDENT_ACTION_LABELS[chosen.value] : ''))
const confirmLabel = computed(() => (props.hasNext ? `${baseLabel.value} et passer au suivant` : baseLabel.value))

const resolvedSummary = computed(() => {
  const i = props.incident
  if (!i || i.todo) return null
  if (i.noshow) return decisionSummary(i.noshow) ?? 'Déclaration traitée'
  return disputeResolutionLabel(fiche.value?.resolution) ?? 'Litige résolu'
})
const resolvedNote = computed(() => props.incident?.noshow?.decisionReason ?? fiche.value?.resolutionNote ?? null)
const split = computed(() => fiche.value?.split ?? null)
const canRetrySplit = computed(() => !!split.value && split.value.status !== 'COMPLETED' && canResolve.value && canSplit.value)

const emptyMessage = computed(() => {
  const i = props.incident
  if (!i) return null
  if (!i.todo) return null
  if (!canResolve.value) return 'Votre rôle ne permet pas de trancher les incidents.'
  if (options.value.length === 0) return 'Aucune décision n’est possible sur cet incident pour l’instant.'
  return null
})
const showForm = computed(() => !!props.incident && props.incident.todo && options.value.length > 0)

// Un autre incident (ou un autre état du même) repart de zéro ; la note d'un geste ne vaut pas pour le suivant.
watch(() => [props.incident?.key, props.incident?.todo], () => {
  chosen.value = actions.value[0] ?? null
  note.value = ''
}, { immediate: true })
// Les gestes se calculent après le chargement de la fiche (partage, droits) : garder un choix valide.
watch(actions, (list) => { if (chosen.value && !list.includes(chosen.value)) chosen.value = list[0] ?? null })

function onConfirm() {
  const a = chosen.value
  if (!a || !canConfirm.value || !showForm.value) return
  const text = note.value.trim()
  if (a === 'NOSHOW_CONFIRM' || a === 'NOSHOW_REJECT') emit('decide-noshow', noShowDecisionOf(a), text)
  else if (a === 'RESOLVED_FOR_SENDER' || a === 'RESOLVED_FOR_TRAVELER' || a === 'DISMISSED') emit('resolve', a, text)
}
/** Raccourcis clavier : la page choisit le geste n° `n` (1 = premier) ou confirme. */
function pick(n: number) {
  const option = options.value[n - 1]
  if (option && showForm.value) chosen.value = option.value
}
defineExpose({ pick, submit: onConfirm, canConfirm })
</script>

<template>
  <section
    aria-labelledby="incident-decision-title" data-test="incident-decision-panel"
    class="flex max-h-[calc(100vh-13rem)] min-h-0 flex-col overflow-hidden rounded-card border border-border bg-surface"
  >
    <div class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
      <div class="flex items-baseline justify-between gap-2">
        <h2 id="incident-decision-title" class="font-display text-lg font-semibold text-balance">Décision</h2>
        <span v-if="showForm && options.length > 1" class="text-xs text-text-muted">Touches 1 à {{ options.length }}</span>
      </div>

      <p
        v-if="!incident" data-test="incident-decision-empty"
        class="rounded-btn border border-border bg-surface-elevated px-3 py-2 text-sm text-text-muted text-pretty"
      >Sélectionne un incident dans la file pour le traiter.</p>

      <template v-else-if="resolvedSummary">
        <div class="rounded-btn border border-border bg-surface-elevated px-3 py-2.5 text-sm" data-test="incident-decision-done">
          <p class="font-medium">{{ resolvedSummary }}</p>
          <p v-if="resolvedNote" class="mt-1 text-xs text-text-muted text-pretty">Note interne : {{ resolvedNote }}</p>
        </div>
        <div v-if="canRetrySplit" class="rounded-btn border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm">
          <p class="font-medium text-warning">Une étape du partage reste à finir</p>
          <p class="mt-1 text-xs text-text-muted text-pretty">Le versement n’a pas été exécuté jusqu’au bout chez Stripe. Reprenez-le une fois la cause réglée.</p>
          <button
            type="button" data-test="split-retry"
            class="mt-2 rounded-btn bg-warning/20 px-3 py-2 text-sm font-medium text-warning transition-[background-color,scale] hover:bg-warning/30 active:scale-[0.97]"
            @click="emit('retry-split')"
          >Reprendre le partage</button>
        </div>
        <p v-else class="text-xs text-text-muted text-pretty">Un incident traité ne se rouvre pas : une nouvelle décision passe par un nouvel incident.</p>
      </template>

      <p
        v-else-if="emptyMessage" :data-test="!canResolve ? 'incident-no-action' : 'incident-no-option'"
        class="rounded-btn border border-border bg-surface-elevated px-3 py-2 text-sm text-text-muted text-pretty"
      >{{ emptyMessage }}</p>

      <template v-else-if="showForm">
        <fieldset class="space-y-1.5">
          <legend class="sr-only">Action</legend>
          <label
            v-for="o in options" :key="o.value" :data-test="`incident-action-${o.value}`"
            :class="['flex cursor-pointer items-start gap-3 rounded-btn border px-3 py-2.5 transition-[background-color,border-color,scale] active:scale-[0.985]',
              chosen === o.value ? 'border-primary bg-primary/5' : 'border-border hover:bg-surface-elevated']"
          >
            <input v-model="chosen" type="radio" name="incident-action" :value="o.value" class="sr-only">
            <KeyHint class="mt-0.5">{{ o.key }}</KeyHint>
            <span class="min-w-0">
              <span class="block text-sm font-medium">{{ o.label }}</span>
              <span class="block text-xs text-text-muted text-pretty">{{ o.help }}</span>
            </span>
          </label>
        </fieldset>

        <SplitResolutionForm
          v-if="chosen === 'SPLIT' && splitOptions" :options="splitOptions"
          @submit="(s, t, n) => emit('split', s, t, n)"
        />
        <GuaranteeFundForm
          v-else-if="chosen === 'GUARANTEE'"
          :currency="fiche?.bidCurrency" :sender-id="fiche?.senderId" :traveler-id="fiche?.travelerId"
          :sender-name="fiche?.senderName" :traveler-name="fiche?.travelerName"
          @submit="(c, b, r) => emit('guarantee', c, b, r)"
        />

        <div v-else-if="noteRequired">
          <label for="incident-note" class="mb-1 block text-xs font-medium">
            Note <span class="font-normal text-text-muted">— {{ chosen && isNoShowAction(chosen) ? 'interne, jamais envoyée aux parties' : 'conservée dans l’audit' }}</span>
          </label>
          <textarea
            id="incident-note" v-model="note" data-test="incident-note" rows="3" :maxlength="noteMax"
            placeholder="Ce que vous avez vérifié (obligatoire)" :aria-invalid="note.trim() && noteProblem ? 'true' : 'false'"
            class="w-full rounded-btn border border-border bg-bg p-2 text-sm"
          />
          <p v-if="note.trim() && noteProblem" data-test="incident-note-problem" class="mt-1 text-xs text-warning text-pretty">{{ noteProblem }}</p>
          <p v-else class="mt-1 text-right text-xs tabular-nums text-text-muted">{{ note.trim().length }}/{{ noteMax }}</p>
          <div class="mt-2 flex flex-wrap gap-1.5" data-test="incident-quick-notes">
            <button
              v-for="q in quickNotes" :key="q" type="button" :data-test="`incident-quick-${q}`"
              class="rounded-full border border-border px-2.5 py-1 text-xs text-text-muted transition-[background-color,scale] hover:bg-surface-elevated hover:text-text active:scale-[0.96]"
              @click="note = q"
            >{{ q }}</button>
          </div>
        </div>

        <ul v-if="consequence.length && !hasOwnForm(chosen!)" class="space-y-1 rounded-btn bg-surface-elevated p-3 text-xs text-text-muted" data-test="incident-preview">
          <li v-for="line in consequence" :key="line" class="text-pretty">{{ line }}</li>
        </ul>
      </template>
    </div>

    <!-- Le geste principal reste sous la main : seul le contenu au-dessus défile -->
    <div v-if="showForm && chosen && !hasOwnForm(chosen)" class="flex flex-col gap-2 border-t border-border bg-surface p-4">
      <p
        v-if="error" data-test="incident-error" role="alert"
        class="rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger text-pretty"
      >{{ error }}</p>
      <button
        type="button" data-test="incident-confirm" :disabled="!canConfirm" :aria-busy="busy ? 'true' : 'false'"
        class="w-full rounded-btn bg-primary px-4 py-3 text-sm font-medium text-white transition-[background-color,scale] hover:bg-primary/90 active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100"
        @click="onConfirm"
      >{{ confirmLabel }} <KeyHint tone="inverse" class="ml-1">⏎</KeyHint></button>
    </div>
    <p
      v-else-if="error" data-test="incident-error" role="alert"
      class="m-4 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger text-pretty"
    >{{ error }}</p>
  </section>
</template>
