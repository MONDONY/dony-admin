import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const svc = vi.hoisted(() => ({
  approve: vi.fn(), reject: vi.fn(), grant: vi.fn(), revoke: vi.fn(),
}))
vi.mock('@/features/gp-pro/services/gpProService', () => ({ gpProService: svc }))

import GpProDecisionDialog from '@/features/gp-pro/components/GpProDecisionDialog.vue'
import UserGpProSection from '@/features/gp-pro/components/UserGpProSection.vue'

const REASON = 'Plusieurs litiges récents'

describe('GpProDecisionDialog', () => {
  const mountDialog = (mode: string, extra: Record<string, unknown> = {}) =>
    mount(GpProDecisionDialog, { props: { open: true, mode, userName: 'Awa Diop', ...extra } })

  it('fermé : rien n’est rendu', () => {
    expect(mount(GpProDecisionDialog, { props: { open: false, mode: 'approve', userName: 'A' } }).html()).not.toContain('gp-pro-dialog')
  })

  it('accepter : pas de saisie, soumission directe', async () => {
    const w = mountDialog('approve')
    expect(w.find('[data-test="gp-pro-text"]').exists()).toBe(false)
    await w.get('[data-test="gp-pro-dialog-submit"]').trigger('click')
    expect(w.emitted('submit')?.[0]).toEqual([''])
  })

  it('refuser : motif de 10 caractères minimum, envoyé à l’utilisateur', async () => {
    const w = mountDialog('reject')
    const submit = w.get('[data-test="gp-pro-dialog-submit"]')
    await w.get('[data-test="gp-pro-text"]').setValue('court')
    expect(submit.attributes('disabled')).toBeDefined()
    expect(w.get('[data-test="gp-pro-hint"]').text()).toContain('Au moins 10')
    await submit.trigger('click')
    expect(w.emitted('submit')).toBeUndefined()
    await w.get('[data-test="gp-pro-text"]').setValue(`  ${REASON}  `)
    expect(w.get('[data-test="gp-pro-hint"]').text()).toContain('Envoyé à l’utilisateur')
    await submit.trigger('click')
    expect(w.emitted('submit')?.[0]).toEqual([REASON])
  })

  it('motif trop long : refusé, compteur en rouge', async () => {
    const w = mountDialog('revoke')
    await w.get('[data-test="gp-pro-text"]').setValue('x'.repeat(1001))
    expect(w.get('[data-test="gp-pro-hint"]').text()).toContain('Pas plus de 1000')
    expect(w.get('[data-test="gp-pro-count"]').classes()).toContain('text-danger')
    expect(w.get('[data-test="gp-pro-dialog-submit"]').attributes('disabled')).toBeDefined()
  })

  it('accorder : note facultative et interne', async () => {
    const w = mountDialog('grant')
    expect(w.get('[data-test="gp-pro-hint"]').text()).toContain('Note interne')
    await w.get('[data-test="gp-pro-dialog-submit"]').trigger('click')
    expect(w.emitted('submit')?.[0]).toEqual([''])
    await w.get('[data-test="gp-pro-text"]').setValue('x'.repeat(1001))
    expect(w.get('[data-test="gp-pro-dialog-submit"]').attributes('disabled')).toBeDefined()
  })

  it('occupé : bouton désactivé ; erreur affichée ; annuler', async () => {
    const w = mountDialog('approve', { busy: true, error: 'Refusé par le serveur' })
    expect(w.get('[data-test="gp-pro-dialog-submit"]').text()).toBe('En cours…')
    expect(w.get('[data-test="gp-pro-dialog-submit"]').attributes('disabled')).toBeDefined()
    expect(w.get('[data-test="gp-pro-dialog-error"]').text()).toBe('Refusé par le serveur')
    await w.get('[data-test="gp-pro-dialog-cancel"]').trigger('click')
    expect(w.emitted('cancel')).toHaveLength(1)
  })
})

describe('UserGpProSection', () => {
  beforeEach(() => Object.values(svc).forEach((f) => f.mockReset()))
  const BASE = { userId: 'u1', userName: 'Awa Diop', gpPro: false, kycStatus: 'VERIFIED', status: 'ACTIVE' }
  const mountSection = (props: Record<string, unknown> = {}) => mount(UserGpProSection, { props: { ...BASE, ...props } })

  it('accorder sans demande, note facultative transmise', async () => {
    svc.grant.mockResolvedValue(undefined)
    const w = mountSection()
    expect(w.get('[data-test="gp-pro-state"]').text()).toBe('non attribué')
    await w.get('[data-test="action-grant-gp-pro"]').trigger('click')
    await w.get('[data-test="gp-pro-text"]').setValue('Connu du terrain')
    await w.get('[data-test="gp-pro-dialog-submit"]').trigger('click')
    await flushPromises()
    expect(svc.grant).toHaveBeenCalledWith('u1', 'Connu du terrain')
    expect(w.emitted('changed')).toHaveLength(1)
  })

  it('accorder sans note : null envoyé', async () => {
    svc.grant.mockResolvedValue(undefined)
    const w = mountSection()
    await w.get('[data-test="action-grant-gp-pro"]').trigger('click')
    await w.get('[data-test="gp-pro-dialog-submit"]').trigger('click')
    await flushPromises()
    expect(svc.grant).toHaveBeenCalledWith('u1', null)
  })

  it('identité non vérifiée ou compte inactif : attribution désactivée et expliquée', () => {
    const noKyc = mountSection({ kycStatus: 'PENDING' })
    expect(noKyc.get('[data-test="action-grant-gp-pro"]').attributes('disabled')).toBeDefined()
    expect(noKyc.get('[data-test="gp-pro-grant-blocked"]').text()).toContain('Identité non vérifiée')
    expect(mountSection({ status: 'BANNED' }).get('[data-test="gp-pro-grant-blocked"]').text()).toContain('Compte inactif')
  })

  it('retirer avec motif ; badge actif affiché avec sa date', async () => {
    svc.revoke.mockResolvedValue(undefined)
    const w = mountSection({ gpPro: true, gpProGrantedAt: '2026-09-01T00:00:00Z' })
    expect(w.get('[data-test="gp-pro-state"]').text()).toContain('actif depuis le')
    await w.get('[data-test="action-revoke-gp-pro"]').trigger('click')
    await w.get('[data-test="gp-pro-text"]').setValue(REASON)
    await w.get('[data-test="gp-pro-dialog-submit"]').trigger('click')
    await flushPromises()
    expect(svc.revoke).toHaveBeenCalledWith('u1', REASON)
    expect(w.emitted('changed')).toHaveLength(1)
  })

  it('conflit : la fiche est relue, l’erreur reste lisible après fermeture du dialogue', async () => {
    svc.revoke.mockRejectedValueOnce({ statusCode: 409, data: { code: 'gp-pro-not-active' } })
    const w = mountSection({ gpPro: true })
    await w.get('[data-test="action-revoke-gp-pro"]').trigger('click')
    await w.get('[data-test="gp-pro-text"]').setValue(REASON)
    await w.get('[data-test="gp-pro-dialog-submit"]').trigger('click')
    await flushPromises()
    expect(w.emitted('changed')).toHaveLength(1)
    await w.get('[data-test="gp-pro-dialog-cancel"]').trigger('click')
    expect(w.get('[data-test="gp-pro-section-error"]').text()).toContain('n’est plus actif')
  })

  it('ancien back : gestes masqués, mention discrète', async () => {
    svc.grant.mockRejectedValueOnce({ statusCode: 405, data: {} })
    const w = mountSection()
    await w.get('[data-test="action-grant-gp-pro"]').trigger('click')
    await w.get('[data-test="gp-pro-dialog-submit"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="gp-pro-section-unavailable"]').exists()).toBe(true)
    expect(w.find('[data-test="action-grant-gp-pro"]').exists()).toBe(false)
  })
})
