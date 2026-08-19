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

  it('ne montre pas de saisie de contrôle sans confirmationPhrase', () => {
    const w = mount(ConfirmActionDialog, { props: { open: true, title: 'T', message: 'M', confirmLabel: 'OK' } })
    expect(w.find('[data-test="confirmation-input"]').exists()).toBe(false)
  })

  it('désactive la confirmation tant que la saisie ne correspond pas exactement', async () => {
    const w = mount(ConfirmActionDialog, {
      props: { open: true, title: 'T', message: 'M', confirmLabel: 'Supprimer', confirmationPhrase: 'Jean Dupont' },
    })
    expect(w.find('[data-test="confirm"]').attributes('disabled')).toBeDefined()
    await w.find('[data-test="confirmation-input"]').setValue('Jean Dupon')
    expect(w.find('[data-test="confirm"]').attributes('disabled')).toBeDefined()
  })

  it('active la confirmation quand la saisie correspond, espaces autour ignorés', async () => {
    const w = mount(ConfirmActionDialog, {
      props: { open: true, title: 'T', message: 'M', confirmLabel: 'Supprimer', confirmationPhrase: 'Jean Dupont' },
    })
    await w.find('[data-test="confirmation-input"]').setValue('  Jean Dupont  ')
    expect(w.find('[data-test="confirm"]').attributes('disabled')).toBeUndefined()
  })

  it('exige motif ET saisie de contrôle quand les deux sont demandés', async () => {
    const w = mount(ConfirmActionDialog, {
      props: {
        open: true, title: 'T', message: 'M', confirmLabel: 'Supprimer',
        requireReason: true, confirmationPhrase: 'Jean Dupont',
      },
    })
    await w.find('[data-test="confirmation-input"]').setValue('Jean Dupont')
    expect(w.find('[data-test="confirm"]').attributes('disabled')).toBeDefined()
    await w.find('[data-test="reason"]').setValue('demande RGPD')
    expect(w.find('[data-test="confirm"]').attributes('disabled')).toBeUndefined()
    await w.find('[data-test="confirm"]').trigger('click')
    expect(w.emitted('confirm')![0]).toEqual(['demande RGPD'])
  })

  it('réinitialise motif et saisie de contrôle à chaque réouverture', async () => {
    const w = mount(ConfirmActionDialog, {
      props: {
        open: true, title: 'T', message: 'M', confirmLabel: 'Supprimer',
        requireReason: true, confirmationPhrase: 'Jean Dupont',
      },
    })
    await w.find('[data-test="confirmation-input"]').setValue('Jean Dupont')
    await w.find('[data-test="reason"]').setValue('motif')
    await w.setProps({ open: false })
    await w.setProps({ open: true })
    expect((w.find('[data-test="confirmation-input"]').element as HTMLInputElement).value).toBe('')
    expect(w.find('[data-test="confirm"]').attributes('disabled')).toBeDefined()
  })

  it('affiche le libellé de contrôle personnalisé', () => {
    const w = mount(ConfirmActionDialog, {
      props: {
        open: true, title: 'T', message: 'M', confirmLabel: 'Supprimer',
        confirmationPhrase: 'Jean Dupont', confirmationLabel: 'Saisissez le nom du compte',
      },
    })
    expect(w.text()).toContain('Saisissez le nom du compte')
  })
})
