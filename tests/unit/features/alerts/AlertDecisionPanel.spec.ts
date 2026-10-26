import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { seedAuth } from '~/tests/helpers/auth'
import AlertDecisionPanel from '@/features/alerts/components/AlertDecisionPanel.vue'
import type { AdminAlert } from '@/features/alerts/types/index'

const open: AdminAlert = { id: 'a1', type: 'ESCROW_J48_TIMEOUT', severity: 'WARN', payload: {}, resolved: false, resolvedAt: null, createdAt: '2026-10-20T10:00:00Z' }

function mountPanel(props: Record<string, unknown> = {}) {
  return mount(AlertDecisionPanel, { props: { alert: open, ...props } })
}

describe('AlertDecisionPanel', () => {
  beforeEach(() => { seedAuth('ADMIN') })

  it('rien de sélectionné : invitation, pas de bouton', () => {
    const w = mountPanel({ alert: null })
    expect(w.find('[data-test="alert-decision-empty"]').exists()).toBe(true)
    expect(w.find('[data-test="alert-confirm"]').exists()).toBe(false)
  })

  it('alerte déjà résolue : le dit, sans geste', () => {
    const w = mountPanel({ alert: { ...open, resolved: true, resolvedAt: '2026-10-21T10:00:00Z' } })
    expect(w.find('[data-test="alert-decision-resolved"]').exists()).toBe(true)
    expect(w.find('[data-test="alert-confirm"]').exists()).toBe(false)
  })

  it('sans ALERT_RESOLVE : aucun geste proposé', () => {
    seedAuth('SUPPORT', { ALERT_RESOLVE: false })
    const w = mountPanel()
    expect(w.find('[data-test="alert-no-action"]').exists()).toBe(true)
    expect(w.find('[data-test="alert-confirm"]').exists()).toBe(false)
  })

  it('« Corrigé » est choisi d’emblée ; le bouton attend une note de 3 caractères au moins', async () => {
    const w = mountPanel()
    expect(w.get('[data-test="alert-confirm"]').attributes('disabled')).toBeDefined()
    await w.get('[data-test="alert-note"]').setValue('ab')
    expect(w.get('[data-test="alert-note-problem"]').text()).toContain('3 caractères')
    expect(w.get('[data-test="alert-confirm"]').attributes('disabled')).toBeDefined()
    await w.get('[data-test="alert-note"]').setValue('Corrigé à la main')
    expect(w.get('[data-test="alert-confirm"]').attributes('disabled')).toBeUndefined()
    await w.get('[data-test="alert-confirm"]').trigger('click')
    expect(w.emitted('confirm')![0]).toEqual(['FIXED', 'Corrigé à la main', 'one'])
  })

  it('un motif rapide remplit la note ; ceux du faux positif diffèrent', async () => {
    const w = mountPanel()
    await w.get('[data-test="alert-quick-Remboursé via Stripe"]').trigger('click')
    expect((w.get('[data-test="alert-note"]').element as HTMLTextAreaElement).value).toBe('Remboursé via Stripe')
    await w.get('[data-test="alert-action-FALSE_POSITIVE"] input').setValue(true)
    expect(w.find('[data-test="alert-quick-Remboursé via Stripe"]').exists()).toBe(false)
    expect(w.find('[data-test="alert-quick-Règle trop sensible"]').exists()).toBe(true)
  })

  it('pick(2) choisit le faux positif ; submit() confirme ; pick hors bornes ignoré', async () => {
    const w = mountPanel()
    ;(w.vm as unknown as { pick: (_n: number) => void }).pick(9)
    ;(w.vm as unknown as { pick: (_n: number) => void }).pick(2)
    await w.get('[data-test="alert-note"]').setValue('Règle trop sensible')
    ;(w.vm as unknown as { submit: () => void }).submit()
    expect(w.emitted('confirm')![0]).toEqual(['FALSE_POSITIVE', 'Règle trop sensible', 'one'])
  })

  it('submit() sans note valide ne fait rien', () => {
    const w = mountPanel()
    ;(w.vm as unknown as { submit: () => void }).submit()
    expect(w.emitted('confirm')).toBeUndefined()
  })

  it('le libellé annonce le passage à la suivante, sauf s’il n’y en a plus', () => {
    expect(mountPanel({ hasNext: true }).get('[data-test="alert-confirm"]').text()).toContain('et passer à la suivante')
    expect(mountPanel({ hasNext: false }).get('[data-test="alert-confirm"]').text()).not.toContain('suivante')
  })

  it('refus du back montré sans perdre la saisie', async () => {
    const w = mountPanel({ error: 'Alerte introuvable' })
    await w.get('[data-test="alert-note"]').setValue('Corrigé à la main')
    expect(w.get('[data-test="alert-error"]').text()).toBe('Alerte introuvable')
    expect((w.get('[data-test="alert-note"]').element as HTMLTextAreaElement).value).toBe('Corrigé à la main')
  })

  it('changer d’alerte repart de zéro', async () => {
    const w = mountPanel()
    await w.get('[data-test="alert-note"]').setValue('Corrigé à la main')
    await w.setProps({ alert: { ...open, id: 'a2' } })
    expect((w.get('[data-test="alert-note"]').element as HTMLTextAreaElement).value).toBe('')
  })

  describe('plusieurs alertes ouvertes du même type', () => {
    it('une seule alerte : pas de choix de portée', () => {
      expect(mountPanel({ groupOpenCount: 1 }).find('[data-test="scope-group"]').exists()).toBe(false)
    })

    it('« Les 5 du groupe » exige une case cochée puis émet la portée groupe', async () => {
      const w = mountPanel({ groupOpenCount: 5 })
      expect(w.get('[data-test="scope-one"]').attributes('aria-pressed')).toBe('true')
      await w.get('[data-test="scope-group"]').trigger('click')
      expect(w.get('[data-test="alert-bulk-warning"]').text()).toContain('5 alertes ouvertes')
      expect(w.get('[data-test="alert-confirm"]').text()).toContain('Résoudre les 5 alertes')
      await w.get('[data-test="alert-note"]').setValue('Versement forcé')
      expect(w.get('[data-test="alert-confirm"]').attributes('disabled')).toBeDefined()
      await w.get('[data-test="alert-acknowledge"]').setValue(true)
      await w.get('[data-test="alert-confirm"]').trigger('click')
      expect(w.emitted('confirm')![0]).toEqual(['FIXED', 'Versement forcé', 'group'])
    })

    it('revenir à « Cette alerte » réarme la case', async () => {
      const w = mountPanel({ groupOpenCount: 3 })
      await w.get('[data-test="scope-group"]').trigger('click')
      await w.get('[data-test="alert-acknowledge"]').setValue(true)
      await w.get('[data-test="scope-one"]').trigger('click')
      await w.get('[data-test="scope-group"]').trigger('click')
      expect((w.get('[data-test="alert-acknowledge"]').element as HTMLInputElement).checked).toBe(false)
    })
  })
})
