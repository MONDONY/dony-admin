<script setup lang="ts">
import { onMounted, ref } from 'vue'
import PaymentsTable from '@/features/payments/components/PaymentsTable.vue'
import PaymentFilters from '@/features/payments/components/PaymentFilters.vue'
import PaymentDetailPanel from '@/features/payments/components/PaymentDetailPanel.vue'
import ChargebacksTable from '@/features/payments/components/ChargebacksTable.vue'
import WalletsTable from '@/features/finance/components/WalletsTable.vue'
import MobileMoneyTable from '@/features/finance/components/MobileMoneyTable.vue'
import CashCommissionsTable from '@/features/finance/components/CashCommissionsTable.vue'
import PaginationControls from '@/components/ui/PaginationControls.vue'
import { usePayments } from '@/features/payments/composables/usePayments'
import { usePaymentDetail } from '@/features/payments/composables/usePaymentDetail'
import { paymentsService } from '@/features/payments/services/paymentsService'
import { financeService } from '@/features/finance/services/financeService'
import type { AdminChargeback } from '@/features/payments/types/index'
import type { AdminWallet, AdminMobileMoneyPayment, AdminCashCommission } from '@/features/finance/types/index'

definePageMeta({ middleware: 'admin-only', permission: 'PAYMENT_VIEW', pageTitle: 'Transactions', pageSubtitle: 'Paiements & escrow' })

type Tab = 'payments' | 'chargebacks' | 'wallets' | 'mobile-money' | 'cash-commissions'

const tab = ref<Tab>('payments')
const { payments, isLoading, totalPages, currentPage, filters, fetchPayments, goToPage, setStatusFilter, setMethodFilter, setDateRange } = usePayments()
const detail = usePaymentDetail()
const cbs = ref<AdminChargeback[]>([])
const cbLoading = ref(false)

const wallets = ref<AdminWallet[]>([])
const walletsLoading = ref(false)
const walletsPage = ref(0)
const walletsTotalPages = ref(0)

const mmPayments = ref<AdminMobileMoneyPayment[]>([])
const mmLoading = ref(false)
const mmPage = ref(0)
const mmTotalPages = ref(0)

const cashCommissions = ref<AdminCashCommission[]>([])
const cashLoading = ref(false)
const cashPage = ref(0)
const cashTotalPages = ref(0)

async function loadCbs() { cbLoading.value = true; try { cbs.value = (await paymentsService.listChargebacks(0, 20)).content } finally { cbLoading.value = false } }

async function loadWallets(page = walletsPage.value) {
  walletsLoading.value = true
  try {
    const res = await financeService.listWallets(page, 20)
    wallets.value = res.content; walletsTotalPages.value = res.totalPages; walletsPage.value = res.number
  } finally { walletsLoading.value = false }
}
async function loadMobileMoney(page = mmPage.value) {
  mmLoading.value = true
  try {
    const res = await financeService.listMobileMoneyPayments(page, 20)
    mmPayments.value = res.content; mmTotalPages.value = res.totalPages; mmPage.value = res.number
  } finally { mmLoading.value = false }
}
async function loadCashCommissions(page = cashPage.value) {
  cashLoading.value = true
  try {
    const res = await financeService.listCashCommissions(page, 20)
    cashCommissions.value = res.content; cashTotalPages.value = res.totalPages; cashPage.value = res.number
  } finally { cashLoading.value = false }
}

async function switchTab(t: Tab) {
  tab.value = t
  if (t === 'chargebacks' && cbs.value.length === 0) await loadCbs()
  if (t === 'wallets' && wallets.value.length === 0) await loadWallets()
  if (t === 'mobile-money' && mmPayments.value.length === 0) await loadMobileMoney()
  if (t === 'cash-commissions' && cashCommissions.value.length === 0) await loadCashCommissions()
}
async function afterAction() { await fetchPayments() }
async function onAction(fn: () => Promise<boolean>) {
  await fn()
  await afterAction()
}

onMounted(fetchPayments)
</script>

<template>
  <div>
    <div class="flex gap-1 mb-4 flex-wrap">
      <button type="button" data-test="tab-payments" :class="['rounded-full px-3 py-1.5 text-sm', tab === 'payments' ? 'bg-primary text-white' : 'bg-surface-elevated text-text-muted']" @click="switchTab('payments')">Paiements</button>
      <button type="button" data-test="tab-chargebacks" :class="['rounded-full px-3 py-1.5 text-sm', tab === 'chargebacks' ? 'bg-primary text-white' : 'bg-surface-elevated text-text-muted']" @click="switchTab('chargebacks')">Litiges bancaires</button>
      <button type="button" data-test="tab-wallets" :class="['rounded-full px-3 py-1.5 text-sm', tab === 'wallets' ? 'bg-primary text-white' : 'bg-surface-elevated text-text-muted']" @click="switchTab('wallets')">Portefeuilles</button>
      <button type="button" data-test="tab-mobile-money" :class="['rounded-full px-3 py-1.5 text-sm', tab === 'mobile-money' ? 'bg-primary text-white' : 'bg-surface-elevated text-text-muted']" @click="switchTab('mobile-money')">Mobile money</button>
      <button type="button" data-test="tab-cash-commissions" :class="['rounded-full px-3 py-1.5 text-sm', tab === 'cash-commissions' ? 'bg-primary text-white' : 'bg-surface-elevated text-text-muted']" @click="switchTab('cash-commissions')">Commissions cash</button>
    </div>
    <template v-if="tab === 'payments'">
      <PaymentFilters
        :model-status="filters.status"
        :model-method="filters.method"
        :model-date-from="filters.dateFrom"
        :model-date-to="filters.dateTo"
        @update:status="setStatusFilter"
        @update:method="setMethodFilter"
        @update:date-range="(from, to) => setDateRange(from, to)"
      />
      <PaymentsTable :payments="payments" :loading="isLoading" @select="detail.open" />
      <div class="mt-4"><PaginationControls :page="currentPage" :total-pages="totalPages" @change="goToPage" /></div>
      <PaymentDetailPanel
        v-if="detail.payment.value"
        :payment="detail.payment.value" :open="detail.payment.value !== null"
        :error="detail.error.value" :busy="detail.busy.value"
        @close="detail.close"
        @force-release="onAction(detail.forceRelease)"
        @refund="onAction(detail.refund)"
      />
    </template>
    <template v-else-if="tab === 'chargebacks'">
      <ChargebacksTable :chargebacks="cbs" :loading="cbLoading" />
    </template>
    <template v-else-if="tab === 'wallets'">
      <WalletsTable :wallets="wallets" :loading="walletsLoading" />
      <div class="mt-4"><PaginationControls :page="walletsPage" :total-pages="walletsTotalPages" @change="loadWallets" /></div>
    </template>
    <template v-else-if="tab === 'mobile-money'">
      <MobileMoneyTable :payments="mmPayments" :loading="mmLoading" />
      <div class="mt-4"><PaginationControls :page="mmPage" :total-pages="mmTotalPages" @change="loadMobileMoney" /></div>
    </template>
    <template v-else>
      <CashCommissionsTable :commissions="cashCommissions" :loading="cashLoading" />
      <div class="mt-4"><PaginationControls :page="cashPage" :total-pages="cashTotalPages" @change="loadCashCommissions" /></div>
    </template>
  </div>
</template>
