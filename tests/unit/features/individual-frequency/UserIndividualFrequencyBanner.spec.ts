import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { seedAuth } from '~/tests/helpers/auth'

const svc = vi.hoisted(() => ({ list: vi.fn(), dismiss: vi.fn() }))
vi.mock('@/features/individual-frequency/services/individualFrequencyService', () => ({ individualFrequencyService: svc }))

import UserIndividualFrequencyBanner from '@/features/individual-frequency/components/UserIndividualFrequencyBanner.vue'

const ALERT = { flagId: 'f1', tripsCount: 5, windowDays: 30, threshold: 4, detectedAt: '2026-11-10T04:30:00Z' }

function mountBanner(alert: unknown, role: 'ADMIN' | 'SUPPORT' = 'ADMIN', overrides: Record<string, boolean> = {}) {
  seedAuth(role, overrides)
  return mount(UserIndividualFrequencyBanner, { props: { alert: alert as never } })
}

describe('UserIndividualFrequencyBanner', () => {
  beforeEach(() => { vi.clearAllMocks(); svc.dismiss.mockResolvedValue(undefined) })

  it('affiche la phrase du contrat quand l’alerte est présente', () => {
    const w = mountBanner(ALERT)
    const b = w.get('[data-test="user-individual-frequency"]')
    expect(b.attributes('role')).toBe('status')
    expect(b.text()).toContain('5 trajets avec colis sur 30 jours (seuil : 4). Statut déclaré : Particulier.')
    expect(b.text()).toContain('Aucun blocage automatique')
  })

  it.each([undefined, null])('alerte absente (%s) : aucun bandeau', (alert) => {
    const w = mountBanner(alert)
    expect(w.find('[data-test="user-individual-frequency"]').exists()).toBe(false)
    expect(w.text()).toBe('')
  })

  it('alerte sans flagId (contrat incomplet) : aucun bandeau', () => {
    expect(mountBanner({ tripsCount: 5 }).find('[data-test="user-individual-frequency"]').exists()).toBe(false)
  })

  it('« Écarter » confirme, poste, puis demande la relecture de la fiche', async () => {
    const w = mountBanner(ALERT)
    await w.get('[data-test="user-individual-frequency-dismiss"]').trigger('click')
    expect(svc.dismiss).not.toHaveBeenCalled()
    await w.get('[data-test="confirm"]').trigger('click')
    await flushPromises()
    expect(svc.dismiss).toHaveBeenCalledWith('f1')
    expect(w.emitted('changed')).toHaveLength(1)
    expect(w.find('[role="dialog"]').exists()).toBe(false)
  })

  it('annuler la confirmation n’appelle rien', async () => {
    const w = mountBanner(ALERT)
    await w.get('[data-test="user-individual-frequency-dismiss"]').trigger('click')
    await w.get('[data-test="cancel"]').trigger('click')
    expect(svc.dismiss).not.toHaveBeenCalled()
    expect(w.emitted('changed')).toBeUndefined()
  })

  it('échec : message sous le bandeau, aucune relecture', async () => {
    svc.dismiss.mockRejectedValue({ statusCode: 500, data: { detail: 'Panne' } })
    const w = mountBanner(ALERT)
    await w.get('[data-test="user-individual-frequency-dismiss"]').trigger('click')
    await w.get('[data-test="confirm"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-test="user-individual-frequency-error"]').text()).toBe('Panne')
    expect(w.emitted('changed')).toBeUndefined()
  })

  it('alerte inconnue ou déjà close (404) : fiche relue, aucune erreur affichée', async () => {
    svc.dismiss.mockRejectedValue({ statusCode: 404, data: { code: 'individual-frequency-flag-not-found' } })
    const w = mountBanner(ALERT)
    await w.get('[data-test="user-individual-frequency-dismiss"]').trigger('click')
    await w.get('[data-test="confirm"]').trigger('click')
    await flushPromises()
    expect(w.emitted('changed')).toHaveLength(1)
    expect(w.find('[data-test="user-individual-frequency-error"]').exists()).toBe(false)
    expect(w.find('[role="dialog"]').exists()).toBe(false)
  })

  it('405 : le bouton disparaît, pas d’erreur', async () => {
    svc.dismiss.mockRejectedValue({ statusCode: 405 })
    const w = mountBanner(ALERT)
    await w.get('[data-test="user-individual-frequency-dismiss"]').trigger('click')
    await w.get('[data-test="confirm"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="user-individual-frequency-dismiss"]').exists()).toBe(false)
    expect(w.find('[data-test="user-individual-frequency-error"]').exists()).toBe(false)
    expect(w.find('[data-test="user-individual-frequency"]').exists()).toBe(true)
  })

  it('demande hebdomadaire sous le seuil : la phrase GP Pro à la place de celle des trajets', () => {
    const w = mountBanner({ ...ALERT, tripsCount: 2, weeklyApplication: true })
    expect(w.get('[data-test="user-individual-frequency-text"]').text())
      .toBe('A demandé GP Pro, fréquence : chaque semaine. Statut déclaré : Particulier.')
  })

  it('demande hebdomadaire au-dessus du seuil : les deux phrases', () => {
    const w = mountBanner({ ...ALERT, weeklyApplication: true })
    expect(w.get('[data-test="user-individual-frequency-text"]').text())
      .toBe('5 trajets avec colis sur 30 jours (seuil : 4). A demandé GP Pro, fréquence : chaque semaine. Statut déclaré : Particulier.')
  })

  it('sans GP_PRO_REVIEW : le bandeau se lit, sans bouton', () => {
    const w = mountBanner(ALERT, 'ADMIN', { GP_PRO_REVIEW: false })
    expect(w.find('[data-test="user-individual-frequency"]').exists()).toBe(true)
    expect(w.find('[data-test="user-individual-frequency-dismiss"]').exists()).toBe(false)
  })

  it('avec GP_PRO_REVIEW : bandeau et bouton « Écarter » ; sans : bandeau seul (le back répondrait 403)', () => {
    const avec = mountBanner(ALERT, 'ADMIN')
    expect(avec.find('[data-test="user-individual-frequency"]').exists()).toBe(true)
    expect(avec.find('[data-test="user-individual-frequency-dismiss"]').exists()).toBe(true)
    const sans = mountBanner(ALERT, 'SUPPORT')
    expect(sans.find('[data-test="user-individual-frequency"]').exists()).toBe(true)
    expect(sans.find('[data-test="user-individual-frequency-dismiss"]').exists()).toBe(false)
  })
})
