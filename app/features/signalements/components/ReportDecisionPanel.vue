<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Bell, TriangleAlert } from 'lucide-vue-next'
import KeyHint from '@/components/ui/KeyHint.vue'
import { useAuthStore } from '@/stores/auth'
import type { AdminReport } from '@/features/signalements/types/index'
import {
  actionsForReport,
  defaultActionFor,
  isNoteRequired,
  notifiesReporter,
  quickNotesFor,
  REPORT_MESSAGE_MAX,
  REPORTER_THANKS_BODY,
  REPORTER_THANKS_TITLE,
  requiresStrongConfirmation,
  sendsWarning,
  WARNING_DEFAULT_BODY,
  WARNING_TITLE,
} from '@/features/signalements/reportActions'
import {
  reportActionConsequence,
  reportActionHelp,
  reportActionLabel,
  reportActionTakenLabel,
} from '@/features/signalements/reportActionLabels'

const props = withDefaults(defineProps<{
  /** Signalement à traiter ; null = rien de sélectionné. */
  report: AdminReport | null
  busy?: boolean
  /** Refus du back (403, 422, ancien back) à montrer sans perdre la saisie. */
  error?: string | null
  /** Un autre signalement attend après celui-ci : le bouton le dit. */
  hasNext?: boolean
}>(), { busy: false, error: null, hasNext: true })
/** `targetMessage` / `reporterMessage` : chaîne vide quand le geste n'écrit à personne ou que rien n'est saisi. */
const emit = defineEmits<{ confirm: [action: string, note: string, targetMessage: string, reporterMessage: string] }>()

const auth = useAuthStore()
const chosen = ref<string | null>(null)
const note = ref('')
const targetMessage = ref('')
const reporterMessage = ref('')
const acknowledged = ref(false)

// `availableActions` du back fait foi (permissions comprises). Sur un ancien back qui ne le renvoie
// pas, seul REPORT_RESOLVE ouvre le traitement : le repli local ne doit pas le contourner.
const mayResolve = computed(() => !!props.report && (Array.isArray(props.report.availableActions) || auth.can('REPORT_RESOLVE')))
const actions = computed(() => (props.report && mayResolve.value ? actionsForReport(props.report, auth.permissions) : []))
const options = computed(() => actions.value.map((value, index) => ({
  value,
  key: index + 1,
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
const chosenLabel = computed(() => (chosen.value ? reportActionLabel(chosen.value, props.report?.targetAuthor) : 'Confirmer'))
const confirmLabel = computed(() => (props.hasNext ? `${chosenLabel.value} et passer au suivant` : chosenLabel.value))

/** Personne avertie : l'auteur du contenu, sinon la cible quand c'est un compte. */
const warnedName = computed(() => {
  const r = props.report
  if (!r) return null
  return r.targetAuthor?.name?.trim() || (r.targetType === 'USER' ? r.targetLabel : null) || null
})
/** Ce qui part réellement, avec les mêmes règles que le back : un aperçu qui ment est pire que pas d'aperçu. */
const preview = computed(() => {
  const items: { key: string; to: string; title: string; body: string }[] = []
  if (warns.value) {
    items.push({
      key: 'target', to: warnedName.value ?? 'La personne signalée', title: WARNING_TITLE,
      body: targetMessage.value.trim() || WARNING_DEFAULT_BODY,
    })
  }
  if (informsReporter.value && props.report?.reporterName) {
    const extra = reporterMessage.value.trim()
    items.push({
      key: 'reporter', to: props.report.reporterName, title: REPORTER_THANKS_TITLE,
      body: extra ? `${REPORTER_THANKS_BODY} ${extra}` : REPORTER_THANKS_BODY,
    })
  }
  return items
})
const nothingSent = computed(() => {
  if (preview.value.length > 0 || !chosen.value) return null
  return chosen.value === 'DISMISS'
    ? 'Rien n’est envoyé : le signalant n’est pas prévenu d’un rejet.'
    : 'Aucune notification n’est envoyée.'
})
const closedRecap = computed(() => {
  const r = props.report
  if (!r || r.status === 'OPEN') return null
  if (r.status === 'DISMISSED') return 'Signalement rejeté.'
  return r.actionTaken ? `Traité : ${reportActionTakenLabel(r.actionTaken)}.` : 'Signalement traité.'
})

function onConfirm() {
  if (!canConfirm.value || !chosen.value) return
  // Un message saisi puis devenu sans objet (changement d'action) ne part jamais.
  emit('confirm', chosen.value, note.value.trim(),
    warns.value ? targetMessage.value.trim() : '',
    informsReporter.value ? reporterMessage.value.trim() : '')
}

/** Raccourcis clavier : la page choisit l'action n° `n` (1 = première) ou confirme. */
function pick(n: number) {
  const option = options.value[n - 1]
  if (option) chosen.value = option.value
}
defineExpose({ pick, submit: onConfirm, canConfirm })
</script>

<template>
  <section
    aria-labelledby="decision-title" data-test="decision-panel"
    class="flex max-h-[calc(100vh-13rem)] min-h-0 flex-col overflow-hidden rounded-card border border-border bg-surface"
  >
    <div class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
    <div class="flex items-baseline justify-between gap-2">
      <h2 id="decision-title" class="font-display text-lg font-semibold text-balance">Décision</h2>
      <span v-if="options.length > 1" class="text-xs text-text-muted">Touches 1 à {{ options.length }}</span>
    </div>

    <p
      v-if="!report" data-test="decision-empty"
      class="rounded-btn border border-border bg-surface-elevated px-3 py-2 text-sm text-text-muted text-pretty"
    >Sélectionne un signalement dans la liste pour le traiter.</p>

    <template v-else>
      <p
        v-if="closedRecap" data-test="decision-closed"
        class="rounded-btn border border-border bg-surface-elevated px-3 py-2 text-sm text-text-muted text-pretty"
      >{{ closedRecap }}</p>

      <p
        v-else-if="options.length === 0" data-test="resolve-no-action"
        class="rounded-btn border border-border bg-surface-elevated px-3 py-2 text-sm text-text-muted text-pretty"
      >Aucune action disponible pour ce signalement.</p>

      <template v-if="options.length > 0 && !closedRecap">
        <fieldset class="space-y-1.5">
          <legend class="sr-only">Action</legend>
          <label
            v-for="o in options" :key="o.value" :data-test="`resolve-action-${o.value}`"
            :class="['flex cursor-pointer items-start gap-3 rounded-btn border px-3 py-2.5 transition-[background-color,border-color,scale] active:scale-[0.985]',
              chosen === o.value
                ? (o.strong ? 'border-danger bg-danger/5' : 'border-primary bg-primary/5')
                : 'border-border hover:bg-surface-elevated']"
          >
            <input
              v-model="chosen" type="radio" name="resolve-action" :value="o.value"
              class="sr-only"
            >
            <KeyHint class="mt-0.5">{{ o.key }}</KeyHint>
            <span class="min-w-0">
              <span
                data-test="resolve-action-label"
                :class="['block text-sm font-medium', o.strong ? 'text-danger' : '']"
              >{{ o.label }}</span>
              <span v-if="o.help" class="block text-xs text-text-muted text-pretty">{{ o.help }}</span>
            </span>
          </label>
        </fieldset>

        <div
          v-if="strong && consequence" data-test="resolve-consequence" role="note"
          class="rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          <p class="flex items-start gap-2 text-pretty">
            <TriangleAlert class="mt-0.5 size-4 shrink-0" aria-hidden="true" /><span>{{ consequence }}</span>
          </p>
          <label class="mt-2 flex cursor-pointer items-center gap-2 text-xs">
            <input v-model="acknowledged" data-test="resolve-acknowledge" type="checkbox">
            J’ai compris la conséquence de cette action
          </label>
        </div>

        <div>
          <label for="resolve-note" class="mb-1 block text-xs font-medium">Note interne <span class="font-normal text-text-muted">— jamais transmise</span></label>
          <textarea
            id="resolve-note" v-model="note" data-test="resolve-note" rows="2"
            :placeholder="noteRequired ? 'Motif (obligatoire)' : 'Note (facultative)'"
            class="w-full rounded-btn border border-border bg-bg p-2 text-sm"
          />
          <div v-if="quickNotes.length" class="mt-2 flex flex-wrap gap-1.5" data-test="resolve-quick-notes">
            <button
              v-for="q in quickNotes" :key="q" type="button" :data-test="`resolve-quick-${q}`"
              class="rounded-full border border-border px-2.5 py-1 text-xs text-text-muted transition-[background-color,scale] hover:bg-surface-elevated hover:text-text active:scale-[0.96]"
              @click="note = q"
            >{{ q }}</button>
          </div>
        </div>

        <div v-if="warns">
          <label for="resolve-target-message" class="mb-1 block text-xs font-medium">
            Message à {{ warnedName ?? 'la personne avertie' }} <span class="font-normal text-text-muted">— elle seule le lit</span>
          </label>
          <textarea
            id="resolve-target-message" v-model="targetMessage" data-test="resolve-target-message" rows="3"
            :maxlength="REPORT_MESSAGE_MAX"
            placeholder="Vide : texte standard « Un comportement signalé sur votre compte a été examiné. »"
            class="w-full rounded-btn border border-border bg-bg p-2 text-sm"
          />
          <p class="mt-1 text-xs text-text-muted text-pretty">Ne nomme pas le signalant et ne cite pas la note interne.</p>
        </div>

        <div v-if="informsReporter">
          <label for="resolve-reporter-message" class="mb-1 block text-xs font-medium">
            Mot pour {{ report.reporterName ?? 'le signalant' }} <span class="font-normal text-text-muted">— facultatif</span>
          </label>
          <textarea
            id="resolve-reporter-message" v-model="reporterMessage" data-test="resolve-reporter-message" rows="2"
            :maxlength="REPORT_MESSAGE_MAX"
            placeholder="Ex. « Le contenu a été retiré. » Ajouté à la suite du remerciement."
            class="w-full rounded-btn border border-border bg-bg p-2 text-sm"
          />
        </div>

        <!-- Ce qui part réellement, mêmes textes que le back -->
        <div data-test="resolve-preview" class="rounded-btn bg-surface-elevated p-3">
          <p class="mb-2 text-xs font-medium">Ce qui sera envoyé</p>
          <ul v-if="preview.length" class="space-y-2">
            <li
              v-for="p in preview" :key="p.key" :data-test="`resolve-preview-${p.key}`"
              class="flex items-start gap-2 text-xs"
            >
              <Bell class="mt-0.5 size-3.5 shrink-0 text-text-muted" aria-hidden="true" />
              <span class="min-w-0 text-pretty">
                <b class="font-medium">{{ p.to }}</b> · {{ p.title }}<br>
                <span class="text-text-muted">{{ p.body }}</span>
              </span>
            </li>
          </ul>
          <p v-else data-test="resolve-preview-none" class="text-xs text-text-muted text-pretty">{{ nothingSent }}</p>
        </div>

      </template>
    </template>
    </div>

    <!-- Le geste principal reste sous la main : seul le contenu au-dessus défile -->
    <div
      v-if="report && options.length > 0 && !closedRecap"
      class="flex flex-col gap-2 border-t border-border bg-surface p-4"
    >
      <p
        v-if="error" data-test="resolve-error" role="alert"
        class="rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger text-pretty"
      >{{ error }}</p>

      <button
        type="button" data-test="resolve-confirm" :disabled="!canConfirm" :aria-busy="busy ? 'true' : 'false'"
        :class="['w-full rounded-btn px-4 py-3 text-sm font-medium text-white transition-[background-color,scale] active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100',
          strong ? 'bg-danger hover:bg-danger/90' : 'bg-primary hover:bg-primary/90']"
        @click="onConfirm"
      >{{ confirmLabel }} <KeyHint tone="inverse" class="ml-1">⏎</KeyHint></button>
    </div>
  </section>
</template>
