<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { DISPUTE_DESCRIPTION_MAX, DISPUTE_DESCRIPTION_MIN, DISPUTE_REASONS } from '@/features/bids/lib/bidActions'
import type { AdminDisputeReason, DisputeParty } from '@/features/bids/lib/bidActions'

/**
 * Ouverture d'un litige par un super-admin, au nom de l'expéditeur ou du voyageur : partie,
 * motif et description obligatoires, puis confirmation explicite de l'effet sur l'argent.
 */
const props = defineProps<{
  open: boolean
  moneyEffect: string
  senderName?: string | null
  travelerName?: string | null
  busy?: boolean
  error?: string | null
}>()
const emit = defineEmits<{ confirm: [party: DisputeParty, reason: AdminDisputeReason, description: string]; cancel: [] }>()

const party = ref<DisputeParty | ''>('')
const reason = ref<AdminDisputeReason | ''>('')
const description = ref('')
const acknowledged = ref(false)
watch(() => props.open, (o) => {
  if (o) { party.value = ''; reason.value = ''; description.value = ''; acknowledged.value = false }
}, { immediate: true })

const reasonId = useId()
const descriptionId = useId()
const length = computed(() => description.value.trim().length)
const descriptionValid = computed(() => length.value >= DISPUTE_DESCRIPTION_MIN && length.value <= DISPUTE_DESCRIPTION_MAX)
const hint = computed(() => {
  if (length.value > DISPUTE_DESCRIPTION_MAX) return `${DISPUTE_DESCRIPTION_MAX} caractères au plus.`
  if (length.value < DISPUTE_DESCRIPTION_MIN) return `${DISPUTE_DESCRIPTION_MIN} caractères au moins : décrivez le différend.`
  return 'Journalisée avec votre identifiant.'
})
const canConfirm = computed(() => !props.busy && party.value !== '' && reason.value !== '' && descriptionValid.value && acknowledged.value)

function onConfirm() {
  if (canConfirm.value && party.value !== '' && reason.value !== '') emit('confirm', party.value, reason.value, description.value.trim())
}
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-test="dispute-dialog">
    <div
      class="w-full max-w-md rounded-card border border-border bg-surface p-6 shadow-xl"
      role="dialog" aria-modal="true" aria-labelledby="dispute-dialog-title"
    >
      <h2 id="dispute-dialog-title" class="mb-1 font-display text-lg font-semibold text-balance">Ouvrir un litige</h2>
      <p class="mb-4 text-sm text-text-muted text-pretty">Le litige apparaît dans Incidents et les deux parties sont prévenues.</p>

      <fieldset class="mb-3">
        <legend class="mb-1 text-xs text-text-muted">Au nom de (obligatoire)</legend>
        <div class="flex flex-wrap gap-2">
          <label class="flex min-h-10 items-center gap-2 rounded-btn border border-border px-3 text-sm">
            <input v-model="party" type="radio" value="SENDER" data-test="dispute-party-sender">
            Expéditeur{{ senderName ? ` (${senderName})` : '' }}
          </label>
          <label class="flex min-h-10 items-center gap-2 rounded-btn border border-border px-3 text-sm">
            <input v-model="party" type="radio" value="TRAVELER" data-test="dispute-party-traveler">
            Voyageur{{ travelerName ? ` (${travelerName})` : '' }}
          </label>
        </div>
      </fieldset>

      <label :for="reasonId" class="mb-1 block text-xs text-text-muted">Motif (obligatoire)</label>
      <select
        :id="reasonId" v-model="reason" data-test="dispute-reason"
        class="mb-3 min-h-10 w-full rounded-btn border border-border bg-bg p-2 text-sm"
      >
        <option value="" disabled>Choisir un motif…</option>
        <option v-for="o in DISPUTE_REASONS" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>

      <label :for="descriptionId" class="mb-1 block text-xs text-text-muted">Description (obligatoire)</label>
      <textarea
        :id="descriptionId" v-model="description" data-test="dispute-description" rows="4" :maxlength="DISPUTE_DESCRIPTION_MAX + 50"
        class="w-full rounded-btn border border-border bg-bg p-2 text-sm"
      />
      <p class="mb-3 mt-1 text-xs text-pretty" :class="descriptionValid || length === 0 ? 'text-text-muted' : 'text-danger'" data-test="dispute-hint">{{ hint }}</p>

      <p class="mb-3 rounded-card border border-warning/30 bg-warning/5 px-3 py-2 text-sm text-pretty" data-test="dispute-money-effect">{{ moneyEffect }}</p>
      <label class="mb-4 flex items-start gap-2 text-sm">
        <input v-model="acknowledged" type="checkbox" data-test="dispute-ack" class="mt-0.5 h-4 w-4">
        <span class="text-pretty">J’ai lu l’effet sur l’argent et je confirme l’ouverture du litige.</span>
      </label>

      <p v-if="error" role="alert" data-test="dispute-error" class="mb-3 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger text-pretty">{{ error }}</p>

      <div class="flex justify-end gap-2">
        <button
          type="button" data-test="dispute-dismiss" :disabled="busy"
          class="inline-flex min-h-10 items-center rounded-btn border border-border px-4 text-sm transition-[background-color,transform] hover:bg-surface-elevated active:scale-[0.96] disabled:opacity-40"
          @click="emit('cancel')"
        >Retour</button>
        <button
          type="button" data-test="dispute-confirm" :disabled="!canConfirm" :aria-busy="busy"
          class="inline-flex min-h-10 items-center rounded-btn bg-danger px-4 text-sm font-medium text-white transition-[background-color,transform] hover:bg-danger/90 active:scale-[0.96] disabled:opacity-40 disabled:active:scale-100"
          @click="onConfirm"
        >{{ busy ? 'Ouverture…' : 'Ouvrir le litige' }}</button>
      </div>
    </div>
  </div>
</template>
