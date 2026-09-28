import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import NoShowDetailPanel from '@/features/incidents/components/NoShowDetailPanel.vue'
import { seedAuth } from '~/tests/helpers/auth'
import { noShow, NuxtLink } from './noShowFixtures'
import type { AdminNoShow, NoShowDecisionResult } from '@/features/incidents/types/index'

const now = Date.parse('2026-09-28T10:00:00Z')
function mountPanel(row: AdminNoShow = noShow(), decide = vi.fn<(_d: 'confirm' | 'reject', _r: string) => Promise<NoShowDecisionResult>>()) {
  const w = mount(NoShowDetailPanel, { props: { row, decide, now }, global: { stubs: { NuxtLink } }, attachTo: document.body })
  return { w, decide }
}
const REASON = 'Absent au rendez-vous, confirmé par téléphone'

describe('NoShowDetailPanel', () => {
  beforeEach(() => seedAuth('ADMIN'))

  it('toutes les infos et les liens vers les parties et le colis', () => {
    const { w } = mountPanel()
    const text = w.text()
    expect(text).toContain('Le voyageur Awa D. déclare l’expéditeur Moussa K. absent à la remise')
    expect(text).toContain('Bamako → Abidjan, 15 sept.')
    expect(text).toContain('Sous séquestre')
    expect(text).toContain('Accepté')
    expect(text).toContain('reste 5 h')
    expect(w.find('[data-test="noshow-declarant-link"]').attributes('href')).toBe('/users?open=t1')
    expect(w.find('[data-test="noshow-accused-link"]').attributes('href')).toBe('/users?open=s1')
    expect(w.find('[data-test="noshow-bid-link"]').attributes('href')).toBe('/colis?open=89125c9c-aaaa-bbbb-cccc-dddddddddddd')
    expect(text).not.toContain('—')
    w.unmount()
  })

  it('partie sans compte (destinataire) : pas de lien ; litige lié : lien vers le litige', () => {
    const { w } = mountPanel(noShow({ scope: 'DELIVERY', accused: { role: 'RECIPIENT', name: 'Fatou S.' }, dispute: { id: 'd1', status: 'OPEN' }, status: 'CONFIRMED', canConfirm: false, canReject: false }))
    expect(w.find('[data-test="noshow-accused-link"]').exists()).toBe(false)
    expect(w.text()).toContain('Fatou S.')
    expect(w.find('[data-test="noshow-dispute-link"]').attributes('href')).toBe('/incidents?tab=disputes&open=d1')
    expect(w.find('[data-test="noshow-confirm"]').exists()).toBe(false)
    expect(w.find('[data-test="noshow-reject"]').exists()).toBe(false)
    w.unmount()
  })

  it('boutons selon canConfirm / canReject', () => {
    const { w } = mountPanel(noShow({ canReject: false }))
    expect(w.find('[data-test="noshow-confirm"]').exists()).toBe(true)
    expect(w.find('[data-test="noshow-reject"]').exists()).toBe(false)
    w.unmount()
  })

  it('SUPPORT (sans DISPUTE_RESOLVE) : aucune action', () => {
    seedAuth('SUPPORT')
    const { w } = mountPanel()
    expect(w.find('[data-test="noshow-confirm"]').exists()).toBe(false)
    expect(w.find('[data-test="noshow-reject"]').exists()).toBe(false)
    w.unmount()
  })

  it('confirmer au départ : effet expliqué, motif obligatoire 10 à 500 caractères avec compteur, En cours…, succès', async () => {
    let resolve!: (_r: NoShowDecisionResult) => void
    const decide = vi.fn(() => new Promise<NoShowDecisionResult>((r) => { resolve = r }))
    const { w } = mountPanel(noShow(), decide)
    await w.find('[data-test="noshow-confirm"]').trigger('click')
    const dialog = w.find('[data-test="noshow-dialog"]')
    expect(dialog.attributes('role')).toBe('dialog')
    expect(dialog.text()).toContain('Confirmer l’absence')
    expect(dialog.text()).toMatch(/colis est annulé et l’expéditeur remboursé/)
    expect(dialog.text()).toMatch(/commission est remboursée au voyageur/)
    const submit = w.find('[data-test="noshow-dialog-submit"]')
    expect(submit.attributes('disabled')).toBeDefined()
    await w.find('[data-test="noshow-dialog-reason"]').setValue('trop court')
    expect(w.find('[data-test="noshow-dialog-count"]').text()).toBe('10 / 500')
    expect(submit.attributes('disabled')).toBeUndefined()
    await w.find('[data-test="noshow-dialog-reason"]').setValue('         x')
    expect(submit.attributes('disabled')).toBeDefined()
    await w.find('[data-test="noshow-dialog-reason"]').setValue(REASON)
    await submit.trigger('click')
    expect(decide).toHaveBeenCalledWith('confirm', REASON)
    expect(w.find('[data-test="noshow-dialog-submit"]').text()).toBe('En cours…')
    expect(w.find('[data-test="noshow-dialog-cancel"]').attributes('disabled')).toBeDefined()
    resolve({ ok: true, message: 'Absence confirmée. Le colis est annulé.' })
    await flushPromises()
    expect(w.find('[data-test="noshow-dialog"]').exists()).toBe(false)
    expect(w.find('[data-test="noshow-success"]').text()).toContain('Absence confirmée. Le colis est annulé.')
    w.unmount()
  })

  it('motif de plus de 500 caractères refusé', async () => {
    const { w } = mountPanel()
    await w.find('[data-test="noshow-confirm"]').trigger('click')
    await w.find('[data-test="noshow-dialog-reason"]').setValue('a'.repeat(501))
    expect(w.find('[data-test="noshow-dialog-submit"]').attributes('disabled')).toBeDefined()
    w.unmount()
  })

  it('confirmer à l’arrivée : le dialogue annonce un litige', async () => {
    const { w } = mountPanel(noShow({ scope: 'DELIVERY', reason: 'RECIPIENT_NO_SHOW', accused: { role: 'RECIPIENT', name: 'Fatou S.' } }))
    await w.find('[data-test="noshow-confirm"]').trigger('click')
    expect(w.find('[data-test="noshow-dialog"]').text()).toMatch(/litige est ouvert/)
    w.unmount()
  })

  it('rejeter : effet expliqué ; erreur (409 déjà tranché) affichée DANS le dialogue', async () => {
    const decide = vi.fn().mockResolvedValue({ ok: false, code: 'noshow-already-decided', message: 'Cette déclaration a déjà été tranchée.' })
    const { w } = mountPanel(noShow(), decide)
    await w.find('[data-test="noshow-reject"]').trigger('click')
    expect(w.find('[data-test="noshow-dialog"]').text()).toMatch(/déclaration est classée/)
    await w.find('[data-test="noshow-dialog-reason"]').setValue(REASON)
    await w.find('[data-test="noshow-dialog-submit"]').trigger('click')
    await flushPromises()
    expect(decide).toHaveBeenCalledWith('reject', REASON)
    expect(w.find('[data-test="noshow-dialog-error"]').text()).toContain('déjà été tranchée')
    expect(w.find('[data-test="noshow-dialog-submit"]').text()).toBe('Rejeter la déclaration')
    // annuler ferme et efface l'erreur
    await w.find('[data-test="noshow-dialog-cancel"]').trigger('click')
    expect(w.find('[data-test="noshow-dialog"]').exists()).toBe(false)
    await w.find('[data-test="noshow-reject"]').trigger('click')
    expect(w.find('[data-test="noshow-dialog-error"]').exists()).toBe(false)
    w.unmount()
  })

  it('Échap ferme le dialogue, puis le panneau ; clic sur le fond ferme le panneau', async () => {
    const { w } = mountPanel()
    await w.find('[data-test="noshow-confirm"]').trigger('click')
    await w.find('[data-test="noshow-dialog"]').trigger('keydown', { key: 'Escape' })
    expect(w.find('[data-test="noshow-dialog"]').exists()).toBe(false)
    await w.find('[data-test="noshow-panel"]').trigger('keydown', { key: 'Escape' })
    await w.find('[data-test="noshow-backdrop"]').trigger('click')
    await w.find('[data-test="noshow-close"]').trigger('click')
    expect(w.emitted('close')).toHaveLength(3)
    w.unmount()
  })

  it('ancien back : titre abrégé, confirmation sans motif via l’ancien endpoint, pas de rejet', async () => {
    const decide = vi.fn().mockResolvedValue({ ok: true, message: 'Absence confirmée.' })
    const { w } = mountPanel(noShow({ legacy: true, scope: null, canReject: false, declarant: { role: 'TRAVELER', userId: 'u9' }, accused: { role: 'SENDER' }, trip: null, handoverAt: null, amount: null, paymentMethod: null, paymentStatus: null, bidStatus: null }), decide)
    expect(w.find('h2').text()).toBe('Colis 89125c9c…')
    expect(w.find('[data-test="noshow-legacy-note"]').exists()).toBe(true)
    expect(w.find('[data-test="noshow-declarant-link"]').attributes('href')).toBe('/users?open=u9')
    expect(w.find('[data-test="noshow-reject"]').exists()).toBe(false)
    await w.find('[data-test="noshow-confirm"]').trigger('click')
    expect(w.find('[data-test="noshow-dialog-reason"]').exists()).toBe(false)
    await w.find('[data-test="noshow-dialog-submit"]').trigger('click')
    await flushPromises()
    expect(decide).toHaveBeenCalledWith('confirm', '')
    w.unmount()
  })

  it('changer de ligne efface le message de succès', async () => {
    const decide = vi.fn().mockResolvedValue({ ok: true, message: 'Fait.' })
    const { w } = mountPanel(noShow(), decide)
    await w.find('[data-test="noshow-confirm"]').trigger('click')
    await w.find('[data-test="noshow-dialog-reason"]').setValue(REASON)
    await w.find('[data-test="noshow-dialog-submit"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="noshow-success"]').exists()).toBe(true)
    await w.setProps({ row: noShow({ id: 'c2' }) })
    expect(w.find('[data-test="noshow-success"]').exists()).toBe(false)
    w.unmount()
  })
})
