import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const registerDevice = vi.fn()
const unregisterDevice = vi.fn()
vi.mock('@/features/mobile/services/mobileService', () => ({
  mobileService: { registerDevice: (...a: unknown[]) => registerDevice(...a), unregisterDevice: (...a: unknown[]) => unregisterDevice(...a) },
}))
const getToken = vi.fn()
const deleteToken = vi.fn()
const getMessaging = vi.fn()
vi.mock('firebase/messaging', () => ({
  getMessaging: (...a: unknown[]) => getMessaging(...(a as [])),
  getToken: (...a: unknown[]) => getToken(...a),
  deleteToken: (...a: unknown[]) => deleteToken(...a),
}))

const config = { app: { baseURL: '/siragbe/' }, public: { firebaseVapidKey: 'VAPID', firebaseAppId: '1:424242:web:abc', firebaseMessagingSenderId: '' } as Record<string, string> }

import { usePushSubscription, clearPushOnLogout, waitForActivation } from '@/features/mobile/composables/usePushSubscription'

const KEY = 'yadony-admin-push-token'
const stored = (token = 'tok-1', uid = 'admin-1') => JSON.stringify({ uid, token })
const authStore = { user: { id: 'admin-1' } as { id: string } | null }
vi.mock('@/stores/auth', () => ({ useAuthStore: () => authStore }))
const subscription = { unsubscribe: vi.fn() }
const pushManager = { getSubscription: vi.fn() }
const registration: Record<string, unknown> = { scope: '/siragbe/m/', active: { state: 'activated' }, pushManager }
const register = vi.fn()
const getRegistration = vi.fn()

/** Service worker en cours d'installation : passe à `activated` quand le test le décide. */
function installingWorker() {
  const sw = Object.assign(new EventTarget(), { state: 'installing' })
  return { sw, activate: () => { sw.state = 'activated'; sw.dispatchEvent(new Event('statechange')) } }
}
const ANDROID = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36'
const IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1'

function setup(opts: { ua?: string, permission?: string, request?: string, push?: boolean, standalone?: boolean, platform?: string, touch?: number } = {}) {
  vi.stubGlobal('useRuntimeConfig', () => config)
  vi.stubGlobal('useNuxtApp', () => ({ $firebaseApp: { name: 'app' } }))
  vi.stubGlobal('Notification', Object.assign(vi.fn(), {
    permission: opts.permission ?? 'default',
    requestPermission: vi.fn().mockResolvedValue(opts.request ?? 'granted'),
  }))
  if (opts.push === false) vi.stubGlobal('PushManager', undefined)
  else vi.stubGlobal('PushManager', class {})
  Object.defineProperty(navigator, 'userAgent', { value: opts.ua ?? ANDROID, configurable: true })
  Object.defineProperty(navigator, 'standalone', { value: opts.standalone, configurable: true })
  Object.defineProperty(navigator, 'platform', { value: opts.platform ?? 'Linux armv8l', configurable: true })
  Object.defineProperty(navigator, 'maxTouchPoints', { value: opts.touch ?? 5, configurable: true })
  Object.defineProperty(navigator, 'serviceWorker', { value: { register, getRegistration }, configurable: true })
  vi.stubGlobal('matchMedia', () => ({ matches: false }))
}
const delPush = () => { delete (window as unknown as Record<string, unknown>).PushManager }

describe('usePushSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    config.public.firebaseVapidKey = 'VAPID'
    config.public.firebaseAppId = '1:424242:web:abc'
    config.public.firebaseMessagingSenderId = ''
    register.mockResolvedValue(registration)
    getRegistration.mockResolvedValue(registration)
    pushManager.getSubscription.mockResolvedValue(subscription)
    subscription.unsubscribe.mockResolvedValue(true)
    registration.active = { state: 'activated' }
    registration.installing = null
    getMessaging.mockReturnValue({ fake: 'messaging' })
    getToken.mockResolvedValue('tok-1')
    registerDevice.mockResolvedValue(undefined)
    unregisterDevice.mockResolvedValue(undefined)
    deleteToken.mockResolvedValue(true)
    localStorage.clear()
    authStore.user = { id: 'admin-1' }
  })
  afterEach(() => { vi.unstubAllGlobals(); delPush() })

  it('state_isUnsupportedFirst_thenDetectedAfterRefresh (no SSR hydration mismatch)', async () => {
    setup({ permission: 'denied' })
    const p = usePushSubscription()
    expect(p.state.value).toBe('unsupported')
    await p.refresh()
    expect(p.state.value).toBe('denied')
  })

  it('state_isUnsupported_onServer_withoutWindow', () => {
    setup()
    const w = window
    vi.stubGlobal('window', undefined)
    try { expect(usePushSubscription().state.value).toBe('unsupported') } finally { vi.stubGlobal('window', w) }
  })

  it('state_needsInstall_onIosOutsideStandalone', async () => {
    setup({ ua: IOS, standalone: false })
    const p = usePushSubscription()
    await p.refresh()
    expect(p.state.value).toBe('needs-install')
  })

  it('state_isNotNeedsInstall_onIosStandalone', async () => {
    setup({ ua: IOS, standalone: true })
    const p = usePushSubscription()
    await p.refresh()
    expect(p.state.value).toBe('off')
  })

  it('state_unsupported_withoutPushManager', async () => {
    setup({ push: false })
    const p = usePushSubscription()
    await p.refresh()
    expect(p.state.value).toBe('unsupported')
  })

  it('state_unsupported_withoutVapidKey', async () => {
    setup()
    config.public.firebaseVapidKey = ''
    const p = usePushSubscription()
    await p.refresh()
    expect(p.state.value).toBe('unsupported')
  })

  it('state_unsupported_withoutMessagingSenderId (neither the variable nor an appId with the project number)', async () => {
    setup()
    config.public.firebaseAppId = 'not-a-firebase-app-id'
    const p = usePushSubscription()
    await p.refresh()
    expect(p.state.value).toBe('unsupported')
    await p.enable()
    expect(p.state.value).toBe('unsupported')
    expect(getToken).not.toHaveBeenCalled()
  })

  it('state_off_withExplicitMessagingSenderId_evenWithoutAppIdNumber', async () => {
    setup()
    config.public.firebaseAppId = 'not-a-firebase-app-id'
    config.public.firebaseMessagingSenderId = '777'
    const p = usePushSubscription()
    await p.refresh()
    expect(p.state.value).toBe('off')
  })

  it('state_denied_whenPermissionAlreadyDenied', async () => {
    setup({ permission: 'denied' })
    const p = usePushSubscription()
    await p.refresh()
    expect(p.state.value).toBe('denied')
  })

  it('enable_registersTokenWithBackend', async () => {
    setup()
    const p = usePushSubscription()
    await p.enable()
    expect(register).toHaveBeenCalledWith('/siragbe/m/firebase-messaging-sw.js', { scope: '/siragbe/m/', updateViaCache: 'none' })
    expect(getToken).toHaveBeenCalledWith({ fake: 'messaging' }, { vapidKey: 'VAPID', serviceWorkerRegistration: registration })
    expect(registerDevice).toHaveBeenCalledWith({ fcmToken: 'tok-1', deviceName: 'Chrome sur Android', platform: 'web' })
    expect(Object.keys(registerDevice.mock.calls[0]![0]).sort()).toEqual(['deviceName', 'fcmToken', 'platform'])
    expect(p.state.value).toBe('on')
    expect(localStorage.getItem(KEY)).toBe(stored())
  })

  it('enable_setsDenied_whenPermissionRefused', async () => {
    setup({ request: 'denied' })
    const p = usePushSubscription()
    await p.enable()
    expect(p.state.value).toBe('denied')
    expect(getToken).not.toHaveBeenCalled()
    expect(registerDevice).not.toHaveBeenCalled()
  })

  it('enable_staysOff_whenPromptDismissed', async () => {
    setup({ request: 'default' })
    const p = usePushSubscription()
    await p.enable()
    expect(p.state.value).toBe('off')
    expect(registerDevice).not.toHaveBeenCalled()
  })

  it('enable_isNoop_when404FromOldBackend', async () => {
    setup()
    registerDevice.mockRejectedValue({ statusCode: 404 })
    const p = usePushSubscription()
    await expect(p.enable()).resolves.toBeUndefined()
    expect(p.state.value).toBe('unsupported')
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('enable_isNoop_when405FromOldBackend', async () => {
    setup()
    registerDevice.mockRejectedValue({ response: { status: 405 } })
    const p = usePushSubscription()
    await p.enable()
    expect(p.state.value).toBe('unsupported')
  })

  it('enable_staysOff_onOtherBackendError', async () => {
    setup()
    registerDevice.mockRejectedValue({ statusCode: 500 })
    const p = usePushSubscription()
    await p.enable()
    expect(p.state.value).toBe('off')
  })

  it('enable_worksWithoutLocalStorage', async () => {
    setup()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })
    const p = usePushSubscription()
    await p.enable()
    expect(p.state.value).toBe('on')
    await p.refresh()
    vi.mocked(Storage.prototype.setItem).mockRestore()
    vi.mocked(Storage.prototype.getItem).mockRestore()
  })

  it('disable_onAFreshPage_unregisters_andUnsubscribesThroughTheMobileRegistration', async () => {
    setup({ permission: 'granted' })
    localStorage.setItem(KEY, stored())
    const p = usePushSubscription()
    await p.refresh()
    expect(p.state.value).toBe('on')
    await p.disable()
    expect(unregisterDevice).toHaveBeenCalledWith('tok-1')
    expect(getRegistration).toHaveBeenCalledWith('/siragbe/m/')
    expect(subscription.unsubscribe).toHaveBeenCalledTimes(1)
    // Sans getToken dans ce document, le SDK chercherait un service worker à la racine du site.
    expect(deleteToken).not.toHaveBeenCalled()
    expect(localStorage.getItem(KEY)).toBeNull()
    expect(p.state.value).toBe('off')
  })

  it('disable_afterEnableInTheSamePage_alsoDeletesTheFcmToken', async () => {
    setup()
    const p = usePushSubscription()
    await p.enable()
    await p.disable()
    expect(deleteToken).toHaveBeenCalledWith({ fake: 'messaging' })
    expect(subscription.unsubscribe).toHaveBeenCalled()
  })

  it('disable_withoutAnyRegistrationOrSubscription_isQuiet', async () => {
    setup({ permission: 'granted' })
    localStorage.setItem(KEY, stored())
    getRegistration.mockResolvedValue(undefined)
    const p = usePushSubscription()
    await expect(p.disable()).resolves.toBeUndefined()
    pushManager.getSubscription.mockResolvedValue(null)
    getRegistration.mockResolvedValue(registration)
    await expect(p.disable()).resolves.toBeUndefined()
    getRegistration.mockRejectedValue(new Error('sw'))
    await expect(p.disable()).resolves.toBeUndefined()
    expect(p.state.value).toBe('off')
  })

  it('disable_continuesWhenBackendFails', async () => {
    setup({ permission: 'granted' })
    localStorage.setItem(KEY, stored())
    unregisterDevice.mockRejectedValue(new Error('net'))
    const p = usePushSubscription()
    await p.refresh()
    await p.disable()
    expect(subscription.unsubscribe).toHaveBeenCalled()
    expect(localStorage.getItem(KEY)).toBeNull()
    expect(p.state.value).toBe('off')
  })

  // ── Premier abonnement : service worker pas encore actif (F3) ─────────────

  it('enable_waitsForTheInstallingWorkerToActivate_beforeGetToken', async () => {
    setup()
    const { sw, activate } = installingWorker()
    registration.active = null
    registration.installing = sw
    const p = usePushSubscription()
    const pending = p.enable()
    await vi.waitFor(() => expect(register).toHaveBeenCalled())
    await Promise.resolve()
    expect(getToken).not.toHaveBeenCalled()
    activate()
    await pending
    expect(getToken).toHaveBeenCalledTimes(1)
    expect(p.state.value).toBe('on')
    expect(p.error.value).toBeNull()
  })

  it('enable_failsVisibly_whenTheWorkerNeverActivates (10 s)', async () => {
    vi.useFakeTimers()
    try {
      setup()
      const { sw } = installingWorker()
      registration.active = null
      registration.installing = sw
      const p = usePushSubscription()
      const pending = p.enable()
      await vi.advanceTimersByTimeAsync(10_000)
      await pending
      expect(getToken).not.toHaveBeenCalled()
      expect(p.state.value).toBe('off')
      expect(p.error.value).toBe('generic')
    } finally { vi.useRealTimers() }
  })

  it('waitForActivation: redundant worker rejects, no worker falls back to ready', async () => {
    const { sw } = installingWorker()
    const reg = { active: null, installing: sw, waiting: null } as unknown as ServiceWorkerRegistration
    const p = waitForActivation(reg, 1000)
    sw.state = 'redundant'; sw.dispatchEvent(new Event('statechange'))
    await expect(p).rejects.toThrow()
    Object.defineProperty(navigator, 'serviceWorker', { value: { ready: Promise.resolve({}) }, configurable: true })
    await expect(waitForActivation({ active: null, installing: null, waiting: null } as unknown as ServiceWorkerRegistration, 1000)).resolves.toBeUndefined()
  })

  // ── Erreurs d'activation visibles (F7) ────────────────────────────────────

  it.each([
    [{ code: 'messaging/missing-app-config-values' }, 'config'],
    [{ code: 'messaging/token-subscribe-failed' }, 'config'],
    [{ code: 'messaging/permission-blocked' }, 'permission'],
    [Object.assign(new Error('x'), { name: 'NotAllowedError' }), 'permission'],
    [new Error('boom'), 'generic'],
  ])('enable_exposesTheErrorKind %#', async (err, kind) => {
    setup()
    getToken.mockRejectedValue(err)
    const p = usePushSubscription()
    await p.enable()
    expect(p.state.value).toBe('off')
    expect(p.error.value).toBe(kind)
  })

  it('enable_firebaseAppMissing_isAConfigError', async () => {
    setup()
    vi.stubGlobal('useNuxtApp', () => ({ $firebaseApp: null }))
    const p = usePushSubscription()
    await p.enable()
    expect(p.error.value).toBe('config')
  })

  it('enable_emptyToken_isAGenericError_andARetryClearsIt', async () => {
    setup()
    getToken.mockResolvedValueOnce('')
    const p = usePushSubscription()
    await p.enable()
    expect(p.state.value).toBe('off')
    expect(p.error.value).toBe('generic')
    await p.enable()
    expect(p.error.value).toBeNull()
    expect(p.state.value).toBe('on')
  })

  // ── iPadOS en mode bureau (F11) ───────────────────────────────────────────

  it('state_needsInstall_onIpadosDesktopMode (MacIntel + touch)', async () => {
    setup({ ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15', platform: 'MacIntel', touch: 5, standalone: false })
    const p = usePushSubscription()
    await p.refresh()
    expect(p.state.value).toBe('needs-install')
  })

  it('state_off_onARealMac (MacIntel without touch)', async () => {
    setup({ ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15', platform: 'MacIntel', touch: 0 })
    const p = usePushSubscription()
    await p.refresh()
    expect(p.state.value).toBe('off')
  })

  it('refresh_restoresOnState_whenPermissionGrantedAndTokenStored', async () => {
    setup({ permission: 'granted' })
    localStorage.setItem(KEY, stored())
    const p = usePushSubscription()
    expect(p.state.value).toBe('unsupported')
    await p.refresh()
    expect(p.state.value).toBe('on')
  })

  it('refresh_isOff_whenPermissionGrantedButNoStoredToken', async () => {
    setup({ permission: 'granted' })
    const p = usePushSubscription()
    await p.refresh()
    expect(p.state.value).toBe('off')
  })

  it('refresh_isOff_whenStoredTokenBelongsToAnotherAdmin', async () => {
    setup({ permission: 'granted' })
    localStorage.setItem(KEY, stored('tok-9', 'someone-else'))
    const p = usePushSubscription()
    await p.refresh()
    expect(p.state.value).toBe('off')
  })

  it('enable_storesTokenWithUid', async () => {
    setup()
    await usePushSubscription().enable()
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({ uid: 'admin-1', token: 'tok-1' })
  })
})

describe('clearPushOnLogout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    config.public.firebaseVapidKey = 'VAPID'
    register.mockResolvedValue(registration)
    getRegistration.mockResolvedValue(registration)
    pushManager.getSubscription.mockResolvedValue(subscription)
    subscription.unsubscribe.mockResolvedValue(true)
    registration.active = { state: 'activated' }
    registration.installing = null
    getMessaging.mockReturnValue({ fake: 'messaging' })
    getToken.mockResolvedValue('tok-1')
    registerDevice.mockResolvedValue(undefined)
    unregisterDevice.mockResolvedValue(undefined)
    deleteToken.mockResolvedValue(true)
    localStorage.clear()
    authStore.user = { id: 'admin-1' }
    setup({ permission: 'granted' })
  })
  afterEach(() => { vi.unstubAllGlobals(); delPush() })

  it('unregisters, unsubscribes through the /m/ registration and removes the key (fresh page)', async () => {
    localStorage.setItem(KEY, stored())
    await clearPushOnLogout()
    expect(unregisterDevice).toHaveBeenCalledWith('tok-1')
    expect(getRegistration).toHaveBeenCalledWith('/siragbe/m/')
    expect(subscription.unsubscribe).toHaveBeenCalledTimes(1)
    expect(deleteToken).not.toHaveBeenCalled()
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('also deletes the FCM token when this page obtained it', async () => {
    await usePushSubscription().enable()
    await clearPushOnLogout()
    expect(deleteToken).toHaveBeenCalledWith({ fake: 'messaging' })
    expect(subscription.unsubscribe).toHaveBeenCalled()
  })

  it('never throws and still cleans up when the backend rejects', async () => {
    localStorage.setItem(KEY, stored())
    unregisterDevice.mockRejectedValue(new Error('net'))
    deleteToken.mockRejectedValue(new Error('fcm'))
    await expect(clearPushOnLogout()).resolves.toBeUndefined()
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('is a no-op without a stored token', async () => {
    await clearPushOnLogout()
    expect(unregisterDevice).not.toHaveBeenCalled()
    expect(deleteToken).not.toHaveBeenCalled()
  })

  it('is a no-op for a token of another admin', async () => {
    localStorage.setItem(KEY, stored('tok-9', 'someone-else'))
    await clearPushOnLogout()
    expect(unregisterDevice).not.toHaveBeenCalled()
  })

  it('is bounded: returns within ~2 s even if the backend hangs', async () => {
    localStorage.setItem(KEY, stored())
    unregisterDevice.mockReturnValue(new Promise(() => {}))
    vi.useFakeTimers()
    try {
      const p = clearPushOnLogout()
      await vi.advanceTimersByTimeAsync(2100)
      await expect(p).resolves.toBeUndefined()
    } finally { vi.useRealTimers() }
    expect(localStorage.getItem(KEY)).toBeNull()
  })
})
