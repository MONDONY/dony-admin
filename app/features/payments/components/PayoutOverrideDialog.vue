<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { PAYOUT_OVERRIDE_REASON_MAX, PAYOUT_OVERRIDE_REASON_MIN, overrideReasonValid } from '@/features/payments/types/index'
import type { PayoutAction, PayoutOverride } from '@/features/payments/types/index'

/**
 * Dérogation : payer un voyageur dont les versements sont bloqués (banni, identité révoquée)
 * ou dont le paiement est en litige bancaire. Geste d'exception, d'où la case à cocher ET le
 * motif journalisé : un seul clic ne doit jamais suffire à verser de l'argent retenu.
 */
const props = defineProps<{
  open: boolean
  action: PayoutAction
  /** Motif du blocage lu sur le paiement (nouveau back), s'il est connu. */
  holdReason?: string | null
  /** Code du 409 qui a déclenché la dérogation, s'il y en a eu un. */
  conflictCode?: string | null
  busy?: boolean
}>()
const emit = defineEmits<{ confirm: [override: PayoutOverride]; cancel: [] }>()

const reason = ref('')
const checked = ref(false)
watch(() => props.open, (o) => { if (o) { reason.value = ''; checked.value = false } }, { immediate: true })

const title = computed(() => props.action === 'release'
  ? 'Payer le voyageur malgré le blocage'
  : 'Relancer le versement malgré le blocage')

const warning = computed(() => {
  if (props.conflictCode === 'payment-disputed') {
    return 'Ce paiement fait l’objet d’un litige bancaire ouvert. En confirmant, l’argent sera versé au voyageur alors que le litige n’est pas tranché.'
  }
  const who = props.holdReason === 'BANNED'
    ? 'Ce voyageur est banni'
    : props.holdReason === 'KYC_REVOKED'
      ? 'L’identité de ce voyageur a été révoquée'
      : 'Ce voyageur est bloqué'
  return `${who} : ses versements sont retenus chez Yadony. En confirmant, l’argent lui sera versé quand même. Si la livraison pose problème, remboursez plutôt l’expéditeur.`
})

const reasonLength = computed(() => reason.value.trim().length)
const reasonHint = computed(() => {
  if (reasonLength.value > PAYOUT_OVERRIDE_REASON_MAX) return `Le motif ne peut pas dépasser ${PAYOUT_OVERRIDE_REASON_MAX} caractères.`
  if (reasonLength.value < PAYOUT_OVERRIDE_REASON_MIN) return `Au moins ${PAYOUT_OVERRIDE_REASON_MIN} caractères : il est journalisé avec votre identifiant.`
  return 'Journalisé avec votre identifiant.'
})
const canSubmit = computed(() => !props.busy && checked.value && overrideReasonValid(reason.value))

function onSubmit() {
  if (!canSubmit.value) return
  emit('confirm', { overrideHold: true, overrideReason: reason.value.trim() })
}
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
    <div
      data-test="override-dialog" role="dialog" aria-modal="true" aria-labelledby="override-dialog-title"
      class="w-full max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto rounded-card border border-border bg-surface p-6 shadow-xl"
    >
      <h2 id="override-dialog-title" class="font-display text-lg font-semibold mb-3 text-balance">{{ title }}</h2>

      <p
        data-test="override-warning" role="alert"
        class="mb-4 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger text-pretty"
      >{{ warning }}</p>

      <label class="mb-4 flex items-start gap-2 text-sm cursor-pointer select-none">
        <input v-model="checked" data-test="override-checked" type="checkbox" class="mt-0.5 h-4 w-4 shrink-0">
        <span class="text-pretty">Je confirme payer ce voyageur malgré le blocage.</span>
      </label>

      <label class="block text-xs text-text-muted" for="override-reason">Motif de la dérogation (obligatoire)</label>
      <textarea
        id="override-reason" v-model="reason" data-test="override-reason" rows="3"
        placeholder="Pourquoi ce voyageur doit être payé malgré tout"
        class="mt-1 w-full rounded-btn border border-border bg-bg p-2 text-sm text-text"
      />
      <div class="mb-4 flex items-start justify-between gap-3 text-xs">
        <span data-test="override-reason-hint" class="text-text-muted text-pretty">{{ reasonHint }}</span>
        <span
          data-test="override-reason-count" class="shrink-0 tabular-nums"
          :class="reasonLength > PAYOUT_OVERRIDE_REASON_MAX ? 'text-danger' : 'text-text-muted'"
        >{{ reasonLength }} / {{ PAYOUT_OVERRIDE_REASON_MAX }}</span>
      </div>

      <div class="flex justify-end gap-2">
        <button
          type="button" data-test="override-cancel"
          class="rounded-btn px-4 py-2 text-sm border border-border transition-colors hover:bg-surface-elevated"
          @click="emit('cancel')"
        >Annuler</button>
        <button
          type="button" data-test="override-submit" :disabled="!canSubmit"
          class="rounded-btn bg-danger px-4 py-2 text-sm text-white transition-[background-color,scale] hover:bg-danger/90 active:scale-[0.96] disabled:opacity-40 disabled:active:scale-100"
          @click="onSubmit"
        >{{ busy ? 'En cours…' : 'Payer malgré le blocage' }}</button>
      </div>
    </div>
  </div>
</template>
