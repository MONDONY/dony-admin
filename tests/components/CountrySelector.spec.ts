import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import CountrySelector from '@/features/auth/components/CountrySelector.vue'

const defaultCountry = { code: 'FR', flag: '🇫🇷', name: 'France', dial: '+33' }

describe('CountrySelector', () => {
  it('shows selected country flag and dial code', () => {
    const wrapper = mount(CountrySelector, {
      props: { modelValue: defaultCountry },
    })
    expect(wrapper.text()).toContain('🇫🇷')
    expect(wrapper.text()).toContain('+33')
  })

  it('opens dropdown on button click', async () => {
    const wrapper = mount(CountrySelector, {
      props: { modelValue: defaultCountry },
    })
    expect(wrapper.find('ul[role="listbox"]').exists()).toBe(false)
    await wrapper.find('button').trigger('click')
    expect(wrapper.find('ul[role="listbox"]').exists()).toBe(true)
  })

  it('lists all 6 countries in dropdown', async () => {
    const wrapper = mount(CountrySelector, {
      props: { modelValue: defaultCountry },
    })
    await wrapper.find('button').trigger('click')
    const items = wrapper.findAll('li[role="option"]')
    expect(items).toHaveLength(6)
  })

  it('emits update:modelValue when a country is selected', async () => {
    const wrapper = mount(CountrySelector, {
      props: { modelValue: defaultCountry },
    })
    await wrapper.find('button').trigger('click')
    const items = wrapper.findAll('li[role="option"]')
    await items[1].trigger('click') // Sénégal
    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    const emitted = wrapper.emitted('update:modelValue')![0][0] as typeof defaultCountry
    expect(emitted.code).toBe('SN')
    expect(emitted.dial).toBe('+221')
  })

  it('closes dropdown after selection', async () => {
    const wrapper = mount(CountrySelector, {
      props: { modelValue: defaultCountry },
    })
    await wrapper.find('button').trigger('click')
    await wrapper.findAll('li[role="option"]')[0].trigger('click')
    expect(wrapper.find('ul[role="listbox"]').exists()).toBe(false)
  })

  it('toggles dropdown closed when button is clicked again', async () => {
    const wrapper = mount(CountrySelector, {
      props: { modelValue: defaultCountry },
    })
    await wrapper.find('button').trigger('click')
    expect(wrapper.find('ul[role="listbox"]').exists()).toBe(true)
    await wrapper.find('button').trigger('click')
    expect(wrapper.find('ul[role="listbox"]').exists()).toBe(false)
  })

  it('closes dropdown when clicking outside the component', async () => {
    const wrapper = mount(CountrySelector, {
      props: { modelValue: defaultCountry },
      attachTo: document.body,
    })
    await wrapper.find('button').trigger('click')
    expect(wrapper.find('ul[role="listbox"]').exists()).toBe(true)

    // Simulate click outside by dispatching a click event on document body
    const outsideElement = document.createElement('div')
    document.body.appendChild(outsideElement)
    outsideElement.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()

    expect(wrapper.find('ul[role="listbox"]').exists()).toBe(false)
    outsideElement.remove()
    wrapper.unmount()
  })

  it('does not close dropdown when clicking inside the component', async () => {
    const wrapper = mount(CountrySelector, {
      props: { modelValue: defaultCountry },
      attachTo: document.body,
    })
    await wrapper.find('button').trigger('click')
    expect(wrapper.find('ul[role="listbox"]').exists()).toBe(true)

    // Dispatch click inside the container — the component itself
    wrapper.element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()

    // Dropdown should still be open (click was inside the container)
    // Note: button.stop prevents toggle, but the handleClickOutside won't close it
    expect(wrapper.find('ul[role="listbox"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('marks the currently selected country with aria-selected', async () => {
    const wrapper = mount(CountrySelector, {
      props: { modelValue: defaultCountry },
    })
    await wrapper.find('button').trigger('click')
    const items = wrapper.findAll('li[role="option"]')
    expect(items[0].attributes('aria-selected')).toBe('true')
    expect(items[1].attributes('aria-selected')).toBe('false')
  })

  it('removes click listener on unmount', async () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener')
    const wrapper = mount(CountrySelector, {
      props: { modelValue: defaultCountry },
    })
    wrapper.unmount()
    expect(removeSpy).toHaveBeenCalledWith('click', expect.any(Function), true)
    removeSpy.mockRestore()
  })
})
