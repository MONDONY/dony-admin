import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import CreateAdminDialog from '@/features/admin-accounts/components/CreateAdminDialog.vue'

describe('CreateAdminDialog', () => {
  it('never offers SUPER_ADMIN in the creation role selector', () => {
    const wrapper = mount(CreateAdminDialog)
    expect(wrapper.find('select').text()).not.toContain('SUPER_ADMIN')
    expect(wrapper.find('select').text()).toContain('ADMIN')
    expect(wrapper.find('select').text()).toContain('SUPPORT')
  })

  it('disables submit when the email is invalid', () => {
    const w = mount(CreateAdminDialog)
    expect((w.find('[data-test="create-admin-submit"]').element as HTMLButtonElement).disabled).toBe(true)
  })

  it('emits submit with the entered email and role', async () => {
    const w = mount(CreateAdminDialog)
    await w.find('[data-test="create-admin-email"]').setValue('new-admin@dony.app')
    await w.find('[data-test="create-admin-role"]').setValue('SUPPORT')
    expect((w.find('[data-test="create-admin-submit"]').element as HTMLButtonElement).disabled).toBe(false)
    await w.find('[data-test="create-admin-submit"]').trigger('submit')
    expect(w.emitted('submit')![0]).toEqual(['new-admin@dony.app', 'SUPPORT'])
  })

  it('emits cancel', async () => {
    const w = mount(CreateAdminDialog)
    await w.find('[data-test="create-admin-cancel"]').trigger('click')
    expect(w.emitted('cancel')).toBeTruthy()
  })
})
