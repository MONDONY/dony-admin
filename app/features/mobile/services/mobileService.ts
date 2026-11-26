import { useApi } from '@/composables/useApi'

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
}
