import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { buildDisplayConditions } from '@/features/video-modals/lib/displayConditions'
import { validateVideoModal } from '@/features/video-modals/lib/validation'
import DisplayConditionsPanel from '@/features/video-modals/components/DisplayConditionsPanel.vue'
import type { VideoModalInput } from '@/features/video-modals/types/index'
import { infoInput, validInput } from './fixtures'

const now = new Date('2026-11-14T12:00:00Z')
const build = (i: VideoModalInput, active = true) => buildDisplayConditions(i, { active, now, errors: validateVideoModal(i) })
const row = (i: VideoModalInput, id: string, active = true) => build(i, active).rows.find(r => r.id === id)

describe('conditions d’affichage', () => {
  it('campagne inactive : bloque', () => {
    const r = build(validInput(), false)
    expect(r.rows.find(x => x.id === 'status')).toMatchObject({ verdict: 'block' })
    expect(r.blocked).toBe(true)
    expect(row(validInput(), 'status')?.verdict).toBe('ok')
  })

  it('hors période : pas commencée ou terminée bloque, dans la période passe', () => {
    expect(row(validInput({ startsAt: '2026-12-01T00:00:00Z' }), 'period')?.verdict).toBe('block')
    expect(row(validInput({ endsAt: '2026-11-01T00:00:00Z' }), 'period')?.verdict).toBe('block')
    expect(row(validInput({ startsAt: '2026-11-01T00:00:00Z', endsAt: '2026-12-01T00:00:00Z' }), 'period')?.verdict).toBe('ok')
    expect(row(validInput({ endsAt: null }), 'period')?.detail).toContain('Sans date')
  })

  it('sans déclencheur : bloque', () => {
    expect(row(validInput({ triggers: [] }), 'trigger')?.verdict).toBe('block')
  })

  it('EVERY_TIME : sans plafond avec un moment, bloque avec un écran, nuance de version', () => {
    const ok = validInput({ frequency: 'EVERY_TIME', frequencyDays: null, triggers: ['PAYMENT_SUCCEEDED'] })
    expect(row(ok, 'frequency')).toMatchObject({ verdict: 'ok' })
    expect(row(ok, 'frequency')?.detail).toContain('Sans plafond')
    expect(row(ok, 'every-time')).toBeUndefined()
    expect(row(ok, 'app-version')?.detail).toContain('servie en « à chaque ouverture »')
    const bad = validInput({ frequency: 'EVERY_TIME', frequencyDays: null, triggers: ['SEARCH_TAB'] })
    expect(row(bad, 'every-time')?.verdict).toBe('block')
    expect(build(bad).common[1]).toContain('Exception')
    expect(build(validInput()).common[1]).not.toContain('Exception')
  })

  it('vidéo : lien YouTube ; information : boutons ; cases indépendantes', () => {
    expect(row(validInput({ youtubeUrl: 'nimporte' }), 'content')).toMatchObject({ label: 'Lien YouTube de la vidéo', verdict: 'block' })
    expect(row(validInput(), 'content')?.verdict).toBe('ok')
    expect(row(infoInput(), 'content')).toMatchObject({ label: 'Boutons et image de l’information' })
    expect(row(infoInput({ primaryAction: { kind: 'URL', screen: null, url: 'http://x' } }), 'content')?.verdict).toBe('block')
    expect(build(validInput()).common[1]).toContain('Cette vidéo a sa propre case')
    expect(build(infoInput()).common[1]).toContain('Cette information a sa propre case')
  })

  it('version : fonctions récentes, plage, système, public, tirage', () => {
    const plain = validInput({ frequency: 'ONCE', triggers: ['SEARCH_TAB'] })
    expect(row(plain, 'app-version')?.verdict).toBe('ok')
    const recent = validInput({ triggers: ['PAYMENT_FAILED'] })
    expect(row(recent, 'app-version')?.detail).toContain('1.0.5 et avant')
    const t = validInput({
      minAppVersion: '1.0.6', maxAppVersion: '1.2.0', platforms: ['ANDROID'], connectedOnly: true, samplePercent: 50,
      conditions: { op: 'AND', children: [{ field: 'country', operator: 'IS', value: 'CI' }] },
    })
    for (const id of ['version-range', 'platforms', 'connected', 'rules', 'sample']) expect(row(t, id)?.verdict, id).toBe('check')
    expect(row(t, 'sample')?.detail).toContain('50 %')
  })

  it('déclencheur : corridor, seuils', () => {
    const t = validInput({
      triggers: ['SEARCH_FEW_RESULTS', 'TRIP_VIEWED_REPEATEDLY'], corridors: [{ from: 'Paris', to: 'Dakar' }],
      triggerOptions: { fewResultsMax: 4, tripViewedTimes: 5 },
    })
    expect(row(t, 'corridors')?.detail).toContain('Paris vers Dakar')
    expect(row(t, 'few-results')?.detail).toContain('4 résultats')
    expect(row(t, 'trip-viewed')?.detail).toContain('5 consultations')
    expect(row(validInput({ triggers: ['APP_OPEN'], corridors: [{ from: 'Paris', to: null }] }), 'corridors')).toBeUndefined()
  })

  it('répétition : plafond, jours, réponses, case, délai', () => {
    expect(row(validInput({ frequency: 'UP_TO_N', maxDisplays: 3 }), 'frequency')?.detail).toContain('3 affichages')
    expect(row(validInput({ frequency: 'ONCE' }), 'frequency')?.detail).toContain('Une seule fois')
    expect(row(validInput({ frequency: 'EVERY_OPEN' }), 'frequency')?.detail).toContain('ouverture')
    expect(row(validInput({ frequency: 'EVERY_N_DAYS', frequencyDays: 7 }), 'frequency')?.detail).toContain('7 jours')
    expect(row(validInput({ stopAfterAnswer: false }), 'stop-after-answer')?.verdict).toBe('ok')
    expect(row(validInput({ allowDontShowAgain: true }), 'dont-show')?.verdict).toBe('check')
    expect(row(validInput({ triggers: ['SEARCH_TAB'] }), 'delay')?.detail).toContain('2 secondes')
    expect(row(validInput({ triggers: ['PUBLISH_TRIP'] }), 'delay')).toBeUndefined()
    expect(row(validInput(), 'daily')?.detail).toContain('1 modal par jour')
  })

  it('règles communes et panneau affiché', () => {
    const w = mount(DisplayConditionsPanel, { props: { input: validInput({ triggers: [] }), active: false, errors: {}, now } })
    expect(w.get('[data-test="vm-dc-blocked"]').exists()).toBe(true)
    expect(w.get('[data-test="vm-dc-status"]').attributes('data-verdict')).toBe('block')
    expect(w.get('[data-test="vm-dc-status"] [data-test="vm-dc-badge"]').text()).toBe('Bloque l’affichage')
    expect(w.get('[data-test="vm-dc-common"]').text()).toContain('Jamais deux modals en même temps')
    expect(w.get('[data-test="vm-dc-common"]').text()).toContain('15 minutes')
    expect(w.text()).not.toContain('—')
    const ok = mount(DisplayConditionsPanel, { props: { input: infoInput(), active: true, errors: {}, now } })
    expect(ok.find('[data-test="vm-dc-blocked"]').exists()).toBe(false)
    expect(ok.text()).toContain('cette information')
  })
})
