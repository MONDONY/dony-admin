import type { FirebaseOptions } from 'firebase/app'

/** Valeur de configuration publique en texte : Nuxt convertit les variables numériques en nombres. */
function text(v: unknown): string {
  return typeof v === 'string' ? v.trim() : typeof v === 'number' && Number.isFinite(v) ? String(v) : ''
}

/**
 * `messagingSenderId` exigé par Firebase Cloud Messaging (numéro du projet Firebase) :
 * `NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, sinon le numéro contenu dans l'appId
 * (`1:<numéro>:web:<id>`). Chaîne vide si aucun des deux n'est disponible.
 */
export function resolveMessagingSenderId(pub: Record<string, unknown>): string {
  const explicit = text(pub.firebaseMessagingSenderId)
  if (explicit) return explicit
  const fromAppId = text(pub.firebaseAppId).split(':')[1] ?? ''
  return /^\d+$/.test(fromAppId) ? fromAppId : ''
}

/** Configuration Firebase de l'app (auth + messaging) à partir de la configuration publique Nuxt. */
export function buildFirebaseConfig(pub: Record<string, unknown>): FirebaseOptions {
  const messagingSenderId = resolveMessagingSenderId(pub)
  return {
    apiKey: text(pub.firebaseApiKey),
    authDomain: text(pub.firebaseAuthDomain),
    projectId: text(pub.firebaseProjectId),
    appId: text(pub.firebaseAppId),
    ...(messagingSenderId ? { messagingSenderId } : {}),
  }
}
