import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
const fieldsMock = vi.fn()
vi.mock('@/features/broadcast/services/broadcastService', () => ({ broadcastService: { fields: () => fieldsMock() } }))
const estimateMock = vi.fn()
vi.mock('@/features/video-modals/services/videoModalService', () => ({ videoModalService: { estimateAudience: (...a: unknown[]) => estimateMock(...a) } }))
import VideoModalForm from '@/features/video-modals/components/VideoModalForm.vue'
import { ESTIMATE_DEBOUNCE_MS } from '@/features/video-modals/composables/useAudienceEstimate'
import type { VideoModalInput } from '@/features/video-modals/types/index'
import { audienceFields, ciRule, infoModal, modal } from './fixtures'

type Wrapper = ReturnType<typeof mountForm>
const mountForm = (props: Record<string, unknown> = {}) => mount(VideoModalForm, { props: { modal: null, ...props } })
const advance = () => vi.advanceTimersByTimeAsync(ESTIMATE_DEBOUNCE_MS)

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
async function fillInfo(w: Wrapper) {
  await w.get('[data-test="vm-name"]').setValue('Annonce')
  await w.get('[data-test="vm-title-fr"]').setValue('Nouveauté')
  await w.get('[data-test="vm-body-fr"]').setValue('Un texte')
}
const submitted = (w: Wrapper) => w.emitted('submit')![0] as [VideoModalInput, boolean, File | null]

describe('VideoModalForm : ciblage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    fieldsMock.mockReset().mockResolvedValue(audienceFields)
    estimateMock.mockReset().mockResolvedValue({ accounts: 1180, afterSample: 1180 })
  })
  afterEach(() => vi.useRealTimers())

  describe('défauts selon le type', () => {
    it('vidéo : une seule fois, arrêt après une réponse, tout le monde ; quatre fréquences proposées', async () => {
      const w = await ready()
      expect((w.get('[data-test="vm-frequency-ONCE"] input').element as HTMLInputElement).checked).toBe(true)
      expect(w.get('[data-test="vm-stop-after-answer"]').attributes('aria-checked')).toBe('true')
      expect(w.get('[data-test="vm-dont-show-again"]').attributes('aria-checked')).toBe('false')
      expect(w.find('[data-test="vm-frequency-EVERY_OPEN"]').exists()).toBe(true)
      expect(w.find('[data-test="vm-frequency-EVERY_N_DAYS"]').exists()).toBe(true)
      expect(w.get('[data-test="vm-version-box"]').text()).toContain('n’ont jamais répondu')
      await fillVideo(w)
      await w.get('form').trigger('submit')
      const [input] = submitted(w)
      expect(input).toMatchObject({
        type: 'VIDEO', frequency: 'ONCE', maxDisplays: 1, stopAfterAnswer: true, allowDontShowAgain: false, priority: 0,
        connectedOnly: false, conditions: null, platforms: [], samplePercent: 100, situations: [], minAppVersion: null, maxAppVersion: null,
      })
      expect(input).not.toHaveProperty('audience')
    })

    it('information : mêmes réglages de départ, quatre fréquences, public « tout le monde » envoyé à la création', async () => {
      const w = await ready({ type: 'INFO' })
      for (const f of ['ONCE', 'UP_TO_N', 'EVERY_OPEN', 'EVERY_N_DAYS']) expect(w.find(`[data-test="vm-frequency-${f}"]`).exists(), f).toBe(true)
      expect(w.get('[data-test="vm-version-box"]').text()).toContain('tout le monde')
      await fillInfo(w)
      await w.get('form').trigger('submit')
      expect(submitted(w)[0]).toMatchObject({ type: 'INFO', frequency: 'ONCE', stopAfterAnswer: true, audience: 'EVERYONE' })
    })

    it('modification : le public n’est jamais renvoyé', async () => {
      const w = await ready({ modal: infoModal() })
      await w.get('form').trigger('submit')
      expect(submitted(w)[0]).not.toHaveProperty('audience')
    })
  })

  describe('moment : situations', () => {
    it('une situation seule suffit (aucun déclencheur) ; sa valeur par défaut est proposée puis modifiable', async () => {
      const w = await ready()
      await fillVideo(w)
      await w.get('[data-test="vm-trigger-SEARCH_TAB"] input').trigger('change')
      await w.get('form').trigger('submit')
      expect(w.emitted('submit')).toBeUndefined()
      expect(w.get('[data-test="vm-triggers-error"]').text()).toContain('au moins un endroit')

      await w.get('[data-test="vm-situation-OFFER_ACCEPTED_UNPAID"] input').trigger('change')
      expect((w.get('[data-test="vm-situation-value-OFFER_ACCEPTED_UNPAID"]').element as HTMLInputElement).value).toBe('6')
      await w.get('[data-test="vm-situation-value-OFFER_ACCEPTED_UNPAID"]').setValue('9')
      await w.get('[data-test="vm-situation-PROFILE_INCOMPLETE"] input').trigger('change')
      await w.get('form').trigger('submit')
      expect(submitted(w)[0]).toMatchObject({
        triggers: [], situations: [{ kind: 'OFFER_ACCEPTED_UNPAID', value: 9 }, { kind: 'PROFILE_INCOMPLETE', value: null }],
      })
      // La phrase en clair dit que la campagne s'ouvre à l'ouverture de l'app, tant que les situations sont vraies.
      expect(w.get('[data-test="vm-summary-text"]').text()).toContain('2 secondes après l’ouverture de l’app, tant qu’une offre acceptée n’est pas payée depuis 9 h et que le profil est incomplet')
    })

    it('décocher une situation la retire ; valeur hors bornes ou vide : refus', async () => {
      const w = await ready()
      await fillVideo(w)
      await w.get('[data-test="vm-situation-RETURN_AFTER_ABSENCE"] input').trigger('change')
      await w.get('[data-test="vm-situation-value-RETURN_AFTER_ABSENCE"]').setValue('400')
      await w.get('form').trigger('submit')
      expect(w.emitted('submit')).toBeUndefined()
      expect(w.get('[data-test="vm-situations-error"]').text()).toContain('1 à 365')
      await w.get('[data-test="vm-situation-value-RETURN_AFTER_ABSENCE"]').setValue('')
      expect(w.get('[data-test="vm-situations-error"]').exists()).toBe(true)
      await w.get('[data-test="vm-situation-RETURN_AFTER_ABSENCE"] input').trigger('change')
      expect(w.find('[data-test="vm-situation-value-RETURN_AFTER_ABSENCE"]').exists()).toBe(false)
      await w.get('form').trigger('submit')
      expect(submitted(w)[0].situations).toEqual([])
    })
  })

  describe('conditions de Communications', () => {
    it('le constructeur de règles de la Diffusion alimente `conditions` (corps du back, sans identifiants locaux)', async () => {
      const w = await ready()
      await fillVideo(w)
      await w.get('[data-test="add-condition"]').trigger('click')
      await w.get('[data-test="pick-field-country"]').trigger('click')
      await w.get('[data-test="value-enum"]').setValue('CI')
      await w.get('[data-test="add-condition"]').trigger('click')
      await w.get('[data-test="pick-field-bids_count"]').trigger('click')
      await w.get('[data-test="value-int"]').setValue('0')
      await w.get('form').trigger('submit')
      expect(submitted(w)[0].conditions).toEqual({
        op: 'AND',
        children: [{ field: 'country', operator: 'IS', value: 'CI' }, { field: 'bids_count', operator: 'EQ', value: 0 }],
      })
      expect(w.get('[data-test="vm-summary-text"]').text()).toContain('qui répondent à Pays de résidence est Côte d’Ivoire et Colis envoyés égal à 0')
      expect(w.get('[data-test="vm-visitors-note"]').text()).toContain('ne verront pas ce modal')
    })

    it('condition incomplète : refus avec message', async () => {
      const w = await ready()
      await fillVideo(w)
      await w.get('[data-test="add-condition"]').trigger('click')
      await w.get('[data-test="pick-field-country"]').trigger('click')
      await w.get('form').trigger('submit')
      expect(w.emitted('submit')).toBeUndefined()
      expect(w.get('[data-test="vm-conditions-error"]').text()).toContain('conditions incomplètes')
      // Retirée, la saisie repart.
      await w.get('[data-test="remove-condition"]').trigger('click')
      await w.get('form').trigger('submit')
      expect(submitted(w)[0].conditions).toBeNull()
    })

    it('supprimer toutes les conditions renvoie null (pas un groupe vide)', async () => {
      const w = await ready({ modal: modal({ conditions: ciRule() }) })
      expect(w.findAll('[data-test="condition-row"]')).toHaveLength(2)
      await w.findAll('[data-test="remove-condition"]')[0]!.trigger('click')
      await w.findAll('[data-test="remove-condition"]')[0]!.trigger('click')
      await w.get('form').trigger('submit')
      expect(submitted(w)[0].conditions).toBeNull()
    })

    it('catalogue indisponible : erreur, « Réessayer » recharge ; les conditions existantes repartent intactes', async () => {
      fieldsMock.mockRejectedValueOnce(new Error('réseau coupé'))
      const w = await ready({ modal: modal({ conditions: ciRule() }) })
      expect(w.get('[data-test="vm-catalog-error"]').text()).toContain('réseau coupé')
      await w.get('form').trigger('submit')
      expect(submitted(w)[0].conditions).toEqual(ciRule())
      await w.get('[data-test="vm-catalog-retry"]').trigger('click')
      await flushPromises()
      expect(fieldsMock).toHaveBeenCalledTimes(2)
      expect(w.find('[data-test="vm-catalog-error"]').exists()).toBe(false)
      expect(w.findAll('[data-test="condition-row"]')).toHaveLength(2)
    })

    it('catalogue qui répond autre chose qu’une liste : pas de plantage', async () => {
      fieldsMock.mockResolvedValue(undefined)
      const w = await ready()
      expect(w.find('[data-test="vm-who"]').exists()).toBe(true)
      await fillVideo(w)
      await w.get('form').trigger('submit')
      expect(submitted(w)[0].conditions).toBeNull()
    })
  })

  describe('réglages dédiés, validation', () => {
    it('version, système, tirage, connectés, priorité : envoyés', async () => {
      const w = await ready({ type: 'INFO' })
      await fillInfo(w)
      await w.get('[data-test="vm-min-version"]').setValue(' 1.0.6 ')
      await w.get('[data-test="vm-max-version"]').setValue('1.2.0')
      await w.get('[data-test="vm-platform-ANDROID"] input').trigger('change')
      await w.get('[data-test="vm-sample"]').setValue('50')
      await w.get('[data-test="vm-connected-only"]').trigger('click')
      await w.get('[data-test="vm-priority"]').setValue('5')
      await w.get('[data-test="vm-frequency-EVERY_N_DAYS"] input[type="radio"]').setValue(true)
      await w.get('[data-test="vm-frequency-days"]').setValue('7')
      await w.get('[data-test="vm-stop-after-answer"]').trigger('click')
      await w.get('[data-test="vm-dont-show-again"]').trigger('click')
      await w.get('[data-test="vm-ends"]').setValue('2026-11-30T12:00')
      await w.get('form').trigger('submit')
      expect(submitted(w)[0]).toMatchObject({
        minAppVersion: '1.0.6', maxAppVersion: '1.2.0', platforms: ['ANDROID'], samplePercent: 50, connectedOnly: true, priority: 5,
        frequency: 'EVERY_N_DAYS', frequencyDays: 7, stopAfterAnswer: false, allowDontShowAgain: true,
      })
      const text = w.get('[data-test="vm-summary-text"]').text()
      expect(text).toContain('uniquement pour les personnes connectées')
      expect(text).toContain('sur Android')
      expect(text).toContain('avec l’application de 1.0.6 à 1.2.0')
      expect(text).toContain('pour 50 % des personnes concernées')
      expect(text).toContain('au plus une fois tous les 7 jours, même après un bouton touché, jusqu’au 30/11/2026, avec une case « Ne plus afficher »')
      expect(w.get('[data-test="vm-summary-priority"]').text()).toContain('5')
    })

    it('valeurs refusées : rien n’est émis, chaque erreur est affichée', async () => {
      const w = await ready({ type: 'INFO' })
      await fillInfo(w)
      await w.get('[data-test="vm-min-version"]').setValue('1.0')
      await w.get('[data-test="vm-max-version"]').setValue('0.9.0')
      await w.get('[data-test="vm-sample"]').setValue('0')
      await w.get('[data-test="vm-priority"]').setValue('1.5')
      await w.get('[data-test="vm-frequency-EVERY_N_DAYS"] input[type="radio"]').setValue(true)
      await w.get('[data-test="vm-frequency-days"]').setValue('400')
      await w.get('form').trigger('submit')
      expect(w.emitted('submit')).toBeUndefined()
      for (const sel of ['vm-min-version-error', 'vm-sample-error', 'vm-priority-error', 'vm-frequency-days-error']) {
        expect(w.find(`[data-test="${sel}"]`).exists(), sel).toBe(true)
      }
      expect(w.get('[data-test="vm-sample-error"]').text()).toContain('1 à 100')
      expect(w.get('[data-test="vm-frequency-days-error"]').text()).toContain('1 à 365')
    })

    it('les erreurs de ciblage n’apparaissent qu’après une tentative', async () => {
      const w = await ready()
      await w.get('[data-test="vm-sample"]').setValue('0')
      expect(w.find('[data-test="vm-sample-error"]').exists()).toBe(false)
    })
  })

  describe('case « Ne plus afficher » et aperçus', () => {
    it.each([['VIDEO'], ['INFO']] as const)('%s : cochée dans l’admin, présente dans l’aperçu FR et EN', async (type) => {
      const w = await ready({ type })
      expect(w.find('[data-test="vm-preview-dontshow"]').exists()).toBe(false)
      await w.get('[data-test="vm-dont-show-again"]').trigger('click')
      expect(w.get('[data-test="vm-preview-dontshow"]').text()).toBe('Ne plus afficher')
      await w.get('[data-test="vm-lang-en"]').trigger('click')
      expect(w.get('[data-test="vm-preview-dontshow"]').text()).toBe('Don’t show again')
      await w.get('[data-test="vm-dont-show-again"]').trigger('click')
      expect(w.find('[data-test="vm-preview-dontshow"]').exists()).toBe(false)
    })
  })

  describe('estimation d’audience', () => {
    it('une estimation après le délai, avec le corps du contrat ; le chargement est visible avant', async () => {
      const w = await ready()
      expect(w.find('[data-test="vm-estimate-loading"]').exists()).toBe(true)
      expect(estimateMock).not.toHaveBeenCalled()
      await advance()
      await vi.waitFor(() => expect(w.find('[data-test="vm-estimate-accounts"]').exists()).toBe(true))
      expect(estimateMock).toHaveBeenCalledTimes(1)
      expect(estimateMock).toHaveBeenCalledWith({
        conditions: null, connectedOnly: false, platforms: [], samplePercent: 100, minAppVersion: null, maxAppVersion: null,
      })
      expect(w.get('[data-test="vm-estimate-accounts"]').text().replace(/\s/g, ' ')).toContain('≈ 1 180')
      expect(w.find('[data-test="vm-estimate-sample"]').exists()).toBe(false)
    })

    it('le ciblage change : nouvelle estimation avec la part du tirage', async () => {
      estimateMock.mockResolvedValueOnce({ accounts: 1180, afterSample: 1180 })
      estimateMock.mockResolvedValueOnce({ accounts: 1180, afterSample: 590 })
      const w = await ready()
      await advance()
      await vi.waitFor(() => expect(w.find('[data-test="vm-estimate-accounts"]').exists()).toBe(true))
      await w.get('[data-test="vm-sample"]').setValue('50')
      await w.get('[data-test="vm-platform-ANDROID"] input').trigger('change')
      await advance()
      await vi.waitFor(() => expect(w.find('[data-test="vm-estimate-sample"]').exists()).toBe(true))
      expect(estimateMock).toHaveBeenCalledTimes(2)
      expect(estimateMock).toHaveBeenLastCalledWith({
        conditions: null, connectedOnly: false, platforms: ['ANDROID'], samplePercent: 50, minAppVersion: null, maxAppVersion: null,
      })
      expect(w.get('[data-test="vm-estimate-sample"]').text()).toContain('après le tirage à 50 %')
    })

    it('les conditions complètes partent dans la requête ; les situations non', async () => {
      const w = await ready({ modal: modal({ conditions: ciRule(), connectedOnly: true, situations: [{ kind: 'KYC_ABANDONED', value: null }] }) })
      await advance()
      await vi.waitFor(() => expect(estimateMock).toHaveBeenCalledTimes(1))
      const body = estimateMock.mock.calls[0]![0] as Record<string, unknown>
      expect(body.conditions).toEqual(ciRule())
      expect(body.connectedOnly).toBe(true)
      expect(body).not.toHaveProperty('situations')
      await vi.waitFor(() => expect(w.find('[data-test="vm-estimate-note"]').exists()).toBe(true))
      expect(w.get('[data-test="vm-estimate-note"]').text()).toContain('situations')
    })

    it('ciblage incomplet ou invalide : aucune requête, invite à compléter', async () => {
      const w = await ready()
      await advance()
      await vi.waitFor(() => expect(estimateMock).toHaveBeenCalledTimes(1))
      await w.get('[data-test="vm-sample"]').setValue('0')
      await advance()
      expect(estimateMock).toHaveBeenCalledTimes(1)
      expect(w.get('[data-test="vm-estimate-hint"]').text()).toContain('Complétez le ciblage')
      await w.get('[data-test="vm-sample"]').setValue('80')
      await w.get('[data-test="add-condition"]').trigger('click')
      await w.get('[data-test="pick-field-country"]').trigger('click')
      await advance()
      expect(estimateMock).toHaveBeenCalledTimes(1)
      expect(w.find('[data-test="vm-estimate-hint"]').exists()).toBe(true)
    })

    it('erreur du back : message du serveur et « Réessayer »', async () => {
      estimateMock.mockRejectedValueOnce({ data: { detail: 'Champ inconnu : foo' } })
      const w = await ready()
      await advance()
      await vi.waitFor(() => expect(w.find('[data-test="vm-estimate-error"]').exists()).toBe(true))
      expect(w.get('[data-test="vm-estimate-error"]').text()).toContain('Champ inconnu : foo')
      await w.get('[data-test="vm-estimate-retry"]').trigger('click')
      await vi.waitFor(() => expect(w.find('[data-test="vm-estimate-accounts"]').exists()).toBe(true))
      expect(estimateMock).toHaveBeenCalledTimes(2)
    })
  })

  describe('modification d’une campagne', () => {
    it('reprend moment, ciblage, fréquence et les renvoie à l’identique', async () => {
      const m = infoModal({
        triggers: ['APP_OPEN'], situations: [{ kind: 'OFFER_UNANSWERED', value: 12 }], frequency: 'EVERY_N_DAYS', frequencyDays: 7,
        stopAfterAnswer: false, allowDontShowAgain: true, priority: 5, connectedOnly: true, conditions: ciRule(), minAppVersion: '1.0.6',
        maxAppVersion: null, platforms: ['IOS'], samplePercent: 40,
      })
      const w = await ready({ modal: m })
      expect((w.get('[data-test="vm-frequency-EVERY_N_DAYS"] input[type="radio"]').element as HTMLInputElement).checked).toBe(true)
      expect((w.get('[data-test="vm-frequency-days"]').element as HTMLInputElement).value).toBe('7')
      expect((w.get('[data-test="vm-priority"]').element as HTMLInputElement).value).toBe('5')
      expect((w.get('[data-test="vm-situation-value-OFFER_UNANSWERED"]').element as HTMLInputElement).value).toBe('12')
      expect((w.get('[data-test="vm-min-version"]').element as HTMLInputElement).value).toBe('1.0.6')
      expect((w.get('[data-test="vm-sample"]').element as HTMLInputElement).value).toBe('40')
      expect(w.get('[data-test="vm-dont-show-again"]').attributes('aria-checked')).toBe('true')
      expect(w.get('[data-test="vm-stop-after-answer"]').attributes('aria-checked')).toBe('false')
      await w.get('form').trigger('submit')
      expect(submitted(w)[0]).toMatchObject({
        triggers: ['APP_OPEN'], situations: [{ kind: 'OFFER_UNANSWERED', value: 12 }], frequency: 'EVERY_N_DAYS', frequencyDays: 7,
        stopAfterAnswer: false, allowDontShowAgain: true, priority: 5, connectedOnly: true, conditions: ciRule(), minAppVersion: '1.0.6',
        maxAppVersion: null, platforms: ['IOS'], samplePercent: 40,
      })
    })

    it('campagne d’avant le ciblage : « jusqu’à N fois » sélectionné, rien de nouveau envoyé en plus d’un comportement identique', async () => {
      const w = await ready({ modal: modal({ maxDisplays: 4 }) })
      expect((w.get('[data-test="vm-frequency-UP_TO_N"] input[type="radio"]').element as HTMLInputElement).checked).toBe(true)
      expect((w.get('[data-test="vm-max"]').element as HTMLInputElement).value).toBe('4')
      expect(w.get('[data-test="vm-stop-after-answer"]').attributes('aria-checked')).toBe('true')
      await w.get('form').trigger('submit')
      expect(submitted(w)[0]).toMatchObject({
        frequency: 'UP_TO_N', maxDisplays: 4, stopAfterAnswer: true, allowDontShowAgain: false, priority: 0, connectedOnly: false,
        conditions: null, platforms: [], samplePercent: 100, situations: [],
      })
    })

    it('vidéo réglée sur « à chaque ouverture » : la fréquence reste visible et sélectionnée', async () => {
      const w = await ready({ modal: modal({ frequency: 'EVERY_OPEN' }) })
      expect((w.get('[data-test="vm-frequency-EVERY_OPEN"] input[type="radio"]').element as HTMLInputElement).checked).toBe(true)
    })
  })
})
