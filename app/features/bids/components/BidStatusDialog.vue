<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { STATUS_REASON_MAX, STATUS_REASON_MIN } from '@/features/bids/lib/bidActions'
import type { AdminForcedBidStatus } from '@/features/bids/lib/bidActions'

/**
 * Changement de statut d'un colis par un super-admin (livraison sans code, par exemple) :
 * nouveau statut, motif obligatoire citant la trace écrite, puis confirmation explicite de
 * l'effet sur l'argent avant l'envoi.
 */
const props = defineProps<{
  open: boolean
  /** Statuts proposés (tous sauf l'actuel). */
  options: readonly { value: AdminForcedBidStatus; label: string }[]
  /** Effet argent, en clair, par statut choisi ; la clé vide vaut tant qu'aucun statut n'est choisi. */
  moneyEffects: Record<string, string>
  busy?: boolean
  error?: string | null
}>()
const emit = defineEmits<{ confirm: [status: AdminForcedBidStatus, reason: string]; cancel: [] }>()

const status = ref<AdminForcedBidStatus | ''>('')
const reason = ref('')
const acknowledged = ref(false)
watch(() => props.open, (o) => { if (o) { status.value = ''; reason.value = ''; acknowledged.value = false } }, { immediate: true })
watch(status, () => { acknowledged.value = false })

const statusId = useId()
const reasonId = useId()
const reasonLength = computed(() => reason.value.trim().length)
const reasonValid = computed(() => reasonLength.value >= STATUS_REASON_MIN && reasonLength.value <= STATUS_REASON_MAX)
const reasonHint = computed(() => {
  if (reasonLength.value > STATUS_REASON_MAX) return `${STATUS_REASON_MAX} caractères au plus.`
  if (reasonLength.value < STATUS_REASON_MIN) return `Obligatoire : ${STATUS_REASON_MIN} caractères au moins. Citez la trace écrite (message, date).`
  return 'Journalisé avec votre identifiant, jamais montré aux utilisateurs.'
})
const canConfirm = computed(() => !props.busy && status.value !== '' && reasonValid.value && acknowledged.value)

function onConfirm() {
  if (canConfirm.value && status.value !== '') emit('confirm', status.value, reason.value.trim())
}
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-test="status-dialog">
    <div
      class="w-full max-w-md rounded-card border border-border bg-surface p-6 shadow-xl"
      role="dialog" aria-modal="true" aria-labelledby="status-dialog-title"
    >
      <h2 id="status-dialog-title" class="mb-1 font-display text-lg font-semibold text-balance">Changer le statut du colis</h2>
      <p class="mb-4 text-sm text-text-muted text-pretty">À utiliser quand une preuve écrite confirme une étape que l’application n’a pas enregistrée.</p>

      <label :for="statusId" class="mb-1 block text-xs text-text-muted">Nouveau statut (obligatoire)</label>
      <select
        :id="statusId" v-model="status" data-test="status-target"
        class="mb-3 min-h-10 w-full rounded-btn border border-border bg-bg p-2 text-sm"
      >
        <option value="" disabled>Choisir un statut…</option>
        <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>

      <label :for="reasonId" class="mb-1 block text-xs text-text-muted">Motif (obligatoire)</label>
      <textarea
        :id="reasonId" v-model="reason" data-test="status-reason" rows="3" :maxlength="STATUS_REASON_MAX + 50"
        class="w-full rounded-btn border border-border bg-bg p-2 text-sm"
      />
      <p class="mb-3 mt-1 text-xs text-pretty" :class="reasonLength === 0 || reasonValid ? 'text-text-muted' : 'text-danger'" data-test="status-reason-hint">{{ reasonHint }}</p>

      <div class="mb-3 rounded-card border border-warning/30 bg-warning/5 px-3 py-2 text-sm text-pretty" data-test="status-money-effect">
        {{ moneyEffects[status] ?? moneyEffects[''] }}
      </div>
      <label class="mb-4 flex items-start gap-2 text-sm">
        <input v-model="acknowledged" type="checkbox" data-test="status-ack" class="mt-0.5 h-4 w-4" :disabled="status === ''">
        <span class="text-pretty">J’ai lu l’effet de ce changement et je le confirme.</span>
      </label>

      <p v-if="error" role="alert" data-test="status-error" class="mb-3 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger text-pretty">{{ error }}</p>

      <div class="flex justify-end gap-2">
        <button
          type="button" data-test="status-dismiss" :disabled="busy"
          class="inline-flex min-h-10 items-center rounded-btn border border-border px-4 text-sm transition-[background-color,transform] hover:bg-surface-elevated active:scale-[0.96] disabled:opacity-40"
          @click="emit('cancel')"
        >Retour</button>
        <button
          type="button" data-test="status-confirm" :disabled="!canConfirm" :aria-busy="busy"
          class="inline-flex min-h-10 items-center rounded-btn bg-primary px-4 text-sm font-medium text-white transition-[background-color,transform] hover:bg-primary/90 active:scale-[0.96] disabled:opacity-40 disabled:active:scale-100"
          @click="onConfirm"
        >{{ busy ? 'Enregistrement…' : 'Changer le statut' }}</button>
      </div>
    </div>
  </div>
</template>
