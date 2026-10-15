<script setup lang="ts">
import { onMounted, ref } from 'vue'
import TopupCodesTable from '@/features/topup-codes/components/TopupCodesTable.vue'
import TopupCodeForm from '@/features/topup-codes/components/TopupCodeForm.vue'
import TopupCodeRedemptionsPanel from '@/features/topup-codes/components/TopupCodeRedemptionsPanel.vue'
import PaginationControls from '@/components/ui/PaginationControls.vue'
import ConfirmActionDialog from '@/components/ui/ConfirmActionDialog.vue'
import { useTopupCodes } from '@/features/topup-codes/composables/useTopupCodes'
import type { AdminTopupCode, TopupCodeDisplayStatus, TopupCodeInput } from '@/features/topup-codes/types/index'

definePageMeta({ middleware: 'admin-only', permission: 'TOPUP_CODE_MANAGE', pageTitle: 'Codes de recharge', pageSubtitle: 'Crédits du solde réservés aux commissions' })

const { codes, isLoading, error, totalPages, currentPage, filters, fetchCodes, goToPage, setStatusFilter, create, revoke, generateCode } = useTopupCodes()

const tabs: { value: TopupCodeDisplayStatus | null; label: string }[] = [
  { value: null, label: 'Tous' },
  { value: 'ACTIVE', label: 'Actifs' },
  { value: 'EXHAUSTED', label: 'Épuisés' },
  { value: 'EXPIRED', label: 'Expirés' },
  { value: 'REVOKED', label: 'Révoqués' },
]

const showForm = ref(false)
const pendingRevoke = ref<AdminTopupCode | null>(null)
const selected = ref<AdminTopupCode | null>(null)

async function onSubmit(input: TopupCodeInput) {
  try {
    await create(input)
    showForm.value = false
  } catch { /* error affiché dans le bandeau, le formulaire reste ouvert */ }
}
async function confirmRevoke() {
  const target = pendingRevoke.value
  pendingRevoke.value = null
  if (target) { try { await revoke(target.id) } catch { /* bandeau */ } }
}

onMounted(fetchCodes)
</script>

<template>
  <div>
    <p
      v-if="error" data-test="topup-error" role="alert"
      class="mb-3 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
    >{{ error }}</p>

    <div class="flex items-center justify-between mb-4">
      <div class="flex gap-1 flex-wrap">
        <button
          v-for="t in tabs" :key="String(t.value)" type="button" :data-test="`topup-tab-${t.value}`"
          :class="['rounded-full px-3 py-1.5 text-sm transition-colors',
            filters.status === t.value ? 'bg-primary text-white' : 'bg-surface-elevated text-text-muted hover:text-text']"
          @click="setStatusFilter(t.value)"
        >{{ t.label }}</button>
      </div>
      <button
        type="button" data-test="new-topup-code"
        class="rounded-btn px-4 py-2 text-sm bg-primary text-white hover:bg-primary/90"
        @click="showForm = true"
      >Nouveau code</button>
    </div>

    <TopupCodesTable
      :codes="codes" :loading="isLoading"
      @revoke="(c) => pendingRevoke = c" @show-redemptions="(c) => selected = c"
    />

    <div class="mt-4">
      <PaginationControls :page="currentPage" :total-pages="totalPages" @change="goToPage" />
    </div>

    <TopupCodeForm v-if="showForm" :generate="generateCode" @submit="onSubmit" @cancel="showForm = false" />

    <TopupCodeRedemptionsPanel :code="selected" @close="selected = null" />

    <ConfirmActionDialog
      :open="pendingRevoke !== null"
      title="Révoquer le code"
      message="Plus personne ne pourra l’utiliser. Les crédits déjà versés restent acquis."
      confirm-label="Révoquer"
      @confirm="confirmRevoke"
      @cancel="pendingRevoke = null"
    />
  </div>
</template>
