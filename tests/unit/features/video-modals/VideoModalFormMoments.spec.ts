import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
const fieldsMock = vi.fn()
vi.mock('@/features/broadcast/services/broadcastService', () => ({ broadcastService: { fields: () => fieldsMock() } }))
const estimateMock = vi.fn()
vi.mock('@/features/video-modals/services/videoModalService', () => ({ videoModalService: { estimateAudience: (...a: unknown[]) => estimateMock(...a) } }))
import VideoModalForm from '@/features/video-modals/components/VideoModalForm.vue'
import type { VideoModalInput } from '@/features/video-modals/types/index'
import { audienceFields, infoModal, modal } from './fixtures'

type Wrapper = ReturnType<typeof mountForm>
const mountForm = (props: Record<string, unknown> = {}) => mount(VideoModalForm, { props: { modal: null, ...props } })
async function ready(props: Record<string, unknown> = {}) {
  const w = mountForm(props)
  await flushPromises()
  return w
}
async function fillVideo(w: Wrapper) {
  await w.get('[data-test="vm-name"]').setValue('Vidéo d’accueil')
  await w.get('[data-test="vm-url"]').setValue('https://youtu.be/dQw4w9WgXcQ')
  await w.get('[data-test="vm-title-fr"]').setValue('Bienvenue')
}
const check = (w: Wrapper, trigger: string) => w.get(`[data-test="vm-trigger-${trigger}"] input`).trigger('change')
const submitted = (w: Wrapper) => w.emitted('submit')![0] as [VideoModalInput, boolean, File | null]
const summaryOf = (w: Wrapper) => w.get('[data-test="vm-summary-text"]').text()

describe('VideoModalForm : moments d’action et corridors', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    fieldsMock.mockReset().mockResolvedValue(audienceFields)
    estimateMock.mockReset().mockResolvedValue({ accounts: 10, afterSample: 10 })
  })
  afterEach(() => vi.useRealTimers())

  it('création sans toucher aux moments : seuils par défaut et aucun corridor dans le corps, ancienne mention absente', async () => {
    const w = await ready()
    await fillVideo(w)
    expect(w.find('[data-test="vm-moments-compat-note"]').exists()).toBe(false)
    await w.get('form').trigger('submit')
    expect(submitted(w)[0]).toMatchObject({ triggers: ['SEARCH_TAB'], triggerOptions: { fewResultsMax: 2, tripViewedTimes: 3 }, corridors: [] })
  })

  it('cocher un moment d’action : envoyé, mention des anciennes versions, phrase en clair', async () => {
    const w = await ready()
    await fillVideo(w)
    await check(w, 'PAYMENT_SUCCEEDED')
    await check(w, 'SEARCH_TAB')
    expect(w.get('[data-test="vm-moments-compat-note"]').text()).toContain('ne verront que les moments d’écran et de bouton')
    expect(summaryOf(w)).toContain('2 secondes après un paiement réussi')
    await w.get('form').trigger('submit')
    expect(submitted(w)[0].triggers).toEqual(['PAYMENT_SUCCEEDED'])
  })

  it('seuil de peu de résultats : champ visible une fois coché, valeur envoyée et dite en clair', async () => {
    const w = await ready()
    await fillVideo(w)
    expect(w.find('[data-test="vm-few-results-max"]').exists()).toBe(false)
    await check(w, 'SEARCH_FEW_RESULTS')
    expect((w.get('[data-test="vm-few-results-max"]').element as HTMLInputElement).value).toBe('2')
    await w.get('[data-test="vm-few-results-max"]').setValue('6')
    expect(summaryOf(w)).toContain('une recherche qui renvoie de 1 à 6 résultats')
    await w.get('form').trigger('submit')
    expect(submitted(w)[0].triggerOptions).toEqual({ fewResultsMax: 6, tripViewedTimes: 3 })
  })

  it('même trajet consulté : champ visible une fois coché, envoyé', async () => {
    const w = await ready()
    await fillVideo(w)
    await check(w, 'TRIP_VIEWED_REPEATEDLY')
    expect((w.get('[data-test="vm-trip-viewed-times"]').element as HTMLInputElement).value).toBe('3')
    await w.get('[data-test="vm-trip-viewed-times"]').setValue('5')
    expect(summaryOf(w)).toContain('la consultation du même trajet 5 fois')
    await w.get('form').trigger('submit')
    expect(submitted(w)[0].triggerOptions).toEqual({ fewResultsMax: 2, tripViewedTimes: 5 })
    // Décoché : le champ disparaît.
    await check(w, 'TRIP_VIEWED_REPEATEDLY')
    expect(w.find('[data-test="vm-trip-viewed-times"]').exists()).toBe(false)
  })

  it('seuils hors bornes ou vides : refus avec message, seulement après une tentative', async () => {
    const w = await ready()
    await fillVideo(w)
    await check(w, 'SEARCH_FEW_RESULTS')
    await check(w, 'TRIP_VIEWED_REPEATEDLY')
    await w.get('[data-test="vm-few-results-max"]').setValue('21')
    await w.get('[data-test="vm-trip-viewed-times"]').setValue('1')
    expect(w.find('[data-test="vm-few-results-error"]').exists()).toBe(false)
    await w.get('form').trigger('submit')
    expect(w.emitted('submit')).toBeUndefined()
    expect(w.get('[data-test="vm-few-results-error"]').text()).toContain('1 à 20')
    expect(w.get('[data-test="vm-trip-viewed-error"]').text()).toContain('2 à 10')
    await w.get('[data-test="vm-few-results-max"]').setValue('')
    await w.get('[data-test="vm-trip-viewed-times"]').setValue('abc')
    expect(w.find('[data-test="vm-few-results-error"]').exists()).toBe(true)
    await w.get('[data-test="vm-few-results-max"]').setValue('20')
    await w.get('[data-test="vm-trip-viewed-times"]').setValue('10')
    await w.get('form').trigger('submit')
    expect(submitted(w)[0].triggerOptions).toEqual({ fewResultsMax: 20, tripViewedTimes: 10 })
  })

  it('valeur invalide laissée puis moment décoché : le formulaire part quand même, avec le défaut', async () => {
    const w = await ready()
    await fillVideo(w)
    await check(w, 'SEARCH_FEW_RESULTS')
    await w.get('[data-test="vm-few-results-max"]').setValue('99')
    await check(w, 'SEARCH_FEW_RESULTS')
    await w.get('form').trigger('submit')
    expect(submitted(w)[0].triggerOptions).toEqual({ fewResultsMax: 2, tripViewedTimes: 3 })
  })

  it('corridors : ajout, saisie, retrait ; un côté vide part en null ; phrase en clair', async () => {
    const w = await ready()
    await fillVideo(w)
    await check(w, 'SEARCH_NO_TRIP_RESULTS')
    expect(w.get('[data-test="vm-corridors-empty"]').exists()).toBe(true)
    await w.get('[data-test="vm-corridor-add"]').trigger('click')
    await w.get('[data-test="vm-corridor-add"]').trigger('click')
    await w.get('[data-test="vm-corridor-add"]').trigger('click')
    await w.get('[data-test="vm-corridor-from-0"]').setValue(' Paris ')
    await w.get('[data-test="vm-corridor-to-0"]').setValue('Abidjan')
    await w.get('[data-test="vm-corridor-to-1"]').setValue('Dakar')
    await w.get('[data-test="vm-corridor-remove-2"]').trigger('click')
    expect(w.findAll('[data-test^="vm-corridor-from-"]')).toHaveLength(2)
    expect(summaryOf(w)).toContain('seulement pour un trajet ou un colis de Paris vers Abidjan ou à l’arrivée à Dakar')
    await w.get('form').trigger('submit')
    expect(submitted(w)[0].corridors).toEqual([{ from: 'Paris', to: 'Abidjan' }, { from: null, to: 'Dakar' }])
  })

  it('corridors : dix au plus, ligne vide ou trop longue refusée', async () => {
    const w = await ready()
    await fillVideo(w)
    await check(w, 'FAVORITE_ADDED')
    for (let i = 0; i < 12; i++) await w.get('[data-test="vm-corridor-add"]').trigger('click')
    expect(w.findAll('[data-test^="vm-corridor-from-"]')).toHaveLength(10)
    await w.get('form').trigger('submit')
    expect(w.emitted('submit')).toBeUndefined()
    expect(w.get('[data-test="vm-corridors-error"]').text()).toContain('au moins le départ ou l’arrivée')
    for (let i = 9; i >= 1; i--) await w.get(`[data-test="vm-corridor-remove-${i}"]`).trigger('click')
    await w.get('[data-test="vm-corridor-from-0"]').setValue('x'.repeat(81))
    expect(w.get('[data-test="vm-corridors-error"]').text()).toContain('80 caractères')
    await w.get('[data-test="vm-corridor-from-0"]').setValue('x'.repeat(80))
    await w.get('form').trigger('submit')
    expect(submitted(w)[0].corridors).toEqual([{ from: 'x'.repeat(80), to: null }])
  })

  it('corridors sans moment concerné : avertissement, et la campagne reste enregistrable', async () => {
    const w = await ready()
    await fillVideo(w)
    await w.get('[data-test="vm-corridor-add"]').trigger('click')
    await w.get('[data-test="vm-corridor-from-0"]').setValue('Paris')
    expect(w.get('[data-test="vm-corridors-inactive"]').exists()).toBe(true)
    await check(w, 'PAYMENT_FAILED')
    expect(w.get('[data-test="vm-corridors-inactive"]').exists()).toBe(true)
    await check(w, 'TRIP_PUBLISHED')
    expect(w.find('[data-test="vm-corridors-inactive"]').exists()).toBe(false)
  })

  it('moment sans autre déclencheur : un moment suffit, la phrase ne parle plus d’un moment à choisir', async () => {
    const w = await ready({ type: 'INFO' })
    await w.get('[data-test="vm-name"]').setValue('Annonce')
    await w.get('[data-test="vm-title-fr"]').setValue('Nouveauté')
    await w.get('[data-test="vm-body-fr"]').setValue('Un texte')
    await check(w, 'SEARCH_TAB')
    await w.get('form').trigger('submit')
    expect(w.emitted('submit')).toBeUndefined()
    await check(w, 'APP_UPDATED')
    expect(summaryOf(w)).toContain('la première ouverture après une mise à jour de l’app')
    await w.get('form').trigger('submit')
    expect(submitted(w)[0]).toMatchObject({ type: 'INFO', triggers: ['APP_UPDATED'], audience: 'EVERYONE' })
  })

  it('modification : moments, seuils et corridors repris et renvoyés à l’identique', async () => {
    const m = modal({
      triggers: ['SEARCH_FEW_RESULTS', 'TRIP_VIEWED_REPEATEDLY', 'KYC_VERIFIED'],
      triggerOptions: { fewResultsMax: 7, tripViewedTimes: 4 },
      corridors: [{ from: 'Paris', to: 'Abidjan' }, { from: null, to: 'Dakar' }],
    })
    const w = await ready({ modal: m })
    expect((w.get('[data-test="vm-trigger-KYC_VERIFIED"] input').element as HTMLInputElement).checked).toBe(true)
    expect((w.get('[data-test="vm-few-results-max"]').element as HTMLInputElement).value).toBe('7')
    expect((w.get('[data-test="vm-trip-viewed-times"]').element as HTMLInputElement).value).toBe('4')
    expect((w.get('[data-test="vm-corridor-from-0"]').element as HTMLInputElement).value).toBe('Paris')
    expect((w.get('[data-test="vm-corridor-from-1"]').element as HTMLInputElement).value).toBe('')
    expect((w.get('[data-test="vm-corridor-to-1"]').element as HTMLInputElement).value).toBe('Dakar')
    await w.get('form').trigger('submit')
    expect(submitted(w)[0]).toMatchObject({ triggers: m.triggers, triggerOptions: m.triggerOptions, corridors: m.corridors })
  })

  it('campagne d’avant l’étape 2 : éditable comme avant, seuils par défaut, aucun corridor, pas de mention', async () => {
    for (const m of [modal({ triggers: ['SEARCH_TAB', 'PUBLISH_TRIP'] }), infoModal()]) {
      const w = await ready({ modal: m })
      expect(w.find('[data-test="vm-moments-compat-note"]').exists()).toBe(false)
      expect(w.find('[data-test="vm-corridor-0"]').exists()).toBe(false)
      await w.get('form').trigger('submit')
      expect(submitted(w)[0]).toMatchObject({ triggers: m.triggers, triggerOptions: { fewResultsMax: 2, tripViewedTimes: 3 }, corridors: [] })
    }
  })

  it('l’estimation d’audience ne reçoit ni moments ni corridors (corps du contrat inchangé)', async () => {
    const w = await ready({ modal: modal({ triggers: ['SEARCH_NO_TRIP_RESULTS'], corridors: [{ from: 'Paris', to: null }] }) })
    await vi.advanceTimersByTimeAsync(600)
    await vi.waitFor(() => expect(estimateMock).toHaveBeenCalled())
    const body = estimateMock.mock.calls[0]![0] as Record<string, unknown>
    expect(Object.keys(body).sort()).toEqual(['conditions', 'connectedOnly', 'maxAppVersion', 'minAppVersion', 'platforms', 'samplePercent'])
    expect(w.exists()).toBe(true)
  })
})
