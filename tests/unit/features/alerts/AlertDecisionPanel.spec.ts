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

  it('alerte résolue : seul « Rouvrir » est proposé, avec une note obligatoire', async () => {
    const w = mountPanel({ alert: { ...open, resolved: true, resolvedAt: '2026-10-21T10:00:00Z' } })
    expect(w.findAll('[data-test^="alert-action-"]').map(x => x.attributes('data-test'))).toEqual(['alert-action-REOPEN'])
    expect(w.find('[data-test="scope-group"]').exists()).toBe(false)
    await w.get('[data-test="alert-quick-L’anomalie est revenue"]').trigger('click')
    await w.get('[data-test="alert-confirm"]').trigger('click')
    expect(w.emitted('confirm')![0]).toEqual(['REOPEN', 'L’anomalie est revenue', 'one', 24])
  })

  it('alerte résolue et « Rouvrir » indisponible (ancien back) : la phrase remplace le geste', () => {
    const w = mountPanel({ alert: { ...open, resolved: true, resolvedAt: '2026-10-21T10:00:00Z' }, unavailable: ['REOPEN'] })
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
    expect(w.emitted('confirm')![0]).toEqual(['FIXED', 'Corrigé à la main', 'one', 24])
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
    expect(w.emitted('confirm')![0]).toEqual(['FALSE_POSITIVE', 'Règle trop sensible', 'one', 24])
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

  describe('reporter', () => {
    const FUTURE = '2999-01-01T00:00:00Z'

    it('alerte ouverte : « Reporter » est le troisième geste, 24 h par défaut', async () => {
      const w = mountPanel()
      expect(w.findAll('[data-test^="alert-action-"]').map(x => x.attributes('data-test')))
        .toEqual(['alert-action-FIXED', 'alert-action-FALSE_POSITIVE', 'alert-action-SNOOZE'])
      ;(w.vm as unknown as { pick: (_n: number) => void }).pick(3)
      await w.vm.$nextTick()
      expect(w.get('[data-test="snooze-24"]').attributes('aria-pressed')).toBe('true')
      await w.get('[data-test="alert-quick-Colis encore en route"]').trigger('click')
      expect(w.get('[data-test="alert-confirm"]').text()).toContain('Reporter de 24 h')
      await w.get('[data-test="alert-confirm"]').trigger('click')
      expect(w.emitted('confirm')![0]).toEqual(['SNOOZE', 'Colis encore en route', 'one', 24])
    })

    it('la durée choisie part avec le geste et change le libellé', async () => {
      const w = mountPanel()
      await w.get('[data-test="alert-action-SNOOZE"] input').setValue(true)
      await w.get('[data-test="snooze-72"]').trigger('click')
      await w.get('[data-test="alert-note"]').setValue('En attente du voyageur')
      expect(w.get('[data-test="alert-confirm"]').text()).toContain('Reporter de 3 jours')
      await w.get('[data-test="alert-confirm"]').trigger('click')
      expect(w.emitted('confirm')![0]).toEqual(['SNOOZE', 'En attente du voyageur', 'one', 72])
    })

    it('un report n’a pas de portée « groupe »', async () => {
      const w = mountPanel({ groupOpenCount: 4 })
      expect(w.find('[data-test="scope-group"]').exists()).toBe(true)
      await w.get('[data-test="alert-action-SNOOZE"] input').setValue(true)
      expect(w.find('[data-test="scope-group"]').exists()).toBe(false)
    })

    it('alerte reportée : « Remettre dans la file » sans note obligatoire', async () => {
      const w = mountPanel({ alert: { ...open, snoozedUntil: FUTURE } })
      expect(w.find('[data-test="alert-action-SNOOZE"]').exists()).toBe(false)
      await w.get('[data-test="alert-action-UNSNOOZE"] input').setValue(true)
      expect(w.get('[data-test="alert-confirm"]').attributes('disabled')).toBeUndefined()
      expect(w.get('[data-test="alert-confirm"]').text()).not.toContain('suivante')
      await w.get('[data-test="alert-confirm"]').trigger('click')
      expect(w.emitted('confirm')![0]).toEqual(['UNSNOOZE', '', 'one', 24])
    })

    it('report échu : l’alerte est de nouveau reportable', () => {
      const w = mountPanel({ alert: { ...open, snoozedUntil: '2000-01-01T00:00:00Z' } })
      expect(w.find('[data-test="alert-action-SNOOZE"]').exists()).toBe(true)
    })

    it('« Reporter » indisponible (ancien back) : retiré de la liste', () => {
      const w = mountPanel({ unavailable: ['SNOOZE'] })
      expect(w.find('[data-test="alert-action-SNOOZE"]').exists()).toBe(false)
      expect(w.findAll('[data-test^="alert-action-"]')).toHaveLength(2)
    })
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
      expect(w.emitted('confirm')![0]).toEqual(['FIXED', 'Versement forcé', 'group', 24])
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
