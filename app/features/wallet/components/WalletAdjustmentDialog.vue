<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { formatMajorAmount } from '@/features/finance/types/index'
import { PAYMENT_CURRENCIES } from '@/features/payments/types/index'
import {
  reasonLengthValid, WALLET_ADJUSTMENT_REASON_MAX, WALLET_ADJUSTMENT_REASON_MIN,
} from '@/features/wallet/types/index'
import type { AdminWalletAccount, WalletAdjustmentDirection, WalletAdjustmentRequest } from '@/features/wallet/types/index'

const props = defineProps<{
  open: boolean
  accounts: AdminWalletAccount[]
  busy?: boolean
  error?: string | null
}>()
const emit = defineEmits<{ submit: [request: WalletAdjustmentRequest]; cancel: [] }>()

type Step = 'form' | 'confirm'
const step = ref<Step>('form')
const direction = ref<WalletAdjustmentDirection>('CREDIT')
const currency = ref('EUR')
const amountText = ref('')
const reason = ref('')

function defaultCurrency(): string {
  return (props.accounts.find((a) => !a.frozen) ?? props.accounts[0])?.currency ?? 'EUR'
}
function reset() {
  step.value = 'form'
  direction.value = 'CREDIT'
  currency.value = defaultCurrency()
  amountText.value = ''
  reason.value = ''
}
watch(() => props.open, (o) => { if (o) reset() }, { immediate: true })

const accountFor = (c: string) => props.accounts.find((a) => a.currency === c)

/**
 * Un débit ne vise qu'un compte existant (rien à retirer ailleurs) ; un crédit peut ouvrir
 * un compte dans une devise que la plateforme encaisse déjà.
 */
const currencyOptions = computed(() => {
  const existing = props.accounts.map((a) => ({
    value: a.currency,
    label: `${a.currency} (solde ${formatMajorAmount(a.balance, a.currency)}${a.frozen ? ', gelé' : ''})`,
  }))
  if (direction.value === 'DEBIT') return existing
  const others = PAYMENT_CURRENCIES
    .filter((c) => !accountFor(c))
    .map((c) => ({ value: c as string, label: `${c} (sans compte)` }))
  return [...existing, ...others]
})

function setDirection(d: WalletAdjustmentDirection) {
  direction.value = d
  if (d === 'DEBIT' && !accountFor(currency.value)) currency.value = defaultCurrency()
}

/** Saisie à la française (virgule) ou à l'anglaise (point), deux décimales au plus. */
const amount = computed<number | null>(() => {
  const t = amountText.value.trim()
  if (!/^\d+([.,]\d{1,2})?$/.test(t)) return null
  const n = Number(t.replace(',', '.'))
  return n > 0 ? n : null
})

const account = computed(() => accountFor(currency.value))
const currentBalance = computed(() => account.value?.balance ?? 0)
const frozen = computed(() => account.value?.frozen === true)
const debitExceeds = computed(() =>
  direction.value === 'DEBIT' && amount.value !== null && amount.value > currentBalance.value,
)
const balanceAfter = computed(() => {
  if (amount.value === null) return null
  const delta = direction.value === 'CREDIT' ? amount.value : -amount.value
  return Math.round((currentBalance.value + delta) * 100) / 100
})

const reasonLength = computed(() => reason.value.trim().length)
const reasonValid = computed(() => reasonLengthValid(reason.value))
const reasonHint = computed(() => {
  if (reasonLength.value > WALLET_ADJUSTMENT_REASON_MAX) return `Le motif ne peut pas dépasser ${WALLET_ADJUSTMENT_REASON_MAX} caractères.`
  if (!reasonValid.value) return `Au moins ${WALLET_ADJUSTMENT_REASON_MIN} caractères : il est journalisé avec votre identifiant.`
  return null
})

const canContinue = computed(() =>
  amount.value !== null && reasonValid.value && !debitExceeds.value && !frozen.value,
)

const request = computed<WalletAdjustmentRequest | null>(() =>
  amount.value === null
    ? null
    : { currency: currency.value, direction: direction.value, amount: amount.value, reason: reason.value.trim() },
)

function onConfirm() {
  if (request.value && canContinue.value) emit('submit', request.value)
}

const directionClass = (d: WalletAdjustmentDirection) => direction.value === d
  ? (d === 'CREDIT' ? 'bg-success/15 text-success border-success/40' : 'bg-danger/15 text-danger border-danger/40')
  : 'border-border text-text-muted hover:bg-surface-elevated'
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
    <div
      data-test="adj-dialog" role="dialog" aria-modal="true" aria-labelledby="adj-title"
      class="w-full max-w-md rounded-card border border-border bg-surface p-6 shadow-xl"
    >
      <h2 id="adj-title" class="font-display text-lg font-semibold mb-1 text-balance">Corriger le solde</h2>

      <template v-if="step === 'form'">
        <p class="text-sm text-text-muted mb-4 text-pretty">
          Chaque correction est journalisée avec son motif et votre identifiant. Plafond : 500 € d'équivalent par opération.
        </p>

        <div class="mb-4 grid grid-cols-2 gap-2" role="group" aria-label="Sens de la correction">
          <button
            type="button" data-test="adj-direction-credit" :aria-pressed="direction === 'CREDIT'"
            class="rounded-btn border px-3 py-2 text-sm font-medium transition-colors active:scale-[0.96]"
            :class="directionClass('CREDIT')" @click="setDirection('CREDIT')"
          >Créditer</button>
          <button
            type="button" data-test="adj-direction-debit" :aria-pressed="direction === 'DEBIT'"
            class="rounded-btn border px-3 py-2 text-sm font-medium transition-colors active:scale-[0.96]"
            :class="directionClass('DEBIT')" @click="setDirection('DEBIT')"
          >Débiter</button>
        </div>

        <div class="mb-4 grid grid-cols-2 gap-3">
          <label class="block text-xs text-text-muted">
            Devise
            <select
              v-model="currency" data-test="adj-currency"
              class="mt-1 w-full rounded-btn border border-border bg-bg p-2 text-sm text-text"
            >
              <option v-for="o in currencyOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
          </label>
          <label class="block text-xs text-text-muted">
            Montant
            <input
              v-model="amountText" data-test="adj-amount" type="text" inputmode="decimal" autocomplete="off"
              placeholder="ex. 12,50"
              class="mt-1 w-full rounded-btn border border-border bg-bg p-2 text-sm text-text tabular-nums"
            >
          </label>
        </div>

        <p
          v-if="frozen" data-test="adj-frozen"
          class="mb-3 rounded-btn border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning text-pretty"
        >Ce portefeuille est gelé : une demande de remboursement est en cours. Aucune correction n'est possible tant qu'elle n'est pas traitée.</p>
        <p
          v-if="debitExceeds" data-test="adj-debit-exceeds"
          class="mb-3 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger text-pretty"
        >Le débit dépasse le solde disponible ({{ formatMajorAmount(currentBalance, currency) }}).</p>

        <div
          v-if="balanceAfter !== null" data-test="adj-recap"
          class="mb-4 flex items-center justify-between rounded-btn bg-surface-elevated px-3 py-2 text-sm"
        >
          <span class="text-text-muted">Solde actuel</span>
          <span class="tabular-nums">
            {{ formatMajorAmount(currentBalance, currency) }}
            <span class="px-1 text-text-muted" aria-hidden="true">→</span>
            <span class="sr-only">puis</span>
            <strong :class="balanceAfter < 0 ? 'text-danger' : ''">{{ formatMajorAmount(balanceAfter, currency) }}</strong>
          </span>
        </div>

        <label class="block text-xs text-text-muted" for="adj-reason">Motif (obligatoire)</label>
        <textarea
          id="adj-reason" v-model="reason" data-test="adj-reason" rows="3"
          placeholder="Pourquoi ce solde doit-il changer ?"
          class="mt-1 w-full rounded-btn border border-border bg-bg p-2 text-sm text-text"
        />
        <div class="mb-4 flex items-start justify-between gap-3 text-xs">
          <span data-test="adj-reason-hint" class="text-text-muted text-pretty">{{ reasonHint }}</span>
          <span
            data-test="adj-reason-count" class="shrink-0 tabular-nums"
            :class="reasonLength > WALLET_ADJUSTMENT_REASON_MAX ? 'text-danger' : 'text-text-muted'"
          >{{ reasonLength }} / {{ WALLET_ADJUSTMENT_REASON_MAX }}</span>
        </div>

        <div class="flex justify-end gap-2">
          <button
            type="button" data-test="adj-cancel"
            class="rounded-btn px-4 py-2 text-sm border border-border hover:bg-surface-elevated"
            @click="emit('cancel')"
          >Annuler</button>
          <button
            type="button" data-test="adj-continue" :disabled="!canContinue"
            class="rounded-btn px-4 py-2 text-sm bg-primary text-white disabled:opacity-40 hover:bg-primary/90 transition-transform active:scale-[0.96]"
            @click="step = 'confirm'"
          >Continuer</button>
        </div>
      </template>

      <template v-else>
        <div data-test="adj-confirm-summary" class="mb-4 space-y-2 text-sm">
          <p class="text-pretty">
            <strong>{{ direction === 'CREDIT' ? 'Créditer' : 'Débiter' }}
              <span class="tabular-nums">{{ formatMajorAmount(amount, currency) }}</span></strong>
            sur le compte {{ currency }} de cet utilisateur.
          </p>
          <p class="tabular-nums text-text-muted">
            Solde : {{ formatMajorAmount(currentBalance, currency) }} → {{ formatMajorAmount(balanceAfter, currency) }}
          </p>
          <p class="rounded-btn bg-surface-elevated px-3 py-2 text-text-muted text-pretty break-words">
            Motif : {{ request?.reason }}
          </p>
        </div>
        <p
          v-if="error" data-test="adj-error"
          class="mb-3 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger text-pretty"
        >{{ error }}</p>
        <div class="flex justify-end gap-2">
          <button
            type="button" data-test="adj-cancel"
            class="rounded-btn px-4 py-2 text-sm border border-border hover:bg-surface-elevated"
            @click="emit('cancel')"
          >Annuler</button>
          <button
            type="button" data-test="adj-back" :disabled="busy"
            class="rounded-btn px-4 py-2 text-sm border border-border hover:bg-surface-elevated disabled:opacity-40"
            @click="step = 'form'"
          >Modifier</button>
          <button
            type="button" data-test="adj-confirm" :disabled="busy"
            class="rounded-btn px-4 py-2 text-sm text-white disabled:opacity-40 transition-transform active:scale-[0.96]"
            :class="direction === 'CREDIT' ? 'bg-success hover:bg-success/90' : 'bg-danger hover:bg-danger/90'"
            @click="onConfirm"
          >{{ busy ? 'En cours…' : 'Confirmer la correction' }}</button>
        </div>
      </template>
    </div>
  </div>
</template>
