/**
 * Jeton push de l'appareil (`{ uid, token }`), écrit par usePushSubscription. Module léger : la
 * déconnexion du bureau le lit sans charger firebase/messaging.
 */
export const PUSH_TOKEN_KEY = 'yadony-admin-push-token'

/** Vrai si un jeton push est enregistré sur cet appareil (stockage illisible : non). */
export function hasStoredPushToken(): boolean {
  try { return !!localStorage.getItem(PUSH_TOKEN_KEY) } catch { return false }
}
