import { useApi } from '@/composables/useApi'
import type { AdminKycQueuePage, KycQueueFilters } from '@/features/kyc/types/index'

function buildQuery(f: KycQueueFilters, page: number, size: number): Record<string, string | number> {
  const q: Record<string, string | number> = { status: f.status }
  if (f.provider) q.provider = f.provider
  if (f.query.trim()) q.query = f.query.trim()
  if (f.from) q.from = f.from
  if (f.to) q.to = f.to
  q.page = page
  q.size = size
  return q
}

/**
 * File des vérifications d'identité (USER_KYC). La fiche d'un dossier et les décisions
 * passent par `usersService` (`/admin/users/{id}/kyc…`), qui porte déjà la lecture et la
 * réinitialisation : un seul service par ressource.
 */
export const kycService = {
  listVerifications(filters: KycQueueFilters, page: number, size: number): Promise<AdminKycQueuePage> {
    return useApi()<AdminKycQueuePage>('/admin/kyc/verifications', { query: buildQuery(filters, page, size) })
  },
  /** Codes de refus et de révocation acceptés par le back (liste de slugs, sans libellés). */
  listRejectionCodes(): Promise<string[]> {
    return useApi()<string[]>('/admin/kyc/rejection-codes')
  },
}
