import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import KycDecisionDialog from '@/features/kyc/components/KycDecisionDialog.vue'

const LONG = 'Pièces contrôlées chez Didit, conformes.'
const LONG_REVOKE = 'Fraude confirmée par le fournisseur après contrôle.'

function mountDialog(props: Record<string, unknown>) {
  return mount(KycDecisionDialog, { props: { open: true, userName: 'Awa Diop', ...props } })
}
const submit = (w: ReturnType<typeof mountDialog>) => w.find('[data-test="kyc-dialog-submit"]')

describe('KycDecisionDialog', () => {
  it('fermé : rien n’est rendu', () => {
    const w = mount(KycDecisionDialog, { props: { open: false, mode: 'approve', userName: 'Awa' } })
    expect(w.find('[data-test="kyc-dialog"]').exists()).toBe(false)
  })

  describe('valider', () => {
    it('rappelle le contrôle chez le fournisseur et exige la case cochée et un motif de 10 caractères', async () => {
      const w = mountDialog({ mode: 'approve', providerSessionUrl: 'https://business.didit.me/s/1' })
      expect(w.find('[data-test="kyc-approve-reminder"]').text()).toContain('fournisseur')
      const link = w.find('[data-test="kyc-dialog-provider-link"]')
      expect(link.attributes('target')).toBe('_blank')
      expect(link.attributes('rel')).toBe('noopener noreferrer')
      expect(submit(w).attributes('disabled')).toBeDefined()
      await w.find('[data-test="kyc-reason"]').setValue('court')
      await w.find('[data-test="kyc-checked"]').setValue(true)
      expect(w.find('[data-test="kyc-reason-hint"]').text()).toContain('10')
      expect(submit(w).attributes('disabled')).toBeDefined()
      await w.find('[data-test="kyc-reason"]').setValue(LONG)
      expect(submit(w).attributes('disabled')).toBeUndefined()
      await w.find('[data-test="kyc-checked"]').setValue(false)
      expect(submit(w).attributes('disabled')).toBeDefined()
      await w.find('[data-test="kyc-checked"]').setValue(true)
      await submit(w).trigger('click')
      expect(w.emitted('submit')![0]).toEqual([{ reason: LONG }])
    })

    it('sans lien fournisseur, aucun lien affiché', () => {
      const w = mountDialog({ mode: 'approve', providerSessionUrl: null })
      expect(w.find('[data-test="kyc-dialog-provider-link"]').exists()).toBe(false)
    })
  })

  describe('refuser', () => {
    it('exige un code, prévient que le motif reste interne et montre le message envoyé', async () => {
      const w = mountDialog({ mode: 'reject' })
      expect(w.text()).toContain('n’est pas envoyé à l’utilisateur')
      await w.find('[data-test="kyc-reason"]').setValue(LONG)
      expect(submit(w).attributes('disabled')).toBeDefined()
      await w.find('[data-test="kyc-code"]').setValue('document_expired')
      expect(w.find('[data-test="kyc-code-user-message"]').text()).toContain('expirée')
      await submit(w).trigger('click')
      expect(w.emitted('submit')![0]).toEqual([{ code: 'document_expired', reason: LONG }])
    })

    it('un motif de plus de 1000 caractères bloque l’envoi', async () => {
      const w = mountDialog({ mode: 'reject' })
      await w.find('[data-test="kyc-code"]').setValue('other')
      await w.find('[data-test="kyc-reason"]').setValue('x'.repeat(1001))
      expect(w.find('[data-test="kyc-reason-hint"]').text()).toContain('1000')
      expect(submit(w).attributes('disabled')).toBeDefined()
    })
  })

  describe('révoquer', () => {
    it('avertit fortement et exige un motif de 20 caractères et la ressaisie exacte du nom', async () => {
      const w = mountDialog({ mode: 'revoke' })
      const warning = w.find('[data-test="kyc-revoke-warning"]').text()
      expect(warning).toContain('publications')
      expect(warning).toContain('versements')
      expect(warning).toContain('ne sont pas annulés')
      await w.find('[data-test="kyc-code"]').setValue('suspected_fraud')
      await w.find('[data-test="kyc-reason"]').setValue('dix-neuf caractères')
      await w.find('[data-test="kyc-confirm-name"]').setValue('Awa Diop')
      expect(submit(w).attributes('disabled')).toBeDefined()
      await w.find('[data-test="kyc-reason"]').setValue(LONG_REVOKE)
      await w.find('[data-test="kyc-confirm-name"]').setValue('awa diop')
      expect(submit(w).attributes('disabled')).toBeDefined()
      await w.find('[data-test="kyc-confirm-name"]').setValue(' Awa Diop ')
      expect(submit(w).attributes('disabled')).toBeUndefined()
      await submit(w).trigger('click')
      expect(w.emitted('submit')![0]).toEqual([{ code: 'suspected_fraud', reason: LONG_REVOKE }])
    })
  })

  it('affiche l’erreur, désactive l’envoi pendant le traitement et annule', async () => {
    const w = mountDialog({ mode: 'reject', error: 'Code de refus inconnu', busy: true })
    expect(w.find('[data-test="kyc-dialog-error"]').text()).toBe('Code de refus inconnu')
    expect(submit(w).text()).toContain('En cours')
    expect(submit(w).attributes('disabled')).toBeDefined()
    await w.find('[data-test="kyc-dialog-cancel"]').trigger('click')
    expect(w.emitted('cancel')).toHaveLength(1)
  })

  it('réinitialise la saisie à chaque ouverture', async () => {
    const w = mountDialog({ mode: 'reject' })
    await w.find('[data-test="kyc-reason"]').setValue(LONG)
    await w.setProps({ open: false })
    await w.setProps({ open: true })
    expect((w.find('[data-test="kyc-reason"]').element as HTMLTextAreaElement).value).toBe('')
  })
})
