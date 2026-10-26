<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Bell, TriangleAlert } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import type { AdminReport } from '@/features/signalements/types/index'
import {
  actionsForReport,
  defaultActionFor,
  isNoteRequired,
  notifiesReporter,
  quickNotesFor,
  REPORT_MESSAGE_MAX,
  requiresStrongConfirmation,
  sendsWarning,
} from '@/features/signalements/reportActions'
import {
  reportActionConsequence,
  reportActionHelp,
  reportActionLabel,
} from '@/features/signalements/reportActionLabels'

const props = defineProps<{
  /** Signalement à traiter ; null = dialogue fermé. */
  report: AdminReport | null
  busy?: boolean
  /** Refus du back (403, 422, ancien back) à montrer sans fermer le dialogue. */
  error?: string | null
}>()
/** `targetMessage` / `reporterMessage` : chaîne vide quand le geste n'écrit à personne ou que rien n'est saisi. */
const emit = defineEmits<{ confirm: [action: string, note: string, targetMessage: string, reporterMessage: string]; cancel: [] }>()

const auth = useAuthStore()
const chosen = ref<string | null>(null)
const note = ref('')
const targetMessage = ref('')
const reporterMessage = ref('')
const acknowledged = ref(false)

const actions = computed(() => (props.report ? actionsForReport(props.report, auth.permissions) : []))
const options = computed(() => actions.value.map((value) => ({
  value,
  label: reportActionLabel(value, props.report?.targetAuthor),
  help: props.report ? reportActionHelp(value, props.report.targetType) : null,
  strong: requiresStrongConfirmation(value),
})))

// Un autre signalement repart de zéro : pré-sélection sûre, note vide, case décochée.
watch(() => props.report?.id, () => {
  chosen.value = defaultActionFor(actions.value)
  note.value = ''
  targetMessage.value = ''
  reporterMessage.value = ''
  acknowledged.value = false
}, { immediate: true })
// Changer d'action réarme la confirmation : une case cochée pour supprimer un message ne
// vaut pas accord pour suspendre un compte.
watch(chosen, () => { acknowledged.value = false })

const warns = computed(() => (chosen.value ? sendsWarning(chosen.value) : false))
const informsReporter = computed(() => (chosen.value ? notifiesReporter(chosen.value) : false))
const quickNotes = computed(() => (chosen.value ? quickNotesFor(chosen.value) : []))
const noteRequired = computed(() => (chosen.value ? isNoteRequired(chosen.value) : false))
const strong = computed(() => (chosen.value ? requiresStrongConfirmation(chosen.value) : false))
const consequence = computed(() => (chosen.value ? reportActionConsequence(chosen.value, props.report?.targetAuthor) : null))
const canConfirm = computed(() => {
  if (!chosen.value || props.busy) return false
  if (noteRequired.value && !note.value.trim()) return false
  if (strong.value && !acknowledged.value) return false
  return true
})
const confirmLabel = computed(() =>
  strong.value && chosen.value ? reportActionLabel(chosen.value, props.report?.targetAuthor) : 'Confirmer')

function onConfirm() {
  if (!canConfirm.value || !chosen.value) return
  // Un message saisi puis devenu sans objet (changement d'action) ne part jamais.
  emit('confirm', chosen.value, note.value.trim(),
    warns.value ? targetMessage.value.trim() : '',
    informsReporter.value ? reporterMessage.value.trim() : '')
}
</script>

<template>
  <div
    v-if="report"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-test="resolve-overlay"
  >
    <div
      role="dialog" aria-modal="true" aria-labelledby="resolve-title"
      class="flex max-h-[90vh] w-full max-w-md flex-col overflow-y-auto rounded-card border border-border bg-surface p-6 shadow-xl"
    >
      <h2 id="resolve-title" class="font-display text-lg font-semibold mb-1 text-balance">Traiter le signalement</h2>
      <p class="text-sm text-text-muted mb-4 text-pretty">Choisis l’action et documente la décision.</p>

      <p
        v-if="options.length === 0" data-test="resolve-no-action"
        class="mb-4 rounded-btn border border-border bg-surface-elevated px-3 py-2 text-sm text-text-muted text-pretty"
      >Aucune action disponible pour ce signalement.</p>

      <fieldset v-else class="mb-4 space-y-2">
        <legend class="sr-only">Action</legend>
        <label
          v-for="o in options" :key="o.value" :data-test="`resolve-action-${o.value}`"
          :class="['flex cursor-pointer items-start gap-3 rounded-btn border px-3 py-2.5 transition-[background-color,border-color]',
            chosen === o.value ? 'border-primary bg-primary/5' : 'border-border hover:bg-surface-elevated']"
        >
          <input
            v-model="chosen" type="radio" name="resolve-action" :value="o.value"
            class="mt-0.5 accent-primary"
          >
          <span class="min-w-0">
            <span
              data-test="resolve-action-label"
              :class="['block text-sm font-medium', o.strong ? 'text-danger' : '']"
            >{{ o.label }}</span>
            <span v-if="o.help" class="block text-xs text-text-muted text-pretty">{{ o.help }}</span>
          </span>
        </label>
      </fieldset>

      <label for="resolve-note" class="mb-1 block text-xs text-text-muted">Note interne <span class="text-text-muted/80">— jamais transmise à personne</span></label>
      <textarea
        id="resolve-note" v-model="note" data-test="resolve-note" rows="2"
        :placeholder="noteRequired ? 'Motif (obligatoire)' : 'Note (facultative)'"
        class="w-full rounded-btn border border-border bg-bg p-2 text-sm mb-2"
      />
      <div v-if="quickNotes.length" class="mb-3 flex flex-wrap gap-1.5" data-test="resolve-quick-notes">
        <button
          v-for="q in quickNotes" :key="q" type="button" :data-test="`resolve-quick-${q}`"
          class="rounded-full border border-border px-2.5 py-1 text-xs text-text-muted transition-[background-color,scale] hover:bg-surface-elevated hover:text-text active:scale-[0.96]"
          @click="note = q"
        >{{ q }}</button>
      </div>

      <template v-if="warns">
        <label for="resolve-target-message" class="mb-1 block text-xs text-text-muted">Message à la personne avertie <span class="text-text-muted/80">— elle seule le lit</span></label>
        <textarea
          id="resolve-target-message" v-model="targetMessage" data-test="resolve-target-message" rows="3"
          :maxlength="REPORT_MESSAGE_MAX"
          placeholder="Vide : texte standard « Un comportement signalé sur votre compte a été examiné. »"
          class="w-full rounded-btn border border-border bg-bg p-2 text-sm mb-1"
        />
        <p class="mb-3 text-xs text-text-muted text-pretty">Ne nomme pas le signalant et ne cite pas la note interne.</p>
      </template>

      <template v-if="informsReporter">
        <label for="resolve-reporter-message" class="mb-1 block text-xs text-text-muted">Mot pour le signalant <span class="text-text-muted/80">— facultatif</span></label>
        <textarea
          id="resolve-reporter-message" v-model="reporterMessage" data-test="resolve-reporter-message" rows="2"
          :maxlength="REPORT_MESSAGE_MAX"
          placeholder="Ex. « Le contenu a été retiré. » Ajouté à la suite du remerciement."
          class="w-full rounded-btn border border-border bg-bg p-2 text-sm mb-1"
        />
        <p data-test="resolve-reporter-notice" class="mb-3 flex items-start gap-2 text-xs text-text-muted text-pretty">
          <Bell class="mt-px size-3.5 shrink-0" aria-hidden="true" /><span>Le signalant reçoit « Merci, votre signalement a été traité. », suivi de ce mot s’il y en a un. Jamais la sanction.</span>
        </p>
      </template>

      <div
        v-if="strong && consequence" data-test="resolve-consequence"
        class="mb-3 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
      >
        <p class="flex items-start gap-2 text-pretty">
          <TriangleAlert class="mt-0.5 size-4 shrink-0" aria-hidden="true" /><span>{{ consequence }}</span>
        </p>
        <label class="mt-2 flex cursor-pointer items-center gap-2 text-xs">
          <input v-model="acknowledged" data-test="resolve-acknowledge" type="checkbox">
          J’ai compris la conséquence de cette action
        </label>
      </div>

      <p
        v-if="error" data-test="resolve-error" role="alert"
        class="mb-3 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger text-pretty"
      >{{ error }}</p>

      <div class="flex justify-end gap-2">
        <button
          type="button" data-test="resolve-cancel"
          class="rounded-btn px-4 py-2 text-sm border border-border transition-[background-color,scale] hover:bg-surface-elevated active:scale-[0.96]"
          @click="emit('cancel')"
        >Annuler</button>
        <button
          type="button" data-test="resolve-confirm" :disabled="!canConfirm" :aria-busy="busy ? 'true' : 'false'"
          :class="['rounded-btn px-4 py-2 text-sm text-white transition-[background-color,scale] active:scale-[0.96] disabled:opacity-40 disabled:active:scale-100',
            strong ? 'bg-danger hover:bg-danger/90' : 'bg-primary hover:bg-primary/90']"
          @click="onConfirm"
        >{{ confirmLabel }}</button>
      </div>
    </div>
  </div>
</template>
