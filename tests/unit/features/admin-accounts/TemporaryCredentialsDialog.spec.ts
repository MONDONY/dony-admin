import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import TemporaryCredentialsDialog from '@/features/admin-accounts/components/TemporaryCredentialsDialog.vue'
import type { TemporaryCredentials } from '@/features/admin-accounts/types/index'

const credentials: TemporaryCredentials = { email: 'new-admin@yadony.com', temporaryPassword: 'Tmp-Str0ng!23' }

describe('TemporaryCredentialsDialog', () => {
  it('displays the email and temporary password', () => {
    const w = mount(TemporaryCredentialsDialog, { props: { credentials } })
    expect(w.text()).toContain(credentials.email)
    expect(w.text()).toContain(credentials.temporaryPassword)
  })

  it('copies the password to the clipboard when the copy button is clicked', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const w = mount(TemporaryCredentialsDialog, { props: { credentials } })
    await w.find('[data-test="credentials-copy"]').trigger('click')
    expect(writeText).toHaveBeenCalledWith(credentials.temporaryPassword)
  })

  it('emits close when the close button is clicked', async () => {
    const w = mount(TemporaryCredentialsDialog, { props: { credentials } })
    await w.find('[data-test="credentials-close"]').trigger('click')
    expect(w.emitted('close')).toBeTruthy()
  })
})
