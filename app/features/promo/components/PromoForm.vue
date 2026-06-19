<script setup lang="ts">
import { computed, ref } from 'vue'
import type { AdminPromoCode, PromoCodeInput, PromoType } from '@/features/promo/types/index'

const props = defineProps<{ editing: AdminPromoCode | null }>()
const emit = defineEmits<{ submit: [input: PromoCodeInput]; cancel: [] }>()

const code = ref(props.editing?.code ?? '')
const type = ref<PromoType>(props.editing?.type ?? 'PERCENT')
const value = ref<number>(props.editing?.value ?? 0)
const maxRedemptions = ref<number | null>(props.editing?.maxRedemptions ?? null)
const expiresAt = ref<string | null>(props.editing?.expiresAt ? props.editing.expiresAt.slice(0, 10) : null)
const active = ref<boolean>(props.editing?.active ?? true)

const canSubmit = computed(() => code.value.trim().length > 0 && Number(value.value) > 0)

function onSubmit() {
  if (!canSubmit.value) return
  emit('submit', {
    code: code.value.trim(),
    type: type.value,
    value: Number(value.value),
    maxRedemptions: maxRedemptions.value === null || maxRedemptions.value === undefined ? null : Number(maxRedemptions.value),
    expiresAt: expiresAt.value || null,
    active: active.value,
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
        <label class="text-sm text-text-muted flex-1">Type
          <select v-model="type" data-test="promo-type" class="mt-1 w-full rounded-btn border border-border bg-bg p-2 text-sm">
            <option value="PERCENT">Pourcentage</option>
            <option value="FIXED_AMOUNT">Montant fixe (cents)</option>
          </select>
        </label>
        <label class="text-sm text-text-muted flex-1">Valeur
          <input v-model="value" data-test="promo-value" type="number" min="1" class="mt-1 w-full rounded-btn border border-border bg-bg p-2 text-sm tabular-nums">
        </label>
      </div>

      <div class="flex gap-3">
        <label class="text-sm text-text-muted flex-1">Utilisations max
          <input v-model="maxRedemptions" data-test="promo-max" type="number" min="1" placeholder="∞" class="mt-1 w-full rounded-btn border border-border bg-bg p-2 text-sm tabular-nums">
        </label>
        <label class="text-sm text-text-muted flex-1">Expire le
          <input v-model="expiresAt" data-test="promo-expires" type="date" class="mt-1 w-full rounded-btn border border-border bg-bg p-2 text-sm">
        </label>
      </div>

      <label class="flex items-center gap-2 text-sm text-text-muted">
        <input v-model="active" data-test="promo-active" type="checkbox"> Actif
      </label>

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
