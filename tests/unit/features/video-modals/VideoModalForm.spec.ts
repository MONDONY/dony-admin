import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import VideoModalForm from '@/features/video-modals/components/VideoModalForm.vue'
import type { VideoModalInput } from '@/features/video-modals/types/index'
import { modal } from './fixtures'

const mountForm = (props: Record<string, unknown> = {}) =>
  mount(VideoModalForm, { props: { modal: null, ...props } })

async function fillValid(w: ReturnType<typeof mountForm>) {
  await w.get('[data-test="vm-name"]').setValue('Vidéo d’accueil')
  await w.get('[data-test="vm-url"]').setValue('https://youtu.be/dQw4w9WgXcQ')
  await w.get('[data-test="vm-title-fr"]').setValue('Bienvenue sur Yadony')
}

describe('VideoModalForm : création', () => {
  it('défauts : Rechercher coché, rappel public ou non répertorié, version 1', () => {
    const w = mountForm()
    expect(w.get('[data-test="vm-trigger-SEARCH_TAB"] input').element).toHaveProperty('checked', true)
    expect(w.get('[data-test="vm-url-reminder"]').text()).toContain('non répertoriée')
    expect(w.get('[data-test="vm-version-box"]').text()).toContain('Version 1')
    expect(w.get('[data-test="vm-submit"]').text()).toBe('Créer le modal')
    expect(w.find('[data-test="vm-stats"]').exists()).toBe(false)
  })

  it('formulaire vide : erreurs affichées après la tentative, rien n’est émis', async () => {
    const w = mountForm()
    expect(w.text()).not.toContain('Donnez un nom')
    await w.get('[data-test="vm-trigger-SEARCH_TAB"] input').trigger('change')
    await w.get('form').trigger('submit')
    expect(w.emitted('submit')).toBeUndefined()
    expect(w.text()).toContain('Donnez un nom')
    expect(w.text()).toContain('Le titre en français est obligatoire')
    expect(w.text()).toContain('au moins un endroit')
    expect(w.get('[data-test="vm-url-error"]').text()).toContain('Collez')
  })

  it('lien : reconnu (avec durée et lien YouTube) ou non reconnu, en direct', async () => {
    const w = mountForm()
    await w.get('[data-test="vm-url"]').setValue('https://vimeo.com/1')
    expect(w.get('[data-test="vm-url-error"]').text()).toContain('Lien non reconnu')
    await w.get('[data-test="vm-url"]').setValue('https://youtu.be/dQw4w9WgXcQ')
    await w.get('[data-test="vm-duration"]').setValue('204')
    const ok = w.get('[data-test="vm-url-ok"]')
    expect(ok.text()).toContain('Vidéo reconnue · 3:24')
    expect(ok.get('a').attributes('href')).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    expect(w.get('[data-test="vm-preview-thumb-img"]').attributes('src')).toContain('/vi/dQw4w9WgXcQ/')
  })

  it('soumet le corps du contrat, avec activation demandée', async () => {
    const w = mountForm()
    await fillValid(w)
    await w.get('[data-test="vm-trigger-PUBLISH_TRIP"] input').trigger('change')
    await w.get('[data-test="vm-duration"]').setValue('204')
    await w.get('[data-test="vm-max"]').setValue('5')
    await w.get('[data-test="vm-switch"]').trigger('click')
    await w.get('form').trigger('submit')
    const [input, activate] = w.emitted('submit')![0] as [VideoModalInput, boolean]
    expect(activate).toBe(true)
    expect(input).toMatchObject({
      name: 'Vidéo d’accueil', youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ', durationSeconds: 204,
      titleFr: 'Bienvenue sur Yadony', triggers: ['SEARCH_TAB', 'PUBLISH_TRIP'], maxDisplays: 5,
      primaryLabelFr: 'Voir la vidéo', secondaryLabelFr: 'Commencer', highlights: [], startsAt: null, endsAt: null,
    })
  })

  it('occupé : la soumission ne part pas', async () => {
    const w = mountForm({ busy: true })
    await fillValid(w)
    await w.get('form').trigger('submit')
    expect(w.emitted('submit')).toBeUndefined()
  })

  it('points forts : ajout avec icônes distinctes, plafond à 3, retrait', async () => {
    const w = mountForm()
    const add = w.get('[data-test="vm-highlight-add"]')
    await add.trigger('click')
    await add.trigger('click')
    await add.trigger('click')
    expect((w.get('[data-test="vm-highlight-icon-1"]').element as HTMLSelectElement).value).toBe('SUITCASE')
    expect(add.attributes('disabled')).toBeDefined()
    await add.trigger('click')
    expect(w.findAll('[data-test^="vm-highlight-remove-"]')).toHaveLength(3)
    await w.get('[data-test="vm-highlight-fr-0"]').setValue('Envoyer un colis')
    expect(w.get('[data-test="vm-preview-item-0"]').text()).toBe('Envoyer un colis')
    await w.get('[data-test="vm-highlight-remove-1"]').trigger('click')
    expect(w.findAll('[data-test^="vm-highlight-remove-"]')).toHaveLength(2)
    await fillValid(w)
    await w.get('form').trigger('submit')
    expect(w.text()).toContain('Chaque point fort a besoin d’un texte en français')
  })

  it('un point fort ajouté prend la première icône libre', async () => {
    const m = modal({ highlights: [
      { icon: 'PARCEL', textFr: 'a', textEn: '' }, { icon: 'SUITCASE', textFr: 'b', textEn: '' },
    ] })
    const w = mountForm({ modal: m })
    await w.get('[data-test="vm-highlight-add"]').trigger('click')
    expect((w.get('[data-test="vm-highlight-icon-2"]').element as HTMLSelectElement).value).toBe('LOCK')
  })

  it('aperçu FR / EN', async () => {
    const w = mountForm()
    await w.get('[data-test="vm-title-fr"]').setValue('Bienvenue')
    await w.get('[data-test="vm-title-en"]').setValue('Welcome')
    expect(w.get('[data-test="vm-preview-title"]').text()).toBe('Bienvenue')
    await w.get('[data-test="vm-lang-en"]').trigger('click')
    expect(w.get('[data-test="vm-preview-title"]').text()).toBe('Welcome')
    expect(w.text()).toContain('Aperçu en direct, en anglais')
    await w.get('[data-test="vm-lang-fr"]').trigger('click')
    expect(w.get('[data-test="vm-preview-title"]').text()).toBe('Bienvenue')
  })

  it('libellé de bouton trop long : avertissement', async () => {
    const w = mountForm()
    expect(w.find('[data-test="vm-label-long"]').exists()).toBe(false)
    await w.get('[data-test="vm-primary-en"]').setValue('Watch the full presentation video now')
    expect(w.find('[data-test="vm-label-long"]').exists()).toBe(true)
  })

  it('période inversée et plafond hors bornes : erreurs', async () => {
    const w = mountForm()
    await fillValid(w)
    await w.get('[data-test="vm-starts"]').setValue('2026-11-10T10:00')
    await w.get('[data-test="vm-ends"]').setValue('2026-11-09T10:00')
    await w.get('[data-test="vm-max"]').setValue('11')
    await w.get('[data-test="vm-duration"]').setValue('-4')
    await w.get('[data-test="vm-primary-fr"]').setValue('')
    await w.get('[data-test="vm-secondary-fr"]').setValue('')
    await w.get('form').trigger('submit')
    expect(w.emitted('submit')).toBeUndefined()
    expect(w.text()).toContain('La fin doit être après le début')
    expect(w.text()).toContain('Entre 1 et 10 affichages')
    expect(w.text()).toContain('Durée en secondes')
    expect(w.text()).toContain('Libellé du bouton principal obligatoire')
    expect(w.text()).toContain('Libellé du bouton secondaire obligatoire')
  })
})

describe('VideoModalForm : modification', () => {
  it('reprend la campagne, version, public, statistiques', () => {
    const m = modal({ version: 2, audience: 'NOT_WATCHED_PREVIOUS', active: true })
    const w = mountForm({ modal: m })
    expect((w.get('[data-test="vm-title-fr"]').element as HTMLInputElement).value).toBe('Bienvenue sur Yadony')
    expect(w.get('[data-test="vm-version-box"]').text()).toContain('Version 2, publiée le')
    expect(w.get('[data-test="vm-version-box"]').text()).toContain('n’ont pas regardé')
    expect(w.get('[data-test="vm-stat-shown"]').text()).toContain('affichés')
    expect(w.get('[data-test="vm-switch"]').attributes('aria-checked')).toBe('true')
    expect(w.get('[data-test="vm-submit"]').text()).toBe('Enregistrer')
  })

  it('l’interrupteur émet tout de suite, sans soumettre', async () => {
    const w = mountForm({ modal: modal({ active: true }) })
    await w.get('[data-test="vm-switch"]').trigger('click')
    expect(w.emitted('toggle-active')![0]).toEqual([false])
    expect(w.emitted('submit')).toBeUndefined()
  })

  it('« Nouvelle version » émet ; « Enregistrer » soumet sans activation', async () => {
    const w = mountForm({ modal: modal({ versionPublishedAt: null, audience: 'SEGMENT' as never }) })
    expect(w.get('[data-test="vm-version-box"]').text()).not.toContain('publiée le')
    expect(w.get('[data-test="vm-version-box"]').text()).toContain('SEGMENT')
    await w.get('[data-test="vm-new-version"]').trigger('click')
    expect(w.emitted('new-version')).toHaveLength(1)
    await w.get('[data-test="vm-title-fr"]').setValue('Corrigé')
    await w.get('form').trigger('submit')
    const [input, activate] = w.emitted('submit')![0] as [VideoModalInput, boolean]
    expect(input.titleFr).toBe('Corrigé')
    expect(activate).toBe(false)
  })

  it('ouvre le slot d’actions', () => {
    const w = mount(VideoModalForm, { props: { modal: modal() }, slots: { actions: '<button data-test="extra">Supprimer</button>' } })
    expect(w.find('[data-test="extra"]').exists()).toBe(true)
  })
})
