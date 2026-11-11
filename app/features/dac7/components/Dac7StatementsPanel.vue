<script setup lang="ts">
import { ref, watch } from 'vue'
import ConfirmActionDialog from '@/components/ui/ConfirmActionDialog.vue'
import { useDac7Statements } from '@/features/dac7/composables/useDac7Statements'
import { DAC7_UNAVAILABLE } from '@/features/dac7/types/index'

/**
 * Envoi du récapitulatif annuel aux voyageurs déclarés. Geste de l'admin, jamais automatique ;
 * la confirmation demande de saisir un mot pour éviter l'envoi par un clic distrait.
 */
const props = defineProps<{ year: number }>()

const CONFIRM_WORD = 'ENVOYER'
const statements = useDac7Statements()
const confirming = ref(false)

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n > 1 ? many : one}`

async function onConfirm() {
  confirming.value = false
  await statements.send(props.year)
}

watch(() => props.year, () => statements.reset())
</script>

<template>
  <section aria-label="Récapitulatifs aux voyageurs" data-test="dac7-statements-panel" class="flex flex-col gap-3 rounded-card border border-border bg-surface p-5">
    <h2 class="font-display text-lg font-bold">Récapitulatifs aux voyageurs</h2>
    <p class="text-sm text-text-muted text-pretty">
      Chaque voyageur déclaré reçoit son récapitulatif de l’année (notification, et e-mail si possible), une seule fois
      par année. Aucun voyageur non déclaré n’est sollicité.
    </p>
    <div>
      <button
        type="button" data-test="dac7-statements-send" :disabled="statements.busy.value"
        class="rounded-btn border border-border px-4 py-2 text-sm transition-[background-color,scale] hover:bg-surface-elevated active:scale-[0.96] disabled:opacity-40"
        @click="confirming = true"
      >Envoyer les récapitulatifs aux voyageurs</button>
    </div>

    <p v-if="statements.unavailable.value" data-test="dac7-unavailable" class="text-sm text-text-muted">{{ DAC7_UNAVAILABLE }}</p>
    <p v-if="statements.error.value" data-test="dac7-statements-error" role="alert"
      class="rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger text-pretty"
    >{{ statements.error.value }}</p>
    <p v-if="statements.result.value" data-test="dac7-statements-result" role="status"
      class="rounded-btn border border-success/40 bg-success/10 px-3 py-2 text-sm text-success"
    >{{ plural(statements.result.value.sent ?? 0, 'envoyé') }}, {{ plural(statements.result.value.skipped ?? 0, 'ignoré') }}.</p>

    <ConfirmActionDialog
      :open="confirming" title="Envoyer les récapitulatifs"
      :message="`Le récapitulatif ${year} part à chaque voyageur déclaré qui ne l’a pas déjà reçu. Cet envoi ne peut pas être rappelé.`"
      :confirmation-phrase="CONFIRM_WORD" :confirmation-label="`Saisissez « ${CONFIRM_WORD} » pour confirmer`"
      confirm-label="Envoyer" confirm-tone="primary"
      @confirm="onConfirm" @cancel="confirming = false"
    />
  </section>
</template>
