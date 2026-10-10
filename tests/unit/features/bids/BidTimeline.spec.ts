import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BidTimeline from '@/features/bids/components/BidTimeline.vue'

const timeline = {
  bidId: 'b1',
  entries: [
    { at: '2026-06-01T10:00:00', kind: 'SCAN' as const, label: 'DEPART', detail: 'Paris CDG', photoUrl: null, gpsLat: 48.8, gpsLon: 2.3, source: 'TRACKING' as const },
    { at: '2026-06-02T10:00:00', kind: 'SCAN' as const, label: 'ARRIVEE', detail: null, photoUrl: 'https://r2/p.jpg?sig', source: 'TRACKING' as const },
    { at: '2026-06-02T11:00:00', kind: 'PAYMENT' as const, label: 'ESCROW_FORCE_RELEASED', source: 'AUDIT' as const, actorKind: 'ADMIN' as const, actorLabel: 'ops@yadony.test' },
    { at: '2026-06-02T12:00:00', kind: 'EVENT' as const, label: 'BID_CREATED', source: 'BID' as const },
    { at: '2026-06-02T13:00:00', kind: 'EVENT' as const, label: 'RATING_CREATED', detail: '5/5', source: 'BID' as const },
    { at: '2026-06-02T14:00:00', kind: 'EVENT' as const, label: 'DISPUTE_OPENED', actorKind: 'ADMIN' as const, source: 'AUDIT' as const },
    { at: 'pas une date', kind: 'EVENT' as const, label: 'UN_CODE_NOUVEAU' },
  ],
}

describe('BidTimeline', () => {
  it('une entrée par évènement, libellés en français, auteur et détails', () => {
    const w = mount(BidTimeline, { props: { timeline } })
    const items = w.findAll('[data-test="timeline-entry"]')
    expect(items).toHaveLength(7)
    expect(items[0].text()).toContain('Scan de départ')
    expect(items[0].text()).toContain('Paris CDG')
    expect(items[0].text()).toContain('GPS 48.8, 2.3')
    expect(items[1].text()).toContain('Scan d’arrivée')
    expect(items[1].find('img').attributes('src')).toBe('https://r2/p.jpg?sig')
    expect(items[2].text()).toContain('Versement forcé par un admin')
    expect(items[2].text()).toContain('par l’admin ops@yadony.test')
    expect(items[3].text()).toContain('Demande de colis créée')
    expect(items[3].text()).toContain('automatique')
    expect(items[4].text()).toContain('5 sur 5 étoiles')
    expect(items[5].text()).toContain('par un admin')
    expect(items[6].text()).toContain('Un code nouveau')
    expect(items[6].text()).toContain('—')
    expect(items[6].find('[data-test="timeline-actor"]').exists()).toBe(false)
  })
  it('repères colorés selon la nature', () => {
    const w = mount(BidTimeline, { props: { timeline } })
    const dots = w.findAll('[data-test="timeline-entry"] > span')
    expect(dots[0].classes()).toContain('bg-primary')
    expect(dots[2].classes()).toContain('bg-success')
    expect(dots[3].classes()).toContain('bg-text-muted')
    expect(dots[5].classes()).toContain('bg-danger')
  })
  it('vide : état explicite, jamais une section blanche', () => {
    expect(mount(BidTimeline, { props: { timeline: null } }).find('[data-test="timeline-empty"]').exists()).toBe(true)
    expect(mount(BidTimeline, { props: { timeline: { bidId: 'b1', entries: [] } } }).find('[data-test="timeline-empty"]').exists()).toBe(true)
  })
  it('chargement et erreur', () => {
    expect(mount(BidTimeline, { props: { timeline: null, loading: true } }).find('[data-test="timeline-loading"]').exists()).toBe(true)
    expect(mount(BidTimeline, { props: { timeline: null, error: 'Boom' } }).find('[data-test="timeline-error"]').text()).toBe('Boom')
  })
  it('valeurs malveillantes : texte brut, photo javascript:/data: écartée', () => {
    const payload = '<img src=x onerror="alert(1)">'
    const w = mount(BidTimeline, { props: { timeline: { bidId: 'b1', entries: [
      { at: '2026-06-01T10:00:00', kind: 'SCAN' as const, label: payload, detail: payload, photoUrl: 'javascript:alert(1)', actorLabel: payload },
      { at: '2026-06-01T11:00:00', kind: 'SCAN' as const, label: 'DEPART', photoUrl: 'data:image/png;base64,AAAA' },
    ] } } })
    expect(w.find('img').exists()).toBe(false)
    expect(w.find('a').exists()).toBe(false)
    expect(w.text()).toContain(payload)
    expect(w.html()).not.toContain('javascript:')
  })
})
