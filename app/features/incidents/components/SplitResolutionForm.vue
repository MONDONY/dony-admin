<script setup lang="ts">
import { ref, computed } from 'vue'
import { SPLIT_REFUSAL_LABELS, currencyDecimals } from '@/features/incidents/types/index'
import type { AdminDisputeSplitOptions } from '@/features/incidents/types/index'

/**
 * Partage chiffré du séquestre à la résolution d'un litige (FLUTTER-E2) : une part remboursée à
 * l'expéditeur, une part versée au voyageur, la somme ne dépassant pas le net disponible
 * (montant − commission − déjà remboursé). Le serveur revalide tout ; ce formulaire n'évite que
 * les allers-retours évidents.
 */
const props = defineProps<{ options: AdminDisputeSplitOptions }>()
const emit = defineEmits<{ submit: [senderRefund: number, travelerPayout: number, note: string] }>()

// v-model sur un input number rend un nombre (ou '' une fois vidé).
const senderRefund = ref<string | number>('')
const travelerPayout = ref<string | number>('')
const note = ref('')

const currency = computed(() => (props.options.currency ?? 'EUR').toUpperCase())
const decimals = computed(() => currencyDecimals(currency.value))
const step = computed(() => (decimals.value === 0 ? '1' : '0.01'))
const net = computed(() => props.options.netAvailable ?? 0)

function parse(v: string | number): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (v.trim() === '') return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
function hasPrecision(n: number): boolean {
  const factor = 10 ** decimals.value
  return Math.abs(Math.round(n * factor) - n * factor) < 1e-6
}

const sender = computed(() => parse(senderRefund.value))
const traveler = computed(() => parse(travelerPayout.value))
const total = computed(() => (sender.value ?? 0) + (traveler.value ?? 0))
const remainder = computed(() => Math.max(0, net.value - total.value))

const problem = computed<string | null>(() => {
  if (sender.value === null || traveler.value === null) return 'Montant invalide.'
  if (sender.value < 0 || traveler.value < 0) return 'Les montants ne peuvent pas être négatifs.'
  if (!hasPrecision(sender.value) || !hasPrecision(traveler.value)) return `Montant trop précis pour ${currency.value}.`
  if (total.value <= 0) return 'Au moins un des deux montants doit être positif.'
  if (total.value - net.value > 1e-9) return 'La somme dépasse le net disponible.'
  return null
})
const valid = computed(() => problem.value === null && note.value.trim().length > 0)

function fmt(n: number | null): string {
  return n == null ? '—' : `${n.toFixed(decimals.value)} ${currency.value}`
}
function submit() {
  if (valid.value) emit('submit', sender.value ?? 0, traveler.value ?? 0, note.value.trim())
}
</script>

<template>
  <div class="rounded-card border border-border bg-surface p-4 space-y-3" data-test="split-form">
    <p class="text-sm font-semibold">Partager le séquestre</p>
    <p v-if="!options.splittable" class="text-xs text-text-muted" data-test="split-unavailable">
      {{ SPLIT_REFUSAL_LABELS[options.reasonCode ?? ''] ?? 'Partage indisponible pour ce litige.' }}
    </p>
    <template v-else>
      <dl class="grid grid-cols-2 gap-2 text-xs tabular-nums">
        <div><dt class="text-text-muted">Payé</dt><dd>{{ fmt(options.amount) }}</dd></div>
        <div><dt class="text-text-muted">Commission (conservée)</dt><dd>{{ fmt(options.commission) }}</dd></div>
        <div><dt class="text-text-muted">Déjà remboursé</dt><dd>{{ fmt(options.refunded) }}</dd></div>
        <div><dt class="text-text-muted">Net disponible</dt><dd class="font-semibold" data-test="split-net">{{ fmt(options.netAvailable) }}</dd></div>
      </dl>
      <label class="block text-sm">
        Remboursé à l'expéditeur
        <input
v-model="senderRefund" data-test="split-sender" type="number" min="0" :step="step"
          class="mt-1 w-full rounded-btn border border-border bg-bg px-3 py-2 text-sm tabular-nums">
      </label>
      <label class="block text-sm">
        Versé au voyageur
        <input
v-model="travelerPayout" data-test="split-traveler" type="number" min="0" :step="step"
          class="mt-1 w-full rounded-btn border border-border bg-bg px-3 py-2 text-sm tabular-nums">
      </label>
      <p class="text-xs text-text-muted tabular-nums" data-test="split-remainder">
        Reste sur le solde Yadony : {{ fmt(remainder) }}
      </p>
      <p v-if="problem && (senderRefund !== '' || travelerPayout !== '')" class="text-xs text-danger" data-test="split-problem">{{ problem }}</p>
      <textarea
v-model="note" data-test="split-note" rows="2" placeholder="Motif de la décision"
        class="w-full rounded-btn border border-border bg-bg px-3 py-2 text-sm" />
      <button
data-test="split-submit" type="button" :disabled="!valid"
        class="rounded-btn px-4 py-2 text-sm bg-primary text-white disabled:opacity-40 hover:bg-primary/90"
        @click="submit">Résoudre avec ce partage</button>
    </template>
  </div>
</template>
