<script setup lang="ts">
import { computed } from 'vue'
import ActiveSwitch from '@/features/video-modals/components/ActiveSwitch.vue'
import {
  FREQUENCY_DAYS_MAX, FREQUENCY_DAYS_MIN, MODAL_FREQUENCIES, type ModalFrequency,
} from '@/features/video-modals/types/index'
import { MAX_DISPLAYS_MAX, MAX_DISPLAYS_MIN } from '@/features/video-modals/lib/validation'

/**
 * « À quelle fréquence ? » : une fois, jusqu'à N fois, à chaque ouverture ou tous les N jours, avec les
 * règles de réponse (arrêt après un bouton touché, case « Ne plus afficher »), la priorité et la période.
 * Une vidéo propose « une fois » et « jusqu'à N fois » ; une information, les quatre.
 */
const props = defineProps<{
  isInfo: boolean
  errors: Partial<Record<'frequency' | 'frequencyDays' | 'maxDisplays' | 'priority' | 'period', string | undefined>>
}>()

const frequency = defineModel<ModalFrequency>('frequency', { required: true })
const maxDisplays = defineModel<number | string>('maxDisplays', { required: true })
const frequencyDays = defineModel<number | string | null>('frequencyDays', { required: true })
const stopAfterAnswer = defineModel<boolean>('stopAfterAnswer', { required: true })
const allowDontShowAgain = defineModel<boolean>('allowDontShowAgain', { required: true })
const priority = defineModel<number | string>('priority', { required: true })
const startsAt = defineModel<string>('startsAt', { required: true })
const endsAt = defineModel<string>('endsAt', { required: true })

/** Une campagne déjà réglée sur une fréquence « information » la garde visible, même si elle est vidéo. */
const options = computed(() => MODAL_FREQUENCIES.filter(f => props.isInfo || f === 'ONCE' || f === 'UP_TO_N' || f === frequency.value))

const inputClass = 'rounded-btn border border-border bg-bg p-2 text-center text-sm font-bold tabular-nums text-accent'
const errClass = 'mt-1 text-xs text-danger'
const optClass = (f: ModalFrequency) =>
  ['flex cursor-pointer items-start gap-2.5 rounded-btn border-2 px-3.5 py-2.5 text-sm transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-primary',
   frequency.value === f ? 'border-primary bg-primary/10' : 'border-border hover:bg-surface-elevated']
</script>

<template>
  <fieldset data-test="vm-frequency">
    <legend class="sr-only">À quelle fréquence ?</legend>
    <div class="grid gap-5 lg:grid-cols-2">
      <div role="radiogroup" aria-label="Fréquence" class="space-y-2">
        <label v-for="f in options" :key="f" :data-test="`vm-frequency-${f}`" :class="optClass(f)">
          <input v-model="frequency" type="radio" name="vm-frequency" class="mt-1 accent-primary" :value="f">
          <span v-if="f === 'ONCE'"><b>Une seule fois</b><span class="block text-xs text-text-muted">Par version du modal.</span></span>
          <span v-else-if="f === 'UP_TO_N'" class="flex flex-wrap items-center gap-1.5">
            <b>Jusqu’à</b>
            <input
              v-model.number="maxDisplays" data-test="vm-max" type="number" :min="MAX_DISPLAYS_MIN" :max="MAX_DISPLAYS_MAX" step="1"
              aria-label="Nombre d’affichages" :class="[inputClass, 'w-16']" @input="frequency = 'UP_TO_N'" @focus="frequency = 'UP_TO_N'"
            >
            <b>fois</b>
            <span class="w-full text-xs text-text-muted">Fermé d’un geste sans toucher un bouton, il revient au déclencheur suivant, jusqu’à ce plafond par version.</span>
          </span>
          <span v-else-if="f === 'EVERY_OPEN'"><b>À chaque ouverture de l’app</b><span class="block text-xs text-text-muted">Un seul modal par ouverture.</span></span>
          <span v-else class="flex flex-wrap items-center gap-1.5">
            <b>Au plus une fois tous les</b>
            <input
              v-model.number="frequencyDays" data-test="vm-frequency-days" type="number" :min="FREQUENCY_DAYS_MIN" :max="FREQUENCY_DAYS_MAX" step="1"
              aria-label="Nombre de jours" :class="[inputClass, 'w-16']" @input="frequency = 'EVERY_N_DAYS'" @focus="frequency = 'EVERY_N_DAYS'"
            >
            <b>jours</b>
            <span class="w-full text-xs text-text-muted">Tant que la campagne est active.</span>
          </span>
        </label>
        <p v-if="errors.frequency" :class="errClass">{{ errors.frequency }}</p>
        <p v-if="errors.maxDisplays" data-test="vm-max-error" :class="errClass">{{ errors.maxDisplays }}</p>
        <p v-if="errors.frequencyDays" data-test="vm-frequency-days-error" :class="errClass">{{ errors.frequencyDays }}</p>
      </div>

      <div class="space-y-2">
        <div class="flex items-center justify-between gap-4 rounded-btn border border-border px-4 py-3">
          <span class="text-sm">
            <b class="block font-semibold">Ne plus afficher après un bouton touché</b>
            <span class="text-xs text-text-muted">Arrêté pour cette version dès qu’un bouton est touché. Coupé : seuls la fréquence et le plafond comptent.</span>
          </span>
          <ActiveSwitch v-model="stopAfterAnswer" data-test="vm-stop-after-answer" label="Ne plus afficher après un bouton touché" />
        </div>
        <div class="flex items-center justify-between gap-4 rounded-btn border border-border px-4 py-3">
          <span class="text-sm">
            <b class="block font-semibold">Case « Ne plus afficher »</b>
            <span class="text-xs text-text-muted">Visible dans le modal : la personne le coupe elle-même, pour cette version.</span>
          </span>
          <ActiveSwitch v-model="allowDontShowAgain" data-test="vm-dont-show-again" label="Case « Ne plus afficher »" />
        </div>
        <p v-if="allowDontShowAgain" data-test="vm-dont-show-note" class="text-xs text-text-muted text-pretty">
          Cochée, la case est une réponse définitive : le modal ne revient plus, quelle que soit la fréquence.
          Elle ne s’affiche que sur la version récente de l’application ; les anciennes versions ne reçoivent pas ce modal.
        </p>

        <label class="block text-xs font-semibold text-text-muted">Priorité
          <span class="mt-1 flex items-center gap-2">
            <input v-model.number="priority" data-test="vm-priority" type="number" step="1" :class="[inputClass, 'w-20']">
            <span class="text-xs font-normal text-text-muted text-pretty">Plus le chiffre est haut, plus la campagne passe en premier ; à égalité, la version la plus récente.</span>
          </span>
          <span v-if="errors.priority" data-test="vm-priority-error" :class="errClass">{{ errors.priority }}</span>
        </label>

        <div class="grid gap-3 sm:grid-cols-2">
          <label class="block text-xs font-semibold text-text-muted">Début (facultatif)
            <input v-model="startsAt" data-test="vm-starts" type="datetime-local" class="mt-1 w-full rounded-btn border border-border bg-bg p-2 text-sm">
          </label>
          <label class="block text-xs font-semibold text-text-muted">Fin (facultatif)
            <input v-model="endsAt" data-test="vm-ends" type="datetime-local" class="mt-1 w-full rounded-btn border border-border bg-bg p-2 text-sm">
            <span v-if="errors.period" :class="errClass">{{ errors.period }}</span>
          </label>
        </div>
        <p v-if="isInfo" class="text-xs text-text-muted text-pretty">Pour une promotion, des dates de début et de fin sont conseillées.</p>
        <p class="text-xs text-text-muted text-pretty">Réglage global : au maximum <b>1 modal par jour</b> et par personne, tous types confondus.</p>
      </div>
    </div>
  </fieldset>
</template>
