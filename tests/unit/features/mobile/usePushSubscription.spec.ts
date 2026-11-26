import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const registerDevice = vi.fn()
const unregisterDevice = vi.fn()
vi.mock('@/features/mobile/services/mobileService', () => ({
  mobileService: { registerDevice: (...a: unknown[]) => registerDevice(...a), unregisterDevice: (...a: unknown[]) => unregisterDevice(...a) },
}))
const getToken = vi.fn()
const deleteToken = vi.fn()
const getMessaging = vi.fn(() => ({ fake: 'messaging' }))
vi.mock('firebase/messaging', () => ({
  getMessaging: (...a: unknown[]) => getMessaging(...(a as [])),
  getToken: (...a: unknown[]) => getToken(...a),
  deleteToken: (...a: unknown[]) => deleteToken(...a),
}))

const config = { app: { baseURL: '/siragbe/' }, public: { firebaseVapidKey: 'VAPID' } as Record<string, string> }

import { usePushSubscription } from '@/features/mobile/composables/usePushSubscription'

const KEY = 'yadony-admin-push-token'
const registration = { scope: '/siragbe/m/' }
const register = vi.fn()
const ANDROID = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36'
const IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1'

function setup(opts: { ua?: string, permission?: string, request?: string, push?: boolean, standalone?: boolean } = {}) {
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
  Object.defineProperty(navigator, 'serviceWorker', { value: { register }, configurable: true })
  vi.stubGlobal('matchMedia', () => ({ matches: false }))
}
const delPush = () => { delete (window as unknown as Record<string, unknown>).PushManager }

describe('usePushSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    config.public.firebaseVapidKey = 'VAPID'
    register.mockResolvedValue(registration)
    getToken.mockResolvedValue('tok-1')
    registerDevice.mockResolvedValue(undefined)
    unregisterDevice.mockResolvedValue(undefined)
    deleteToken.mockResolvedValue(true)
    localStorage.clear()
  })
  afterEach(() => { vi.unstubAllGlobals(); delPush() })

  it('state_needsInstall_onIosOutsideStandalone', () => {
    setup({ ua: IOS, standalone: false })
    expect(usePushSubscription().state.value).toBe('needs-install')
  })

  it('state_isNotNeedsInstall_onIosStandalone', () => {
    setup({ ua: IOS, standalone: true })
    expect(usePushSubscription().state.value).toBe('off')
  })

  it('state_unsupported_withoutPushManager', () => {
    setup({ push: false })
    expect(usePushSubscription().state.value).toBe('unsupported')
  })

  it('state_unsupported_withoutVapidKey', () => {
    setup()
    config.public.firebaseVapidKey = ''
    expect(usePushSubscription().state.value).toBe('unsupported')
  })

  it('state_denied_whenPermissionAlreadyDenied', () => {
    setup({ permission: 'denied' })
    expect(usePushSubscription().state.value).toBe('denied')
  })

  it('enable_registersTokenWithBackend', async () => {
    setup()
    const p = usePushSubscription()
    await p.enable()
    expect(register).toHaveBeenCalledWith('/siragbe/m/firebase-messaging-sw.js', { scope: '/siragbe/m/' })
    expect(getToken).toHaveBeenCalledWith({ fake: 'messaging' }, { vapidKey: 'VAPID', serviceWorkerRegistration: registration })
    expect(registerDevice).toHaveBeenCalledWith({ fcmToken: 'tok-1', deviceName: 'Chrome sur Android', platform: 'web' })
    expect(Object.keys(registerDevice.mock.calls[0]![0]).sort()).toEqual(['deviceName', 'fcmToken', 'platform'])
    expect(p.state.value).toBe('on')
    expect(localStorage.getItem(KEY)).toBe('tok-1')
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

  it('disable_unregistersAndDeletesToken', async () => {
    setup({ permission: 'granted' })
    localStorage.setItem(KEY, 'tok-1')
    const p = usePushSubscription()
    await p.refresh()
    expect(p.state.value).toBe('on')
    await p.disable()
    expect(unregisterDevice).toHaveBeenCalledWith('tok-1')
    expect(deleteToken).toHaveBeenCalledWith({ fake: 'messaging' })
    expect(localStorage.getItem(KEY)).toBeNull()
    expect(p.state.value).toBe('off')
  })

  it('disable_continuesWhenBackendFails', async () => {
    setup({ permission: 'granted' })
    localStorage.setItem(KEY, 'tok-1')
    unregisterDevice.mockRejectedValue(new Error('net'))
    const p = usePushSubscription()
    await p.refresh()
    await p.disable()
    expect(deleteToken).toHaveBeenCalled()
    expect(localStorage.getItem(KEY)).toBeNull()
    expect(p.state.value).toBe('off')
  })

  it('refresh_restoresOnState_whenPermissionGrantedAndTokenStored', async () => {
    setup({ permission: 'granted' })
    localStorage.setItem(KEY, 'tok-1')
    const p = usePushSubscription()
    expect(p.state.value).toBe('off')
    await p.refresh()
    expect(p.state.value).toBe('on')
  })

  it('refresh_isOff_whenPermissionGrantedButNoStoredToken', async () => {
    setup({ permission: 'granted' })
    const p = usePushSubscription()
    await p.refresh()
    expect(p.state.value).toBe('off')
  })
})
