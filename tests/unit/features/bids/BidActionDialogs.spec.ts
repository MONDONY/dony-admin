import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BidCancelDialog from '@/features/bids/components/BidCancelDialog.vue'
import BidDisputeDialog from '@/features/bids/components/BidDisputeDialog.vue'

const EFFECT = 'L’expéditeur sera remboursé de 48,00 EUR ; aucun versement au voyageur.'

describe('BidCancelDialog', () => {
  const mountDialog = (props: Record<string, unknown> = {}) =>
    mount(BidCancelDialog, { props: { open: true, moneyEffect: EFFECT, ...props } })

  it('fermé : rien', () => {
    expect(mountDialog({ open: false }).find('[data-test="cancel-dialog"]').exists()).toBe(false)
  })

  it('motif et confirmation explicite obligatoires ; note exigée avec « Autre »', async () => {
    const w = mountDialog()
    expect(w.find('[data-test="cancel-money-effect"]').text()).toBe(EFFECT)
    const confirm = w.find('[data-test="cancel-confirm"]')
    expect(confirm.attributes('disabled')).toBeDefined()
    await w.find('[data-test="cancel-reason"]').setValue('OTHER')
    await w.find('[data-test="cancel-ack"]').setValue(true)
    expect(confirm.attributes('disabled')).toBeDefined()
    expect(w.find('[data-test="cancel-note-hint"]').text()).toContain('Obligatoire avec « Autre »')
    await w.find('[data-test="cancel-note"]').setValue('  Doublon signalé par les deux  ')
    expect(confirm.attributes('disabled')).toBeUndefined()
    await confirm.trigger('click')
    expect(w.emitted('confirm')![0]).toEqual(['OTHER', 'Doublon signalé par les deux'])
  })

  it('motif catalogué : note facultative ; note trop longue refusée', async () => {
    const w = mountDialog()
    await w.find('[data-test="cancel-reason"]').setValue('DUPLICATE')
    await w.find('[data-test="cancel-ack"]').setValue(true)
    expect(w.find('[data-test="cancel-confirm"]').attributes('disabled')).toBeUndefined()
    await w.find('[data-test="cancel-note"]').setValue('x'.repeat(1001))
    expect(w.find('[data-test="cancel-confirm"]').attributes('disabled')).toBeDefined()
    expect(w.find('[data-test="cancel-note-hint"]').text()).toContain('1000 caractères au plus')
  })

  it('en cours : bouton occupé ; erreur affichée ; colis chez le voyageur signalé ; retour', async () => {
    const w = mountDialog({ busy: true, error: 'Colis déjà livré', withTraveler: true })
    expect(w.find('[data-test="cancel-confirm"]').text()).toBe('Annulation…')
    expect(w.find('[data-test="cancel-error"]').text()).toBe('Colis déjà livré')
    expect(w.find('[data-test="cancel-with-traveler"]').exists()).toBe(true)
    await w.setProps({ busy: false })
    await w.find('[data-test="cancel-dismiss"]').trigger('click')
    expect(w.emitted('cancel')).toHaveLength(1)
  })

  it('rouvert : formulaire vidé', async () => {
    const w = mountDialog()
    await w.find('[data-test="cancel-reason"]').setValue('DUPLICATE')
    await w.setProps({ open: false })
    await w.setProps({ open: true })
    expect((w.find('[data-test="cancel-reason"]').element as HTMLSelectElement).value).toBe('')
  })
})

describe('BidDisputeDialog', () => {
  const mountDialog = (props: Record<string, unknown> = {}) =>
    mount(BidDisputeDialog, { props: { open: true, moneyEffect: 'Versement gelé', senderName: 'Awa', travelerName: 'Moussa', ...props } })

  it('partie, motif, description (10 caractères) et confirmation obligatoires', async () => {
    const w = mountDialog()
    expect(w.text()).toContain('Expéditeur (Awa)')
    expect(w.text()).toContain('Voyageur (Moussa)')
    const confirm = w.find('[data-test="dispute-confirm"]')
    await w.find('[data-test="dispute-party-traveler"]').setValue(true)
    await w.find('[data-test="dispute-reason"]').setValue('PARCEL_LOST')
    await w.find('[data-test="dispute-description"]').setValue('court')
    await w.find('[data-test="dispute-ack"]').setValue(true)
    expect(confirm.attributes('disabled')).toBeDefined()
    expect(w.find('[data-test="dispute-hint"]').classes()).toContain('text-danger')
    await w.find('[data-test="dispute-description"]').setValue(' Colis introuvable depuis l’arrivée ')
    expect(confirm.attributes('disabled')).toBeUndefined()
    await confirm.trigger('click')
    expect(w.emitted('confirm')![0]).toEqual(['TRAVELER', 'PARCEL_LOST', 'Colis introuvable depuis l’arrivée'])
  })

  it('description trop longue, état occupé, erreur, retour, noms absents', async () => {
    const w = mountDialog({ senderName: null, travelerName: null })
    expect(w.text()).not.toContain('Expéditeur (')
    await w.find('[data-test="dispute-description"]').setValue('x'.repeat(2001))
    expect(w.find('[data-test="dispute-hint"]').text()).toContain('2000 caractères au plus')
    await w.setProps({ busy: true, error: 'Litige déjà ouvert' })
    expect(w.find('[data-test="dispute-confirm"]').text()).toBe('Ouverture…')
    expect(w.find('[data-test="dispute-error"]').text()).toBe('Litige déjà ouvert')
    await w.setProps({ busy: false })
    await w.find('[data-test="dispute-dismiss"]').trigger('click')
    expect(w.emitted('cancel')).toHaveLength(1)
  })
})
