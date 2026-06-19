import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ConfirmActionDialog from '@/components/ui/ConfirmActionDialog.vue'

describe('ConfirmActionDialog', () => {
  it('does not render content when closed', () => {
    const w = mount(ConfirmActionDialog, { props: { open: false, title: 'T', message: 'M', confirmLabel: 'OK' } })
    expect(w.find('[data-test="confirm"]').exists()).toBe(false)
  })
  it('emits confirm with the reason when requireReason', async () => {
    const w = mount(ConfirmActionDialog, { props: { open: true, title: 'T', message: 'M', confirmLabel: 'OK', requireReason: true } })
    await w.find('[data-test="reason"]').setValue('fraude')
    await w.find('[data-test="confirm"]').trigger('click')
    expect(w.emitted('confirm')![0]).toEqual(['fraude'])
  })
  it('confirm disabled until reason entered when requireReason', async () => {
    const w = mount(ConfirmActionDialog, { props: { open: true, title: 'T', message: 'M', confirmLabel: 'OK', requireReason: true } })
    expect(w.find('[data-test="confirm"]').attributes('disabled')).toBeDefined()
  })
  it('emits cancel', async () => {
    const w = mount(ConfirmActionDialog, { props: { open: true, title: 'T', message: 'M', confirmLabel: 'OK' } })
    await w.find('[data-test="cancel"]').trigger('click')
    expect(w.emitted('cancel')).toBeTruthy()
  })
})
