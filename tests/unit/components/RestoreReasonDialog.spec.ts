import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RestoreReasonDialog from '@/components/ui/RestoreReasonDialog.vue'
import { RESTORE_REASON_MAX, RESTORE_REASON_MIN, restoreReasonValid } from '@/lib/restoreReason'

function mountDialog(props: Record<string, unknown> = {}) {
  return mount(RestoreReasonDialog, {
    props: { open: true, title: 'Restaurer', message: 'Le signalement redevient visible.', confirmLabel: 'Restaurer', ...props },
  })
}

describe('restoreReasonValid', () => {
  it('exige 10 à 500 caractères après trim', () => {
    expect(RESTORE_REASON_MIN).toBe(10)
    expect(RESTORE_REASON_MAX).toBe(500)
    expect(restoreReasonValid('  court   ')).toBe(false)
    expect(restoreReasonValid('supprimé par erreur')).toBe(true)
    expect(restoreReasonValid('x'.repeat(500))).toBe(true)
    expect(restoreReasonValid('x'.repeat(501))).toBe(false)
  })
})

describe('RestoreReasonDialog', () => {
  it('ne rend rien fermé', () => {
    expect(mountDialog({ open: false }).find('[data-test="restore-dialog"]').exists()).toBe(false)
  })

  it('bloque la confirmation sous 10 caractères et affiche le compteur', async () => {
    const w = mountDialog()
    const confirm = () => w.find('[data-test="restore-confirm"]').element as HTMLButtonElement
    expect(confirm().disabled).toBe(true)
    await w.find('[data-test="restore-reason"]').setValue('trop court')
    expect(confirm().disabled).toBe(false)
    await w.find('[data-test="restore-reason"]').setValue('court')
    expect(confirm().disabled).toBe(true)
    expect(w.find('[data-test="restore-reason-count"]').text()).toBe('5 / 500')
    expect(w.find('[data-test="restore-reason-hint"]').text()).toContain('10')
  })

  it('bloque au-delà de 500 caractères', async () => {
    const w = mountDialog()
    await w.find('[data-test="restore-reason"]').setValue('x'.repeat(501))
    expect((w.find('[data-test="restore-confirm"]').element as HTMLButtonElement).disabled).toBe(true)
    expect(w.find('[data-test="restore-reason-hint"]').text()).toContain('500')
  })

  it('émet le motif nettoyé', async () => {
    const w = mountDialog()
    await w.find('[data-test="restore-reason"]').setValue('  supprimé par erreur  ')
    await w.find('[data-test="restore-confirm"]').trigger('click')
    expect(w.emitted('confirm')![0]).toEqual(['supprimé par erreur'])
  })

  it('affiche la note complémentaire, l’erreur, et désactive pendant l’envoi', async () => {
    const w = mountDialog({ notice: 'La note moyenne sera recalculée.', error: 'Déjà restauré', busy: true })
    expect(w.find('[data-test="restore-notice"]').text()).toContain('recalculée')
    expect(w.find('[data-test="restore-error"]').text()).toBe('Déjà restauré')
    await w.find('[data-test="restore-reason"]').setValue('supprimé par erreur')
    expect((w.find('[data-test="restore-confirm"]').element as HTMLButtonElement).disabled).toBe(true)
    expect(w.find('[data-test="restore-confirm"]').text()).toContain('En cours')
  })

  it('annuler émet cancel et une réouverture vide le motif', async () => {
    const w = mountDialog()
    await w.find('[data-test="restore-reason"]').setValue('supprimé par erreur')
    await w.find('[data-test="restore-cancel"]').trigger('click')
    expect(w.emitted('cancel')).toBeTruthy()
    await w.setProps({ open: false })
    await w.setProps({ open: true })
    expect((w.find('[data-test="restore-reason"]').element as HTMLTextAreaElement).value).toBe('')
  })

  it('n’affiche jamais de tiret cadratin', () => {
    expect(mountDialog({ notice: 'Note' }).text()).not.toContain('—')
  })
})
