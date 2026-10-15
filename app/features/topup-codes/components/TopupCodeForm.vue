<script setup lang="ts">
import { computed, ref } from 'vue'
import { TOPUP_CURRENCIES, type TopupCodeInput } from '@/features/topup-codes/types/index'

const props = defineProps<{ generate: () => Promise<string> }>()
const emit = defineEmits<{ submit: [input: TopupCodeInput]; cancel: [] }>()

const code = ref('')
const amount = ref('')
const currency = ref<string>('XOF')
const quantity = ref<number | string>(1)
const expiresOn = ref<string | null>(null)
const note = ref('')
const generating = ref(false)

const parsedAmount = computed(() => Number(String(amount.value).replace(',', '.').trim()))
const canSubmit = computed(() => Number.isFinite(parsedAmount.value) && parsedAmount.value > 0 && Number(quantity.value) >= 1)

async function onGenerate() {
  generating.value = true
  try { code.value = await props.generate() } catch { /* l'erreur est affichée par la page */ } finally { generating.value = false }
}

function onSubmit() {
  if (!canSubmit.value) return
  const trimmed = code.value.trim().toUpperCase()
  emit('submit', {
    code: trimmed.length > 0 ? trimmed : null,
    amount: parsedAmount.value,
    currency: currency.value,
    maxRedemptions: Number(quantity.value),
    expiresAt: expiresOn.value ? expiresOn.value + 'T23:59:59' : null,
    note: note.value.trim().length > 0 ? note.value.trim() : null,
  })
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" data-test="topup-overlay">
    <form
      class="w-full max-w-md rounded-card border border-border bg-surface p-6 shadow-xl flex flex-col gap-3"
      @submit.prevent="onSubmit"
    >
      <h2 class="font-display text-lg font-semibold">Nouveau code de recharge</h2>
      <p class="text-sm text-text-muted text-pretty">Crédit non remboursable, utilisable seulement pour les commissions. Chaque compte ne peut l’utiliser qu’une fois.</p>

      <label class="text-sm text-text-muted">Code (vide = généré)
        <div class="mt-1 flex gap-2">
          <input v-model="code" data-test="topup-code" type="text" maxlength="32" class="w-full rounded-btn border border-border bg-bg p-2 text-sm font-mono uppercase">
          <button
            type="button" data-test="topup-generate" :disabled="generating"
            class="rounded-btn px-3 py-2 text-sm border border-border hover:bg-surface-elevated disabled:opacity-40"
            @click="onGenerate"
          >Générer</button>
        </div>
      </label>

      <div class="flex gap-3">
        <label class="text-sm text-text-muted flex-1">Montant
          <input v-model="amount" data-test="topup-amount" type="text" inputmode="decimal" class="mt-1 w-full rounded-btn border border-border bg-bg p-2 text-sm tabular-nums">
        </label>
        <label class="text-sm text-text-muted w-28">Devise
          <select v-model="currency" data-test="topup-currency" class="mt-1 w-full rounded-btn border border-border bg-bg p-2 text-sm">
            <option v-for="c in TOPUP_CURRENCIES" :key="c" :value="c">{{ c }}</option>
          </select>
        </label>
      </div>

      <div class="flex gap-3">
        <label class="text-sm text-text-muted flex-1">Nombre d’utilisations
          <input v-model="quantity" data-test="topup-quantity" type="number" min="1" max="10000" class="mt-1 w-full rounded-btn border border-border bg-bg p-2 text-sm tabular-nums">
        </label>
        <label class="text-sm text-text-muted flex-1">Expire le (vide = 90 jours)
          <input v-model="expiresOn" data-test="topup-expires" type="date" class="mt-1 w-full rounded-btn border border-border bg-bg p-2 text-sm">
        </label>
      </div>

      <label class="text-sm text-text-muted">Note interne
        <input v-model="note" data-test="topup-note" type="text" maxlength="500" class="mt-1 w-full rounded-btn border border-border bg-bg p-2 text-sm">
      </label>

      <div class="flex justify-end gap-2 mt-2">
        <button type="button" data-test="topup-cancel" class="rounded-btn px-4 py-2 text-sm border border-border hover:bg-surface-elevated" @click="emit('cancel')">Annuler</button>
        <button type="submit" data-test="topup-submit" :disabled="!canSubmit" class="rounded-btn px-4 py-2 text-sm bg-primary text-white disabled:opacity-40 hover:bg-primary/90">Créer</button>
      </div>
    </form>
  </div>
</template>
