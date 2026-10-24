<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import PaymentsTable from '@/features/payments/components/PaymentsTable.vue'
import PaymentFilters from '@/features/payments/components/PaymentFilters.vue'
import PaymentTotalsBar from '@/features/payments/components/PaymentTotalsBar.vue'
import PaymentDetailPanel from '@/features/payments/components/PaymentDetailPanel.vue'
import PaymentViewTabs from '@/features/payments/components/PaymentViewTabs.vue'
import PaymentSearchBox from '@/features/payments/components/PaymentSearchBox.vue'
import ActiveFilters from '@/components/ui/ActiveFilters.vue'
import TransactionSectionTabs from '@/features/transactions/components/TransactionSectionTabs.vue'
import ChargebacksTable from '@/features/payments/components/ChargebacksTable.vue'
import WalletsTable from '@/features/finance/components/WalletsTable.vue'
import MobileMoneyTable from '@/features/finance/components/MobileMoneyTable.vue'
import CashCommissionsTable from '@/features/finance/components/CashCommissionsTable.vue'
import MobileMoneyCommissionsPanel from '@/features/finance/components/MobileMoneyCommissionsPanel.vue'
import WalletRefundRequestsTable from '@/features/finance/components/WalletRefundRequestsTable.vue'
import ResolveWalletRefundDialog from '@/features/finance/components/ResolveWalletRefundDialog.vue'
import RetryWalletRefundDialog from '@/features/finance/components/RetryWalletRefundDialog.vue'
import PeriodFilter from '@/features/finance/components/PeriodFilter.vue'
import PaginationControls from '@/components/ui/PaginationControls.vue'
import { usePaymentsSection, type PaymentPickKind } from '@/features/payments/composables/usePaymentsSection'
import { usePaymentDetail } from '@/features/payments/composables/usePaymentDetail'
import { usePaymentDrawerRoute } from '@/features/payments/composables/usePaymentDrawerRoute'
import { useFinanceCounts } from '@/features/transactions/composables/useFinanceCounts'
import { isTab, sectionOf, type TransactionTab } from '@/features/transactions/lib/sections'
import { paymentsService } from '@/features/payments/services/paymentsService'
import { financeService } from '@/features/finance/services/financeService'
import { extractProblemMessage } from '@/lib/problemDetail'
import { useAuthStore } from '@/stores/auth'
import type { AdminChargeback, PaymentSuggestParcel, PaymentSuggestPerson, PaymentSuggestTrip } from '@/features/payments/types/index'
import type { AdminWallet, AdminMobileMoneyPayment, AdminCashCommission, AdminMobileMoneyCommissions, AdminWalletRefundRequest, ResolveWalletRefundBody, RetryWalletRefundBody, WalletRefundRetryPreview, WalletRefundView } from '@/features/finance/types/index'
import { WALLET_REFUND_VIEWS } from '@/features/finance/types/index'

definePageMeta({ middleware: 'admin-only', permission: 'PAYMENT_VIEW', pageTitle: 'Transactions', pageSubtitle: 'Paiements & escrow' })

type Tab = TransactionTab
const tab = ref<Tab>('payments')
const section = computed(() => sectionOf(tab.value))
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
// Pastilles des quatre sections ; sans elles (ancien back), les sept onglets plats d'avant.
const finance = useFinanceCounts()
// Section Paiements : liste, vues à nombre, recherche à suggestions, filtres dans l'URL (lus ici,
// avant le premier rendu : les champs s'initialisent depuis leurs props).
const pay = usePaymentsSection()
const {
  filters, payments, isLoading, error: paymentsError, totalPages, currentPage, totals, exporting, heldFilterUnsupported,
  chips, viewsReady, hiddenAbandoned, held, searchResetKey, countsApi, suggestApi,
} = pay
const { counts: viewCounts, error: viewCountsError } = countsApi
const { suggestions, unavailable: suggestionsUnavailable } = suggestApi
const detail = usePaymentDetail()
// Tiroir paiement : ?open=<paiement> et ?section=<onglet> dans l'URL, ouverture depuis un lien reçu.
const drawer = usePaymentDrawerRoute(detail, { apply: q => pay.url.apply(q) })
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
/**
 * Vue de l'onglet. « Toutes » par défaut : les remboursements à la suppression de compte sont
 * automatiques et n'apparaîtraient jamais dans la seule file « À traiter ».
 */
const walletRefundView = ref<WalletRefundView>('all')
const walletRefundEmptyLabels: Record<WalletRefundView, string> = {
  all: 'Aucune demande de remboursement',
  pending: 'Rien à traiter : aucun ticket manuel en attente',
  processing: 'Aucun remboursement en cours',
  failed: 'Aucun remboursement en échec',
  done: 'Aucun remboursement effectué',
}

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
    const view = WALLET_REFUND_VIEWS.find(v => v.key === walletRefundView.value)
    const res = await financeService.listWalletRefundRequests(page, 20, view?.statuses)
    walletRefunds.value = res.content; walletRefundsTotalPages.value = res.totalPages; walletRefundsPage.value = res.number
    walletRefundsLoaded.value = true
  }
  catch (e) { tabError.value = extractProblemMessage(e, 'Impossible de charger les demandes de remboursement wallet') }
  finally { walletRefundsLoading.value = false }
}
async function setWalletRefundView(view: WalletRefundView) {
  if (walletRefundView.value === view) return
  walletRefundView.value = view
  await loadWalletRefunds(0)
}
/** Ticket manuel en cours de clôture : la boîte de dialogue demande le montant réellement versé. */
const resolvingWalletRefund = ref<AdminWalletRefundRequest | null>(null)
const resolveWalletRefundError = ref<string | null>(null)
function openResolveWalletRefund(id: string) {
  resolvingWalletRefund.value = walletRefunds.value.find(r => r.id === id) ?? null
  resolveWalletRefundError.value = null
}
function closeResolveWalletRefund() {
  if (walletRefundBusyId.value) return
  resolvingWalletRefund.value = null
  resolveWalletRefundError.value = null
}
async function resolveWalletRefund(body: ResolveWalletRefundBody) {
  const request = resolvingWalletRefund.value
  if (!request) return
  walletRefundBusyId.value = request.id
  resolveWalletRefundError.value = null
  try {
    await financeService.resolveWalletRefundRequest(request.id, body)
    resolvingWalletRefund.value = null
    await Promise.all([loadWalletRefunds(), finance.reload()])
  }
  // L'erreur reste dans la boîte de dialogue : la saisie n'est pas perdue (422 du back, par exemple).
  catch (e) { resolveWalletRefundError.value = extractProblemMessage(e, 'Impossible de résoudre cette demande de remboursement') }
  finally { walletRefundBusyId.value = null }
}

/**
 * Relance d'un remboursement mobile money passé en manuel : l'aperçu lit le solde pawaPay et
 * le dû ; un 422 (demande non éligible) s'affiche dans la fenêtre. « Verser maintenant » envoie
 * le dû ; un 422 reste dans la fenêtre, un succès passe la ligne « En cours » puis recharge.
 */
const retryingWalletRefund = ref<AdminWalletRefundRequest | null>(null)
const retryPreview = ref<WalletRefundRetryPreview | null>(null)
const retryPreviewLoading = ref(false)
const retryPreviewError = ref<string | null>(null)
const retryWalletRefundError = ref<string | null>(null)
async function loadRetryPreview() {
  const request = retryingWalletRefund.value
  if (!request) return
  retryPreviewLoading.value = true
  retryPreviewError.value = null
  try {
    const preview = await financeService.getWalletRefundRetryPreview(request.id)
    if (retryingWalletRefund.value?.id === request.id) retryPreview.value = preview
  }
  catch (e) {
    retryPreview.value = null
    retryPreviewError.value = extractProblemMessage(e, 'Impossible de lire l’aperçu de la relance')
  }
  finally { retryPreviewLoading.value = false }
}
async function openRetryWalletRefund(id: string) {
  retryingWalletRefund.value = walletRefunds.value.find(r => r.id === id) ?? null
  retryPreview.value = null
  retryWalletRefundError.value = null
  await loadRetryPreview()
}
function closeRetryWalletRefund() {
  if (walletRefundBusyId.value) return
  retryingWalletRefund.value = null
  retryPreview.value = null
  retryPreviewError.value = null
  retryWalletRefundError.value = null
}
async function retryWalletRefund(body: RetryWalletRefundBody) {
  const request = retryingWalletRefund.value
  if (!request) return
  walletRefundBusyId.value = request.id
  retryWalletRefundError.value = null
  try {
    await financeService.retryWalletRefundRequest(request.id, body)
    const row = walletRefunds.value.find(r => r.id === request.id)
    if (row) row.status = 'PROCESSING'
    walletRefundBusyId.value = null
    closeRetryWalletRefund()
    await Promise.all([loadWalletRefunds(), finance.reload()])
  }
  catch (e) { retryWalletRefundError.value = extractProblemMessage(e, 'Impossible de relancer ce remboursement') }
  finally { walletRefundBusyId.value = null }
}

/**
 * L'onglet vit dans l'URL (?tab=wallet-refunds, notification WALLET_REFUND_REQUESTED), à côté
 * des filtres des paiements qu'il ne touche pas. Paiements = pas de paramètre ; quitter Paiements
 * ferme la fiche paiement (son ?open= est retiré).
 */
function syncTabQuery(t: Tab) {
  const query = drawer.tabQuery(t)
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
  const wanted = route.query?.tab
  await Promise.all([
    pay.load(), finance.reload(),
    isTab(wanted) && wanted !== 'payments' ? switchTab(wanted, true) : Promise.resolve(),
  ])
  // ?open=<paiement>[&section=] (alerte, recherche globale, fiche colis) : la fiche, sur son onglet.
  await drawer.restore()
})
// Page déjà ouverte : un clic sur une notification change seulement la query.
watch(() => route.query?.tab, (v) => {
  const t: Tab = isTab(v) ? v : 'payments'
  if (t !== tab.value) void switchTab(t, true)
})
// ?open= et ?section= arrivés page ouverte : suivis par `usePaymentDrawerRoute`.
// … et pour ?held=true (bandeau d'une fiche utilisateur, carte de la vue d'ensemble).
watch(() => route.query?.held, (v) => { if (v !== undefined) void pay.applyLegacyHeld() })
</script>

<template>
  <div>
    <div class="mb-4">
      <TransactionSectionTabs :section="section" :sub="tab" :counts="finance.counts.value" @update:tab="switchTab" />
      <p v-if="finance.error.value" data-test="finance-counts-error" role="status" class="mt-1 flex items-center gap-2 text-xs text-text-muted">
        Nombres des sections indisponibles
        <button
          type="button" data-test="finance-counts-retry"
          class="inline-flex min-h-10 items-center rounded-btn px-2 text-xs text-primary transition-[background-color,transform] hover:bg-primary/10 active:scale-[0.96] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          @click="finance.reload()"
        >Réessayer</button>
      </p>
    </div>
    <p
      v-if="tabError" data-test="transactions-error"
      class="mb-3 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
    >{{ tabError }}</p>

    <template v-if="tab === 'payments'">
      <div class="mb-4 space-y-3">
        <!-- Vues : seulement une fois les nombres répondus, jamais face à un ancien back (liste « Tous »). -->
        <div v-if="viewsReady">
          <PaymentViewTabs :model-value="filters.view ?? 'ALL'" :counts="viewCounts" @update:model-value="pay.setView" />
          <p v-if="viewCountsError" data-test="payment-counts-error" role="status" class="mt-1 flex items-center gap-2 text-xs text-text-muted">
            Nombres indisponibles
            <button
              type="button" data-test="payment-counts-retry"
              class="inline-flex min-h-10 items-center rounded-btn px-2 text-xs text-primary transition-[background-color,transform] hover:bg-primary/10 active:scale-[0.96] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              @click="countsApi.reload()"
            >Réessayer</button>
          </p>
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
      <p class="mb-3 max-w-3xl text-sm text-text-muted text-pretty">
        Un compte supprimé avec un solde est remboursé automatiquement sur sa carte ou son mobile money :
        rien à exécuter, la ligne passe de « En cours » à « Remboursée ». Seuls les tickets manuels
        (échec du remboursement automatique, ou solde payé par carte et mobile money à la fois)
        se remboursent hors plateforme puis se marquent remboursés.
      </p>
      <div class="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filtrer les remboursements">
        <button
          v-for="v in WALLET_REFUND_VIEWS"
          :key="v.key"
          type="button"
          :data-test="`wrr-view-${v.key}`"
          :aria-pressed="walletRefundView === v.key"
          :class="['rounded-full px-3 py-1 text-xs font-medium', walletRefundView === v.key ? 'bg-primary text-white' : 'bg-surface-elevated text-text-muted']"
          @click="setWalletRefundView(v.key)"
        >{{ v.label }}</button>
      </div>
      <WalletRefundRequestsTable :requests="walletRefunds" :loading="walletRefundsLoading" :busy-id="walletRefundBusyId" :empty-label="walletRefundEmptyLabels[walletRefundView]" @resolve="openResolveWalletRefund" @retry="openRetryWalletRefund" />
      <RetryWalletRefundDialog
        :open="retryingWalletRefund !== null" :request="retryingWalletRefund" :preview="retryPreview"
        :loading="retryPreviewLoading" :preview-error="retryPreviewError"
        :busy="walletRefundBusyId !== null" :error="retryWalletRefundError"
        @confirm="retryWalletRefund" @cancel="closeRetryWalletRefund" @refresh="loadRetryPreview"
      />
      <ResolveWalletRefundDialog
        :open="resolvingWalletRefund !== null" :request="resolvingWalletRefund"
        :busy="walletRefundBusyId !== null" :error="resolveWalletRefundError"
        @confirm="resolveWalletRefund" @cancel="closeResolveWalletRefund"
      />
      <div class="mt-4"><PaginationControls :page="walletRefundsPage" :total-pages="walletRefundsTotalPages" @change="loadWalletRefunds" /></div>
    </template>
  </div>
</template>
