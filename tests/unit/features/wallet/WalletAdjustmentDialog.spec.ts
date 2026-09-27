import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import WalletAdjustmentDialog from '@/features/wallet/components/WalletAdjustmentDialog.vue'
import type { AdminWalletAccount } from '@/features/wallet/types/index'

const EUR: AdminWalletAccount = { currency: 'EUR', balance: 12.5, refundEligibleAmount: 10, frozen: false }
const XOF: AdminWalletAccount = { currency: 'XOF', balance: 5000, refundEligibleAmount: 0, frozen: false }
const FROZEN_EUR: AdminWalletAccount = { ...EUR, frozen: true }
const REASON = 'Geste commercial après incident de livraison'

function mountDialog(accounts: AdminWalletAccount[] = [EUR, XOF], extra: Record<string, unknown> = {}) {
  return mount(WalletAdjustmentDialog, { props: { open: true, accounts, ...extra } })
}

async function fill(w: ReturnType<typeof mountDialog>, amount: string, reason = REASON) {
  await w.find('[data-test="adj-amount"]').setValue(amount)
  await w.find('[data-test="adj-reason"]').setValue(reason)
}

const continueBtn = (w: ReturnType<typeof mountDialog>) => w.find('[data-test="adj-continue"]')

describe('WalletAdjustmentDialog', () => {
  it('ne rend rien fermé', () => {
    const w = mount(WalletAdjustmentDialog, { props: { open: false, accounts: [EUR] } })
    expect(w.find('[data-test="adj-dialog"]').exists()).toBe(false)
  })

  it('crédit : propose les comptes existants ET les devises supportées sans compte', () => {
    const w = mountDialog([EUR])
    const options = w.findAll('[data-test="adj-currency"] option').map((o) => o.attributes('value'))
    expect(options[0]).toBe('EUR')
    expect(options).toContain('XAF')
    expect(options).toContain('XOF')
    expect(w.find('[data-test="adj-currency"]').text()).toContain('sans compte')
  })

  it('débit : seulement les comptes existants, et la devise sans compte est abandonnée', async () => {
    const w = mountDialog([EUR])
    await w.find('[data-test="adj-currency"]').setValue('XAF')
    await w.find('[data-test="adj-direction-debit"]').trigger('click')
    const options = w.findAll('[data-test="adj-currency"] option').map((o) => o.attributes('value'))
    expect(options).toEqual(['EUR'])
    expect((w.find('[data-test="adj-currency"]').element as HTMLSelectElement).value).toBe('EUR')
  })

  it('compteur du motif et validation 10 à 500 caractères', async () => {
    const w = mountDialog()
    await fill(w, '5', 'trop court')
    expect(w.find('[data-test="adj-reason-count"]').text()).toContain('10 / 500')
    expect(continueBtn(w).attributes('disabled')).toBeUndefined()
    await w.find('[data-test="adj-reason"]').setValue('court')
    expect(w.find('[data-test="adj-reason-count"]').text()).toContain('5 / 500')
    expect(w.find('[data-test="adj-reason-hint"]').text()).toMatch(/10 caractères/)
    expect(continueBtn(w).attributes('disabled')).toBeDefined()
    await w.find('[data-test="adj-reason"]').setValue('a'.repeat(501))
    expect(continueBtn(w).attributes('disabled')).toBeDefined()
    expect(w.find('[data-test="adj-reason-hint"]').text()).toMatch(/500 caractères/)
  })

  it('récapitulatif solde actuel vers solde après, pour un crédit', async () => {
    const w = mountDialog()
    await fill(w, '7,5')
    const recap = w.find('[data-test="adj-recap"]').text()
    expect(recap).toContain('12,50 EUR')
    expect(recap).toContain('20,00 EUR')
  })

  it('récapitulatif d’un crédit dans une devise sans compte : part de zéro', async () => {
    const w = mountDialog([EUR])
    await w.find('[data-test="adj-currency"]').setValue('XAF')
    await fill(w, '1000')
    const recap = w.find('[data-test="adj-recap"]').text()
    expect(recap).toContain('0,00 XAF')
    expect(recap).toContain('1\u202f000,00 XAF')
  })

  it('débit supérieur au solde : bloqué côté client avec explication', async () => {
    const w = mountDialog()
    await w.find('[data-test="adj-direction-debit"]').trigger('click')
    await fill(w, '20')
    expect(w.find('[data-test="adj-debit-exceeds"]').exists()).toBe(true)
    expect(continueBtn(w).attributes('disabled')).toBeDefined()
    await w.find('[data-test="adj-amount"]').setValue('12.5')
    expect(w.find('[data-test="adj-debit-exceeds"]').exists()).toBe(false)
    expect(continueBtn(w).attributes('disabled')).toBeUndefined()
    expect(w.find('[data-test="adj-recap"]').text()).toContain('0,00 EUR')
  })

  it('montant invalide (nul, négatif, plus de deux décimales, texte) : bouton désactivé', async () => {
    const w = mountDialog()
    for (const v of ['0', '-3', '1.234', 'abc', '']) {
      await fill(w, v)
      expect(continueBtn(w).attributes('disabled'), v).toBeDefined()
    }
    expect(w.find('[data-test="adj-recap"]').exists()).toBe(false)
  })

  it('portefeuille gelé : bouton désactivé avec explication', async () => {
    const w = mountDialog([FROZEN_EUR, { ...XOF, frozen: true }])
    await fill(w, '5')
    expect(w.find('[data-test="adj-frozen"]').text()).toMatch(/gelé/i)
    expect(continueBtn(w).attributes('disabled')).toBeDefined()
    await w.find('[data-test="adj-currency"]').setValue('XAF')
    expect(w.find('[data-test="adj-frozen"]').exists()).toBe(false)
    expect(continueBtn(w).attributes('disabled')).toBeUndefined()
  })

  it('confirmation explicite : un écran de vérification avant l’envoi', async () => {
    const w = mountDialog()
    await fill(w, '7,5')
    await continueBtn(w).trigger('click')
    expect(w.emitted('submit')).toBeUndefined()
    const summary = w.find('[data-test="adj-confirm-summary"]').text()
    expect(summary).toContain('Créditer')
    expect(summary).toContain('7,50 EUR')
    expect(summary).toContain(REASON)
    await w.find('[data-test="adj-confirm"]').trigger('click')
    expect(w.emitted('submit')![0]).toEqual([{ currency: 'EUR', direction: 'CREDIT', amount: 7.5, reason: REASON }])
  })

  it('le motif est envoyé sans espaces superflus, un débit porte DEBIT', async () => {
    const w = mountDialog()
    await w.find('[data-test="adj-direction-debit"]').trigger('click')
    await fill(w, '2', `  ${REASON}  `)
    await continueBtn(w).trigger('click')
    expect(w.find('[data-test="adj-confirm-summary"]').text()).toContain('Débiter')
    await w.find('[data-test="adj-confirm"]').trigger('click')
    expect(w.emitted('submit')![0]).toEqual([{ currency: 'EUR', direction: 'DEBIT', amount: 2, reason: REASON }])
  })

  it('retour au formulaire depuis la confirmation, saisie conservée', async () => {
    const w = mountDialog()
    await fill(w, '3')
    await continueBtn(w).trigger('click')
    await w.find('[data-test="adj-back"]').trigger('click')
    expect((w.find('[data-test="adj-amount"]').element as HTMLInputElement).value).toBe('3')
  })

  it('affiche l’erreur transmise et permet une nouvelle tentative', async () => {
    const w = mountDialog()
    await fill(w, '3')
    await continueBtn(w).trigger('click')
    await w.setProps({ error: 'Plafond de 500 € dépassé' })
    expect(w.find('[data-test="adj-error"]').text()).toBe('Plafond de 500 € dépassé')
    await w.find('[data-test="adj-confirm"]').trigger('click')
    expect(w.emitted('submit')).toHaveLength(1)
  })

  it('pendant l’envoi, la confirmation est désactivée', async () => {
    const w = mountDialog()
    await fill(w, '3')
    await continueBtn(w).trigger('click')
    await w.setProps({ busy: true })
    expect(w.find('[data-test="adj-confirm"]').attributes('disabled')).toBeDefined()
    expect(w.find('[data-test="adj-confirm"]').text()).toContain('En cours')
  })

  it('annuler émet cancel, depuis le formulaire comme depuis la confirmation', async () => {
    const w = mountDialog()
    await w.find('[data-test="adj-cancel"]').trigger('click')
    await fill(w, '3')
    await continueBtn(w).trigger('click')
    await w.find('[data-test="adj-cancel"]').trigger('click')
    expect(w.emitted('cancel')).toHaveLength(2)
  })

  it('une réouverture remet le formulaire à zéro', async () => {
    const w = mountDialog()
    await fill(w, '3')
    await continueBtn(w).trigger('click')
    await w.setProps({ open: false })
    await w.setProps({ open: true })
    expect(w.find('[data-test="adj-amount"]').exists()).toBe(true)
    expect((w.find('[data-test="adj-amount"]').element as HTMLInputElement).value).toBe('')
  })

  it('sans aucun compte, un crédit en EUR reste possible', async () => {
    const w = mountDialog([])
    expect((w.find('[data-test="adj-currency"]').element as HTMLSelectElement).value).toBe('EUR')
    await fill(w, '3')
    expect(continueBtn(w).attributes('disabled')).toBeUndefined()
  })

  it('présélectionne le premier compte non gelé', () => {
    const w = mountDialog([FROZEN_EUR, XOF])
    expect((w.find('[data-test="adj-currency"]').element as HTMLSelectElement).value).toBe('XOF')
  })

  it('aucun texte affiché ne contient de tiret cadratin', async () => {
    const w = mountDialog([FROZEN_EUR])
    await fill(w, '3')
    expect(w.text()).not.toContain('—')
  })
})
