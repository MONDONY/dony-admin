import { describe, it, expect, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { seedAuth } from '~/tests/helpers/auth'
import UserAccountBanners from '@/features/user-profile/components/UserAccountBanners.vue'
import type { AdminRole } from '@/stores/auth'

const USER = { id: 'u1', status: 'ACTIVE', heldPaymentsCount: 0 }
function mountB(user: Record<string, unknown> = {}, props: Record<string, unknown> = {}, role: AdminRole = 'ADMIN', overrides: Record<string, boolean> = {}) {
  seedAuth(role, overrides)
  return mount(UserAccountBanners, {
    props: { user: { ...USER, ...user } as never, busy: false, ...props },
    global: { stubs: { NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } } },
  })
}

describe('UserAccountBanners', () => {
  beforeEach(() => { seedAuth('ADMIN') })

  it('compte sain : aucun bandeau', () => {
    const w = mountB()
    expect(w.find('[data-test="user-payouts-held"]').exists()).toBe(false)
    expect(w.find('[data-test="user-payouts-restored"]').exists()).toBe(false)
    expect(w.find('[data-test="user-pending-deletion"]').exists()).toBe(false)
  })

  it('versements bloqués : motifs, nombre, lien vers les versements retenus', () => {
    const w = mountB({ payoutsHeldSince: '2026-10-10T12:00:00Z', payoutsHeldReasons: ['BANNED'], heldPaymentsCount: 2 })
    const b = w.get('[data-test="user-payouts-held"]')
    expect(b.attributes('role')).toBe('status')
    expect(b.text()).toContain('Versements bloqués')
    expect(b.text()).toContain('2 paiements en attente')
    expect(b.text()).toContain('Ses gains restent chez Yadony')
    expect(w.get('[data-test="user-payouts-held-link"]').attributes('href')).toBe('/transactions?held=true')
  })

  it('un seul paiement : singulier', () => {
    expect(mountB({ payoutsHeldReasons: ['BANNED'], heldPaymentsCount: 1 }).get('[data-test="user-payouts-held"]').text()).toContain('1 paiement en attente')
  })

  it('retenu sans paiement en attente : texte dédié, pas de lien', () => {
    const w = mountB({ payoutsHeldSince: '2026-10-10T12:00:00Z', payoutsHeldReasons: ['KYC_REVOKED'], heldPaymentsCount: 0 })
    expect(w.get('[data-test="user-payouts-held"]').text()).toContain('aucun paiement en attente')
    expect(w.find('[data-test="user-payouts-held-link"]').exists()).toBe(false)
  })

  it('ancien back : motif unique pris en compte', () => {
    expect(mountB({ payoutsHeldReason: 'BANNED', heldPaymentsCount: 3 }).find('[data-test="user-payouts-held"]').exists()).toBe(true)
  })

  it('compte rétabli mais paiements retenus : bandeau « rétabli »', () => {
    const w = mountB({ payoutsHeldReasons: [], heldPaymentsCount: 2 })
    expect(w.find('[data-test="user-payouts-held"]').exists()).toBe(false)
    expect(w.get('[data-test="user-payouts-restored"]').text()).toContain('Compte rétabli : 2 paiements toujours retenus, à débloquer manuellement.')
    expect(w.get('[data-test="user-payouts-restored"]').text()).toContain('Rien ne repart tout seul')
    expect(w.find('[data-test="user-payouts-held-link"]').exists()).toBe(true)
  })

  it('lien masqué sans PAYMENT_VIEW', () => {
    const w = mountB({ payoutsHeldReasons: ['BANNED'], heldPaymentsCount: 2 }, {}, 'ADMIN', { PAYMENT_VIEW: false })
    expect(w.find('[data-test="user-payouts-held"]').exists()).toBe(true)
    expect(w.find('[data-test="user-payouts-held-link"]').exists()).toBe(false)
  })

  describe('suppression demandée', () => {
    const PD = { status: 'PENDING_DELETION', deletionScheduledFor: '2026-11-15T12:00:00Z' }

    it('bandeau avec date prévue et bouton', () => {
      const w = mountB(PD)
      const b = w.get('[data-test="user-pending-deletion"]')
      expect(b.attributes('role')).toBe('status')
      expect(b.text()).toContain('Suppression prévue le 15/11/2026')
      expect(w.find('[data-test="action-cancel-deletion"]').exists()).toBe(true)
    })

    it('date demandée, ou texte seul', () => {
      expect(mountB({ status: 'PENDING_DELETION', deletionRequestedAt: '2026-11-01T12:00:00Z' }).text()).toContain('Suppression demandée le 01/11/2026')
      expect(mountB({ status: 'PENDING_DELETION' }).get('[data-test="user-pending-deletion"]').text()).toContain('Suppression demandée')
    })

    it('sans USER_DELETE : bandeau mais ni bouton ni indisponibilité', () => {
      const w = mountB(PD, {}, 'ADMIN', { USER_DELETE: false })
      expect(w.find('[data-test="user-pending-deletion"]').exists()).toBe(true)
      expect(w.find('[data-test="action-cancel-deletion"]').exists()).toBe(false)
      expect(w.find('[data-test="cancel-deletion-unavailable"]').exists()).toBe(false)
    })

    it('indisponible : texte à la place du bouton', () => {
      const w = mountB(PD, { cancelDeletionUnavailable: true })
      expect(w.find('[data-test="action-cancel-deletion"]').exists()).toBe(false)
      expect(w.get('[data-test="cancel-deletion-unavailable"]').text()).toContain('Annulation indisponible tant que le serveur n’est pas mis à jour.')
    })

    it('motif : dialogue, confirmation émet le motif', async () => {
      const w = mountB(PD)
      await w.get('[data-test="action-cancel-deletion"]').trigger('click')
      const dlg = w.get('[data-test="restore-dialog"]')
      expect(dlg.text()).toContain('Annuler la suppression du compte')
      expect(dlg.text()).toContain('Le compte est conservé et redevient actif.')
      expect(dlg.text()).toContain('L’utilisateur sera prévenu que son compte n’est plus supprimé.')
      await w.get('[data-test="restore-reason"]').setValue('Demande de l’utilisateur par téléphone')
      await w.get('[data-test="restore-confirm"]').trigger('click')
      expect(w.emitted('cancelDeletion')![0]).toEqual(['Demande de l’utilisateur par téléphone'])
    })

    it('le dialogue reste ouvert et montre l’erreur de motif (422)', async () => {
      const w = mountB(PD)
      await w.get('[data-test="action-cancel-deletion"]').trigger('click')
      await w.setProps({ cancelDeletionReasonError: 'Motif trop court' })
      expect(w.get('[data-test="restore-error"]').text()).toBe('Motif trop court')
    })

    it('se ferme au succès (statut qui change), sur erreur de fiche et sur indisponibilité', async () => {
      for (const change of [
        { user: { ...USER, status: 'ACTIVE' } },
        { error: 'Plus annulable' },
        { cancelDeletionUnavailable: true },
      ]) {
        const w = mountB(PD)
        await w.get('[data-test="action-cancel-deletion"]').trigger('click')
        expect(w.find('[data-test="restore-dialog"]').exists()).toBe(true)
        await w.setProps(change as never)
        await flushPromises()
        expect(w.find('[data-test="restore-dialog"]').exists()).toBe(false)
      }
    })

    it('Annuler ferme le dialogue sans émettre', async () => {
      const w = mountB(PD)
      await w.get('[data-test="action-cancel-deletion"]').trigger('click')
      await w.get('[data-test="restore-cancel"]').trigger('click')
      expect(w.find('[data-test="restore-dialog"]').exists()).toBe(false)
      expect(w.emitted('cancelDeletion')).toBeUndefined()
    })

    it('occupé : bouton désactivé', () => {
      expect(mountB(PD, { busy: true }).get('[data-test="action-cancel-deletion"]').attributes('disabled')).toBeDefined()
    })
  })
})
