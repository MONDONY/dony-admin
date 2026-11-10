<script setup lang="ts">
import { computed } from 'vue'
import SituationChip from '@/features/video-modals/components/SituationChip.vue'
import type { SituationDraft } from '@/features/video-modals/lib/form'
import {
  COMING_SOON_MOMENTS, NO_DELAY_TRIGGERS, OPEN_DELAY_SECONDS, SITUATIONS, SITUATION_KINDS, TRIGGER_CHIP_LABELS, VIDEO_MODAL_TRIGGERS,
  type SituationKind, type VideoModalTrigger,
} from '@/features/video-modals/types/index'

/**
 * « Quand s'ouvre-t-il ? » : un moment (l'app le déclenche sur le coup, en bleu) ou une situation
 * (constatée par le serveur, vraie tant que la condition tient, en orange). Les moments d'action et de
 * recherche de l'étape 2 sont montrés grisés avec « Bientôt » : ils ne peuvent pas être choisis.
 */
const props = defineProps<{
  triggers: VideoModalTrigger[]
  situations: SituationDraft[]
  isInfo: boolean
  error?: string
  situationsError?: string
}>()
const emit = defineEmits<{
  'toggle-trigger': [trigger: VideoModalTrigger]
  'toggle-situation': [kind: SituationKind]
  'set-situation-value': [kind: SituationKind, value: number | string]
}>()

const situationOf = (kind: SituationKind) => props.situations.find(s => s.kind === kind)
const groupKinds = (group: 'PAYMENT' | 'ACCOUNT') => SITUATION_KINDS.filter(k => SITUATIONS[k].group === group)
const hasNoDelay = computed(() => props.triggers.some(t => NO_DELAY_TRIGGERS.includes(t)))

const chip = 'inline-flex cursor-pointer items-center rounded-full border-2 px-3.5 py-1.5 text-sm font-semibold transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-primary'
const soon = 'cursor-not-allowed border-border opacity-50'
const badge = 'ml-2 rounded-full bg-surface-elevated px-2 py-0.5 text-[11px] font-bold text-text-muted'
const labelClass = 'mb-2 mt-4 text-xs font-bold uppercase tracking-wide text-text-muted'
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
      <label
        v-for="t in VIDEO_MODAL_TRIGGERS" :key="t" :data-test="`vm-trigger-${t}`"
        :class="[chip, triggers.includes(t) ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-surface-elevated']"
      >
        <input type="checkbox" class="sr-only" :checked="triggers.includes(t)" @change="emit('toggle-trigger', t)">
        {{ TRIGGER_CHIP_LABELS[t] }}
      </label>
    </div>

    <p :class="labelClass">Après une action réussie</p>
    <div class="flex flex-wrap gap-2" data-test="vm-coming-soon">
      <span v-for="l in COMING_SOON_MOMENTS.ACTION" :key="l" aria-disabled="true" :class="[chip, soon]">{{ l }}<span :class="badge">Bientôt</span></span>
    </div>

    <p :class="labelClass">Recherche et intérêt</p>
    <div class="flex flex-wrap gap-2">
      <span v-for="l in COMING_SOON_MOMENTS.SEARCH" :key="l" aria-disabled="true" :class="[chip, soon]">{{ l }}<span :class="badge">Bientôt</span></span>
    </div>

    <p :class="labelClass">Paiement et offres</p>
    <div class="flex flex-wrap gap-2">
      <span v-for="l in COMING_SOON_MOMENTS.PAYMENT" :key="l" aria-disabled="true" :class="[chip, soon]">{{ l }}<span :class="badge">Bientôt</span></span>
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
      <span v-for="l in COMING_SOON_MOMENTS.ACCOUNT" :key="l" aria-disabled="true" :class="[chip, soon]">{{ l }}<span :class="badge">Bientôt</span></span>
    </div>
    <p v-if="situations.length > 0" data-test="vm-situations-note" class="mt-2 text-xs text-text-muted text-pretty">
      Une situation se vérifie sur le compte : ce modal n’est jamais montré aux visiteurs sans compte, et toutes les situations cochées doivent être vraies en même temps.
      Sans écran ni bouton coché, il s’ouvre à l’ouverture de l’app.
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
