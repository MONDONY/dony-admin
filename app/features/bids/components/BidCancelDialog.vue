<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { CANCEL_NOTE_MAX, CANCEL_NOTE_MIN, CANCEL_REASONS } from '@/features/bids/lib/bidActions'
import type { AdminBidCancelReason } from '@/features/bids/lib/bidActions'

/**
 * Annulation d'un colis par un super-admin : motif obligatoire, note interne (obligatoire avec
 * « Autre »), puis confirmation explicite de l'effet sur l'argent avant l'envoi.
 */
const props = defineProps<{
  open: boolean
  /** Effet argent, en clair (« L'expéditeur sera remboursé de … ; aucun versement au voyageur »). */
  moneyEffect: string
  /** Colis déjà chez le voyageur : le retour se fait à la main. */
  withTraveler?: boolean
  busy?: boolean
  error?: string | null
}>()
const emit = defineEmits<{ confirm: [reason: AdminBidCancelReason, note: string]; cancel: [] }>()

const reason = ref<AdminBidCancelReason | ''>('')
const note = ref('')
const acknowledged = ref(false)
watch(() => props.open, (o) => { if (o) { reason.value = ''; note.value = ''; acknowledged.value = false } }, { immediate: true })

const reasonId = useId()
const noteId = useId()
const noteLength = computed(() => note.value.trim().length)
const noteRequired = computed(() => reason.value === 'OTHER')
const noteValid = computed(() => noteLength.value <= CANCEL_NOTE_MAX && (!noteRequired.value || noteLength.value >= CANCEL_NOTE_MIN))
const noteHint = computed(() => {
  if (noteLength.value > CANCEL_NOTE_MAX) return `${CANCEL_NOTE_MAX} caractères au plus.`
  if (noteRequired.value && noteLength.value < CANCEL_NOTE_MIN) return `Obligatoire avec « Autre » : ${CANCEL_NOTE_MIN} caractères au moins.`
  return 'Note interne, journalisée avec votre identifiant, jamais montrée aux utilisateurs.'
})
const canConfirm = computed(() => !props.busy && reason.value !== '' && noteValid.value && acknowledged.value)

function onConfirm() {
  if (canConfirm.value && reason.value !== '') emit('confirm', reason.value, note.value.trim())
}
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-test="cancel-dialog">
    <div
      class="w-full max-w-md rounded-card border border-border bg-surface p-6 shadow-xl"
      role="dialog" aria-modal="true" aria-labelledby="cancel-dialog-title"
    >
      <h2 id="cancel-dialog-title" class="mb-1 font-display text-lg font-semibold text-balance">Annuler le colis</h2>
      <p class="mb-4 text-sm text-text-muted text-pretty">Le colis passe « Annulé » et les deux parties sont prévenues. Ce geste est définitif.</p>

      <label :for="reasonId" class="mb-1 block text-xs text-text-muted">Motif (obligatoire)</label>
      <select
        :id="reasonId" v-model="reason" data-test="cancel-reason"
        class="mb-3 min-h-10 w-full rounded-btn border border-border bg-bg p-2 text-sm"
      >
        <option value="" disabled>Choisir un motif…</option>
        <option v-for="o in CANCEL_REASONS" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>

      <label :for="noteId" class="mb-1 block text-xs text-text-muted">Note interne{{ noteRequired ? ' (obligatoire)' : ' (facultative)' }}</label>
      <textarea
        :id="noteId" v-model="note" data-test="cancel-note" rows="3" :maxlength="CANCEL_NOTE_MAX + 50"
        class="w-full rounded-btn border border-border bg-bg p-2 text-sm"
      />
      <p class="mb-3 mt-1 text-xs text-pretty" :class="noteValid ? 'text-text-muted' : 'text-danger'" data-test="cancel-note-hint">{{ noteHint }}</p>

      <div class="mb-3 rounded-card border border-warning/30 bg-warning/5 px-3 py-2 text-sm text-pretty" data-test="cancel-money-effect">
        {{ moneyEffect }}
        <p v-if="withTraveler" class="mt-1 text-xs" data-test="cancel-with-traveler">
          Le colis est déjà chez le voyageur : son retour s’organise avec le support.
        </p>
      </div>
      <label class="mb-4 flex items-start gap-2 text-sm">
        <input v-model="acknowledged" type="checkbox" data-test="cancel-ack" class="mt-0.5 h-4 w-4">
        <span class="text-pretty">J’ai lu l’effet sur l’argent et je confirme l’annulation.</span>
      </label>

      <p v-if="error" role="alert" data-test="cancel-error" class="mb-3 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger text-pretty">{{ error }}</p>

      <div class="flex justify-end gap-2">
        <button
          type="button" data-test="cancel-dismiss" :disabled="busy"
          class="inline-flex min-h-10 items-center rounded-btn border border-border px-4 text-sm transition-[background-color,transform] hover:bg-surface-elevated active:scale-[0.96] disabled:opacity-40"
          @click="emit('cancel')"
        >Retour</button>
        <button
          type="button" data-test="cancel-confirm" :disabled="!canConfirm" :aria-busy="busy"
          class="inline-flex min-h-10 items-center rounded-btn bg-danger px-4 text-sm font-medium text-white transition-[background-color,transform] hover:bg-danger/90 active:scale-[0.96] disabled:opacity-40 disabled:active:scale-100"
          @click="onConfirm"
        >{{ busy ? 'Annulation…' : 'Annuler le colis' }}</button>
      </div>
    </div>
  </div>
</template>
