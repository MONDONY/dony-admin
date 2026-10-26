<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import KeyHint from '@/components/ui/KeyHint.vue'
import { useAuthStore } from '@/stores/auth'
import {
  alertActionsFor,
  ALERT_ACTION_HELP,
  ALERT_ACTION_LABELS,
  ALERT_NOTE_MAX,
  alertNoteError,
  DEFAULT_SNOOZE_HOURS,
  isGroupAction,
  isNoteRequired,
  QUICK_NOTES,
  SNOOZE_CHOICES,
  type AlertAction,
  type DecisionScope,
} from '@/features/alerts/lib/alertWorkbench'
import type { AdminAlert } from '@/features/alerts/types/index'

const props = withDefaults(defineProps<{
  /** Alerte à traiter ; null = rien de sélectionné. */
  alert: AdminAlert | null
  /** Alertes ouvertes du même type (celle-ci comprise) : au-delà d'une, on peut les résoudre ensemble. */
  groupOpenCount?: number
  busy?: boolean
  /** Refus du back à montrer sans perdre la saisie. */
  error?: string | null
  /** Une autre alerte attend après celle-ci : le bouton le dit. */
  hasNext?: boolean
  /** Gestes que le serveur ne sait pas encore faire (ancien back) : retirés de la liste. */
  unavailable?: AlertAction[]
  /** Horloge injectable (tests) pour savoir si l'alerte est reportée. */
  now?: number
}>(), { groupOpenCount: 1, busy: false, error: null, hasNext: true, unavailable: () => [], now: undefined })
const emit = defineEmits<{ confirm: [action: AlertAction, note: string, scope: DecisionScope, hours: number] }>()

const auth = useAuthStore()
const chosen = ref<AlertAction>('FIXED')
const note = ref('')
const scope = ref<DecisionScope>('one')
const acknowledged = ref(false)
const hours = ref(DEFAULT_SNOOZE_HOURS)

const canResolve = computed(() => auth.can('ALERT_RESOLVE'))
const actions = computed<AlertAction[]>(() => (props.alert
  ? alertActionsFor(props.alert, props.now).filter((a) => !props.unavailable.includes(a))
  : []))
const options = computed(() => actions.value.map((value, i) => ({ value, key: i + 1, label: ALERT_ACTION_LABELS[value], help: ALERT_ACTION_HELP[value] })))
const open = computed(() => !!props.alert && !props.alert.resolved)
const showScope = computed(() => open.value && props.groupOpenCount > 1 && isGroupAction(chosen.value))
const bulk = computed(() => showScope.value && scope.value === 'group')
const required = computed(() => isNoteRequired(chosen.value))
const noteProblem = computed(() => alertNoteError(note.value, chosen.value))
const canConfirm = computed(() => !props.busy && !noteProblem.value && (!bulk.value || acknowledged.value))
const hoursLabel = computed(() => SNOOZE_CHOICES.find((c) => c.hours === hours.value)?.label ?? `${hours.value} h`)
const baseLabel = computed(() => {
  if (bulk.value) return `Résoudre les ${props.groupOpenCount} alertes`
  if (chosen.value === 'SNOOZE') return `Reporter de ${hoursLabel.value}`
  return ALERT_ACTION_LABELS[chosen.value]
})
const confirmLabel = computed(() => (props.hasNext && !bulk.value && chosen.value !== 'UNSNOOZE' ? `${baseLabel.value} et passer à la suivante` : baseLabel.value))
const placeholder = computed(() => (required.value ? 'Ce qui a été fait (obligatoire)' : 'Note (facultative)'))
const consequence = computed(() => {
  if (chosen.value === 'SNOOZE') return 'L’alerte reste ouverte mais quitte la file : elle y revient seule à la date choisie, et l’onglet Reportées la garde en attendant.'
  if (chosen.value === 'UNSNOOZE') return 'Elle revient dans la file tout de suite.'
  if (chosen.value === 'REOPEN') return 'L’alerte revient dans la file des ouvertes. Refusé s’il en existe déjà une du même type.'
  return 'Résoudre n’envoie aucun message : l’alerte quitte la file et reste dans l’historique et dans l’Audit.'
})
const emptyMessage = computed(() => {
  if (!props.alert) return null
  if (!canResolve.value) return 'Votre rôle ne permet pas de traiter les alertes.'
  if (options.value.length === 0) {
    return props.alert.resolved
      ? 'Cette alerte est déjà résolue. Sa note est dans l’Audit.'
      : 'Aucun geste disponible pour cette alerte.'
  }
  return null
})
const showForm = computed(() => !!props.alert && canResolve.value && options.value.length > 0)

// Une autre alerte (ou un autre état de la même) repart de zéro ; la note d'un geste ne vaut pas pour la suivante.
watch(() => [props.alert?.id, props.alert?.resolved, props.alert?.snoozedUntil], () => {
  chosen.value = actions.value[0] ?? 'FIXED'
  note.value = ''
  scope.value = 'one'
  acknowledged.value = false
  hours.value = DEFAULT_SNOOZE_HOURS
}, { immediate: true })
watch([scope, chosen], () => { acknowledged.value = false })

function onConfirm() {
  if (!canConfirm.value || !showForm.value) return
  emit('confirm', chosen.value, note.value.trim(), bulk.value ? 'group' : 'one', hours.value)
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
    aria-labelledby="alert-decision-title" data-test="alert-decision-panel"
    class="flex max-h-[calc(100vh-18rem)] min-h-0 flex-col overflow-hidden rounded-card border border-border bg-surface"
  >
    <div class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
      <div class="flex items-baseline justify-between gap-2">
        <h2 id="alert-decision-title" class="font-display text-lg font-semibold text-balance">Décision</h2>
        <span v-if="showForm && options.length > 1" class="text-xs text-text-muted">Touches 1 à {{ options.length }}</span>
      </div>

      <p
        v-if="!alert" data-test="alert-decision-empty"
        class="rounded-btn border border-border bg-surface-elevated px-3 py-2 text-sm text-text-muted text-pretty"
      >Sélectionne une alerte dans la liste pour la traiter.</p>
      <p
        v-else-if="emptyMessage" :data-test="!canResolve ? 'alert-no-action' : 'alert-decision-resolved'"
        class="rounded-btn border border-border bg-surface-elevated px-3 py-2 text-sm text-text-muted text-pretty"
      >{{ emptyMessage }}</p>

      <template v-else>
        <div v-if="showScope" role="group" aria-label="Portée" class="flex gap-1 rounded-btn bg-surface-elevated p-0.5">
          <button
            type="button" data-test="scope-one" :aria-pressed="scope === 'one' ? 'true' : 'false'"
            :class="['flex-1 rounded-btn px-2 py-1.5 text-sm transition-colors', scope === 'one' ? 'bg-surface font-semibold shadow-sm' : 'text-text-muted hover:text-text']"
            @click="scope = 'one'"
          >Cette alerte</button>
          <button
            type="button" data-test="scope-group" :aria-pressed="scope === 'group' ? 'true' : 'false'"
            :class="['flex-1 rounded-btn px-2 py-1.5 text-sm transition-colors', scope === 'group' ? 'bg-surface font-semibold shadow-sm' : 'text-text-muted hover:text-text']"
            @click="scope = 'group'"
          >Les {{ groupOpenCount }} du groupe</button>
        </div>

        <fieldset class="space-y-1.5">
          <legend class="sr-only">Action</legend>
          <label
            v-for="o in options" :key="o.value" :data-test="`alert-action-${o.value}`"
            :class="['flex cursor-pointer items-start gap-3 rounded-btn border px-3 py-2.5 transition-[background-color,border-color,scale] active:scale-[0.985]',
              chosen === o.value ? 'border-primary bg-primary/5' : 'border-border hover:bg-surface-elevated']"
          >
            <input v-model="chosen" type="radio" name="alert-action" :value="o.value" class="sr-only">
            <KeyHint class="mt-0.5">{{ o.key }}</KeyHint>
            <span class="min-w-0">
              <span class="block text-sm font-medium">{{ o.label }}</span>
              <span class="block text-xs text-text-muted text-pretty">{{ o.help }}</span>
            </span>
          </label>
        </fieldset>

        <div v-if="chosen === 'SNOOZE'" role="group" aria-label="Durée du report" data-test="snooze-hours" class="flex flex-wrap gap-1.5">
          <button
            v-for="c in SNOOZE_CHOICES" :key="c.hours" type="button" :data-test="`snooze-${c.hours}`"
            :aria-pressed="hours === c.hours ? 'true' : 'false'"
            :class="['rounded-full border px-3 py-1 text-sm transition-colors', hours === c.hours ? 'border-primary bg-primary/10 font-medium text-primary' : 'border-border text-text-muted hover:text-text']"
            @click="hours = c.hours"
          >{{ c.label }}</button>
        </div>

        <div>
          <label for="alert-note" class="mb-1 block text-xs font-medium">Note <span class="font-normal text-text-muted">— conservée dans l’audit</span></label>
          <textarea
            id="alert-note" v-model="note" data-test="alert-note" rows="2"
            :placeholder="placeholder" :aria-invalid="note.trim() && noteProblem ? 'true' : 'false'"
            class="w-full rounded-btn border border-border bg-bg p-2 text-sm"
          />
          <p v-if="note.trim() && noteProblem" data-test="alert-note-problem" class="mt-1 text-xs text-warning text-pretty">{{ noteProblem }}</p>
          <p v-else class="mt-1 text-right text-xs tabular-nums text-text-muted">{{ note.trim().length }}/{{ ALERT_NOTE_MAX }}</p>
          <div v-if="QUICK_NOTES[chosen].length" class="mt-2 flex flex-wrap gap-1.5" data-test="alert-quick-notes">
            <button
              v-for="q in QUICK_NOTES[chosen]" :key="q" type="button" :data-test="`alert-quick-${q}`"
              class="rounded-full border border-border px-2.5 py-1 text-xs text-text-muted transition-[background-color,scale] hover:bg-surface-elevated hover:text-text active:scale-[0.96]"
              @click="note = q"
            >{{ q }}</button>
          </div>
        </div>

        <div
          v-if="bulk" data-test="alert-bulk-warning" role="note"
          class="rounded-btn border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning"
        >
          <p class="text-pretty">La même note sera appliquée aux {{ groupOpenCount }} alertes ouvertes de ce type. Chacune garde sa ligne dans l’Audit.</p>
          <label class="mt-2 flex cursor-pointer items-center gap-2 text-xs">
            <input v-model="acknowledged" data-test="alert-acknowledge" type="checkbox">
            J’ai vérifié que les {{ groupOpenCount }} alertes sont traitées
          </label>
        </div>
        <p class="rounded-btn bg-surface-elevated p-3 text-xs text-text-muted text-pretty" data-test="alert-preview">{{ consequence }}</p>
      </template>
    </div>

    <!-- Le geste principal reste sous la main : seul le contenu au-dessus défile -->
    <div v-if="showForm" class="flex flex-col gap-2 border-t border-border bg-surface p-4">
      <p
        v-if="error" data-test="alert-error" role="alert"
        class="rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger text-pretty"
      >{{ error }}</p>
      <button
        type="button" data-test="alert-confirm" :disabled="!canConfirm" :aria-busy="busy ? 'true' : 'false'"
        class="w-full rounded-btn bg-primary px-4 py-3 text-sm font-medium text-white transition-[background-color,scale] hover:bg-primary/90 active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100"
        @click="onConfirm"
      >{{ confirmLabel }} <KeyHint tone="inverse" class="ml-1">⏎</KeyHint></button>
    </div>
  </section>
</template>
