import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PayoutOverrideDialog from '@/features/payments/components/PayoutOverrideDialog.vue'

function mountDialog(props: Record<string, unknown> = {}) {
  return mount(PayoutOverrideDialog, { props: { open: true, action: 'release', ...props } })
}

describe('PayoutOverrideDialog', () => {
  it('fermé : rien n’est rendu', () => {
    const w = mountDialog({ open: false })
    expect(w.find('[data-test="override-dialog"]').exists()).toBe(false)
  })

  it('avertit clairement, selon le motif de blocage du voyageur', () => {
    const banned = mountDialog({ holdReasons: ['BANNED'] })
    expect(banned.find('[data-test="override-warning"]').text()).toContain('banni')
    const revoked = mountDialog({ holdReasons: ['KYC_REVOKED'] })
    expect(revoked.find('[data-test="override-warning"]').text()).toContain('a été révoquée')
    const unknown = mountDialog()
    expect(unknown.find('[data-test="override-warning"]').text()).toContain('bloqué')
  })

  it('litige bancaire (blocker DISPUTED) : avertissement dédié', () => {
    const w = mountDialog({ blockers: ['DISPUTED'] })
    expect(w.find('[data-test="override-warning"]').text()).toContain('litige bancaire')
  })

  it('titres distincts pour le déblocage et la relance', () => {
    expect(mountDialog().find('h2').text()).toContain('Payer le voyageur')
    expect(mountDialog({ action: 'retry-payout' }).find('h2').text()).toContain('Relancer le versement')
  })

  it('valide : case cochée ET motif de 10 à 500 caractères', async () => {
    const w = mountDialog()
    const submit = () => w.find('[data-test="override-submit"]')
    expect(submit().attributes('disabled')).toBeDefined()

    await w.find('[data-test="override-reason"]').setValue('Colis livré et contrôlé')
    expect(submit().attributes('disabled')).toBeDefined()

    await w.find('[data-test="override-checked"]').setValue(true)
    expect(submit().attributes('disabled')).toBeUndefined()

    await w.find('[data-test="override-reason"]').setValue('trop court')
    expect(w.find('[data-test="override-reason-count"]').text()).toBe('10 / 500')
    expect(submit().attributes('disabled')).toBeUndefined()

    await w.find('[data-test="override-reason"]').setValue('court')
    expect(submit().attributes('disabled')).toBeDefined()
    expect(w.find('[data-test="override-reason-hint"]').text()).toContain('10 caractères')

    await w.find('[data-test="override-reason"]').setValue('a'.repeat(501))
    expect(submit().attributes('disabled')).toBeDefined()
    expect(w.find('[data-test="override-reason-hint"]').text()).toContain('500')
  })

  it('émet la dérogation avec le motif nettoyé', async () => {
    const w = mountDialog()
    await w.find('[data-test="override-checked"]').setValue(true)
    await w.find('[data-test="override-reason"]').setValue('   Colis livré et contrôlé   ')
    await w.find('[data-test="override-submit"]').trigger('click')
    expect(w.emitted('confirm')?.[0]).toEqual([{ overrideHold: true, overrideReason: 'Colis livré et contrôlé' }])
  })

  it('n’émet rien tant que le formulaire est invalide', async () => {
    const w = mountDialog()
    await w.find('[data-test="override-submit"]').trigger('click')
    expect(w.emitted('confirm')).toBeUndefined()
  })

  it('occupé : bouton désactivé et libellé d’attente', async () => {
    const w = mountDialog({ busy: true })
    await w.find('[data-test="override-checked"]').setValue(true)
    await w.find('[data-test="override-reason"]').setValue('Colis livré et contrôlé')
    expect(w.find('[data-test="override-submit"]').attributes('disabled')).toBeDefined()
    expect(w.find('[data-test="override-submit"]').text()).toContain('En cours')
  })

  it('annuler émet cancel ; la saisie est remise à zéro à la réouverture', async () => {
    const w = mountDialog()
    await w.find('[data-test="override-checked"]').setValue(true)
    await w.find('[data-test="override-reason"]').setValue('Colis livré et contrôlé')
    await w.find('[data-test="override-cancel"]').trigger('click')
    expect(w.emitted('cancel')).toBeTruthy()
    await w.setProps({ open: false })
    await w.setProps({ open: true })
    expect((w.find('[data-test="override-reason"]').element as HTMLTextAreaElement).value).toBe('')
    expect((w.find('[data-test="override-checked"]').element as HTMLInputElement).checked).toBe(false)
  })

  it('aucun tiret cadratin dans le texte affiché', () => {
    for (const props of [{}, { blockers: ['DISPUTED', 'BENEFICIARY_HELD'] }, { holdReasons: ['BANNED'], action: 'retry-payout' }]) {
      expect(mountDialog(props).text()).not.toContain('—')
    }
  })
})
