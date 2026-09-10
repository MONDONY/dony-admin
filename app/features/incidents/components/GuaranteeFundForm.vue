<script setup lang="ts">
import { ref, computed } from 'vue'
import { guaranteeFundMaxCents } from '@/features/incidents/types/index'
import { formatAmount } from '@/features/finance/types/index'

const props = withDefaults(defineProps<{
  /** Devise du colis : celle du versement. */
  currency?: string | null
  senderId?: string | null
  travelerId?: string | null
  senderName?: string | null
  travelerName?: string | null
}>(), { currency: null, senderId: null, travelerId: null, senderName: null, travelerName: null })

const emit = defineEmits<{ submit: [amountCents: number, beneficiaryUserId: string, reason: string] }>()

const amount = ref('')
const reason = ref('')
const beneficiary = ref<string | null>(null)

const currencyCode = computed(() => (props.currency ?? 'EUR').toUpperCase())
const maxCents = computed(() => guaranteeFundMaxCents(currencyCode.value))
const cents = computed(() => Math.round(parseFloat(amount.value || '0') * 100))
const parties = computed(() => [
  props.senderId ? { id: props.senderId, label: `Expéditeur${props.senderName ? ` (${props.senderName})` : ''}`, test: 'sender' } : null,
  props.travelerId ? { id: props.travelerId, label: `Voyageur${props.travelerName ? ` (${props.travelerName})` : ''}`, test: 'traveler' } : null,
].filter((p): p is { id: string; label: string; test: string } => p !== null))
const valid = computed(() =>
  cents.value > 0 && cents.value <= maxCents.value && reason.value.trim().length > 0 && beneficiary.value !== null)

function submit() {
  if (valid.value && beneficiary.value) emit('submit', cents.value, beneficiary.value, reason.value.trim())
}
</script>

<template>
  <div class="rounded-card border border-border bg-surface p-4 space-y-3">
    <p class="text-sm font-semibold">
      Fonds de garantie
      <span class="text-xs text-text-muted" data-test="gf-max">(max {{ formatAmount(maxCents, currencyCode) }})</span>
    </p>
    <p v-if="!currency" class="text-xs text-warning" data-test="gf-currency-unknown">
      Devise du colis inconnue : le montant sera pris en {{ currencyCode }}.
    </p>
    <div class="flex items-center gap-2">
      <input
        data-test="gf-amount"
        v-model="amount"
        type="number"
        min="0"
        :max="maxCents / 100"
        step="0.01"
        :placeholder="`Montant en ${currencyCode}`"
        class="w-full rounded-btn border border-border bg-bg px-3 py-2 text-sm tabular-nums"
      >
      <span class="text-sm text-text-muted" data-test="gf-currency">{{ currencyCode }}</span>
    </div>
    <fieldset class="space-y-1">
      <legend class="text-xs text-text-muted">Bénéficiaire</legend>
      <p v-if="parties.length === 0" class="text-xs text-danger" data-test="gf-no-party">
        Aucune partie identifiée sur ce litige : impossible de désigner un bénéficiaire.
      </p>
      <label v-for="p in parties" :key="p.id" class="flex items-center gap-2 text-sm">
        <input v-model="beneficiary" type="radio" :value="p.id" :data-test="`gf-beneficiary-${p.test}`">
        {{ p.label }}
      </label>
    </fieldset>
    <textarea
      data-test="gf-reason"
      v-model="reason"
      rows="2"
      placeholder="Motif"
      class="w-full rounded-btn border border-border bg-bg px-3 py-2 text-sm"
    />
    <button
      data-test="gf-submit"
      type="button"
      :disabled="!valid"
      class="rounded-btn px-4 py-2 text-sm bg-primary text-white disabled:opacity-40 hover:bg-primary/90"
      @click="submit"
    >Activer le fonds de garantie</button>
  </div>
</template>
