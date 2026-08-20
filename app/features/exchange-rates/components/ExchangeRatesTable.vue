<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import ConfirmActionDialog from '@/components/ui/ConfirmActionDialog.vue'
import type { ExchangeRate } from '@/features/exchange-rates/types/index'

const props = defineProps<{ rates: ExchangeRate[]; busy?: boolean }>()
const emit = defineEmits<{ update: [currency: string, unitsPerEur: number] }>()

/**
 * XOF et XAF ont une parité fixe avec l'euro (655,957 CFA/EUR, un traité monétaire) —
 * le back refuse toute écriture dessus avec `exchange-rate-fixed-parity`. Autant
 * désactiver l'édition ici plutôt que laisser l'admin cliquer Enregistrer pour se
 * prendre le 422 : la contrainte doit être visible avant le clic, pas après.
 */
const FIXED_PARITY_CURRENCIES = new Set(['XOF', 'XAF'])
function isFixedParity(currency: string) {
  return FIXED_PARITY_CURRENCIES.has(currency)
}

// Bornes documentées du back (`AdminExchangeRateController`) : taux strictement positif,
// plafonné à 10000. Ce contrôle évite juste l'aller-retour réseau pour une valeur déjà
// invalide — le back reste l'autorité.
const MAX_UNITS_PER_EUR = 10000

// Brouillon local par devise, initialisé depuis la valeur courante au premier affichage.
// On ne réécrase jamais une saisie en cours si le parent republie la même liste (ex.
// après la mise à jour d'une autre devise).
const drafts = reactive<Record<string, string | number>>({})
watch(
  () => props.rates,
  (list) => {
    for (const r of list) {
      if (!(r.currency in drafts)) drafts[r.currency] = r.unitsPerEur
    }
  },
  { immediate: true },
)

function fmt(d: string) {
  return new Date(d).toLocaleString('fr-FR')
}

function errorFor(currency: string, raw: string | number | undefined): string | null {
  if (isFixedParity(currency) || raw === undefined) return null
  const str = String(raw)
  const n = Number(raw)
  if (str.trim() === '' || Number.isNaN(n)) return 'Le taux de change doit être un nombre.'
  if (n <= 0) return 'Le taux de change doit être strictement positif.'
  if (n > MAX_UNITS_PER_EUR) return `Le taux de change ne peut pas dépasser ${MAX_UNITS_PER_EUR}.`
  return null
}

interface PendingChange { currency: string; unitsPerEur: number; message: string }
const pending = ref<PendingChange | null>(null)

function requestSave(currency: string) {
  if (isFixedParity(currency)) return
  const raw = String(drafts[currency])
  if (errorFor(currency, raw)) return
  pending.value = {
    currency,
    unitsPerEur: Number(raw),
    message: `Confirmez le nouveau taux de « ${currency} » : ${raw} unités pour un euro. `
      + 'Ce taux s\'applique immédiatement aux nouvelles conversions affichées et aux '
      + 'commissions cross-devise débitées après cette modification.',
  }
}

function confirmPending() {
  if (!pending.value) return
  emit('update', pending.value.currency, pending.value.unitsPerEur)
  pending.value = null
}
function cancelPending() {
  pending.value = null
}
</script>

<template>
  <div class="space-y-4">
    <div
      v-for="r in rates" :key="r.currency"
      class="rounded-card border border-border bg-surface p-4 space-y-3" :data-test="`rate-row-${r.currency}`"
    >
      <div class="flex items-center justify-between gap-3">
        <p class="text-sm font-semibold">{{ r.currency }}</p>
        <p class="text-xs text-text-muted" :data-test="`rate-meta-${r.currency}`">
          <template v-if="r.updatedAt">Modifié le {{ fmt(r.updatedAt) }}</template>
          <template v-else>Jamais modifié</template>
        </p>
      </div>

      <div class="flex items-center gap-2">
        <template v-if="isFixedParity(r.currency)">
          <input
            :value="r.unitsPerEur" disabled :data-test="`rate-value-${r.currency}`"
            class="w-32 rounded-btn border border-border bg-bg p-2 text-sm tabular-nums opacity-40"
          >
          <span class="text-xs text-text-muted" :data-test="`rate-fixed-${r.currency}`">
            Parité fixe, non modifiable
          </span>
        </template>
        <template v-else>
          <input
            v-model="drafts[r.currency]" :data-test="`rate-value-${r.currency}`" type="number"
            step="0.000001" :disabled="busy"
            class="w-32 rounded-btn border border-border bg-bg p-2 text-sm tabular-nums disabled:opacity-40"
          >
          <span class="text-xs text-text-muted">unités pour 1 €</span>

          <button
            type="button" :data-test="`rate-save-${r.currency}`"
            :disabled="busy || !!errorFor(r.currency, drafts[r.currency])"
            class="ml-auto rounded-btn px-4 py-2 text-sm bg-primary text-white disabled:opacity-40 hover:bg-primary/90"
            @click="requestSave(r.currency)"
          >Enregistrer</button>
        </template>
      </div>

      <p v-if="errorFor(r.currency, drafts[r.currency])" class="text-xs text-danger" :data-test="`rate-error-${r.currency}`">
        {{ errorFor(r.currency, drafts[r.currency]) }}
      </p>
    </div>

    <ConfirmActionDialog
      :open="pending !== null"
      title="Confirmer le nouveau taux"
      :message="pending?.message ?? ''"
      confirm-label="Confirmer"
      @confirm="confirmPending"
      @cancel="cancelPending"
    />
  </div>
</template>
