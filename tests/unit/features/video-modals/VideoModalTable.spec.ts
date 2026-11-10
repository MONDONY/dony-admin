import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import VideoModalTable from '@/features/video-modals/components/VideoModalTable.vue'
import type { VideoModalTrigger } from '@/features/video-modals/types/index'
import { infoModal, modal } from './fixtures'

const NuxtLink = { name: 'NuxtLink', props: ['to'], template: '<a :href="to"><slot /></a>' }
const mountTable = (items = [modal()], busy = false) =>
  mount(VideoModalTable, { props: { items, busy }, global: { stubs: { NuxtLink } } })

describe('VideoModalTable', () => {
  it('nom, déclencheurs, version, public et résultats', () => {
    const m = modal({ triggers: ['SEARCH_TAB', 'PUBLISH_TRIP'], version: 2, audience: 'EVERYONE' })
    const row = mountTable([m]).get(`[data-test="vm-row-${m.id}"]`)
    expect(row.text()).toContain('Vidéo d’accueil')
    expect(row.text()).toContain('Rechercher')
    expect(row.text()).toContain('Publier un trajet')
    expect(row.text()).toContain('v2')
    expect(row.text()).toContain('Tout le monde')
    expect(row.text()).toContain('612')
    expect(row.text()).toContain('vue en entier')
    expect(row.get('a').attributes('href')).toBe(`/modals-video/${m.id}`)
  })

  it('valeurs absentes ou inconnues : replis lisibles', () => {
    const m = modal({
      name: '', versionPublishedAt: null, stats: null,
      triggers: ['FUTURE_TAB' as VideoModalTrigger], audience: 'SEGMENT' as never,
    })
    const text = mountTable([m]).text()
    expect(text).toContain('Bienvenue sur Yadony')
    expect(text).toContain('FUTURE_TAB')
    expect(text).toContain('SEGMENT')
    expect(text).toContain('0 affichés')
    const noTriggers = mountTable([{ ...modal(), triggers: undefined as never }])
    expect(noTriggers.text()).toContain('v1')
  })

  it('interrupteur, nouvelle version et suppression émettent la campagne', async () => {
    const m = modal({ active: true })
    const w = mountTable([m])
    await w.get('[data-test="vm-switch"]').trigger('click')
    expect(w.emitted('toggle-active')![0]).toEqual([m, false])
    await w.get(`[data-test="vm-version-${m.id}"]`).trigger('click')
    expect(w.emitted('new-version')![0]).toEqual([m])
    await w.get(`[data-test="vm-remove-${m.id}"]`).trigger('click')
    expect(w.emitted('remove')![0]).toEqual([m])
    expect(w.get('[data-test="vm-switch"]').attributes('aria-label')).toBe(`Désactiver ${m.name}`)
  })

  it('occupé : actions bloquées', () => {
    const w = mountTable([modal()], true)
    expect(w.get('[data-test="vm-switch"]').attributes('disabled')).toBeDefined()
    expect(w.get(`[data-test="vm-remove-${modal().id}"]`).attributes('disabled')).toBeDefined()
    expect(w.get('[data-test="vm-switch"]').attributes('aria-label')).toBe(`Activer ${modal().name}`)
  })

  it('colonne Type : Vidéo par défaut (ancien back), Information pour INFO', () => {
    const { type: _t, ...legacy } = modal()
    const w = mountTable([legacy as never, infoModal()])
    expect(w.text()).toContain('Type')
    expect(w.get(`[data-test="vm-type-${modal().id}"]`).text()).toBe('Vidéo')
    expect(w.get(`[data-test="vm-type-${infoModal().id}"]`).text()).toBe('Information')
  })

  it('résultats Information : « bouton touché », sans « vue en entier »', () => {
    const row = mountTable([infoModal()]).get(`[data-test="vm-row-${infoModal().id}"]`)
    expect(row.text()).toContain('bouton touché')
    expect(row.text()).not.toContain('vue en entier')
    expect(row.text()).not.toContain('vidéo ouverte')
  })

  it('fréquence et priorité de chaque campagne ; campagne d’avant le ciblage : jusqu’à N fois, priorité 0', () => {
    const old = modal({ maxDisplays: 4 })
    const w1 = mountTable([old])
    expect(w1.get(`[data-test="vm-frequency-${old.id}"]`).text()).toBe('Jusqu’à 4 fois')
    expect(w1.get(`[data-test="vm-priority-${old.id}"]`).text()).toBe('0')
    const m = infoModal({ frequency: 'EVERY_N_DAYS', frequencyDays: 7, priority: 5, allowDontShowAgain: true })
    const w2 = mountTable([m])
    expect(w2.get(`[data-test="vm-frequency-${m.id}"]`).text()).toContain('Tous les 7 jours')
    expect(w2.get(`[data-test="vm-frequency-${m.id}"]`).text()).toContain('Case « Ne plus afficher »')
    expect(w2.get(`[data-test="vm-priority-${m.id}"]`).text()).toBe('5')
    expect(w2.text()).toContain('Fréquence')
    expect(w2.text()).toContain('Priorité')
  })

  it('situations en pastilles à part des déclencheurs', () => {
    const m = infoModal({ triggers: [], situations: [{ kind: 'OFFER_ACCEPTED_UNPAID', value: 6 }, { kind: 'PROFILE_INCOMPLETE', value: null }, { kind: 'NOPE' as never, value: null }] })
    const badges = mountTable([m]).findAll('[data-test="vm-situation-badge"]').map(b => b.text())
    expect(badges).toEqual(['Offre non payée', 'Profil incomplet', 'NOPE'])
    expect(mountTable([modal()]).find('[data-test="vm-situation-badge"]').exists()).toBe(false)
  })
})
