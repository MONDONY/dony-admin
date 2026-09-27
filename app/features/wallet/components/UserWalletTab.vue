<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import PaginationControls from '@/components/ui/PaginationControls.vue'
import WalletAdjustmentDialog from './WalletAdjustmentDialog.vue'
import { useUserWallet } from '@/features/wallet/composables/useUserWallet'
import { useWalletAdjustment } from '@/features/wallet/composables/useWalletAdjustment'
import { formatMajorAmount } from '@/features/finance/types/index'
import {
  formatSignedAmount, isAdjustmentTransaction, walletTransactionTypeLabel, WALLET_TRANSACTION_TYPES,
} from '@/features/wallet/types/index'
import type { WalletAdjustmentRequest } from '@/features/wallet/types/index'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{ userId: string }>()
const auth = useAuthStore()
const wallet = useUserWallet(props.userId)
const adjustment = useWalletAdjustment(props.userId)

const dialogOpen = ref(false)
const success = ref<string | null>(null)

// Le bouton suppose un portefeuille lisible : sans soldes, le récapitulatif serait faux.
const canAdjust = computed(() =>
  auth.can('WALLET_ADJUST') && !wallet.unavailable.value && !wallet.error.value && !wallet.isLoading.value,
)

function openDialog() {
  success.value = null
  adjustment.begin()
  dialogOpen.value = true
}

async function onSubmit(request: WalletAdjustmentRequest) {
  const result = await adjustment.submit(request)
  if (!result) return
  dialogOpen.value = false
  const c = result.account.currency
  success.value = `Solde corrigé : ${formatMajorAmount(result.account.balance, c)} sur le compte ${c}.`
  await wallet.refresh()
}

function onCurrencyFilter(e: Event) {
  const v = (e.target as HTMLSelectElement).value
  void wallet.setCurrencyFilter(v || null)
}
function onTypeFilter(e: Event) {
  const v = (e.target as HTMLSelectElement).value
  void wallet.setTypeFilter(v || null)
}

function fmtDate(d: string) { return new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) }

onMounted(wallet.load)
</script>

<template>
  <section class="space-y-5" aria-label="Portefeuille">
    <p v-if="wallet.isLoading.value" class="text-sm text-text-muted">Chargement du portefeuille…</p>

    <p v-else-if="wallet.unavailable.value" data-test="wallet-unavailable" class="text-sm text-text-muted">Portefeuille indisponible pour le moment</p>

    <p
      v-else-if="wallet.error.value" data-test="wallet-error"
      class="rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
    >{{ wallet.error.value }}</p>

    <template v-else>
      <div>
        <div class="mb-2 flex items-center justify-between gap-2">
          <h3 class="text-sm font-semibold">Soldes</h3>
          <button
            v-if="canAdjust" type="button" data-test="wallet-adjust-open"
            class="rounded-btn border border-border px-3 py-1.5 text-sm hover:bg-surface-elevated transition-transform active:scale-[0.96]"
            @click="openDialog"
          >Corriger le solde</button>
        </div>
        <p
          v-if="success" data-test="wallet-success" role="status"
          class="mb-2 rounded-btn border border-success/40 bg-success/10 px-3 py-2 text-sm text-success"
        >{{ success }}</p>
        <p v-if="wallet.accounts.value.length === 0" data-test="wallet-no-account" class="text-sm text-text-muted">
          Aucun compte ouvert pour cet utilisateur.
        </p>
        <ul v-else class="grid grid-cols-2 gap-2">
          <li
            v-for="a in wallet.accounts.value" :key="a.currency" :data-test="`wallet-account-${a.currency}`"
            class="rounded-card border border-border bg-surface-elevated p-3"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs font-medium text-text-muted">{{ a.currency }}</span>
              <span
                v-if="a.frozen" data-test="wallet-frozen"
                class="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning"
                title="Une demande de remboursement est en cours"
              >Gelé</span>
            </div>
            <p class="mt-1 text-lg font-semibold tabular-nums">{{ formatMajorAmount(a.balance, a.currency) }}</p>
            <p data-test="wallet-refundable" class="text-xs text-text-muted tabular-nums">
              Remboursable : {{ a.refundEligibleAmount == null ? 'non calculable' : formatMajorAmount(a.refundEligibleAmount, a.currency) }}
            </p>
          </li>
        </ul>
      </div>

      <div>
        <h3 class="mb-2 text-sm font-semibold">Journal</h3>
        <div class="mb-3 grid grid-cols-2 gap-2">
          <select
            data-test="wallet-filter-currency" aria-label="Filtrer par devise" :value="wallet.filters.currency ?? ''"
            class="rounded-btn border border-border bg-surface px-2 py-1.5 text-sm"
            @change="onCurrencyFilter"
          >
            <option value="">Toutes les devises</option>
            <option v-for="a in wallet.accounts.value" :key="a.currency" :value="a.currency">{{ a.currency }}</option>
          </select>
          <select
            data-test="wallet-filter-type" aria-label="Filtrer par type de mouvement" :value="wallet.filters.type ?? ''"
            class="rounded-btn border border-border bg-surface px-2 py-1.5 text-sm"
            @change="onTypeFilter"
          >
            <option value="">Tous les mouvements</option>
            <option v-for="t in WALLET_TRANSACTION_TYPES" :key="t" :value="t">{{ walletTransactionTypeLabel(t) }}</option>
          </select>
        </div>

        <p
          v-if="wallet.transactionsError.value" data-test="wallet-tx-error"
          class="mb-2 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
        >{{ wallet.transactionsError.value }}</p>
        <p v-else-if="wallet.transactionsLoading.value" class="text-sm text-text-muted">Chargement du journal…</p>
        <p v-else-if="wallet.transactions.value.length === 0" data-test="wallet-tx-empty" class="text-sm text-text-muted">
          Aucun mouvement.
        </p>
        <ul v-else class="divide-y divide-border rounded-card border border-border">
          <li v-for="t in wallet.transactions.value" :key="t.id" :data-test="`wallet-tx-${t.id}`" class="px-3 py-2 text-sm">
            <div class="flex items-baseline justify-between gap-3">
              <span class="min-w-0 truncate" :title="t.type">{{ walletTransactionTypeLabel(t.type) }}</span>
              <span
                data-test="wallet-tx-amount" class="shrink-0 font-medium tabular-nums"
                :class="t.amount > 0 ? 'text-success' : t.amount < 0 ? 'text-danger' : 'text-text-muted'"
              >{{ formatSignedAmount(t.amount, t.currency) }}</span>
            </div>
            <div class="flex items-baseline justify-between gap-3 text-xs text-text-muted">
              <span class="tabular-nums">{{ fmtDate(t.createdAt) }}</span>
              <span v-if="t.balanceAfter != null" class="tabular-nums">Solde : {{ formatMajorAmount(t.balanceAfter, t.currency) }}</span>
            </div>
            <p
              v-if="isAdjustmentTransaction(t.type) && (t.adminReason || t.adminActorEmail || t.adminActorId)"
              data-test="wallet-tx-admin" class="mt-1 text-xs text-text-muted text-pretty break-words"
            >
              <span v-if="t.adminReason">Motif : {{ t.adminReason }}</span>
              <span v-if="t.adminReason && (t.adminActorEmail || t.adminActorId)"> · </span>
              <span v-if="t.adminActorEmail || t.adminActorId">par {{ t.adminActorEmail || t.adminActorId }}</span>
            </p>
          </li>
        </ul>
        <div v-if="wallet.totalPages.value > 1" class="mt-3">
          <PaginationControls :page="wallet.page.value" :total-pages="wallet.totalPages.value" @change="wallet.goToPage" />
        </div>
      </div>
    </template>

    <WalletAdjustmentDialog
      :open="dialogOpen" :accounts="wallet.accounts.value"
      :busy="adjustment.busy.value" :error="adjustment.error.value"
      @submit="onSubmit" @cancel="dialogOpen = false"
    />
  </section>
</template>
