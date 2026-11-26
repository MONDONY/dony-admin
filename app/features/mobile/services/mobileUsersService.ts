import { useApi } from '@/composables/useApi'
import type { AdminUserDetail, AdminUserPage } from '@/features/users/types/index'

/**
 * Lecture seule des utilisateurs pour le choix d'un destinataire (Diffuser). Volontairement distinct du
 * service du poste ordinateur : aucune suspension, bannissement, suppression ou décision KYC n'est
 * joignable depuis les écrans mobiles. Deux GET, rien d'autre.
 */
export const mobileUsersService = {
  /** Recherche de l'écran Utilisateurs (nom, téléphone, e-mail), tous statuts, première page. */
  list(query: string, size: number): Promise<AdminUserPage> {
    return useApi()<AdminUserPage>('/admin/users', { query: { page: 0, size, query: query.trim() } })
  },
  get(id: string): Promise<AdminUserDetail> {
    return useApi()<AdminUserDetail>(`/admin/users/${encodeURIComponent(id)}`)
  },
}
