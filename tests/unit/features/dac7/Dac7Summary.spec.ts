import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Dac7Summary from '@/features/dac7/components/Dac7Summary.vue'

const OVERVIEW = {
  year: 2026, enabled: true, remindersEnabled: true,
  declarableSellers: 12, withTaxInfo: 9, missingTaxInfo: 3, identityReview: 2, unknownResidence: 1, nonDeclarable: 4,
  refundsToReconcile: 5, pendingSplits: 1, anomalies: 6, invalidPartnerJurisdictions: [],
  totals: { operations: 240, netEur: 18234.5, commissionEur: 2100 },
  eurComplete: true, commissionComplete: true, exportReady: true, blockers: [],
}
const mountIt = (overview: unknown, extra: Record<string, unknown> = {}) =>
  mount(Dac7Summary, { props: { overview: overview as never, loading: false, ...extra } })
const norm = (t: string) => t.replace(/\s/g, ' ')

describe('Dac7Summary', () => {
  it('affiche les compteurs du contrat', () => {
    const w = mountIt(OVERVIEW)
    const text = (k: string) => w.get(`[data-test="dac7-card-${k}"]`).text()
    expect(text('declarableSellers')).toContain('12')
    expect(text('declarableSellers')).toContain('Voyageurs déclarables')
    expect(text('withTaxInfo')).toContain('9')
    expect(text('missingTaxInfo')).toContain('3')
    expect(text('identityReview')).toContain('2')
    expect(text('unknownResidence')).toContain('1')
    expect(text('nonDeclarable')).toContain('4')
    expect(text('refundsToReconcile')).toContain('5')
    expect(text('pendingSplits')).toContain('1')
    expect(text('anomalies')).toContain('6')
  })

  it('affiche les totaux en euros', () => {
    const w = mountIt(OVERVIEW)
    expect(w.get('[data-test="dac7-card-operations"]').text()).toContain('240')
    expect(norm(w.get('[data-test="dac7-card-netEur"]').text())).toContain('18 234,50 €')
    expect(norm(w.get('[data-test="dac7-card-commissionEur"]').text())).toContain('2 100,00 €')
    expect(w.find('[data-test="dac7-partial-eur"]').exists()).toBe(false)
    expect(w.find('[data-test="dac7-partial-commission"]').exists()).toBe(false)
  })

  it('signale des montants partiels', () => {
    const w = mountIt({ ...OVERVIEW, eurComplete: false, commissionComplete: false })
    expect(w.get('[data-test="dac7-partial-eur"]').text()).toMatch(/partiel/i)
    expect(w.get('[data-test="dac7-partial-commission"]').text()).toMatch(/partielle/i)
  })

  it('badges « Collecte éteinte » et « Rappels éteints »', () => {
    const off = mountIt({ ...OVERVIEW, enabled: false, remindersEnabled: false })
    expect(off.get('[data-test="dac7-badge-collecte"]').text()).toBe('Collecte éteinte')
    expect(off.get('[data-test="dac7-badge-rappels"]').text()).toBe('Rappels éteints')
    const on = mountIt(OVERVIEW)
    expect(on.find('[data-test="dac7-badge-collecte"]').exists()).toBe(false)
    expect(on.find('[data-test="dac7-badge-rappels"]').exists()).toBe(false)
  })

  it('un champ absent (ancien back) n’allume aucun badge et n’affiche pas NaN', () => {
    const w = mountIt({ year: 2026 })
    expect(w.find('[data-test="dac7-badge-collecte"]').exists()).toBe(false)
    expect(w.find('[data-test="dac7-badge-rappels"]').exists()).toBe(false)
    expect(w.text()).not.toContain('NaN')
    expect(w.text()).not.toContain('undefined')
    expect(w.get('[data-test="dac7-card-declarableSellers"]').text()).toContain('n/d')
    expect(w.get('[data-test="dac7-card-netEur"]').text()).toContain('n/d')
    expect(w.text()).not.toMatch(/[–—]/)
  })

  it('export prêt : aucun blocage', () => {
    const w = mountIt(OVERVIEW)
    expect(w.get('[data-test="dac7-ready"]').text()).toMatch(/aucun blocage/i)
    expect(w.find('[data-test="dac7-blockers"]').exists()).toBe(false)
  })

  it('liste chaque blocage avec son explication en français', () => {
    const w = mountIt({ ...OVERVIEW, exportReady: false, blockers: ['TAX_INFO_MISSING', 'EUR_INCOMPLETE', 'NO_SELLERS'] })
    expect(w.find('[data-test="dac7-ready"]').exists()).toBe(false)
    const rows = w.findAll('[data-test^="dac7-blocker-"]')
    expect(rows.map(r => r.attributes('data-test'))).toEqual(['dac7-blocker-TAX_INFO_MISSING', 'dac7-blocker-EUR_INCOMPLETE', 'dac7-blocker-NO_SELLERS'])
    expect(rows[0].text()).toContain('Numéro fiscal manquant')
    expect(rows[0].text()).toMatch(/mode Partiel/)
    expect(rows[1].text()).toMatch(/taux de change/i)
  })

  it('le blocage « pays partenaire invalide » montre les codes concernés', () => {
    const w = mountIt({ ...OVERVIEW, blockers: ['INVALID_PARTNER_JURISDICTION'], invalidPartnerJurisdictions: ['XX', 'ZZ'] })
    expect(w.get('[data-test="dac7-blocker-INVALID_PARTNER_JURISDICTION"]').text()).toContain('XX, ZZ')
  })

  it('un blocage inconnu s’affiche avec un message générique, jamais le code seul', () => {
    const w = mountIt({ ...OVERVIEW, exportReady: false, blockers: ['NOUVEAU'] })
    const t = w.get('[data-test="dac7-blocker-NOUVEAU"]').text()
    expect(t).toContain('Blocage non reconnu : NOUVEAU')
    expect(w.get('[data-test="dac7-blockers"]').text()).not.toMatch(/exportez en mode Partiel/)
  })

  it('société déclarante non configurée : explication, et le mode Partiel n’est pas proposé', () => {
    const w = mountIt({ ...OVERVIEW, exportReady: false, blockers: ['OPERATOR_CONFIG_MISSING'] })
    expect(w.get('[data-test="dac7-blocker-OPERATOR_CONFIG_MISSING"]').text()).toContain('contactez l’équipe technique')
    expect(w.get('[data-test="dac7-blockers"]').text()).toMatch(/ne les contourne pas/)
    expect(w.get('[data-test="dac7-blockers"]').text()).not.toMatch(/exportez en mode Partiel/)
  })

  it('le mode Partiel n’est proposé que si tous les blocages sont contournables', () => {
    const w = mountIt({ ...OVERVIEW, exportReady: false, blockers: ['TAX_INFO_MISSING'] })
    expect(w.get('[data-test="dac7-blockers"]').text()).toMatch(/exportez en mode Partiel/)
  })

  it('liste de blocages absente ou export non prêt sans blocage : « État inconnu », pas « Aucun blocage »', () => {
    const noList = mountIt({ year: 2026, declarableSellers: 1 })
    expect(noList.get('[data-test="dac7-state-unknown"]').text()).toContain('État inconnu')
    expect(noList.find('[data-test="dac7-ready"]').exists()).toBe(false)
    const notReady = mountIt({ ...OVERVIEW, exportReady: false, blockers: [] })
    expect(notReady.find('[data-test="dac7-state-unknown"]').exists()).toBe(true)
    expect(notReady.find('[data-test="dac7-ready"]').exists()).toBe(false)
  })

  it('pas encore chargé : rien à montrer ; en chargement : l’état de chargement', () => {
    expect(mountIt(null).find('[data-test="dac7-card-declarableSellers"]').exists()).toBe(false)
    expect(mountIt(null, { loading: true }).text()).toContain('Chargement')
  })

  it('erreur : message et « Réessayer »', async () => {
    const w = mountIt(null, { error: 'Base indisponible' })
    expect(w.get('[data-test="state-error"]').text()).toContain('Base indisponible')
    await w.get('[data-test="state-retry"]').trigger('click')
    expect(w.emitted('retry')).toHaveLength(1)
  })
})
