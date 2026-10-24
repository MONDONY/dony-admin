<script setup lang="ts">
import PaginationControls from '@/components/ui/PaginationControls.vue'
import OpenRowMissing from './OpenRowMissing.vue'
import SectionError from './SectionError.vue'
import WalletRefundRequestsTable from './WalletRefundRequestsTable.vue'
import ResolveWalletRefundDialog from './ResolveWalletRefundDialog.vue'
import RetryWalletRefundDialog from './RetryWalletRefundDialog.vue'
import { WALLET_REFUND_VIEWS, type WalletRefundView } from '@/features/finance/types/index'
import type { useWalletRefunds } from '@/features/finance/composables/useWalletRefunds'

/** Onglet Remboursements wallet : vues par statut, ligne ouverte par lien, gestes et leurs fenêtres. */
const props = defineProps<{ list: ReturnType<typeof useWalletRefunds> }>()
const {
  rows, isLoading, error, filters, openId, openMissing, currentPage, totalPages, busyId,
  resolving, resolveError, retrying, retryPreview, retryPreviewLoading, retryPreviewError, retryError,
} = props.list

const EMPTY: Record<WalletRefundView, string> = {
  all: 'Aucune demande de remboursement',
  pending: 'Rien à traiter : aucun ticket manuel en attente',
  processing: 'Aucun remboursement en cours',
  failed: 'Aucun remboursement en échec',
  done: 'Aucun remboursement effectué',
}
</script>

<template>
  <div>
    <p class="mb-3 max-w-3xl text-sm text-text-muted text-pretty">
      Un compte supprimé avec un solde est remboursé automatiquement sur sa carte ou son mobile money :
      rien à exécuter, la ligne passe de « En cours » à « Remboursée ». Seuls les tickets manuels
      (échec du remboursement automatique, ou solde payé par carte et mobile money à la fois)
      se remboursent hors plateforme puis se marquent remboursés.
    </p>
    <div class="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filtrer les remboursements">
      <button
        v-for="v in WALLET_REFUND_VIEWS" :key="v.key" type="button" :data-test="`wrr-view-${v.key}`"
        :aria-pressed="filters.view === v.key"
        :class="['inline-flex min-h-10 items-center rounded-full px-3 text-xs font-medium transition-[background-color,transform] active:scale-[0.96] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary',
                 filters.view === v.key ? 'bg-primary text-white' : 'bg-surface-elevated text-text-muted hover:text-text']"
        @click="props.list.setView(v.key)"
      >{{ v.label }}</button>
    </div>
    <SectionError :message="error" />
    <OpenRowMissing :show="openMissing" label="Cette demande n’est pas dans cette page de la liste." />
    <WalletRefundRequestsTable
      :requests="rows" :loading="isLoading" :busy-id="busyId" :failed="!!error" :highlight-id="openId"
      :empty-label="EMPTY[filters.view as WalletRefundView]" @resolve="props.list.openResolve" @retry="props.list.openRetry"
    />
    <RetryWalletRefundDialog
      :open="retrying !== null" :request="retrying" :preview="retryPreview"
      :loading="retryPreviewLoading" :preview-error="retryPreviewError"
      :busy="busyId !== null" :error="retryError"
      @confirm="props.list.retry" @cancel="props.list.closeRetry" @refresh="props.list.loadRetryPreview"
    />
    <ResolveWalletRefundDialog
      :open="resolving !== null" :request="resolving"
      :busy="busyId !== null" :error="resolveError"
      @confirm="props.list.resolve" @cancel="props.list.closeResolve"
    />
    <div class="mt-4"><PaginationControls :page="currentPage" :total-pages="totalPages" @change="props.list.goToPage" /></div>
  </div>
</template>
