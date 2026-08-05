import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PasswordField from '@/features/auth/components/PasswordField.vue'

function mountField(props: Partial<InstanceType<typeof PasswordField>['$props']> = {}) {
  return mount(PasswordField, {
    props: { id: 'pwd', modelValue: '', label: 'Mot de passe', autocomplete: 'current-password', ...props },
  })
}

describe('PasswordField', () => {
  it('renders masked by default', () => {
    const wrapper = mountField()
    expect(wrapper.find('input').attributes('type')).toBe('password')
  })

  it('reveals the value in plain text when the toggle is clicked', async () => {
    const wrapper = mountField({ modelValue: 'Secr3t!12345' })
    await wrapper.find('[data-test="pwd-toggle-visibility"]').trigger('click')
    expect(wrapper.find('input').attributes('type')).toBe('text')
    expect(wrapper.find('input').element.value).toBe('Secr3t!12345')
  })

  it('masks it again on a second click', async () => {
    const wrapper = mountField()
    const toggle = wrapper.find('[data-test="pwd-toggle-visibility"]')
    await toggle.trigger('click')
    await toggle.trigger('click')
    expect(wrapper.find('input').attributes('type')).toBe('password')
  })

  it('emits update:modelValue on input', async () => {
    const wrapper = mountField()
    await wrapper.find('input').setValue('NewValue123!')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['NewValue123!'])
  })

  it('forwards disabled to the input', () => {
    const wrapper = mountField({ disabled: true })
    expect(wrapper.find('input').attributes('disabled')).toBeDefined()
  })
})
