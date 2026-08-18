const STORAGE_KEY = 'yadony_device_id'

/**
 * Retourne un identifiant stable pour ce navigateur, généré une fois et
 * persisté dans localStorage. Utilisé pour le header X-Device-Id.
 */
export function getDeviceId(): string {
  if (typeof window === 'undefined') return ''
  let id = window.localStorage.getItem(STORAGE_KEY)
  if (!id) {
    id = crypto.randomUUID()
    window.localStorage.setItem(STORAGE_KEY, id)
  }
  return id
}
