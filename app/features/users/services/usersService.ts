import { useApi } from '@/composables/useApi'
import type {
  AdminDeletionReasonCode, AdminGdprRequestPage, AdminKycDetail, AdminUserDetail, AdminUserPage,
  DeletionImpact, RecetteBulkResult, RecetteModeStatus, RecetteTesterStatus, UsersFilterState,
} from '@/features/users/types/index'

function buildQuery(f: UsersFilterState, page: number, size: number): Record<string, string | number | boolean> {
  const q: Record<string, string | number | boolean> = { page, size }
  if (f.status && f.status !== 'TOUS') q.status = f.status
  if (f.role) q.role = f.role
  if (f.kyc) q.kyc = f.kyc
  if (f.pro !== null) q.pro = f.pro
  if (f.city) q.city = f.city
  if (f.query.trim()) q.query = f.query.trim()
  if (f.recetteTester === true || f.recetteTester === false) q.recetteTester = f.recetteTester
  return q
}

export const usersService = {
  list(filters: UsersFilterState, page: number, size: number): Promise<AdminUserPage> {
    return useApi()<AdminUserPage>('/admin/users', { query: buildQuery(filters, page, size) })
  },
  get(id: string): Promise<AdminUserDetail> {
    return useApi()<AdminUserDetail>(`/admin/users/${encodeURIComponent(id)}`)
  },
  suspend(id: string, reason: string): Promise<AdminUserDetail> {
    return useApi()<AdminUserDetail>(`/admin/users/${encodeURIComponent(id)}/suspend`, { method: 'POST', body: { reason } })
  },
  ban(id: string, reason: string): Promise<AdminUserDetail> {
    return useApi()<AdminUserDetail>(`/admin/users/${encodeURIComponent(id)}/ban`, { method: 'POST', body: { reason } })
  },
  unsuspend(id: string): Promise<AdminUserDetail> {
    return useApi()<AdminUserDetail>(`/admin/users/${encodeURIComponent(id)}/unsuspend`, { method: 'POST' })
  },
  /**
   * Offre un accès PRO gratuit. Le motif est obligatoire côté backend : un geste
   * commercial doit rester explicable, et il est journalisé avec l'administrateur.
   */
  grantPro(id: string, reason: string): Promise<AdminUserDetail> {
    return useApi()<AdminUserDetail>(`/admin/users/${encodeURIComponent(id)}/pro-grant`, { method: 'POST', body: { reason } })
  },
  /** Révoque un accès offert. Sans effet sur un abonnement payant, qui se gère dans Stripe. */
  revokePro(id: string): Promise<AdminUserDetail> {
    return useApi()<AdminUserDetail>(`/admin/users/${encodeURIComponent(id)}/pro-grant`, { method: 'DELETE' })
  },
  setCommissionRate(id: string, rate: number | null): Promise<AdminUserDetail> {
    return useApi()<AdminUserDetail>(`/admin/users/${encodeURIComponent(id)}/commission-rate`, { method: 'PUT', body: { rate } })
  },
  suspendPublishing(id: string, reason: string): Promise<void> {
    return useApi()<void>(`/admin/users/${encodeURIComponent(id)}/suspend-publishing`, { method: 'POST', query: { reason } })
  },
  liftPublishingSuspension(id: string): Promise<void> {
    return useApi()<void>(`/admin/users/${encodeURIComponent(id)}/lift-publishing-suspension`, { method: 'POST' })
  },
  muteMessaging(id: string, durationHours: number | null, reason: string): Promise<AdminUserDetail> {
    return useApi()<AdminUserDetail>(`/admin/users/${encodeURIComponent(id)}/mute-messaging`, {
      method: 'POST',
      body: { durationHours, reason },
    })
  },
  unmuteMessaging(id: string): Promise<AdminUserDetail> {
    return useApi()<AdminUserDetail>(`/admin/users/${encodeURIComponent(id)}/unmute-messaging`, { method: 'POST' })
  },
  /**
   * Annule une suppression de compte demandée (USER_DELETE) : le compte redevient actif et
   * l'utilisateur est prévenu. 409 `user-deletion-not-cancellable` si elle ne l'est plus.
   */
  cancelDeletion(id: string, reason: string): Promise<AdminUserDetail> {
    return useApi()<AdminUserDetail>(`/admin/users/${encodeURIComponent(id)}/cancel-deletion`, { method: 'POST', body: { reason } })
  },
  getKyc(id: string): Promise<AdminKycDetail> {
    return useApi()<AdminKycDetail>(`/admin/users/${encodeURIComponent(id)}/kyc`)
  },
  resetKyc(id: string, reason: string): Promise<AdminKycDetail> {
    return useApi()<AdminKycDetail>(`/admin/users/${encodeURIComponent(id)}/kyc/reset`, { method: 'POST', body: { reason } })
  },
  /** Décision manuelle (KYC_DECIDE) : le back exige d'avoir une session chez le fournisseur. */
  approveKyc(id: string, reason: string): Promise<AdminKycDetail> {
    return useApi()<AdminKycDetail>(`/admin/users/${encodeURIComponent(id)}/kyc/approve`, { method: 'POST', body: { reason } })
  },
  /**
   * Validation sans pièce (SUPER_ADMIN seulement, back #578) : réservée au compte de
   * démonstration des stores, qui ne peut présenter aucune pièce d'identité.
   */
  approveKycWithoutDocuments(id: string, reason: string): Promise<AdminKycDetail> {
    return useApi()<AdminKycDetail>(`/admin/users/${encodeURIComponent(id)}/kyc/approve-without-documents`, { method: 'POST', body: { reason } })
  },
  /** `code` (catalogue) est montré à l'utilisateur ; `reason` reste interne (journal d'audit). */
  rejectKyc(id: string, code: string, reason: string): Promise<AdminKycDetail> {
    return useApi()<AdminKycDetail>(`/admin/users/${encodeURIComponent(id)}/kyc/reject`, { method: 'POST', body: { code, reason } })
  },
  revokeKyc(id: string, code: string, reason: string): Promise<AdminKycDetail> {
    return useApi()<AdminKycDetail>(`/admin/users/${encodeURIComponent(id)}/kyc/revoke`, { method: 'POST', body: { code, reason } })
  },
  listGdprRequests(page: number, size: number): Promise<AdminGdprRequestPage> {
    return useApi()<AdminGdprRequestPage>('/admin/users/gdpr-requests', { query: { page, size } })
  },
  /** Irréversible : le back répond 204 sans corps. */
  executeGdprDeletion(id: string, reason: string): Promise<void> {
    return useApi()<void>(`/admin/users/${encodeURIComponent(id)}/gdpr-execute`, { method: 'POST', body: { reason } })
  },
  getDeletionImpact(id: string): Promise<DeletionImpact> {
    return useApi()<DeletionImpact>(`/admin/users/${encodeURIComponent(id)}/deletion-impact`)
  },
  /** Irréversible : le compte est anonymisé et banni. Le back répond 204 sans corps. */
  deleteUser(id: string, reasonCode: AdminDeletionReasonCode, reason: string): Promise<void> {
    return useApi()<void>(`/admin/users/${encodeURIComponent(id)}/delete`, {
      method: 'POST',
      body: { reasonCode, reason },
    })
  },
  /** Mode recette (staging) : réservé au super-admin (ADMIN_MANAGE) côté back. */
  getRecetteTester(id: string): Promise<RecetteTesterStatus> {
    return useApi()<RecetteTesterStatus>(`/admin/users/${encodeURIComponent(id)}/recette-tester`)
  },
  /** 409 `recette-disabled` hors staging, 404 `user-not-found`, 422 corps invalide. */
  setRecetteTester(id: string, enabled: boolean): Promise<RecetteTesterStatus> {
    return useApi()<RecetteTesterStatus>(`/admin/users/${encodeURIComponent(id)}/recette-tester`, { method: 'PUT', body: { enabled } })
  },
  /** Mode recette ouvert dans cet environnement (staging) ? 404 sur un back plus ancien. */
  getRecetteStatus(): Promise<RecetteModeStatus> {
    return useApi()<RecetteModeStatus>('/admin/recette/status')
  },
  /**
   * Désignation en masse (1 à 200 comptes, ADMIN_MANAGE). 409 `recette-disabled` hors staging,
   * 422 sélection vide ou trop grande.
   */
  setRecetteTesterBulk(userIds: string[], enabled: boolean): Promise<RecetteBulkResult> {
    return useApi()<RecetteBulkResult>('/admin/users/recette-tester', { method: 'PUT', body: { userIds, enabled } })
  },
}
