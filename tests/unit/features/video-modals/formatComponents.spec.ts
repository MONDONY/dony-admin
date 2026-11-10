import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import LayoutPicker from '@/features/video-modals/components/LayoutPicker.vue'
import ImageSection from '@/features/video-modals/components/ImageSection.vue'
import ModalShell from '@/features/video-modals/components/ModalShell.vue'
import InfoModalPreview from '@/features/video-modals/components/InfoModalPreview.vue'
import VideoModalPreview from '@/features/video-modals/components/VideoModalPreview.vue'
import VideoModalTable from '@/features/video-modals/components/VideoModalTable.vue'
import { infoModal, modal } from './fixtures'

describe('LayoutPicker', () => {
  const mountPicker = (props: Record<string, unknown> = {}) =>
    mount(LayoutPicker, { props: { layout: 'BOTTOM_SHEET', sizePercent: null, ...props } })

  it('trois cartes, la courante est cochée, un clic change le format', async () => {
    const w = mountPicker()
    for (const l of ['BOTTOM_SHEET', 'CENTERED', 'FULLSCREEN']) expect(w.find(`[data-test="vm-layout-${l}"]`).exists()).toBe(true)
    expect(w.get('[data-test="vm-layout-BOTTOM_SHEET"]').attributes('aria-checked')).toBe('true')
    expect(w.get('[data-test="vm-layout-CENTERED"]').attributes('aria-checked')).toBe('false')
    await w.get('[data-test="vm-layout-CENTERED"]').trigger('click')
    expect(w.emitted('update:layout')![0]).toEqual(['CENTERED'])
  })

  it('automatique par défaut : curseur désactivé, « Auto » affiché', () => {
    const w = mountPicker()
    expect(w.get('[data-test="vm-size-range"]').attributes('disabled')).toBeDefined()
    expect(w.get('[data-test="vm-size-value"]').text()).toBe('Auto')
    expect((w.get('[data-test="vm-size-auto"]').element as HTMLInputElement).checked).toBe(true)
  })

  it('décocher Automatique pose 60 %, le curseur envoie un entier', async () => {
    const w = mountPicker()
    await w.get('[data-test="vm-size-auto"]').setValue(false)
    expect(w.emitted('update:sizePercent')![0]).toEqual([60])
    const w2 = mountPicker({ sizePercent: 60 })
    expect(w2.get('[data-test="vm-size-value"]').text()).toBe('60 %')
    expect(w2.get('[data-test="vm-size-range"]').attributes('min')).toBe('30')
    expect(w2.get('[data-test="vm-size-range"]').attributes('max')).toBe('100')
    await w2.get('[data-test="vm-size-range"]').setValue('75')
    expect(w2.emitted('update:sizePercent')![0]).toEqual([75])
    await w2.get('[data-test="vm-size-auto"]').setValue(true)
    expect(w2.emitted('update:sizePercent')![1]).toEqual([null])
  })

  it('plein écran : taille désactivée et 100 % affiché', () => {
    const w = mountPicker({ layout: 'FULLSCREEN', sizePercent: 50 })
    expect(w.get('[data-test="vm-size-range"]').attributes('disabled')).toBeDefined()
    expect(w.get('[data-test="vm-size-auto"]').attributes('disabled')).toBeDefined()
    expect(w.get('[data-test="vm-size-value"]').text()).toBe('100 %')
    expect(w.text()).toContain('toujours toute la hauteur')
  })

  it('affiche les erreurs de format et de taille', () => {
    const w = mountPicker({ error: 'Format KO', sizeError: 'Taille KO' })
    expect(w.text()).toContain('Format KO')
    expect(w.text()).toContain('Taille KO')
  })
})

describe('ImageSection', () => {
  const base = {
    mode: 'NONE', fit: 'COVER', altFr: '', altEn: '', previewUrl: null, pendingName: null,
    isEdit: false, busy: false, fileError: null,
  }
  const mountSection = (props: Record<string, unknown> = {}) => mount(ImageSection, { props: { ...base, ...props } })

  it('mode Aucune sans image : invite à choisir un mode, pas de champ fichier', () => {
    const w = mountSection()
    expect(w.find('[data-test="vm-image-file"]').exists()).toBe(false)
    expect(w.text()).toContain('Bannière en haut')
  })

  it('trois modes ; un clic émet le mode', async () => {
    const w = mountSection()
    expect(w.findAll('[role="radio"]').length).toBe(3)
    await w.get('[data-test="vm-image-mode-POSTER"]').trigger('click')
    expect(w.emitted('update:mode')![0]).toEqual(['POSTER'])
  })

  it('création : annonce l’envoi automatique après la création et les règles du fichier', () => {
    const w = mountSection({ mode: 'TOP' })
    expect(w.get('[data-test="vm-image-flow"]').text()).toContain('automatiquement juste après la création')
    expect(w.get('[data-test="vm-image-rules"]').text()).toContain('3 Mo')
    expect(w.get('[data-test="vm-image-state"]').text()).toBe('Aucune image envoyée')
    expect(w.get('[data-test="vm-image-pick"]').text()).toBe('Choisir une image')
    expect(w.find('[data-test="vm-image-remove"]').exists()).toBe(false)
  })

  it('modification : fichier envoyé tout de suite ; image présente : Remplacer et Retirer', async () => {
    const w = mountSection({ mode: 'TOP', isEdit: true, previewUrl: 'https://cdn/x.jpg' })
    expect(w.get('[data-test="vm-image-flow"]').text()).toContain('dès que vous le choisissez')
    expect(w.get('[data-test="vm-image-state"]').text()).toBe('Image envoyée')
    expect(w.get('[data-test="vm-image-thumb"]').attributes('src')).toBe('https://cdn/x.jpg')
    expect(w.get('[data-test="vm-image-pick"]').text()).toBe('Remplacer')
    await w.get('[data-test="vm-image-remove"]').trigger('click')
    expect(w.emitted('remove')).toHaveLength(1)
  })

  it('fichier choisi avant la création : son nom est affiché', () => {
    const w = mountSection({ mode: 'POSTER', pendingName: 'concours.png', previewUrl: 'blob:x' })
    expect(w.get('[data-test="vm-image-state"]').text()).toBe('concours.png')
  })

  it('choisir un fichier émet pick ; sans fichier, rien', async () => {
    const w = mountSection({ mode: 'TOP' })
    const input = w.get('[data-test="vm-image-file"]')
    expect(input.attributes('accept')).toBe('image/jpeg,image/png,image/webp')
    const f = new File([new Uint8Array([1])], 'a.png', { type: 'image/png' })
    Object.defineProperty(input.element, 'files', { value: [f], configurable: true })
    await input.trigger('change')
    expect(w.emitted('pick')![0]).toEqual([f])
    Object.defineProperty(input.element, 'files', { value: [], configurable: true })
    await input.trigger('change')
    expect(w.emitted('pick')).toHaveLength(1)
  })

  it('cadrage, textes alternatifs et erreurs', async () => {
    const w = mountSection({ mode: 'TOP', fileError: 'Format non accepté', modeError: 'Envoyez une image', altFrError: 'trop long', altEnError: 'too long' })
    await w.get('[data-test="vm-image-fit-CONTAIN"]').trigger('click')
    expect(w.emitted('update:fit')![0]).toEqual(['CONTAIN'])
    await w.get('[data-test="vm-image-alt-fr"]').setValue('Affiche')
    await w.get('[data-test="vm-image-alt-en"]').setValue('Poster')
    expect(w.emitted('update:altFr')![0]).toEqual(['Affiche'])
    expect(w.emitted('update:altEn')![0]).toEqual(['Poster'])
    expect(w.get('[data-test="vm-image-file-error"]').text()).toBe('Format non accepté')
    expect(w.get('[data-test="vm-image-mode-error"]').text()).toBe('Envoyez une image')
    expect(w.text()).toContain('trop long')
    expect(w.text()).toContain('too long')
  })
})

describe('ModalShell', () => {
  it('feuille du bas : pas de croix', () => {
    const w = mount(ModalShell, { slots: { default: '<i>x</i>' } })
    expect(w.find('[data-test="vm-preview-close"]').exists()).toBe(false)
    expect(w.get('[data-test="vm-shell"]').attributes('style')).toContain('max-height')
  })
  it('feuille avec taille : hauteur maximale en pourcentage', () => {
    const w = mount(ModalShell, { props: { sizePercent: 50 } })
    expect(w.get('[data-test="vm-shell"]').attributes('style')).toContain('calc(50% - 14px)')
  })
  it('feuille de la vidéo sans taille : occupe la hauteur d’avant', () => {
    const w = mount(ModalShell, { props: { fillAuto: true } })
    expect(w.get('[data-test="vm-shell"]').attributes('style')).toContain('top: 58px')
  })
  it('carte centrée : croix et hauteur max (82 % par défaut)', () => {
    const w = mount(ModalShell, { props: { layout: 'CENTERED' } })
    expect(w.find('[data-test="vm-preview-close"]').exists()).toBe(true)
    expect(w.get('[data-test="vm-shell"]').attributes('style')).toContain('82%')
    expect(mount(ModalShell, { props: { layout: 'CENTERED', sizePercent: 55 } }).get('[data-test="vm-shell"]').attributes('style')).toContain('55%')
  })
  it('plein écran : croix, sans plafond de hauteur', () => {
    const w = mount(ModalShell, { props: { layout: 'FULLSCREEN', sizePercent: 40 } })
    expect(w.find('[data-test="vm-preview-close"]').exists()).toBe(true)
    expect(w.get('[data-test="vm-shell"]').attributes('style') ?? '').not.toContain('max-height')
    expect(w.get('[data-test="vm-shell"]').classes()).toContain('inset-0')
  })
})

describe('aperçus avec format et image', () => {
  const info = {
    lang: 'fr' as const, icon: 'BELL' as const, titleFr: 'Concours', titleEn: 'Contest', subtitleFr: '', subtitleEn: '',
    bodyFr: 'Gagnez', bodyEn: 'Win', primaryLabelFr: 'Participer', primaryLabelEn: 'Join', primaryKind: 'URL' as const,
    secondaryEnabled: false, secondaryLabelFr: '', secondaryLabelEn: '', secondaryKind: 'CLOSE' as const,
  }

  it('sans image : halo, titre et texte comme avant', () => {
    const w = mount(InfoModalPreview, { props: info })
    expect(w.find('[data-test="vm-preview-halo"]').exists()).toBe(true)
    expect(w.find('[data-test="vm-preview-banner"]').exists()).toBe(false)
    expect(w.find('[data-test="vm-preview-poster"]').exists()).toBe(false)
    expect(w.find('[data-test="vm-preview-close"]').exists()).toBe(false)
  })

  it('bannière : image au-dessus du titre et du texte, qui restent affichés', () => {
    const w = mount(InfoModalPreview, { props: { ...info, imageMode: 'TOP', imageUrl: 'https://cdn/x.jpg', imageFit: 'CONTAIN' } })
    expect(w.find('[data-test="vm-preview-banner"]').exists()).toBe(true)
    expect(w.find('[data-test="vm-preview-halo"]').exists()).toBe(false)
    const img = w.get('[data-test="vm-preview-image"]')
    expect(img.attributes('src')).toBe('https://cdn/x.jpg')
    expect(img.classes()).toContain('object-contain')
    expect(w.get('[data-test="vm-preview-title"]').text()).toBe('Concours')
    expect(w.get('[data-test="vm-preview-body"]').text()).toBe('Gagnez')
  })

  it('affiche : ni titre ni texte, l’image remplit, boutons conservés', () => {
    const w = mount(InfoModalPreview, { props: { ...info, imageMode: 'POSTER', imageUrl: 'https://cdn/x.jpg', layout: 'FULLSCREEN' } })
    expect(w.find('[data-test="vm-preview-poster"]').exists()).toBe(true)
    expect(w.find('[data-test="vm-preview-title"]').exists()).toBe(false)
    expect(w.find('[data-test="vm-preview-body"]').exists()).toBe(false)
    expect(w.get('[data-test="vm-preview-image"]').classes()).toContain('object-cover')
    expect(w.get('[data-test="vm-preview-primary"]').text()).toBe('Participer')
    expect(w.find('[data-test="vm-preview-close"]').exists()).toBe(true)
  })

  it('image pas encore envoyée : espace réservé', () => {
    const w = mount(InfoModalPreview, { props: { ...info, imageMode: 'TOP' } })
    expect(w.find('[data-test="vm-preview-image"]').exists()).toBe(false)
    expect(w.get('[data-test="vm-preview-banner"]').text()).toBe('Image')
  })

  it('texte alternatif FR/EN, repli sur le titre', () => {
    const p = { ...info, imageMode: 'TOP' as const, imageUrl: 'https://cdn/x.jpg', imageAltFr: 'Affiche du concours', imageAltEn: '' }
    expect(mount(InfoModalPreview, { props: p }).get('[data-test="vm-preview-image"]').attributes('alt')).toBe('Affiche du concours')
    expect(mount(InfoModalPreview, { props: { ...p, lang: 'en' } }).get('[data-test="vm-preview-image"]').attributes('alt')).toBe('Affiche du concours')
    expect(mount(InfoModalPreview, { props: { ...p, lang: 'en', imageAltEn: 'Contest poster' } }).get('[data-test="vm-preview-image"]').attributes('alt')).toBe('Contest poster')
    expect(mount(InfoModalPreview, { props: { ...p, imageAltFr: '' } }).get('[data-test="vm-preview-image"]').attributes('alt')).toBe('Concours')
  })

  it('l’aperçu vidéo suit le format : carte centrée avec croix', () => {
    const w = mount(VideoModalPreview, {
      props: {
        lang: 'en', youtubeUrl: '', durationSeconds: null, titleFr: 'a', titleEn: '', subtitleFr: '', subtitleEn: '',
        primaryLabelFr: 'a', primaryLabelEn: '', secondaryLabelFr: 'b', secondaryLabelEn: '', highlights: [],
        layout: 'CENTERED', sizePercent: 60,
      },
    })
    expect(w.get('[data-test="vm-shell"]').attributes('data-layout')).toBe('CENTERED')
    expect(w.get('[data-test="vm-shell"]').attributes('style')).toContain('60%')
    expect(w.get('[data-test="vm-preview-close"]').attributes('aria-label')).toBe('Close')
  })
})

describe('liste : colonne Format', () => {
  const NuxtLink = { name: 'NuxtLink', props: ['to'], template: '<a :href="to"><slot /></a>' }
  const mountTable = (items: ReturnType<typeof modal>[]) => mount(VideoModalTable, { props: { items }, global: { stubs: { NuxtLink } } })

  it('campagne ancienne : Feuille du bas, sans image', () => {
    const w = mountTable([modal()])
    expect(w.get(`[data-test="vm-format-${modal().id}"]`).text()).toBe('Feuille du bas')
  })

  it('format, taille et image', () => {
    const m = infoModal({ layout: 'CENTERED', sizePercent: 60, imageMode: 'POSTER' })
    expect(mountTable([m]).get(`[data-test="vm-format-${m.id}"]`).text()).toBe('Carte centrée · 60 %Image : Affiche seule')
    const f = infoModal({ layout: 'FULLSCREEN', sizePercent: 60 })
    expect(mountTable([f]).get(`[data-test="vm-format-${f.id}"]`).text()).toBe('Plein écran')
  })
})
