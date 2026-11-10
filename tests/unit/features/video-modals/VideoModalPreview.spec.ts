import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import VideoModalPreview from '@/features/video-modals/components/VideoModalPreview.vue'
import type { VideoModalHighlight } from '@/features/video-modals/types/index'

const base = {
  lang: 'fr' as const,
  youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ',
  durationSeconds: 204 as number | string | null,
  titleFr: 'Bienvenue sur Yadony', titleEn: 'Welcome to Yadony',
  subtitleFr: 'Envoyez ou voyagez', subtitleEn: '',
  primaryLabelFr: 'Voir la vidéo (3 min)', primaryLabelEn: 'Watch the video (3 min)',
  secondaryLabelFr: 'Commencer', secondaryLabelEn: 'Get started',
  highlights: [
    { icon: 'PARCEL', textFr: 'Envoyer un colis', textEn: 'Send a parcel' },
    { icon: 'LOCK', textFr: 'Payer en sécurité', textEn: '' },
    { icon: 'STAR', textFr: '  ', textEn: '' },
  ] as VideoModalHighlight[],
}
const mountPreview = (props: Partial<typeof base> = {}) => mount(VideoModalPreview, { props: { ...base, ...props } })

describe('VideoModalPreview', () => {
  it('FR : titre, sous-titre, miniature YouTube, durée, points forts remplis, deux boutons', () => {
    const w = mountPreview()
    expect(w.get('[data-test="vm-preview-title"]').text()).toBe('Bienvenue sur Yadony')
    expect(w.get('[data-test="vm-preview-subtitle"]').text()).toBe('Envoyez ou voyagez')
    expect(w.get('[data-test="vm-preview-thumb-img"]').attributes('src')).toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg')
    expect(w.get('[data-test="vm-preview-duration"]').text()).toBe('3:24')
    expect(w.text()).toContain('Avec Yadony, vous pouvez')
    expect(w.find('[data-test="vm-preview-item-0"]').text()).toBe('Envoyer un colis')
    expect(w.find('[data-test="vm-preview-item-2"]').exists()).toBe(false)
    expect(w.get('[data-test="vm-preview-primary"]').text()).toBe('Voir la vidéo (3 min)')
    expect(w.get('[data-test="vm-preview-secondary"]').text()).toBe('Commencer')
  })

  it('EN : textes anglais, repli FR quand l’EN est vide', () => {
    const w = mountPreview({ lang: 'en' })
    expect(w.get('[data-test="vm-preview-title"]').text()).toBe('Welcome to Yadony')
    expect(w.get('[data-test="vm-preview-subtitle"]').text()).toBe('Envoyez ou voyagez')
    expect(w.text()).toContain('With Yadony, you can')
    expect(w.get('[data-test="vm-preview-item-0"]').text()).toBe('Send a parcel')
    expect(w.get('[data-test="vm-preview-item-1"]').text()).toBe('Payer en sécurité')
    expect(w.get('[data-test="vm-preview-primary"]').text()).toBe('Watch the video (3 min)')
  })

  it('lien non reconnu, sans durée ni sous-titre ni points forts : bloc vidéo neutre', () => {
    const w = mountPreview({ youtubeUrl: 'https://vimeo.com/1', durationSeconds: null, subtitleFr: '', highlights: [] })
    expect(w.find('[data-test="vm-preview-thumb-img"]').exists()).toBe(false)
    expect(w.get('[data-test="vm-preview-thumb"]').text()).toContain('Vidéo')
    expect(w.find('[data-test="vm-preview-duration"]').exists()).toBe(false)
    expect(w.find('[data-test="vm-preview-subtitle"]').exists()).toBe(false)
    expect(w.text()).not.toContain('Avec Yadony')
  })

  it('titre vide : texte d’attente dans la langue ; durée saisie en texte', () => {
    expect(mountPreview({ titleFr: '', titleEn: '' }).get('[data-test="vm-preview-title"]').text()).toBe('Titre du modal')
    const en = mountPreview({ lang: 'en', titleFr: '', titleEn: '', youtubeUrl: '', durationSeconds: '65' })
    expect(en.get('[data-test="vm-preview-title"]').text()).toBe('Modal title')
    expect(en.get('[data-test="vm-preview-thumb"]').text()).toContain('Video')
    expect(en.get('[data-test="vm-preview-duration"]').text()).toBe('1:05')
  })

  it('icône inconnue d’un back plus récent : repli sur l’icône colis, pas de plantage', () => {
    const w = mountPreview({ highlights: [{ icon: 'ROCKET', textFr: 'Nouveau', textEn: '' } as unknown as VideoModalHighlight] })
    expect(w.get('[data-test="vm-preview-item-0"]').text()).toBe('Nouveau')
  })

  it('les boutons restent sur une ligne', () => {
    const w = mountPreview()
    expect(w.get('[data-test="vm-preview-primary"]').classes()).toContain('whitespace-nowrap')
    expect(w.get('[data-test="vm-preview-secondary"]').classes()).toContain('whitespace-nowrap')
  })

  it('case « Ne plus afficher » : absente par défaut, présente quand elle est cochée, avant les boutons', () => {
    expect(mountPreview().find('[data-test="vm-preview-dontshow"]').exists()).toBe(false)
    const w = mount(VideoModalPreview, { props: { ...base, allowDontShowAgain: true } })
    expect(w.get('[data-test="vm-preview-dontshow"]').text()).toBe('Ne plus afficher')
    expect(w.html().indexOf('vm-preview-dontshow')).toBeLessThan(w.html().indexOf('vm-preview-primary'))
    const en = mount(VideoModalPreview, { props: { ...base, lang: 'en', allowDontShowAgain: true } })
    expect(en.get('[data-test="vm-preview-dontshow"]').text()).toBe('Don’t show again')
  })
})
