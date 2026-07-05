<script setup lang="ts">
import { computed, ref } from 'vue'
import { PROMO_TARGET_LABELS, type AdminPromoCode, type PromoCodeInput, type PromoTarget } from '@/features/promo/types/index'

const props = defineProps<{ editing: AdminPromoCode | null }>()
const emit = defineEmits<{ submit: [input: PromoCodeInput]; cancel: [] }>()

const code = ref(props.editing?.code ?? '')
const ratePercent = ref<number>(props.editing ? Math.round(props.editing.rate * 1000) / 10 : 10)
const target = ref<PromoTarget>(props.editing?.target ?? 'ANY')
const validFrom = ref<string | null>(props.editing?.validFrom ? props.editing.validFrom.slice(0, 10) : null)
const validTo = ref<string | null>(props.editing?.validTo ? props.editing.validTo.slice(0, 10) : null)
const maxRedemptions = ref<number | null>(props.editing?.maxRedemptions ?? null)
const perUserLimit = ref<number | null>(props.editing?.perUserLimit ?? 1)

const canSubmit = computed(() =>
  code.value.trim().length > 0 && Number(ratePercent.value) > 0 && Number(ratePercent.value) < 100)

function onSubmit() {
  if (!canSubmit.value) return
  emit('submit', {
    code: code.value.trim().toUpperCase(),
    rate: Number(ratePercent.value) / 100,
    target: target.value,
    validFrom: validFrom.value ? validFrom.value + 'T00:00:00' : null,
    validTo: validTo.value ? validTo.value + 'T23:59:59' : null,
    maxRedemptions: maxRedemptions.value === null || maxRedemptions.value === undefined ? null : Number(maxRedemptions.value),
    perUserLimit: perUserLimit.value === null || perUserLimit.value === undefined ? null : Number(perUserLimit.value),
  })
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" data-test="promo-overlay">
    <form
      class="w-full max-w-md rounded-card border border-border bg-surface p-6 shadow-xl flex flex-col gap-3"
      @submit.prevent="onSubmit"
    >
      <h2 class="font-display text-lg font-semibold">{{ editing ? 'Éditer le code promo' : 'Nouveau code promo' }}</h2>

      <label class="text-sm text-text-muted">Code
        <input v-model="code" data-test="promo-code" type="text" class="mt-1 w-full rounded-btn border border-border bg-bg p-2 text-sm font-mono uppercase">
      </label>

      <div class="flex gap-3">
        <label class="text-sm text-text-muted flex-1">Réduction (%)
          <input v-model="ratePercent" data-test="promo-rate" type="number" min="0.1" max="99.9" step="0.1" class="mt-1 w-full rounded-btn border border-border bg-bg p-2 text-sm tabular-nums">
        </label>
        <label class="text-sm text-text-muted flex-1">Cible
          <select v-model="target" data-test="promo-target" class="mt-1 w-full rounded-btn border border-border bg-bg p-2 text-sm">
            <option v-for="(label, value) in PROMO_TARGET_LABELS" :key="value" :value="value">{{ label }}</option>
          </select>
        </label>
      </div>

      <div class="flex gap-3">
        <label class="text-sm text-text-muted flex-1">Valide du
          <input v-model="validFrom" data-test="promo-valid-from" type="date" class="mt-1 w-full rounded-btn border border-border bg-bg p-2 text-sm">
        </label>
        <label class="text-sm text-text-muted flex-1">au
          <input v-model="validTo" data-test="promo-valid-to" type="date" class="mt-1 w-full rounded-btn border border-border bg-bg p-2 text-sm">
        </label>
      </div>

      <div class="flex gap-3">
        <label class="text-sm text-text-muted flex-1">Utilisations max
          <input v-model="maxRedemptions" data-test="promo-max" type="number" min="1" placeholder="∞" class="mt-1 w-full rounded-btn border border-border bg-bg p-2 text-sm tabular-nums">
        </label>
        <label class="text-sm text-text-muted flex-1">Limite par utilisateur
          <input v-model="perUserLimit" data-test="promo-per-user" type="number" min="1" class="mt-1 w-full rounded-btn border border-border bg-bg p-2 text-sm tabular-nums">
        </label>
      </div>

      <div class="flex justify-end gap-2 mt-2">
        <button
          type="button" data-test="promo-cancel"
          class="rounded-btn px-4 py-2 text-sm border border-border hover:bg-surface-elevated"
          @click="emit('cancel')"
        >Annuler</button>
        <button
          type="submit" data-test="promo-submit" :disabled="!canSubmit"
          class="rounded-btn px-4 py-2 text-sm bg-primary text-white disabled:opacity-40 hover:bg-primary/90"
        >{{ editing ? 'Enregistrer' : 'Créer' }}</button>
      </div>
    </form>
  </div>
</template>
