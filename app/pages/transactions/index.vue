<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import PaymentsTable from '@/features/payments/components/PaymentsTable.vue'
import PaymentFilters from '@/features/payments/components/PaymentFilters.vue'
import PaymentTotalsBar from '@/features/payments/components/PaymentTotalsBar.vue'
import PaymentDetailPanel from '@/features/payments/components/PaymentDetailPanel.vue'
import ChargebacksTable from '@/features/payments/components/ChargebacksTable.vue'
import WalletsTable from '@/features/finance/components/WalletsTable.vue'
import MobileMoneyTable from '@/features/finance/components/MobileMoneyTable.vue'
import CashCommissionsTable from '@/features/finance/components/CashCommissionsTable.vue'
import MobileMoneyCommissionsPanel from '@/features/finance/components/MobileMoneyCommissionsPanel.vue'
import WalletRefundRequestsTable from '@/features/finance/components/WalletRefundRequestsTable.vue'
import PeriodFilter from '@/features/finance/components/PeriodFilter.vue'
import PaginationControls from '@/components/ui/PaginationControls.vue'
import { usePayments } from '@/features/payments/composables/usePayments'
import { usePaymentDetail } from '@/features/payments/composables/usePaymentDetail'
import { paymentsService } from '@/features/payments/services/paymentsService'
import { financeService } from '@/features/finance/services/financeService'
import { extractProblemMessage } from '@/lib/problemDetail'
import { useAuthStore } from '@/stores/auth'
import type { AdminChargeback } from '@/features/payments/types/index'
import type { AdminWallet, AdminMobileMoneyPayment, AdminCashCommission, AdminMobileMoneyCommissions, AdminWalletRefundRequest } from '@/features/finance/types/index'

definePageMeta({ middleware: 'admin-only', permission: 'PAYMENT_VIEW', pageTitle: 'Transactions', pageSubtitle: 'Paiements & escrow' })

type Tab = 'payments' | 'chargebacks' | 'wallets' | 'mobile-money' | 'mm-commissions' | 'cash-commissions' | 'wallet-refunds'

const TABS: readonly Tab[] = ['payments', 'chargebacks', 'wallets', 'mobile-money', 'mm-commissions', 'cash-commissions', 'wallet-refunds']
const isTab = (v: unknown): v is Tab => typeof v === 'string' && (TABS as readonly string[]).includes(v)
const tab = ref<Tab>('payments')
const route = useRoute()
const router = useRouter()
const { payments, isLoading, error: paymentsError, totalPages, currentPage, filters, totals, exporting, fetchPayments, goToPage, setStatusFilter, setMethodFilter, setCurrencyFilter, setDateRange, setHeldFilter, setQuery, setHideAbandoned, exportCsv, heldFilterUnsupported } = usePayments()
const auth = useAuthStore()
const detail = usePaymentDetail()
const cbs = ref<AdminChargeback[]>([])
const cbLoading = ref(false)
const cbPage = ref(0)
const cbTotalPages = ref(0)
const cbLoaded = ref(false)

const wallets = ref<AdminWallet[]>([])
const walletsLoading = ref(false)
const walletsPage = ref(0)
const walletsTotalPages = ref(0)

const mmPayments = ref<AdminMobileMoneyPayment[]>([])
const mmLoading = ref(false)
const mmPage = ref(0)
const mmTotalPages = ref(0)

const mmCommissions = ref<AdminMobileMoneyCommissions | null>(null)
const mmCommissionsLoading = ref(false)
const mmCommissionsFrom = ref<string | null>(null)
const mmCommissionsTo = ref<string | null>(null)
const cashCommissions = ref<AdminCashCommission[]>([])
const cashLoading = ref(false)
const cashPage = ref(0)
const cashTotalPages = ref(0)

const walletRefunds = ref<AdminWalletRefundRequest[]>([])
const walletRefundsLoading = ref(false)
const walletRefundsPage = ref(0)
const walletRefundsTotalPages = ref(0)
const walletRefundsLoaded = ref(false)
const walletRefundBusyId = ref<string | null>(null)

// Sur un écran financier, un appel en échec ne doit JAMAIS ressembler à une absence de
// données : sans ce message, un 403 ou un 500 rend un tableau vide, indiscernable d'un
// compte réellement sans portefeuille ni commission.
const tabError = ref<string | null>(null)

async function loadCbs(page = cbPage.value) {
  cbLoading.value = true
  tabError.value = null
  try {
    const res = await paymentsService.listChargebacks(page, 20)
    cbs.value = res.content; cbTotalPages.value = res.totalPages; cbPage.value = res.number
    cbLoaded.value = true
  }
  catch (e) { tabError.value = extractProblemMessage(e, 'Impossible de charger les litiges bancaires') }
  finally { cbLoading.value = false }
}

async function loadWallets(page = walletsPage.value) {
  walletsLoading.value = true
  tabError.value = null
  try {
    const res = await financeService.listWallets(page, 20)
    wallets.value = res.content; walletsTotalPages.value = res.totalPages; walletsPage.value = res.number
  }
  catch (e) { tabError.value = extractProblemMessage(e, 'Impossible de charger les portefeuilles') }
  finally { walletsLoading.value = false }
}
async function loadMobileMoney(page = mmPage.value) {
  mmLoading.value = true
  tabError.value = null
  try {
    const res = await financeService.listMobileMoneyPayments(page, 20)
    mmPayments.value = res.content; mmTotalPages.value = res.totalPages; mmPage.value = res.number
  }
  catch (e) { tabError.value = extractProblemMessage(e, 'Impossible de charger les paiements mobile money') }
  finally { mmLoading.value = false }
}
async function loadMobileMoneyCommissions() {
  mmCommissionsLoading.value = true
  tabError.value = null
  try {
    mmCommissions.value = await financeService.getMobileMoneyCommissionsForDays(mmCommissionsFrom.value, mmCommissionsTo.value)
  }
  catch (e) { tabError.value = extractProblemMessage(e, 'Impossible de charger les commissions mobile money') }
  finally { mmCommissionsLoading.value = false }
}

async function setMmCommissionsPeriod(from: string | null, to: string | null) {
  mmCommissionsFrom.value = from
  mmCommissionsTo.value = to
  await loadMobileMoneyCommissions()
}

async function loadCashCommissions(page = cashPage.value) {
  cashLoading.value = true
  tabError.value = null
  try {
    const res = await financeService.listCashCommissions(page, 20)
    cashCommissions.value = res.content; cashTotalPages.value = res.totalPages; cashPage.value = res.number
  }
  catch (e) { tabError.value = extractProblemMessage(e, 'Impossible de charger les commissions cash') }
  finally { cashLoading.value = false }
}

async function loadWalletRefunds(page = walletRefundsPage.value) {
  walletRefundsLoading.value = true
  tabError.value = null
  try {
    const res = await financeService.listWalletRefundRequests(page, 20)
    walletRefunds.value = res.content; walletRefundsTotalPages.value = res.totalPages; walletRefundsPage.value = res.number
    walletRefundsLoaded.value = true
  }
  catch (e) { tabError.value = extractProblemMessage(e, 'Impossible de charger les demandes de remboursement wallet') }
  finally { walletRefundsLoading.value = false }
}
async function resolveWalletRefund(id: string) {
  walletRefundBusyId.value = id
  tabError.value = null
  try {
    await financeService.resolveWalletRefundRequest(id)
    await loadWalletRefunds()
  }
  catch (e) { tabError.value = extractProblemMessage(e, 'Impossible de résoudre cette demande de remboursement') }
  finally { walletRefundBusyId.value = null }
}

/**
 * L'onglet vit dans l'URL (?tab=wallet-refunds, notification WALLET_REFUND_REQUESTED), à côté
 * de ?held=true qu'il ne touche pas. Paiements = pas de paramètre.
 */
function syncTabQuery(t: Tab) {
  const query = { ...(route.query ?? {}) }
  if (t === 'payments') delete query.tab
  else query.tab = t
  if (query.tab === route.query?.tab) return
  void router.replace({ query })
}
async function switchTab(t: Tab, fromUrl = false) {
  tab.value = t
  if (!fromUrl) syncTabQuery(t)
  if (t === 'chargebacks' && !cbLoaded.value) await loadCbs()
  if (t === 'wallets' && wallets.value.length === 0) await loadWallets()
  if (t === 'mobile-money' && mmPayments.value.length === 0) await loadMobileMoney()
  if (t === 'mm-commissions' && mmCommissions.value === null) await loadMobileMoneyCommissions()
  if (t === 'cash-commissions' && cashCommissions.value.length === 0) await loadCashCommissions()
  if (t === 'wallet-refunds' && !walletRefundsLoaded.value) await loadWalletRefunds()
}
// Même lien que les contreparties de UserDeletionDialog (?query=<uuid>), plus ?open=<uuid>
// pour ouvrir la fiche sans second clic.
function openWalletOwner(userId: string) {
  return navigateTo({ path: '/users', query: { query: userId, open: userId } })
}
// ?held=true (carte de la vue d'ensemble, fiche utilisateur) : le filtre « Versements
// retenus » est le seul porté par l'URL, pour que ces liens restent partageables.
async function onHeldFilter(h: boolean) {
  const query = { ...(route.query ?? {}) }
  if (h) query.held = 'true'
  else delete query.held
  await router.replace({ query })
  await setHeldFilter(h)
}
async function afterAction() { await fetchPayments() }
async function onAction(fn: () => Promise<boolean>) {
  await fn()
  await afterAction()
}

onMounted(async () => {
  if (route.query?.held === 'true') filters.held = true
  const wanted = route.query?.tab
  await Promise.all([fetchPayments(), isTab(wanted) && wanted !== 'payments' ? switchTab(wanted, true) : Promise.resolve()])
  // ?open=<paymentId> (lien « Ouvrir le paiement » d'une alerte) : ouvre la fiche.
  const openId = route.query?.open
  if (typeof openId === 'string' && openId) await detail.open(openId)
})
// Page déjà ouverte : un clic sur une notification change seulement la query.
watch(() => route.query?.tab, (v) => {
  const t: Tab = isTab(v) ? v : 'payments'
  if (t !== tab.value) void switchTab(t, true)
})
</script>

<template>
  <div>
    <div class="flex gap-1 mb-4 flex-wrap">
      <button type="button" data-test="tab-payments" :aria-pressed="tab === 'payments'" :class="['rounded-full px-3 py-1.5 text-sm', tab === 'payments' ? 'bg-primary text-white' : 'bg-surface-elevated text-text-muted']" @click="switchTab('payments')">Paiements</button>
      <button type="button" data-test="tab-chargebacks" :aria-pressed="tab === 'chargebacks'" :class="['rounded-full px-3 py-1.5 text-sm', tab === 'chargebacks' ? 'bg-primary text-white' : 'bg-surface-elevated text-text-muted']" @click="switchTab('chargebacks')">Litiges bancaires</button>
      <button type="button" data-test="tab-wallets" :aria-pressed="tab === 'wallets'" :class="['rounded-full px-3 py-1.5 text-sm', tab === 'wallets' ? 'bg-primary text-white' : 'bg-surface-elevated text-text-muted']" @click="switchTab('wallets')">Portefeuilles</button>
      <button type="button" data-test="tab-mobile-money" :aria-pressed="tab === 'mobile-money'" :class="['rounded-full px-3 py-1.5 text-sm', tab === 'mobile-money' ? 'bg-primary text-white' : 'bg-surface-elevated text-text-muted']" @click="switchTab('mobile-money')">Mobile money</button>
      <button type="button" data-test="tab-mm-commissions" :aria-pressed="tab === 'mm-commissions'" :class="['rounded-full px-3 py-1.5 text-sm', tab === 'mm-commissions' ? 'bg-primary text-white' : 'bg-surface-elevated text-text-muted']" @click="switchTab('mm-commissions')">Commissions mobile money</button>
      <button type="button" data-test="tab-cash-commissions" :aria-pressed="tab === 'cash-commissions'" :class="['rounded-full px-3 py-1.5 text-sm', tab === 'cash-commissions' ? 'bg-primary text-white' : 'bg-surface-elevated text-text-muted']" @click="switchTab('cash-commissions')">Commissions cash</button>
      <button type="button" data-test="tab-wallet-refunds" :aria-pressed="tab === 'wallet-refunds'" :class="['rounded-full px-3 py-1.5 text-sm', tab === 'wallet-refunds' ? 'bg-primary text-white' : 'bg-surface-elevated text-text-muted']" @click="switchTab('wallet-refunds')">Remboursements wallet</button>
    </div>
    <p
      v-if="tabError" data-test="transactions-error"
      class="mb-3 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
    >{{ tabError }}</p>

    <template v-if="tab === 'payments'">
      <PaymentFilters
        :model-status="filters.status"
        :model-method="filters.method"
        :model-currency="filters.currency"
        :model-date-from="filters.dateFrom"
        :model-date-to="filters.dateTo"
        :model-held="filters.held"
        :model-query="filters.query"
        :model-hide-abandoned="filters.hideAbandoned"
        @update:held="onHeldFilter"
        @update:query="setQuery"
        @update:hide-abandoned="setHideAbandoned"
        @update:status="setStatusFilter"
        @update:method="setMethodFilter"
        @update:currency="setCurrencyFilter"
        @update:date-range="(from, to) => setDateRange(from, to)"
      />
      <p
        v-if="heldFilterUnsupported" data-test="held-filter-unsupported"
        class="mb-3 rounded-btn border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning text-pretty"
      >Le serveur ne sait pas encore isoler les versements retenus : ce filtre sera disponible après sa mise à jour.</p>
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p class="text-sm text-text-muted">Cliquez sur un paiement pour voir les personnes, les montants, les références Stripe et la chronologie.</p>
        <button
          v-if="auth.can('EXPORT_RUN')" type="button" data-test="payments-export" :disabled="exporting"
          class="rounded-btn border border-border px-3 py-1.5 text-sm hover:bg-surface-elevated disabled:opacity-40"
          @click="exportCsv"
        >{{ exporting ? 'Export…' : 'Exporter en CSV' }}</button>
      </div>
      <p
        v-if="paymentsError" data-test="payments-error"
        class="mb-3 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
      >{{ paymentsError }}</p>
      <PaymentTotalsBar v-if="totals" :totals="totals" />
      <PaymentsTable :payments="payments" :loading="isLoading" @select="detail.open" />
      <div class="mt-4"><PaginationControls :page="currentPage" :total-pages="totalPages" @change="goToPage" /></div>
      <PaymentDetailPanel
        v-if="detail.payment.value"
        :payment="detail.payment.value" :open="detail.payment.value !== null"
        :error="detail.error.value" :busy="detail.busy.value"
        :override-request="detail.overrideRequest.value"
        :override-error="detail.overrideError.value"
        @close="detail.close"
        @force-release="(o) => onAction(() => detail.forceRelease(o))"
        @refund="onAction(detail.refund)"
        @retry-payout="(o) => onAction(() => detail.retryPayout(o))"
        @override-dismiss="detail.dismissOverride"
        @retry-refund="onAction(detail.retryRefund)"
        @resynced="detail.open(detail.payment.value!.id)"
      />
    </template>
    <template v-else-if="tab === 'chargebacks'">
      <ChargebacksTable :chargebacks="cbs" :loading="cbLoading" />
      <div class="mt-4"><PaginationControls :page="cbPage" :total-pages="cbTotalPages" @change="loadCbs" /></div>
    </template>
    <template v-else-if="tab === 'wallets'">
      <WalletsTable :wallets="wallets" :loading="walletsLoading" @select="openWalletOwner" />
      <div class="mt-4"><PaginationControls :page="walletsPage" :total-pages="walletsTotalPages" @change="loadWallets" /></div>
    </template>
    <template v-else-if="tab === 'mobile-money'">
      <MobileMoneyTable :payments="mmPayments" :loading="mmLoading" />
      <div class="mt-4"><PaginationControls :page="mmPage" :total-pages="mmTotalPages" @change="loadMobileMoney" /></div>
    </template>
    <template v-else-if="tab === 'mm-commissions'">
      <PeriodFilter
        :model-date-from="mmCommissionsFrom" :model-date-to="mmCommissionsTo"
        @update:date-range="setMmCommissionsPeriod"
      />
      <MobileMoneyCommissionsPanel :data="mmCommissions" :loading="mmCommissionsLoading" />
    </template>
    <template v-else-if="tab === 'cash-commissions'">
      <CashCommissionsTable :commissions="cashCommissions" :loading="cashLoading" />
      <div class="mt-4"><PaginationControls :page="cashPage" :total-pages="cashTotalPages" @change="loadCashCommissions" /></div>
    </template>
    <template v-else>
      <WalletRefundRequestsTable :requests="walletRefunds" :loading="walletRefundsLoading" :busy-id="walletRefundBusyId" @resolve="resolveWalletRefund" />
      <div class="mt-4"><PaginationControls :page="walletRefundsPage" :total-pages="walletRefundsTotalPages" @change="loadWalletRefunds" /></div>
    </template>
  </div>
</template>
