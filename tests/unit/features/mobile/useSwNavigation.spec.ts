import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'

const navigateMock = vi.fn()
vi.stubGlobal('navigateTo', navigateMock)
vi.stubGlobal('useRuntimeConfig', () => ({ app: { baseURL: '/siragbe/' }, public: {} }))

import { resolveSwNavigation, useSwNavigation } from '@/features/mobile/composables/useSwNavigation'

const origin = window.location.origin

describe('resolveSwNavigation', () => {
  it('accepts a same-origin url and strips the base path', () => {
    expect(resolveSwNavigation({ type: 'navigate', url: `${origin}/siragbe/m/alertes?x=1#h` }, '/siragbe/')).toBe('/m/alertes?x=1#h')
  })
  it('accepts a relative url', () => {
    expect(resolveSwNavigation({ type: 'navigate', url: '/siragbe/m/support' }, '/siragbe/')).toBe('/m/support')
  })
  it('ignores cross-origin urls', () => {
    expect(resolveSwNavigation({ type: 'navigate', url: 'https://evil.example/siragbe/m/x' }, '/siragbe/')).toBeNull()
  })
  it('ignores protocol-relative and javascript urls', () => {
    expect(resolveSwNavigation({ type: 'navigate', url: '//evil.example/m' }, '/siragbe/')).toBeNull()
    expect(resolveSwNavigation({ type: 'navigate', url: 'javascript:alert(1)' }, '/siragbe/')).toBeNull()
  })
  it('ignores malformed payloads', () => {
    expect(resolveSwNavigation(null, '/siragbe/')).toBeNull()
    expect(resolveSwNavigation({ type: 'other', url: '/m' }, '/siragbe/')).toBeNull()
    expect(resolveSwNavigation({ type: 'navigate', url: 42 }, '/siragbe/')).toBeNull()
    expect(resolveSwNavigation({ type: 'navigate', url: 'http://[bad' }, '/siragbe/')).toBeNull()
  })
})

describe('useSwNavigation', () => {
  const listeners = new Set<(_e: MessageEvent) => void>()
  const sw = {
    addEventListener: vi.fn((...a: [string, (_e: MessageEvent) => void]) => listeners.add(a[1])),
    removeEventListener: vi.fn((...a: [string, (_e: MessageEvent) => void]) => listeners.delete(a[1])),
  }
  beforeEach(() => {
    navigateMock.mockClear(); listeners.clear()
    Object.defineProperty(navigator, 'serviceWorker', { value: sw, configurable: true })
  })
  const Comp = defineComponent({ setup() { useSwNavigation(); return () => h('div') } })
  const send = (data: unknown) => listeners.forEach(fn => fn({ data } as MessageEvent))

  it('navigates on a valid message, ignores a cross-origin one, and unsubscribes on unmount', () => {
    const w = mount(Comp)
    expect(listeners.size).toBe(1)
    send({ type: 'navigate', url: `${origin}/siragbe/m/alertes` })
    expect(navigateMock).toHaveBeenCalledWith('/m/alertes')
    navigateMock.mockClear()
    send({ type: 'navigate', url: 'https://evil.example/m/alertes' })
    expect(navigateMock).not.toHaveBeenCalled()
    w.unmount()
    expect(listeners.size).toBe(0)
  })
})
