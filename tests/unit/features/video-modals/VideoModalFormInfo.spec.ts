import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import VideoModalForm from '@/features/video-modals/components/VideoModalForm.vue'
import { INFO_SCREENS, INFO_SCREEN_LABELS, type VideoModalInput } from '@/features/video-modals/types/index'
import { infoModal } from './fixtures'

const mountInfo = (props: Record<string, unknown> = {}) =>
  mount(VideoModalForm, { props: { modal: null, type: 'INFO', ...props } })

async function fillBase(w: ReturnType<typeof mountInfo>) {
  await w.get('[data-test="vm-name"]').setValue('Annonce')
  await w.get('[data-test="vm-title-fr"]').setValue('Nouveauté')
  await w.get('[data-test="vm-body-fr"]').setValue('Un texte')
}

describe('VideoModalForm : type Information, création', () => {
  it('champs Information visibles, champs vidéo absents', () => {
    const w = mountInfo()
    for (const sel of ['vm-icon', 'vm-body-fr', 'vm-body-en', 'vm-primary-fr', 'vm-primary-kind', 'vm-secondary-enabled']) {
      expect(w.find(`[data-test="${sel}"]`).exists(), sel).toBe(true)
    }
    for (const sel of ['vm-url', 'vm-duration', 'vm-highlight-add', 'vm-url-reminder']) {
      expect(w.find(`[data-test="${sel}"]`).exists(), sel).toBe(false)
    }
    expect(w.find('[data-test="vm-secondary-box"]').exists()).toBe(false)
    expect(w.find('[data-test="vm-type"]').exists()).toBe(false)
    expect(w.find('[data-test="vm-preview-body"]').exists()).toBe(true)
  })

  it('l’icône propose la liste existante plus BELL et INFO', () => {
    const values = w => w
    const opts = mountInfo().findAll('[data-test="vm-icon"] option').map(o => o.attributes('value'))
    expect(opts).toEqual(['PARCEL', 'SUITCASE', 'LOCK', 'SEARCH', 'CHAT', 'QR', 'STAR', 'WALLET', 'BELL', 'INFO'])
    void values
  })

  it('compteur de caractères du texte FR et EN', async () => {
    const w = mountInfo()
    expect(w.get('[data-test="vm-body-fr-count"]').text()).toBe('0 / 500')
    await w.get('[data-test="vm-body-fr"]').setValue('abc')
    await w.get('[data-test="vm-body-en"]').setValue('a'.repeat(501))
    expect(w.get('[data-test="vm-body-fr-count"]').text()).toBe('3 / 500')
    expect(w.get('[data-test="vm-body-en-count"]').text()).toBe('501 / 500')
    expect(w.get('[data-test="vm-body-en-count"]').classes()).toContain('text-danger')
  })

  it('formulaire vide : erreurs, rien n’est émis', async () => {
    const w = mountInfo()
    await w.get('form').trigger('submit')
    expect(w.emitted('submit')).toBeUndefined()
    expect(w.text()).toContain('Donnez un nom')
    expect(w.text()).toContain('Le texte en français est obligatoire')
  })

  it('écran : liste fermée avec libellés lisibles, corps SCREEN envoyé', async () => {
    const w = mountInfo()
    await w.get('[data-test="vm-primary-kind"]').setValue('SCREEN')
    const opts = w.findAll('[data-test="vm-primary-screen"] option').filter(o => o.attributes('value'))
    expect(opts.map(o => o.attributes('value'))).toEqual([...INFO_SCREENS])
    expect(opts.map(o => o.text())).toEqual(INFO_SCREENS.map(s => INFO_SCREEN_LABELS[s]))
    await fillBase(w)
    await w.get('[data-test="vm-primary-fr"]').setValue('Voir le suivi')
    expect((w.get('[data-test="vm-primary-screen"]').element as HTMLSelectElement).value).toBe('SEARCH')
    await w.get('[data-test="vm-primary-screen"]').setValue('TRACKING')
    await w.get('form').trigger('submit')
    const [input, activate] = w.emitted('submit')![0] as [VideoModalInput, boolean]
    expect(activate).toBe(false)
    expect(input).toMatchObject({
      type: 'INFO', youtubeUrl: null, durationSeconds: null, highlights: [], icon: 'INFO',
      primaryAction: { kind: 'SCREEN', screen: 'TRACKING', url: null }, secondaryAction: null,
    })
  })

  it('lien : http refusé avec un message clair, https accepté', async () => {
    const w = mountInfo()
    await fillBase(w)
    await w.get('[data-test="vm-primary-kind"]').setValue('URL')
    await w.get('[data-test="vm-primary-fr"]').setValue('En savoir plus')
    await w.get('[data-test="vm-primary-url"]').setValue('http://yadony.com')
    await w.get('form').trigger('submit')
    expect(w.emitted('submit')).toBeUndefined()
    expect(w.get('[data-test="vm-primary-url-error"]').text()).toContain('Seuls les liens https://')
    await w.get('[data-test="vm-primary-url"]').setValue('https://yadony.com/aide')
    await w.get('form').trigger('submit')
    const [input] = w.emitted('submit')![0] as [VideoModalInput]
    expect(input.primaryAction).toEqual({ kind: 'URL', screen: null, url: 'https://yadony.com/aide' })
  })

  it('changer l’action efface l’écran ou le lien de l’ancienne', async () => {
    const w = mountInfo()
    await w.get('[data-test="vm-primary-kind"]').setValue('URL')
    await w.get('[data-test="vm-primary-url"]').setValue('https://yadony.com')
    await w.get('[data-test="vm-primary-kind"]').setValue('SCREEN')
    expect((w.get('[data-test="vm-primary-screen"]').element as HTMLSelectElement).value).toBe('SEARCH')
    await w.get('[data-test="vm-primary-kind"]').setValue('CLOSE')
    expect(w.find('[data-test="vm-primary-screen"]').exists()).toBe(false)
    expect(w.find('[data-test="vm-primary-url"]').exists()).toBe(false)
  })

  it('bouton secondaire facultatif : coché, mêmes champs et envoyé ; décoché, absent', async () => {
    const w = mountInfo()
    await fillBase(w)
    await w.get('[data-test="vm-secondary-enabled"]').setValue(true)
    await w.get('[data-test="vm-secondary-kind"]').setValue('URL')
    await w.get('[data-test="vm-secondary-fr"]').setValue('Plus d’infos')
    await w.get('[data-test="vm-secondary-url"]').setValue('javascript:alert(1)')
    await w.get('form').trigger('submit')
    expect(w.emitted('submit')).toBeUndefined()
    expect(w.get('[data-test="vm-secondary-url-error"]').exists()).toBe(true)
    await w.get('[data-test="vm-secondary-url"]').setValue('https://yadony.com')
    expect(w.get('[data-test="vm-preview-secondary"]').text()).toBe('Plus d’infos')
    await w.get('form').trigger('submit')
    const [input] = w.emitted('submit')![0] as [VideoModalInput]
    expect(input.secondaryAction).toEqual({ kind: 'URL', screen: null, url: 'https://yadony.com' })
    expect(input.secondaryLabelFr).toBe('Plus d’infos')
    await w.get('[data-test="vm-secondary-enabled"]').setValue(false)
    expect(w.find('[data-test="vm-preview-secondary"]').exists()).toBe(false)
  })

  it('libellé de plus de 26 caractères : erreur', async () => {
    const w = mountInfo()
    await fillBase(w)
    await w.get('[data-test="vm-primary-en"]').setValue('x'.repeat(27))
    await w.get('form').trigger('submit')
    expect(w.emitted('submit')).toBeUndefined()
    expect(w.text()).toContain('26 caractères au plus')
  })

  it('aperçu en direct FR / EN, icône comprise', async () => {
    const w = mountInfo()
    await w.get('[data-test="vm-title-fr"]').setValue('Bonjour')
    await w.get('[data-test="vm-title-en"]').setValue('Hello')
    await w.get('[data-test="vm-body-fr"]').setValue('Corps')
    await w.get('[data-test="vm-icon"]').setValue('BELL')
    expect(w.get('[data-test="vm-preview-title"]').text()).toBe('Bonjour')
    expect(w.get('[data-test="vm-preview-body"]').text()).toBe('Corps')
    expect(w.get('[data-test="vm-preview-halo"]').attributes('style')).toContain('#FFF4D6')
    await w.get('[data-test="vm-lang-en"]').trigger('click')
    expect(w.get('[data-test="vm-preview-title"]').text()).toBe('Hello')
    expect(w.get('[data-test="vm-preview-body"]').text()).toBe('Corps')
  })
})

describe('VideoModalForm : type Information, modification', () => {
  it('reprend la campagne, type fixé, statistiques sans « vue en entier »', () => {
    const w = mount(VideoModalForm, { props: { modal: infoModal({ secondaryAction: { kind: 'CLOSE', screen: null, url: null }, secondaryLabelFr: 'Plus tard' }) } })
    expect(w.get('[data-test="vm-type"]').text()).toContain('Information')
    expect(w.find('[data-test="vm-type-VIDEO"]').exists()).toBe(false)
    expect((w.get('[data-test="vm-body-fr"]').element as HTMLTextAreaElement).value).toBe('Découvrez le suivi en direct.')
    expect((w.get('[data-test="vm-primary-screen"]').element as HTMLSelectElement).value).toBe('TRACKING')
    expect((w.get('[data-test="vm-secondary-enabled"]').element as HTMLInputElement).checked).toBe(true)
    expect(w.get('[data-test="vm-stats"]').text()).toContain('bouton touché')
    expect(w.find('[data-test="vm-stat-completed"]').exists()).toBe(false)
  })
})
