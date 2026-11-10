<script setup lang="ts">
import { computed } from 'vue'
import TriggerChip from '@/features/video-modals/components/TriggerChip.vue'
import SituationChip from '@/features/video-modals/components/SituationChip.vue'
import type { SituationDraft, TriggerOptionsDraft } from '@/features/video-modals/lib/form'
import {
  FEW_RESULTS_DEFAULT, FEW_RESULTS_MAX, FEW_RESULTS_MIN, MOMENT_GROUPS, NO_DELAY_TRIGGERS, OPEN_DELAY_SECONDS, SCREEN_TRIGGERS, SITUATIONS,
  SITUATION_KINDS, TRIP_VIEWED_DEFAULT, TRIP_VIEWED_MAX, TRIP_VIEWED_MIN, isMomentTrigger,
  type SituationKind, type VideoModalTrigger,
} from '@/features/video-modals/types/index'

/**
 * « Quand s'ouvre-t-il ? » : un moment (l'app le déclenche sur le coup, en bleu) ou une situation
 * (constatée par le serveur, vraie tant que la condition tient, en orange). Les moments d'action et de
 * recherche (étape 2) sont des pastilles bleues comme les écrans ; « peu de résultats » et « même trajet
 * consulté » montrent leur seuil seulement une fois cochés.
 */
const props = withDefaults(defineProps<{
  triggers: VideoModalTrigger[]
  situations: SituationDraft[]
  isInfo: boolean
  /** Seuils des moments de recherche ; défauts de l'étape 2 si absents. */
  triggerOptions?: TriggerOptionsDraft
  error?: string
  situationsError?: string
  fewResultsError?: string
  tripViewedError?: string
}>(), {
  triggerOptions: () => ({ fewResultsMax: FEW_RESULTS_DEFAULT, tripViewedTimes: TRIP_VIEWED_DEFAULT }),
  error: undefined,
  situationsError: undefined,
  fewResultsError: undefined,
  tripViewedError: undefined,
})
const emit = defineEmits<{
  'toggle-trigger': [trigger: VideoModalTrigger]
  'toggle-situation': [kind: SituationKind]
  'set-situation-value': [kind: SituationKind, value: number | string]
  'set-trigger-option': [key: keyof TriggerOptionsDraft, value: number | string]
}>()

const situationOf = (kind: SituationKind) => props.situations.find(s => s.kind === kind)
const groupKinds = (group: 'PAYMENT' | 'ACCOUNT') => SITUATION_KINDS.filter(k => SITUATIONS[k].group === group)
const hasNoDelay = computed(() => props.triggers.some(t => NO_DELAY_TRIGGERS.includes(t)))
const hasMoment = computed(() => props.triggers.some(isMomentTrigger))
const fewResultsOn = computed(() => props.triggers.includes('SEARCH_FEW_RESULTS'))
const tripViewedOn = computed(() => props.triggers.includes('TRIP_VIEWED_REPEATEDLY'))

const chip = 'inline-flex items-center rounded-full border-2 px-3.5 py-1.5 text-sm font-semibold'
const labelClass = 'mb-2 mt-4 text-xs font-bold uppercase tracking-wide text-text-muted'
const optionRow = 'mt-2 flex flex-wrap items-center gap-2 rounded-btn bg-surface-elevated p-2.5 text-sm'
const optionInput = 'w-16 rounded-btn border border-primary bg-bg p-1.5 text-center text-sm font-bold tabular-nums text-primary'
const errClass = 'mt-1 text-xs text-danger'
</script>

<template>
  <fieldset data-test="vm-when">
    <legend class="sr-only">Quand s’ouvre-t-il ? (un ou plusieurs déclencheurs)</legend>
    <p class="mb-2 text-xs text-text-muted text-pretty">
      Un <b class="text-primary">moment</b> se produit dans l’app ; une <b class="text-accent">situation</b> est constatée par le serveur
      et reste vraie tant que la condition tient.
    </p>

    <p :class="labelClass">Écrans et boutons</p>
    <div class="flex flex-wrap gap-2">
      <TriggerChip v-for="t in SCREEN_TRIGGERS" :key="t" :trigger="t" :checked="triggers.includes(t)" @toggle="emit('toggle-trigger', t)" />
    </div>

    <p :class="labelClass">Après une action réussie</p>
    <div class="flex flex-wrap gap-2" data-test="vm-moments-action">
      <TriggerChip v-for="t in MOMENT_GROUPS.ACTION" :key="t" :trigger="t" :checked="triggers.includes(t)" @toggle="emit('toggle-trigger', t)" />
    </div>

    <p :class="labelClass">Recherche et intérêt</p>
    <div class="flex flex-wrap gap-2" data-test="vm-moments-search">
      <TriggerChip v-for="t in MOMENT_GROUPS.SEARCH" :key="t" :trigger="t" :checked="triggers.includes(t)" @toggle="emit('toggle-trigger', t)" />
    </div>
    <div v-if="fewResultsOn" data-test="vm-opt-few-results" :class="optionRow">
      <label for="vm-few-results-max" class="font-semibold">Seuil de peu de résultats</label>
      <span>de 1 à</span>
      <input
        id="vm-few-results-max" type="number" :min="FEW_RESULTS_MIN" :max="FEW_RESULTS_MAX" step="1" data-test="vm-few-results-max"
        :value="triggerOptions.fewResultsMax" :class="optionInput"
        @input="emit('set-trigger-option', 'fewResultsMax', ($event.target as HTMLInputElement).value)"
      >
      <span>résultats</span>
      <span class="text-xs text-text-muted">De {{ FEW_RESULTS_MIN }} à {{ FEW_RESULTS_MAX }} ; zéro résultat a son propre moment.</span>
    </div>
    <p v-if="fewResultsOn && fewResultsError" data-test="vm-few-results-error" :class="errClass">{{ fewResultsError }}</p>
    <div v-if="tripViewedOn" data-test="vm-opt-trip-viewed" :class="optionRow">
      <label for="vm-trip-viewed-times" class="font-semibold">Consultations d’un même trajet</label>
      <input
        id="vm-trip-viewed-times" type="number" :min="TRIP_VIEWED_MIN" :max="TRIP_VIEWED_MAX" step="1" data-test="vm-trip-viewed-times"
        :value="triggerOptions.tripViewedTimes" :class="optionInput"
        @input="emit('set-trigger-option', 'tripViewedTimes', ($event.target as HTMLInputElement).value)"
      >
      <span>fois</span>
      <span class="text-xs text-text-muted">De {{ TRIP_VIEWED_MIN }} à {{ TRIP_VIEWED_MAX }}, compté sur l’appareil.</span>
    </div>
    <p v-if="tripViewedOn && tripViewedError" data-test="vm-trip-viewed-error" :class="errClass">{{ tripViewedError }}</p>

    <p :class="labelClass">Paiement et offres</p>
    <div class="flex flex-wrap gap-2">
      <TriggerChip v-for="t in MOMENT_GROUPS.PAYMENT" :key="t" :trigger="t" :checked="triggers.includes(t)" @toggle="emit('toggle-trigger', t)" />
      <SituationChip
        v-for="k in groupKinds('PAYMENT')" :key="k" :kind="k" :draft="situationOf(k)"
        @toggle="emit('toggle-situation', k)" @set-value="v => emit('set-situation-value', k, v)"
      />
    </div>

    <p :class="labelClass">Compte et fidélisation</p>
    <div class="flex flex-wrap gap-2">
      <SituationChip
        v-for="k in groupKinds('ACCOUNT')" :key="k" :kind="k" :draft="situationOf(k)"
        @toggle="emit('toggle-situation', k)" @set-value="v => emit('set-situation-value', k, v)"
      />
      <TriggerChip v-for="t in MOMENT_GROUPS.ACCOUNT" :key="t" :trigger="t" :checked="triggers.includes(t)" @toggle="emit('toggle-trigger', t)" />
    </div>
    <p v-if="hasMoment" data-test="vm-moments-compat-note" class="mt-2 rounded-btn border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-text text-pretty">
      Les anciennes versions de l’app ne verront que les moments d’écran et de bouton : un moment d’action ne s’ouvre que sur la version récente de l’application.
    </p>
    <p v-if="situations.length > 0" data-test="vm-situations-note" class="mt-2 text-xs text-text-muted text-pretty">
      Une situation se vérifie sur le compte : ce modal n’est jamais montré aux visiteurs sans compte, et toutes les situations cochées doivent être vraies en même temps.
      Sans écran, bouton ni moment coché, il s’ouvre à l’ouverture de l’app.
    </p>
    <p v-if="situationsError" data-test="vm-situations-error" class="mt-1 text-xs text-danger">{{ situationsError }}</p>

    <p :class="labelClass">Délai d’ouverture</p>
    <div class="flex flex-wrap items-center gap-2">
      <span data-test="vm-delay" :class="[chip, 'cursor-default border-primary bg-primary/10 text-primary']">
        {{ OPEN_DELAY_SECONDS }} secondes après le déclencheur
      </span>
      <span class="text-xs text-text-muted text-pretty">
        Fixe pour l’instant.<template v-if="hasNoDelay"> Les boutons « Publier un trajet » et « Envoyer un colis » ouvrent le modal sans délai, avant le formulaire.</template>
      </span>
    </div>

    <p v-if="isInfo" class="mt-3 text-xs text-text-muted text-pretty">
      L’app n’ouvre qu’un seul modal par ouverture, et au plus un par jour et par personne, tous modals confondus. Si le bouton ouvre un formulaire, il s’ouvre directement, sans rejouer un modal.
    </p>
    <p v-else class="mt-3 text-xs text-text-muted text-pretty">
      Sur « Publier un trajet » ou « Envoyer un colis », le modal s’ouvre avant le formulaire ; « Commencer » ou la fin de la vidéo mènent ensuite au formulaire.
      L’app n’ouvre qu’un seul modal par ouverture, et au plus un par jour et par personne, tous modals confondus.
    </p>
    <p v-if="error" data-test="vm-triggers-error" class="mt-1 text-xs text-danger">{{ error }}</p>
  </fieldset>
</template>
