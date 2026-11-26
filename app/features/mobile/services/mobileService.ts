import { useApi } from '@/composables/useApi'
import type { AdminAlert } from '@/features/alerts/types/index'

export interface RegisterDeviceBody {
  fcmToken: string
  deviceName: string
  platform: 'web'
}

export const mobileService = {
  /** Enregistre le jeton push de cet appareil (idempotent par jeton côté back). */
  async registerDevice(body: RegisterDeviceBody): Promise<void> {
    await useApi()('/admin/mobile/devices', { method: 'POST', body })
  },
  async unregisterDevice(fcmToken: string): Promise<void> {
    await useApi()('/admin/mobile/devices', { method: 'DELETE', query: { fcmToken } })
  },
  /** Prend l'alerte en charge (ALERT_RESOLVE). 409 `alert-already-claimed` ; 404/405 sans code sur un back qui n'a pas la route. */
  claimAlert(id: string): Promise<AdminAlert> {
    return useApi()<AdminAlert>(`/admin/alerts/${encodeURIComponent(id)}/claim`, { method: 'POST' })
  },
  /** Libère l'alerte (celui qui l'a prise, ou ADMIN_MANAGE). 403 `alert-claim-not-yours`. */
  releaseAlert(id: string): Promise<AdminAlert> {
    return useApi()<AdminAlert>(`/admin/alerts/${encodeURIComponent(id)}/claim`, { method: 'DELETE' })
  },
}
