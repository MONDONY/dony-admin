import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SupportTemplatesDialog from '@/features/support/components/SupportTemplatesDialog.vue'

const t = (id: string, label: string) => ({ id, label, content: `Texte ${label}`, sortOrder: 10 })
function mountDialog(props: Record<string, unknown> = {}) {
  return mount(SupportTemplatesDialog, { props: { open: true, templates: [t('a', 'Merci'), t('b', 'Clôture')], ...props } })
}

describe('SupportTemplatesDialog', () => {
  it('fermée : rien n’est rendu', () => {
    expect(mountDialog({ open: false }).find('[data-test="templates-dialog"]').exists()).toBe(false)
  })

  it('liste les réponses avec modifier et supprimer, ou invite à ajouter la première', () => {
    const w = mountDialog()
    expect(w.get('[data-test="template-a"]').text()).toContain('Merci')
    expect(w.get('[data-test="template-a"]').text()).toContain('Texte Merci')
    expect(mountDialog({ templates: [] }).get('[data-test="templates-empty"]').text()).toContain('ajoutez la première')
  })

  it('nouvelle réponse : libellé et texte obligatoires, puis création nettoyée', async () => {
    const w = mountDialog()
    await w.get('[data-test="template-new"]').trigger('click')
    expect(w.get('[data-test="template-save"]').attributes('disabled')).toBeDefined()
    await w.get('[data-test="template-label"]').setValue('  Merci  ')
    expect(w.get('[data-test="template-problem"]').text()).toContain('obligatoires')
    await w.get('[data-test="template-content"]').setValue('  Merci de votre patience.  ')
    await w.get('[data-test="template-save"]').trigger('click')
    expect(w.emitted('create')![0]).toEqual(['Merci', 'Merci de votre patience.'])
  })

  it('modifier : formulaire prérempli, annulable, puis mise à jour', async () => {
    const w = mountDialog()
    await w.get('[data-test="template-edit-b"]').trigger('click')
    expect((w.get('[data-test="template-label"]').element as HTMLInputElement).value).toBe('Clôture')
    await w.get('[data-test="template-cancel"]').trigger('click')
    expect(w.find('[data-test="template-label"]').exists()).toBe(false)
    await w.get('[data-test="template-edit-b"]').trigger('click')
    await w.get('[data-test="template-content"]').setValue('Nouveau texte')
    await w.get('[data-test="template-save"]').trigger('click')
    expect(w.emitted('update')![0]).toEqual(['b', 'Clôture', 'Nouveau texte'])
  })

  it('supprimer en deux temps', async () => {
    const w = mountDialog()
    await w.get('[data-test="template-remove-a"]').trigger('click')
    expect(w.emitted('remove')).toBeUndefined()
    expect(w.get('[data-test="template-remove-a"]').text()).toBe('Confirmer la suppression')
    await w.get('[data-test="template-remove-a"]').trigger('click')
    expect(w.emitted('remove')![0]).toEqual(['a'])
  })

  it('libellé ou texte trop longs : message, enregistrement impossible', async () => {
    const w = mountDialog()
    await w.get('[data-test="template-new"]').trigger('click')
    await w.get('[data-test="template-label"]').setValue('x'.repeat(60))
    await w.get('[data-test="template-content"]').setValue('ok')
    expect(w.get('[data-test="template-save"]').attributes('disabled')).toBeUndefined()
    await w.setProps({ busy: true })
    expect(w.get('[data-test="template-save"]').text()).toBe('Enregistrement…')
    expect(w.get('[data-test="template-save"]').attributes('disabled')).toBeDefined()
  })

  it('une liste relue après un geste réussi referme le formulaire ; un refus le laisse ouvert avec sa phrase', async () => {
    const w = mountDialog()
    await w.get('[data-test="template-new"]').trigger('click')
    await w.get('[data-test="template-label"]').setValue('Neuf')
    await w.get('[data-test="template-content"]').setValue('Texte')
    await w.setProps({ error: 'Le libellé est obligatoire.' })
    await w.setProps({ templates: [t('a', 'Merci')] })
    expect(w.get('[data-test="templates-error"]').text()).toBe('Le libellé est obligatoire.')
    expect(w.find('[data-test="template-label"]').exists()).toBe(true)
    await w.setProps({ error: null })
    await w.setProps({ templates: [t('a', 'Merci'), t('c', 'Neuf')] })
    expect(w.find('[data-test="template-label"]').exists()).toBe(false)
  })

  it('fermer : bouton, fond ou Échap', async () => {
    const w = mountDialog()
    await w.get('[data-test="templates-close"]').trigger('click')
    expect(w.emitted('close')).toHaveLength(1)
    await w.get('.fixed').trigger('click')
    expect(w.emitted('close')).toHaveLength(2)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(w.emitted('close')!.length).toBeGreaterThanOrEqual(3)
  })

  it('la fermeture remet le formulaire à zéro', async () => {
    const w = mountDialog()
    await w.get('[data-test="template-new"]').trigger('click')
    await w.setProps({ open: false })
    await w.setProps({ open: true })
    expect(w.find('[data-test="template-label"]').exists()).toBe(false)
  })
})
