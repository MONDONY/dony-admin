import { describe, it, expect, afterEach } from 'vitest'
import { initializeApp, deleteApp, type FirebaseApp } from 'firebase/app'
import { getMessaging } from 'firebase/messaging'
import { buildFirebaseConfig, resolveMessagingSenderId } from '@/lib/firebaseConfig'

const PUB = { firebaseApiKey: 'key', firebaseAuthDomain: 'x.firebaseapp.com', firebaseProjectId: 'proj', firebaseAppId: '1:424242:web:abc' }

describe('resolveMessagingSenderId', () => {
  it('prefers the explicit value (NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID)', () => {
    expect(resolveMessagingSenderId({ ...PUB, firebaseMessagingSenderId: ' 777 ' })).toBe('777')
  })
  it('accepts a number (Nuxt parses numeric env values)', () => {
    expect(resolveMessagingSenderId({ ...PUB, firebaseMessagingSenderId: 777 })).toBe('777')
  })
  it('falls back to the project number inside the appId', () => {
    expect(resolveMessagingSenderId({ ...PUB, firebaseMessagingSenderId: '' })).toBe('424242')
  })
  it('is empty when neither is available', () => {
    expect(resolveMessagingSenderId({ firebaseAppId: 'nope' })).toBe('')
    expect(resolveMessagingSenderId({ firebaseAppId: '1:abc:web:x' })).toBe('')
    expect(resolveMessagingSenderId({})).toBe('')
  })
})

describe('buildFirebaseConfig', () => {
  it('carries the four keys FCM requires', () => {
    expect(buildFirebaseConfig(PUB)).toEqual({
      apiKey: 'key', authDomain: 'x.firebaseapp.com', projectId: 'proj', appId: '1:424242:web:abc', messagingSenderId: '424242',
    })
  })
  it('omits messagingSenderId when unknown', () => {
    expect(buildFirebaseConfig({ ...PUB, firebaseAppId: 'nope' })).not.toHaveProperty('messagingSenderId')
  })
})

// Sans mock : la vraie validation de configuration de @firebase/messaging (extractAppConfig).
describe('real getMessaging config validation (not mocked)', () => {
  const apps: FirebaseApp[] = []
  afterEach(async () => { await Promise.all(apps.splice(0).map(a => deleteApp(a))) })

  function stubBrowser() {
    // Ouverture IndexedDB qui ne se termine jamais : le contrôle asynchrone isSupported() reste en
    // attente (aucun rejet non géré sous happy-dom) ; la validation synchrone, elle, s'exécute.
    Object.defineProperty(globalThis, 'indexedDB', { value: { open: () => ({}) }, configurable: true })
    Object.defineProperty(navigator, 'serviceWorker', { value: { addEventListener: () => {} }, configurable: true })
  }

  it('rejects the old config (no messagingSenderId) with messaging/missing-app-config-values', () => {
    stubBrowser()
    const app = initializeApp({ apiKey: 'key', projectId: 'proj', appId: 'no-number' }, 'cfg-old')
    apps.push(app)
    expect(() => getMessaging(app)).toThrow(expect.objectContaining({ code: 'messaging/missing-app-config-values' }))
  })

  it('accepts the config built from the appId fallback', () => {
    stubBrowser()
    const app = initializeApp(buildFirebaseConfig(PUB), 'cfg-new')
    apps.push(app)
    expect(() => getMessaging(app)).not.toThrow()
  })
})
