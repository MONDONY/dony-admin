<script setup lang="ts">
import { onMounted, ref } from 'vue'
import PaymentsTable from '@/features/payments/components/PaymentsTable.vue'
import PaymentDetailPanel from '@/features/payments/components/PaymentDetailPanel.vue'
import ChargebacksTable from '@/features/payments/components/ChargebacksTable.vue'
import PaginationControls from '@/components/ui/PaginationControls.vue'
import { usePayments } from '@/features/payments/composables/usePayments'
import { usePaymentDetail } from '@/features/payments/composables/usePaymentDetail'
import { paymentsService } from '@/features/payments/services/paymentsService'
import type { AdminChargeback } from '@/features/payments/types/index'

definePageMeta({ middleware: 'admin-only', pageTitle: 'Transactions', pageSubtitle: 'Paiements & escrow' })

const tab = ref<'payments' | 'chargebacks'>('payments')
const { payments, isLoading, totalPages, currentPage, fetchPayments, goToPage } = usePayments()
const detail = usePaymentDetail()
const cbs = ref<AdminChargeback[]>([])
const cbLoading = ref(false)

async function loadCbs() { cbLoading.value = true; try { cbs.value = (await paymentsService.listChargebacks(0, 20)).content } finally { cbLoading.value = false } }
async function switchTab(t: 'payments' | 'chargebacks') { tab.value = t; if (t === 'chargebacks' && cbs.value.length === 0) await loadCbs() }
async function afterAction() { await fetchPayments() }

onMounted(fetchPayments)
</script>

<template>
  <div>
    <div class="flex gap-1 mb-4">
      <button type="button" data-test="tab-payments" :class="['rounded-full px-3 py-1.5 text-sm', tab === 'payments' ? 'bg-primary text-white' : 'bg-surface-elevated text-text-muted']" @click="switchTab('payments')">Paiements</button>
      <button type="button" data-test="tab-chargebacks" :class="['rounded-full px-3 py-1.5 text-sm', tab === 'chargebacks' ? 'bg-primary text-white' : 'bg-surface-elevated text-text-muted']" @click="switchTab('chargebacks')">Litiges bancaires</button>
    </div>
    <template v-if="tab === 'payments'">
      <PaymentsTable :payments="payments" :loading="isLoading" @select="detail.open" />
      <div class="mt-4"><PaginationControls :page="currentPage" :total-pages="totalPages" @change="goToPage" /></div>
      <PaymentDetailPanel
        v-if="detail.payment.value"
        :payment="detail.payment.value" :open="detail.payment.value !== null"
        @close="detail.close"
        @force-release="async () => { await detail.forceRelease(); await afterAction() }"
        @refund="async () => { await detail.refund(); await afterAction() }"
      />
    </template>
    <ChargebacksTable v-else :chargebacks="cbs" :loading="cbLoading" />
  </div>
</template>
