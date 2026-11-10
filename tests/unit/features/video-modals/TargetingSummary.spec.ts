import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TargetingSummary from '@/features/video-modals/components/TargetingSummary.vue'

const parts = [{ text: 'Ce modal s’ouvrira ' }, { text: '2 secondes après l’ouverture', strong: true }, { text: '.' }]
const mountSummary = (props: Record<string, unknown> = {}) =>
  mount(TargetingSummary, { props: { parts, priority: 5, samplePercent: 100, ready: true, loading: false, error: null, result: null, ...props } })

describe('TargetingSummary', () => {
  it('phrase « En clair » : réglages en gras (or)', () => {
    const w = mountSummary()
    expect(w.get('[data-test="vm-summary-text"]').text()).toBe('Ce modal s’ouvrira 2 secondes après l’ouverture.')
    const b = w.get('[data-test="vm-summary-text"] b')
    expect(b.text()).toBe('2 secondes après l’ouverture')
    expect(b.classes()).toContain('text-[#FFC23D]')
    expect(w.text()).toContain('En clair :')
  })

  it('ciblage incomplet : invite à le compléter, aucune estimation', () => {
    const w = mountSummary({ ready: false })
    expect(w.get('[data-test="vm-estimate-hint"]').text()).toContain('Complétez le ciblage')
    expect(w.find('[data-test="vm-estimate-accounts"]').exists()).toBe(false)
  })

  it('chargement : indicateur', () => {
    const w = mountSummary({ loading: true })
    expect(w.get('[data-test="vm-estimate-loading"]').text()).toContain('Estimation en cours')
    expect(w.find('[data-test="vm-estimate-accounts"]').exists()).toBe(false)
  })

  it('erreur : message et « Réessayer »', async () => {
    const w = mountSummary({ error: 'Estimation indisponible pour le moment' })
    expect(w.get('[data-test="vm-estimate-error"]').text()).toContain('Estimation indisponible')
    await w.get('[data-test="vm-estimate-retry"]').trigger('click')
    expect(w.emitted('retry')).toHaveLength(1)
  })

  it('résultat sans tirage : comptes concernés seulement, nombre en espaces insécables', () => {
    const w = mountSummary({ result: { accounts: 1180, afterSample: 1180 } })
    expect(w.get('[data-test="vm-estimate-accounts"]').text().replace(/\s/g, ' ')).toContain('≈ 1 180')
    expect(w.get('[data-test="vm-estimate-accounts"]').text()).toContain('comptes concernés')
    expect(w.find('[data-test="vm-estimate-sample"]').exists()).toBe(false)
    expect(w.get('[data-test="vm-estimate-note"]').text()).toContain('visiteurs sans compte ne sont pas comptés')
    expect(w.get('[data-test="vm-estimate-note"]').text()).not.toContain('situations')
  })

  it('résultat avec tirage : part retenue ; situations signalées', () => {
    const w = mountSummary({ result: { accounts: 1180, afterSample: 590 }, samplePercent: 50, hasSituations: true })
    expect(w.get('[data-test="vm-estimate-sample"]').text().replace(/\s/g, ' ')).toContain('≈ 590')
    expect(w.get('[data-test="vm-estimate-sample"]').text()).toContain('après le tirage à 50 %')
    expect(w.get('[data-test="vm-estimate-note"]').text()).toContain('situations sont vérifiées par le serveur')
  })

  it('tirage illisible (texte) : pas de ligne de tirage', () => {
    expect(mountSummary({ result: { accounts: 3, afterSample: 3 }, samplePercent: '' }).find('[data-test="vm-estimate-sample"]').exists()).toBe(false)
  })

  it('priorité affichée ; vide = 0', () => {
    expect(mountSummary().get('[data-test="vm-summary-priority"]').text()).toContain('5')
    expect(mountSummary({ priority: '' }).get('[data-test="vm-summary-priority"]').text()).toContain('0')
  })
})
