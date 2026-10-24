import { ref } from 'vue'
import { financeService } from '@/features/finance/services/financeService'
import { FINANCE_PAGE_SIZE, useFinanceList } from '@/features/finance/composables/useFinanceList'
import { defaultWalletRefundView } from '@/features/finance/lib/walletRefundViews'
import { WALLET_REFUND_VIEWS } from '@/features/finance/types/index'
import type {
  AdminWalletRefundRequest, ResolveWalletRefundBody, RetryWalletRefundBody, WalletRefundRetryPreview,
} from '@/features/finance/types/index'
import { extractProblemMessage } from '@/lib/problemDetail'

/**
 * Remboursements wallet de la section Soldes : vues par statut (toujours affichées), ligne ouverte
 * par `?open=<demande>` (opération mobile money, demande parente), et les deux gestes inchangés :
 * « Marquer remboursée » (ticket manuel) et « Relancer le remboursement » (mobile money).
 *
 * - `pendingCount` : tickets en attente (pastille du menu) ; vue d'ouverture « À traiter » s'il y
 *   en a, « Toutes » sinon ou si le nombre est inconnu (ancien back).
 * - `onChanged` : après un geste réussi, la page relit ses pastilles.
 */
export function useWalletRefunds(opts: { pendingCount: () => Promise<number | null>; onChanged?: () => unknown }) {
  const list = useFinanceList<AdminWalletRefundRequest, Record<string, never>>({
    filters: {},
    specs: {},
    views: { ids: WALLET_REFUND_VIEWS.map(v => v.key), all: 'all', source: 'static' },
    initialView: async () => defaultWalletRefundView(await opts.pendingCount()),
    fetch: (f, page) => financeService.listWalletRefundRequests(page, FINANCE_PAGE_SIZE, WALLET_REFUND_VIEWS.find(v => v.key === f.view)?.statuses),
    rowId: r => r.id,
    errorLabel: 'Impossible de charger les demandes de remboursement wallet',
  })
  const busyId = ref<string | null>(null)
  const find = (id: string) => list.rows.value.find(r => r.id === id) ?? null
  async function afterGesture() { await Promise.all([list.goToPage(list.currentPage.value), opts.onChanged?.()]) }

  /** Ticket manuel en cours de clôture : la boîte de dialogue demande le montant réellement versé. */
  const resolving = ref<AdminWalletRefundRequest | null>(null)
  const resolveError = ref<string | null>(null)
  function openResolve(id: string) { resolving.value = find(id); resolveError.value = null }
  function closeResolve() {
    if (busyId.value) return
    resolving.value = null; resolveError.value = null
  }
  async function resolve(body: ResolveWalletRefundBody) {
    const request = resolving.value
    if (!request) return
    busyId.value = request.id
    resolveError.value = null
    try {
      await financeService.resolveWalletRefundRequest(request.id, body)
      resolving.value = null
      await afterGesture()
    }
    // L'erreur reste dans la boîte de dialogue : la saisie n'est pas perdue (422 du back, par exemple).
    catch (e) { resolveError.value = extractProblemMessage(e, 'Impossible de résoudre cette demande de remboursement') }
    finally { busyId.value = null }
  }

  /**
   * Relance d'un remboursement mobile money passé en manuel : l'aperçu lit le solde pawaPay et le
   * dû ; un 422 (demande non éligible) s'affiche dans la fenêtre. « Verser maintenant » envoie le
   * dû ; un 422 reste dans la fenêtre, un succès passe la ligne « En cours » puis recharge.
   */
  const retrying = ref<AdminWalletRefundRequest | null>(null)
  const retryPreview = ref<WalletRefundRetryPreview | null>(null)
  const retryPreviewLoading = ref(false)
  const retryPreviewError = ref<string | null>(null)
  const retryError = ref<string | null>(null)
  async function loadRetryPreview() {
    const request = retrying.value
    if (!request) return
    retryPreviewLoading.value = true
    retryPreviewError.value = null
    try {
      const preview = await financeService.getWalletRefundRetryPreview(request.id)
      if (retrying.value?.id === request.id) retryPreview.value = preview
    } catch (e) {
      retryPreview.value = null
      retryPreviewError.value = extractProblemMessage(e, 'Impossible de lire l’aperçu de la relance')
    } finally { retryPreviewLoading.value = false }
  }
  async function openRetry(id: string) {
    retrying.value = find(id)
    retryPreview.value = null
    retryError.value = null
    await loadRetryPreview()
  }
  function closeRetry() {
    if (busyId.value) return
    retrying.value = null; retryPreview.value = null; retryPreviewError.value = null; retryError.value = null
  }
  async function retry(body: RetryWalletRefundBody) {
    const request = retrying.value
    if (!request) return
    busyId.value = request.id
    retryError.value = null
    try {
      await financeService.retryWalletRefundRequest(request.id, body)
      const row = find(request.id)
      if (row) row.status = 'PROCESSING'
      busyId.value = null
      closeRetry()
      await afterGesture()
    } catch (e) { retryError.value = extractProblemMessage(e, 'Impossible de relancer ce remboursement') }
    finally { busyId.value = null }
  }

  return {
    ...list, busyId,
    resolving, resolveError, openResolve, closeResolve, resolve,
    retrying, retryPreview, retryPreviewLoading, retryPreviewError, retryError, loadRetryPreview, openRetry, closeRetry, retry,
  }
}
