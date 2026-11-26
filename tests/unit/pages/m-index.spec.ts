import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

const navigateToMock = vi.fn()
vi.stubGlobal('navigateTo', navigateToMock)
vi.stubGlobal('definePageMeta', vi.fn())
let ssrContext: object | undefined
vi.stubGlobal('useNuxtApp', () => ({ ssrContext }))

import MIndex from '@/pages/m/index.vue'
import { useAuthStore } from '@/stores/auth'
import { seedAuth, makeAdmin } from '../../helpers/auth'

const NO_TABS = {
  ALERT_VIEW: false, METRICS_VIEW: false, SUPPORT_TICKET_VIEW: false,
  MODERATION_VIEW: false, NOTIFICATION_SEND: false,
}

describe('/m index', () => {
  beforeEach(() => {
    navigateToMock.mockClear()
    ssrContext = undefined
  })

  it('goes to the first permitted tab', () => {
    seedAuth('ADMIN', { ALERT_VIEW: false })
    mount(MIndex)
    expect(navigateToMock).toHaveBeenCalledWith('/m/ensemble', { replace: true })
  })

  it('goes to /denied for an authenticated admin without any tab', () => {
    seedAuth('ADMIN', NO_TABS)
    mount(MIndex)
    expect(navigateToMock).toHaveBeenCalledTimes(1)
    expect(navigateToMock).toHaveBeenCalledWith('/denied', { replace: true })
  })

  it('goes to the lock page (never /login) when nobody is authenticated (session not restored)', () => {
    setActivePinia(createPinia())
    mount(MIndex)
    expect(navigateToMock).toHaveBeenCalledTimes(1)
    expect(navigateToMock).toHaveBeenCalledWith('/m/verrouille', { replace: true })
  })

  it('never lands on /denied for an admin whose session arrives after a first empty state', () => {
    setActivePinia(createPinia())
    const auth = useAuthStore()
    // Plugin firebase.client.ts finit avant le montage : la session est posée avant la page.
    auth.setSession('t', makeAdmin('ADMIN'))
    mount(MIndex)
    expect(navigateToMock).toHaveBeenCalledWith('/m/alertes', { replace: true })
    expect(navigateToMock).not.toHaveBeenCalledWith('/denied', expect.anything())
  })

  it('does not navigate during server render', () => {
    ssrContext = {}
    setActivePinia(createPinia())
    mount(MIndex)
    expect(navigateToMock).not.toHaveBeenCalled()
  })
})
