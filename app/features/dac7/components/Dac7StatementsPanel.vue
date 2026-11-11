<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ConfirmActionDialog from '@/components/ui/ConfirmActionDialog.vue'
import { useDac7Statements } from '@/features/dac7/composables/useDac7Statements'
import { DAC7_UNAVAILABLE, closedYears, currentUtcYear } from '@/features/dac7/types/index'

/**
 * Envoi du récapitulatif annuel aux voyageurs déclarés. Geste de l'admin, jamais automatique ;
 * la confirmation demande de saisir un mot pour éviter l'envoi par un clic distrait. Le back
 * refuse une année qui n'est pas terminée (422 `dac7-year-not-closed`) : ce panneau a son propre
 * sélecteur, limité aux années terminées, et ne suit pas l'année de la page quand elle est en cours.
 */
const props = defineProps<{
  year: number
  /** Noms des voyageurs déjà chargés dans le tableau, par identifiant (nomment les voyageurs sans e-mail). */
  names?: Record<string, string>
}>()
const emit = defineEmits<{ busy: [value: boolean] }>()

const CONFIRM_WORD = 'ENVOYER'
const statements = useDac7Statements()
const confirming = ref(false)

const utcYear = currentUtcYear()
const years = closedYears(utcYear)
/** L'année de la page quand elle est terminée, sinon la plus récente année terminée. */
const sendYear = ref<number | null>(years.includes(props.year) ? props.year : (years[0] ?? null))
const noEmail = computed(() => {
  const r = statements.result.value
  const ids = r?.skippedNoEmailTravelerIds ?? []
  const count = r?.skippedNoEmail ?? ids.length
  return { count, names: ids.map(id => props.names?.[id] || id) }
})
const pageYearOpen = computed(() => props.year >= utcYear)

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n > 1 ? many : one}`

async function onConfirm() {
  confirming.value = false
  if (sendYear.value !== null) await statements.send(sendYear.value)
}

watch(sendYear, () => statements.reset())
watch(() => props.year, (y) => { if (years.includes(y)) sendYear.value = y })
// La page verrouille le sélecteur d'année pendant l'envoi : le résultat reste celui de l'année affichée.
watch(() => statements.busy.value, v => emit('busy', v))
</script>

<template>
  <section aria-label="Récapitulatifs aux voyageurs" data-test="dac7-statements-panel" class="flex flex-col gap-3 rounded-card border border-border bg-surface p-5">
    <h2 class="font-display text-lg font-bold">Récapitulatifs aux voyageurs</h2>
    <p class="text-sm text-text-muted text-pretty">
      Chaque voyageur déclaré reçoit son récapitulatif de l’année (notification, et e-mail si possible), une seule fois
      par année. Aucun voyageur non déclaré n’est sollicité.
    </p>
    <label v-if="years.length" class="flex items-center gap-2 text-sm text-text-muted">
      Année du récapitulatif
      <select
        v-model.number="sendYear" data-test="dac7-statements-year" :disabled="statements.busy.value"
        class="rounded-btn border border-border bg-bg px-3 py-1.5 text-sm text-text"
      >
        <option v-for="y in years" :key="y" :value="y">{{ y }}</option>
      </select>
    </label>
    <p v-if="!years.length" data-test="dac7-statements-closed-hint" class="text-sm text-text-muted text-pretty">
      Aucune année n’est encore terminée : le récapitulatif d’une année ne peut être envoyé qu’après la fin de cette année.
    </p>
    <p v-else-if="pageYearOpen" data-test="dac7-statements-closed-hint" class="text-sm text-text-muted text-pretty">
      L’année {{ year }} n’est pas terminée : le récapitulatif d’une année ne peut être envoyé qu’après la fin de cette année.
    </p>
    <div>
      <button
        type="button" data-test="dac7-statements-send" :disabled="statements.busy.value || sendYear === null"
        class="rounded-btn border border-border px-4 py-2 text-sm transition-[background-color,scale] hover:bg-surface-elevated active:scale-[0.96] disabled:opacity-40"
        @click="confirming = true"
      >Envoyer les récapitulatifs aux voyageurs</button>
    </div>

    <p v-if="statements.unavailable.value" data-test="dac7-unavailable" class="text-sm text-text-muted">{{ DAC7_UNAVAILABLE }}</p>
    <p
      v-if="statements.error.value" data-test="dac7-statements-error" role="alert"
      class="rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger text-pretty"
    >{{ statements.error.value }}</p>
    <p
      v-if="statements.result.value" data-test="dac7-statements-result" role="status"
      class="rounded-btn border border-success/40 bg-success/10 px-3 py-2 text-sm text-success"
    >{{ plural(statements.result.value.sent ?? 0, 'envoyé') }}, {{ plural(statements.result.value.skipped ?? 0, 'ignoré') }}, {{ noEmail.count }} sans e-mail.</p>
    <div
      v-if="noEmail.count > 0" data-test="dac7-statements-no-email" role="status"
      class="rounded-btn border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-text"
    >
      <p class="text-pretty">
        {{ plural(noEmail.count, 'voyageur n’a', 'voyageurs n’ont') }} pas d’e-mail : {{ noEmail.count > 1 ? 'ils ne peuvent' : 'il ne peut' }} pas recevoir {{ noEmail.count > 1 ? 'leur récapitulatif' : 'son récapitulatif' }} pour l’instant.
      </p>
      <p v-if="noEmail.names.length" data-test="dac7-statements-no-email-names" class="mt-1 text-xs text-text-muted text-pretty">{{ noEmail.names.join(', ') }}</p>
    </div>

    <ConfirmActionDialog
      :open="confirming" title="Envoyer les récapitulatifs"
      :message="`Le récapitulatif ${sendYear} part à chaque voyageur déclaré qui ne l’a pas déjà reçu. Cet envoi ne peut pas être rappelé.`"
      :confirmation-phrase="CONFIRM_WORD" :confirmation-label="`Saisissez « ${CONFIRM_WORD} » pour confirmer`"
      confirm-label="Envoyer" confirm-tone="primary"
      @confirm="onConfirm" @cancel="confirming = false"
    />
  </section>
</template>
