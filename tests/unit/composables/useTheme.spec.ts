import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, ref, onMounted, onUnmounted } from 'vue'

// useTheme uses Vue composition API as Nuxt auto-imports; stub them globally
vi.stubGlobal('ref', ref)
vi.stubGlobal('onMounted', onMounted)
vi.stubGlobal('onUnmounted', onUnmounted)

describe('useTheme', () => {
  let observeMock: ReturnType<typeof vi.fn>
  let disconnectMock: ReturnType<typeof vi.fn>

  function makeMockObserver() {
    observeMock = vi.fn()
    disconnectMock = vi.fn()
    // MutationObserver must be a class (constructable)
    vi.stubGlobal('MutationObserver', class MockMutationObserver {
      observe = observeMock
      disconnect = disconnectMock
      constructor(_cb: (_mutations: MutationRecord[], _observer: MutationObserver) => void) { void _cb }
    })
  }

  beforeEach(() => {
    makeMockObserver()
    document.documentElement.classList.remove('dark')
  })

  afterEach(() => {
    document.documentElement.classList.remove('dark')
  })

  it('isDark is false when dark class is not set on mount', async () => {
    const { useTheme } = await import('@/composables/useTheme')
    const TestComp = defineComponent({
      setup() { return useTheme() },
      template: '<div :data-dark="String(isDark)" />',
    })
    const wrapper = mount(TestComp)
    expect(wrapper.attributes('data-dark')).toBe('false')
  })

  it('isDark is true when dark class is present at mount', async () => {
    // Add dark class before mounting
    document.documentElement.classList.add('dark')
    makeMockObserver()

    const { useTheme } = await import('@/composables/useTheme')
    const TestComp = defineComponent({
      setup() { return useTheme() },
      template: '<div :data-dark="String(isDark)" />',
    })
    const wrapper = mount(TestComp)
    await wrapper.vm.$nextTick()
    // isDark should be true because onMounted reads classList
    expect(wrapper.attributes('data-dark')).toBe('true')
  })

  it('disconnects observer on unmount', async () => {
    const { useTheme } = await import('@/composables/useTheme')
    const TestComp = defineComponent({
      setup() { return useTheme() },
      template: '<div />',
    })
    const wrapper = mount(TestComp)
    wrapper.unmount()
    expect(disconnectMock).toHaveBeenCalled()
  })
})
