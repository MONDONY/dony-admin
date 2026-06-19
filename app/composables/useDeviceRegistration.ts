import { useApi } from '@/composables/useApi'

interface DeviceDto {
  deviceId: string
  deviceName: string
  platform: string
  lastSeenAt: string
  isCurrent: boolean
}

/** Construit un nom lisible depuis le user agent (ex: "Chrome sur Windows"). */
export function buildWebDeviceName(userAgent: string): string {
  const browser = /Edg/.test(userAgent) ? 'Edge'
    : /Chrome/.test(userAgent) ? 'Chrome'
    : /Firefox/.test(userAgent) ? 'Firefox'
    : /Safari/.test(userAgent) ? 'Safari'
    : 'Navigateur'
  const os = /Windows/.test(userAgent) ? 'Windows'
    : /Mac OS|Macintosh/.test(userAgent) ? 'macOS'
    : /Android/.test(userAgent) ? 'Android'
    : /Linux/.test(userAgent) ? 'Linux'
    : /iPhone|iPad/.test(userAgent) ? 'iOS'
    : 'Web'
  return `${browser} sur ${os}`
}

/**
 * Vérifie si l'appareil courant est toujours enregistré côté serveur.
 * Retourne `true` si encore enregistré OU en cas d'erreur réseau (fail-safe :
 * on ne déconnecte jamais sur une simple erreur de fetch).
 * Retourne `false` UNIQUEMENT si le serveur répond et que l'appareil courant
 * n'est plus dans la liste (révoqué).
 */
export async function isCurrentDeviceRegistered(): Promise<boolean> {
  try {
    const api = useApi()
    const devices = await api<DeviceDto[]>('/users/me/devices', { method: 'GET' })
    return devices.some((d) => d.isCurrent)
  } catch {
    return true // fail-safe : erreur réseau → ne pas déconnecter
  }
}

/**
 * Enregistre la session web courante dans user_devices (fire-and-forget).
 * N'échoue jamais l'appelant — les erreurs sont avalées silencieusement.
 */
export async function registerWebDevice(): Promise<void> {
  try {
    const api = useApi()
    const deviceName = buildWebDeviceName(
      typeof navigator !== 'undefined' ? navigator.userAgent : '',
    )
    await api('/users/me/devices', {
      method: 'POST',
      body: { deviceName, platform: 'web' },
    })
  } catch {
    // silencieux — l'enregistrement ne doit pas bloquer l'app
  }
}
