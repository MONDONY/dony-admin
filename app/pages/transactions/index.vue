<script setup lang="ts">
import { onMounted, watch } from 'vue'
import PaymentsTable from '@/features/payments/components/PaymentsTable.vue'
import PaymentFilters from '@/features/payments/components/PaymentFilters.vue'
import PaymentTotalsBar from '@/features/payments/components/PaymentTotalsBar.vue'
import PaymentDetailPanel from '@/features/payments/components/PaymentDetailPanel.vue'
import PaymentViewTabs from '@/features/payments/components/PaymentViewTabs.vue'
import PaymentSearchBox from '@/features/payments/components/PaymentSearchBox.vue'
import ChargebacksSection from '@/features/payments/components/ChargebacksSection.vue'
import ActiveFilters from '@/components/ui/ActiveFilters.vue'
import TransactionSectionTabs from '@/features/transactions/components/TransactionSectionTabs.vue'
import MobileMoneySection from '@/features/finance/components/MobileMoneySection.vue'
import WalletsSection from '@/features/finance/components/WalletsSection.vue'
import CashCommissionsSection from '@/features/finance/components/CashCommissionsSection.vue'
import WalletRefundsSection from '@/features/finance/components/WalletRefundsSection.vue'
import MobileMoneyCommissionsPanel from '@/features/finance/components/MobileMoneyCommissionsPanel.vue'
import PeriodFilter from '@/features/finance/components/PeriodFilter.vue'
import SectionError from '@/features/finance/components/SectionError.vue'
import ListCountsError from '@/features/finance/components/ListCountsError.vue'
import PaginationControls from '@/components/ui/PaginationControls.vue'
import { usePaymentsSection, type PaymentPickKind } from '@/features/payments/composables/usePaymentsSection'
import { usePaymentDetail } from '@/features/payments/composables/usePaymentDetail'
import { usePaymentDrawerRoute } from '@/features/payments/composables/usePaymentDrawerRoute'
import { useChargebacks } from '@/features/payments/composables/useChargebacks'
import { useMobileMoney } from '@/features/finance/composables/useMobileMoney'
import { useMobileMoneyCommissions } from '@/features/finance/composables/useMobileMoneyCommissions'
import { useWallets } from '@/features/finance/composables/useWallets'
import { useCashCommissions } from '@/features/finance/composables/useCashCommissions'
import { useWalletRefunds } from '@/features/finance/composables/useWalletRefunds'
import { MM_URL_PARAMS } from '@/features/finance/lib/mobileMoneyViews'
import { PAYMENT_URL_SPECS } from '@/features/payments/lib/paymentPageFilters'
import { useFinanceCounts } from '@/features/transactions/composables/useFinanceCounts'
import { useTransactionTabs } from '@/features/transactions/composables/useTransactionTabs'
import { useAuthStore } from '@/stores/auth'
import type { PaymentSuggestParcel, PaymentSuggestPerson, PaymentSuggestTrip } from '@/features/payments/types/index'

definePageMeta({ middleware: 'admin-only', permission: 'PAYMENT_VIEW', pageTitle: 'Transactions', pageSubtitle: 'Paiements & escrow' })

const route = useRoute()
const auth = useAuthStore()
// Pastilles des quatre sections (sans pastille le temps de la réponse) ; sans elles (ancien back,
// ou en échec), les sept onglets plats d'avant.
const finance = useFinanceCounts()
// Listes des autres onglets : chacune garde son état ; ses filtres vivent dans l'URL de son onglet.
const mm = useMobileMoney()
const mmCommissions = useMobileMoneyCommissions()
const wallets = useWallets()
const cash = useCashCommissions()
const cbs = useChargebacks()
const refunds = useWalletRefunds({
  // Vue « À traiter » s'il y a des tickets : même nombre que la pastille du menu.
  pendingCount: async () => { await finance.settled(); return finance.counts.value?.details?.walletRefundsPending ?? null },
  onChanged: () => finance.reload(),
})
/** Paramètres d'URL des Paiements (dont l'alias `held`) : `view` et `query` y portent le même nom qu'ailleurs. */
const PAYMENT_PARAMS = [...Object.entries(PAYMENT_URL_SPECS).map(([k, spec]) => spec.param ?? k), 'held']
// Onglet dans l'URL et portée des paramètres : chaque section n'écrit les siens que tant qu'elle est affichée.
const tabs = useTransactionTabs({
  tabQuery: t => drawer.tabQuery(t),
  applyPayments: q => pay.url.apply(q),
  paymentParams: PAYMENT_PARAMS,
  lists: { 'mobile-money': { ...mm, params: MM_URL_PARAMS }, wallets, 'cash-commissions': cash, chargebacks: cbs, 'wallet-refunds': refunds },
  visit: { 'mm-commissions': () => mmCommissions.ensure() },
})
const { tab, section } = tabs
// Section Paiements : liste, vues à nombre, recherche à suggestions, filtres dans l'URL (lus ici,
// avant le premier rendu : les champs s'initialisent depuis leurs props).
const pay = usePaymentsSection({ active: () => tab.value === 'payments' })
const {
  filters, payments, isLoading, error: paymentsError, totalPages, currentPage, totals, exporting, heldFilterUnsupported,
  chips, viewsReady, viewsPending, hiddenAbandoned, held, searchResetKey, countsApi, suggestApi,
} = pay
const { counts: viewCounts, error: viewCountsError } = countsApi
const { suggestions, unavailable: suggestionsUnavailable } = suggestApi
const detail = usePaymentDetail()
// Tiroir paiement : ?open=<paiement> et ?section=<onglet> dans l'URL, ouverture depuis un lien reçu.
const drawer = usePaymentDrawerRoute(detail, { apply: q => pay.url.apply(q) })

/**
 * Après chaque geste : la liste, les nombres des vues et les pastilles des sections sont relus ;
 * un geste réussi relit aussi la fiche (sa réponse ne porte ni les liens ni l'alerte). Un échec
 * garde la fiche telle quelle : son message et la dérogation proposée restent affichés.
 */
async function afterAction() { await Promise.all([pay.refresh(), finance.reload()]) }
async function onAction(fn: () => Promise<boolean>) {
  const id = drawer.openId.value
  const ok = await fn()
  await Promise.all([afterAction(), ok && id && drawer.openId.value === id ? detail.reload(id) : null])
}
/** Un n° de suivi suggéré ouvre son paiement ; une personne ou un trajet filtre la liste. */
async function onPick(kind: PaymentPickKind, payload: PaymentSuggestPerson | PaymentSuggestTrip | PaymentSuggestParcel) {
  const id = await pay.onPick(kind, payload)
  if (id) await drawer.openPayment(id)
}
/** Référence exacte : ouverte seulement si le texte tapé est celui auquel les suggestions ont répondu. */
async function onOpenPayment(id: string) {
  const target = await pay.onOpenPayment(id)
  if (target) await drawer.openPayment(target)
}

onMounted(async () => {
  await Promise.all([pay.load(), finance.reload(), tabs.start()])
  // ?open=<paiement>[&section=] (alerte, recherche globale, fiche colis) : la fiche, sur son onglet.
  await drawer.restore()
})
// ?open= et ?section= arrivés page ouverte : suivis par `usePaymentDrawerRoute` ; ?tab= et les
// paramètres des autres onglets : par `useTransactionTabs` ; ?held=true (bandeau d'une fiche
// utilisateur, carte de la vue d'ensemble) : ici.
watch(() => route.query?.held, (v) => { if (v !== undefined) void pay.applyLegacyHeld() })
</script>

<template>
  <div>
    <div class="mb-4">
      <TransactionSectionTabs :section="section" :sub="tab" :counts="finance.counts.value" :flat="finance.flat.value" @update:tab="tabs.switchTab" />
      <p v-if="finance.error.value" data-test="finance-counts-error" role="status" class="mt-1 flex items-center gap-2 text-xs text-text-muted">
        Nombres des sections indisponibles
        <button
          type="button" data-test="finance-counts-retry"
          class="inline-flex min-h-10 items-center rounded-btn px-2 text-xs text-primary transition-[background-color,transform] hover:bg-primary/10 active:scale-[0.96] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          @click="finance.reload()"
        >Réessayer</button>
      </p>
    </div>

    <template v-if="tab === 'payments'">
      <div class="mb-4 space-y-3">
        <!-- Vues : seulement une fois les nombres répondus, jamais face à un ancien back (liste « Tous »). -->
        <div v-if="viewsReady">
          <PaymentViewTabs :model-value="filters.view ?? 'ALL'" :counts="viewCounts" @update:model-value="pay.setView" />
          <ListCountsError v-if="viewCountsError" test-prefix="payment" class="mt-1" @retry="countsApi.reload()" />
        </div>
        <!-- Nombres en route : même hauteur que les vues et leur aide, pour que la liste ne saute pas. -->
        <div v-else-if="viewsPending" data-test="payment-views-skeleton" aria-hidden="true">
          <div class="flex h-10 items-center gap-4 border-b border-border px-4">
            <span v-for="n in 6" :key="n" class="h-3 w-16 animate-pulse rounded bg-surface-elevated motion-reduce:animate-none" />
          </div>
          <div class="mt-2 h-4" />
        </div>
        <PaymentSearchBox
          :model-query="filters.query ?? ''" :suggestions="suggestions" :suggestions-disabled="suggestionsUnavailable" :reset-key="searchResetKey"
          @type="pay.onType" @update:query="pay.onSearch" @pick="onPick" @open-payment="onOpenPayment"
        />
        <PaymentFilters
          :model-method="filters.method"
          :model-currency="filters.currency"
          :model-date-from="filters.dateFrom"
          :model-date-to="filters.dateTo"
          :model-amount-min="filters.amountMin ?? null"
          :model-amount-max="filters.amountMax ?? null"
          :model-held="held"
          :model-hide-abandoned="filters.hideAbandoned"
          @update:held="pay.setHeld"
          @update:hide-abandoned="pay.setHideAbandoned"
          @update:method="pay.setMethodFilter"
          @update:currency="pay.setCurrencyFilter"
          @update:date-range="(from, to) => pay.setDateRange(from, to)"
          @update:amount-range="(min, max) => pay.setAmountRange(min, max)"
        />
        <div v-if="chips.length || hiddenAbandoned" class="flex flex-wrap items-center gap-x-4 gap-y-2">
          <ActiveFilters :chips="chips" @remove="pay.removeChip" @clear="pay.clearAll" />
          <p v-if="hiddenAbandoned" data-test="abandoned-hidden" class="ml-auto flex items-center text-sm text-text-muted tabular-nums">
            {{ hiddenAbandoned }} {{ hiddenAbandoned > 1 ? 'checkouts abandonnés masqués' : 'checkout abandonné masqué' }} ·
            <button
              type="button" data-test="abandoned-show"
              class="inline-flex min-h-10 items-center rounded-btn px-2 text-sm text-primary transition-[background-color,transform] hover:bg-primary/10 active:scale-[0.96] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              @click="pay.showAbandoned()"
            >les afficher</button>
          </p>
        </div>
      </div>
      <p
        v-if="heldFilterUnsupported" data-test="held-filter-unsupported"
        class="mb-3 rounded-btn border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning text-pretty"
      >Le serveur ne sait pas encore isoler les versements retenus : ce filtre sera disponible après sa mise à jour.</p>
      <p
        v-if="paymentsError" data-test="payments-error"
        class="mb-3 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
      >{{ paymentsError }}</p>
      <PaymentTotalsBar v-if="totals" :totals="totals" />
      <PaymentsTable
        :payments="payments" :loading="isLoading" :empty-label="filters.view === 'ATTENTION' ? 'Rien à traiter' : 'Aucun paiement'"
        @select="drawer.openPayment"
      />
      <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
        <PaginationControls :page="currentPage" :total-pages="totalPages" @change="pay.goToPage" />
        <button
          v-if="auth.can('EXPORT_RUN')" type="button" data-test="payments-export" :disabled="exporting"
          class="inline-flex min-h-10 items-center rounded-btn border border-border px-3 text-sm transition-[background-color,transform] hover:bg-surface-elevated active:scale-[0.96] disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          @click="pay.exportCsv()"
        >{{ exporting ? 'Export…' : 'Exporter en CSV' }}</button>
      </div>
      <PaymentDetailPanel
        v-if="detail.payment.value"
        :payment="detail.payment.value" :open="detail.payment.value !== null"
        :error="detail.error.value" :busy="detail.busy.value"
        :override-request="detail.overrideRequest.value"
        :override-error="detail.overrideError.value"
        :section="drawer.section.value"
        @update:section="drawer.setSection"
        @close="drawer.closePayment"
        @force-release="(o) => onAction(() => detail.forceRelease(o))"
        @refund="onAction(detail.refund)"
        @retry-payout="(o) => onAction(() => detail.retryPayout(o))"
        @override-dismiss="detail.dismissOverride"
        @retry-refund="onAction(detail.retryRefund)"
        @resynced="detail.open(detail.payment.value!.id)"
      />
    </template>
    <ChargebacksSection v-else-if="tab === 'chargebacks'" :list="cbs" />
    <WalletsSection v-else-if="tab === 'wallets'" :list="wallets" />
    <MobileMoneySection v-else-if="tab === 'mobile-money'" :list="mm" />
    <template v-else-if="tab === 'mm-commissions'">
      <SectionError :message="mmCommissions.error.value" />
      <PeriodFilter
        :model-date-from="mmCommissions.from.value" :model-date-to="mmCommissions.to.value"
        @update:date-range="mmCommissions.setPeriod"
      />
      <MobileMoneyCommissionsPanel :data="mmCommissions.data.value" :loading="mmCommissions.loading.value" />
    </template>
    <CashCommissionsSection v-else-if="tab === 'cash-commissions'" :list="cash" />
    <WalletRefundsSection v-else :list="refunds" />
  </div>
</template>
