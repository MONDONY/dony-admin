import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import InfoModalPreview from '@/features/video-modals/components/InfoModalPreview.vue'

const base = {
  lang: 'fr' as const,
  icon: 'BELL' as const,
  titleFr: 'Nouveauté', titleEn: 'News',
  subtitleFr: 'Sous-titre', subtitleEn: '',
  bodyFr: 'Texte français', bodyEn: 'English text',
  primaryLabelFr: 'Voir', primaryLabelEn: 'See', primaryKind: 'SCREEN' as const,
  secondaryEnabled: true, secondaryLabelFr: 'Plus tard', secondaryLabelEn: '', secondaryKind: 'CLOSE' as const,
}
const mountPreview = (props: Record<string, unknown> = {}) => mount(InfoModalPreview, { props: { ...base, ...props } })

describe('InfoModalPreview', () => {
  it('affiche titre, sous-titre, texte et deux boutons, sans vignette vidéo', () => {
    const w = mountPreview()
    expect(w.get('[data-test="vm-preview-title"]').text()).toBe('Nouveauté')
    expect(w.get('[data-test="vm-preview-subtitle"]').text()).toBe('Sous-titre')
    expect(w.get('[data-test="vm-preview-body"]').text()).toBe('Texte français')
    expect(w.get('[data-test="vm-preview-primary"]').text()).toBe('Voir')
    expect(w.get('[data-test="vm-preview-secondary"]').text()).toBe('Plus tard')
    expect(w.find('[data-test="vm-preview-thumb"]').exists()).toBe(false)
  })

  it('anglais avec repli FR quand l’EN est vide', () => {
    const w = mountPreview({ lang: 'en' })
    expect(w.get('[data-test="vm-preview-title"]').text()).toBe('News')
    expect(w.get('[data-test="vm-preview-body"]').text()).toBe('English text')
    expect(w.get('[data-test="vm-preview-primary"]').text()).toBe('See')
    expect(w.get('[data-test="vm-preview-secondary"]').text()).toBe('Plus tard')
    expect(w.find('[data-test="vm-preview-subtitle"]').text()).toBe('Sous-titre')
  })

  it('secondaire absent : un seul bouton ; sous-titre vide : masqué', () => {
    const w = mountPreview({ secondaryEnabled: false, subtitleFr: '' })
    expect(w.find('[data-test="vm-preview-secondary"]').exists()).toBe(false)
    expect(w.find('[data-test="vm-preview-subtitle"]').exists()).toBe(false)
  })

  it('repli : Fermer sans libellé = OK ; écran sans libellé = vide ; titre et texte fictifs', () => {
    const w = mountPreview({ titleFr: '', bodyFr: '', primaryKind: 'CLOSE', primaryLabelFr: '', secondaryKind: 'SCREEN', secondaryLabelFr: '' })
    expect(w.get('[data-test="vm-preview-primary"]').text()).toBe('OK')
    expect(w.get('[data-test="vm-preview-secondary"]').text()).toBe('')
    expect(w.get('[data-test="vm-preview-title"]').text()).toBe('Titre du modal')
    expect(w.get('[data-test="vm-preview-body"]').text()).toBe('Texte du modal.')
    const en = mountPreview({ lang: 'en', titleFr: '', titleEn: '', bodyFr: '', bodyEn: '' })
    expect(en.get('[data-test="vm-preview-title"]').text()).toBe('Modal title')
    expect(en.get('[data-test="vm-preview-body"]').text()).toBe('Modal text.')
  })

  it('couleur unie du halo selon l’icône, repli sur INFO si inconnue', () => {
    const style = (icon: string) => mountPreview({ icon }).get('[data-test="vm-preview-halo"]').attributes('style') ?? ''
    expect(style('BELL')).toContain('#FFF4D6')
    expect(style('INFO')).toContain('#EAF1FF')
    expect(style('ROCKET')).toContain('#EAF1FF')
    expect(style('BELL')).not.toContain('gradient')
  })

  it('case « Ne plus afficher » : absente par défaut, présente quand elle est cochée, avant les boutons', () => {
    expect(mountPreview().find('[data-test="vm-preview-dontshow"]').exists()).toBe(false)
    const w = mountPreview({ allowDontShowAgain: true })
    const box = w.get('[data-test="vm-preview-dontshow"]')
    expect(box.text()).toBe('Ne plus afficher')
    const html = w.html()
    expect(html.indexOf('vm-preview-dontshow')).toBeLessThan(html.indexOf('vm-preview-primary'))
    expect(html.indexOf('vm-preview-body')).toBeLessThan(html.indexOf('vm-preview-dontshow'))
  })

  it('case « Ne plus afficher » en anglais, y compris en affiche seule', () => {
    expect(mountPreview({ lang: 'en', allowDontShowAgain: true }).get('[data-test="vm-preview-dontshow"]').text()).toBe('Don’t show again')
    const poster = mountPreview({ allowDontShowAgain: true, imageMode: 'POSTER', imageUrl: 'https://x/y.jpg' })
    expect(poster.find('[data-test="vm-preview-dontshow"]').exists()).toBe(true)
  })
})
