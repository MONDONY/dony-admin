/**
 * Page /dac7 : synthèse, onglets, année, droit de route et tolérance de l'ancien back.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { seedAuth } from '~/tests/helpers/auth'

const meta = vi.hoisted(() => ({ value: undefined as Record<string, unknown> | undefined }))
vi.stubGlobal('definePageMeta', (m: Record<string, unknown>) => { meta.value = m })

const svc = vi.hoisted(() => ({
  overview: vi.fn(), sellers: vi.fn(), diligence: vi.fn(), remind: vi.fn(), decision: vi.fn(),
  refunds: vi.fn(), anomalies: vi.fn(), exportFile: vi.fn(), controlCsv: vi.fn(), sendStatements: vi.fn(),
}))
vi.mock('@/features/dac7/services/dac7Service', () => ({ dac7Service: svc }))
vi.mock('@/lib/downloadBlob', () => ({ downloadBlob: vi.fn() }))

const YEAR = new Date().getFullYear()
const OVERVIEW = {
  year: YEAR, enabled: true, remindersEnabled: false, declarableSellers: 5, withTaxInfo: 3, missingTaxInfo: 2,
  identityReview: 0, unknownResidence: 0, nonDeclarable: 1, refundsToReconcile: 4, pendingSplits: 0, anomalies: 2,
  invalidPartnerJurisdictions: [], totals: { operations: 10, netEur: 500, commissionEur: 60 },
  eurComplete: true, commissionComplete: true, exportReady: false, blockers: ['TAX_INFO_MISSING'],
}

async function mountPage(role: 'ADMIN' | 'SUPPORT' = 'ADMIN') {
  seedAuth(role, { DAC7_REPORT: true })
  const mod = await import('@/pages/dac7/index.vue')
  const w = mount(mod.default, { global: { stubs: { NuxtLink: { props: ['to'], template: '<a :data-to="to"><slot /></a>' } } } })
  await flushPromises()
  return w
}

describe('/dac7', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    svc.overview.mockResolvedValue(OVERVIEW)
    svc.sellers.mockResolvedValue([])
    svc.refunds.mockResolvedValue([])
    svc.anomalies.mockResolvedValue([])
    svc.diligence.mockResolvedValue([])
  })

  it('exige le droit DAC7_REPORT et nomme la page', async () => {
    await mountPage()
    expect(meta.value).toMatchObject({ middleware: 'admin-only', permission: 'DAC7_REPORT', pageTitle: 'Déclaration DAC7' })
  })

  it('charge la synthèse de l’année courante, avec ses badges et ses blocages', async () => {
    const w = await mountPage()
    expect(svc.overview).toHaveBeenCalledWith(YEAR)
    expect((w.get('[data-test="dac7-year"]').element as HTMLSelectElement).value).toBe(String(YEAR))
    expect(w.get('[data-test="dac7-card-declarableSellers"]').text()).toContain('5')
    expect(w.get('[data-test="dac7-badge-rappels"]').text()).toBe('Rappels éteints')
    expect(w.find('[data-test="dac7-blocker-TAX_INFO_MISSING"]').exists()).toBe(true)
  })

  it('le sélecteur propose l’année courante en premier, jusqu’à 2023', async () => {
    const w = await mountPage()
    const years = w.findAll('[data-test="dac7-year"] option').map(o => Number(o.text()))
    expect(years[0]).toBe(YEAR)
    expect(years.at(-1)).toBe(2023)
  })

  it('changer d’année relit la synthèse et la liste', async () => {
    const w = await mountPage()
    svc.overview.mockClear(); svc.sellers.mockClear()
    await w.get('[data-test="dac7-year"]').setValue('2024')
    await flushPromises()
    expect(svc.overview).toHaveBeenCalledWith(2024)
    expect(svc.sellers).toHaveBeenCalledWith(2024, 'ALL')
  })

  it('onglet Voyageurs par défaut ; les autres se chargent à l’ouverture', async () => {
    const w = await mountPage()
    expect(w.find('[data-test="dac7-sellers-panel"]').exists()).toBe(true)
    expect(svc.refunds).not.toHaveBeenCalled()
    await w.get('[data-test="dac7-tab-refunds"]').trigger('click')
    await flushPromises()
    expect(svc.refunds).toHaveBeenCalledWith(YEAR)
    expect(w.find('[data-test="dac7-refunds-panel"]').exists()).toBe(true)
    expect(w.find('[data-test="dac7-sellers-panel"]').exists()).toBe(false)
    await w.get('[data-test="dac7-tab-anomalies"]').trigger('click')
    await flushPromises()
    expect(svc.anomalies).toHaveBeenCalledWith(YEAR)
    await w.get('[data-test="dac7-tab-export"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="dac7-export-panel"]').exists()).toBe(true)
    expect(w.find('[data-test="dac7-statements-panel"]').exists()).toBe(true)
  })

  it('les onglets portent les compteurs de la synthèse', async () => {
    const w = await mountPage()
    expect(w.get('[data-test="dac7-tab-refunds"]').text()).toContain('4')
    expect(w.get('[data-test="dac7-tab-anomalies"]').text()).toContain('2')
  })

  it('l’onglet Fichier connaît le nombre de blocages de la synthèse', async () => {
    const w = await mountPage()
    await w.get('[data-test="dac7-tab-export"]').trigger('click')
    expect(w.get('[data-test="dac7-export-hint"]').text()).toMatch(/1 blocage/)
  })

  it('un geste dans le tiroir relit la synthèse', async () => {
    svc.sellers.mockResolvedValue([{ userId: 'u1', displayName: 'Awa Diop', solicitation: 'SOLLICITER' }])
    svc.remind.mockResolvedValue(undefined)
    const w = await mountPage()
    svc.overview.mockClear()
    await w.get('[data-test="dac7-seller-open-u1"]').trigger('click')
    await flushPromises()
    await w.get('[data-test="dac7-remind"]').trigger('click')
    await w.get('[data-test="confirm"]').trigger('click')
    await flushPromises()
    expect(svc.overview).toHaveBeenCalledWith(YEAR)
  })

  it('ancien back (404 sans code) : « Non disponible sur cette version du serveur », aucune erreur', async () => {
    svc.overview.mockRejectedValue({ statusCode: 404, data: {} })
    const w = await mountPage()
    expect(w.get('[data-test="dac7-page-unavailable"]').text()).toContain('Non disponible sur cette version du serveur')
    expect(w.find('[data-test="state-error"]').exists()).toBe(false)
    expect(w.find('[data-test="dac7-sellers-panel"]').exists()).toBe(false)
    expect(svc.sellers).not.toHaveBeenCalled()
  })

  it('405 aussi', async () => {
    svc.overview.mockRejectedValue({ statusCode: 405, data: {} })
    const w = await mountPage()
    expect(w.find('[data-test="dac7-page-unavailable"]').exists()).toBe(true)
  })

  it('vraie erreur : message avec « Réessayer », qui relit', async () => {
    svc.overview.mockRejectedValueOnce({ statusCode: 500, data: { detail: 'Base indisponible' } })
    const w = await mountPage()
    expect(w.get('[data-test="state-error"]').text()).toContain('Base indisponible')
    svc.overview.mockResolvedValueOnce(OVERVIEW)
    await w.get('[data-test="state-retry"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="state-error"]').exists()).toBe(false)
    expect(w.find('[data-test="dac7-card-declarableSellers"]').exists()).toBe(true)
  })

  it('un 404 porteur d’un code reste une vraie erreur', async () => {
    svc.overview.mockRejectedValue({ statusCode: 404, data: { code: 'dac7-year-unknown', detail: 'Année inconnue' } })
    const w = await mountPage()
    expect(w.find('[data-test="dac7-page-unavailable"]').exists()).toBe(false)
    expect(w.get('[data-test="state-error"]').text()).toContain('Année inconnue')
  })

  it('aucune donnée personnelle dans la console du navigateur', async () => {
    const spies = (['log', 'warn', 'error', 'info', 'debug'] as const).map(k => vi.spyOn(console, k).mockImplementation(() => {}))
    svc.sellers.mockResolvedValue([{ userId: 'u1', displayName: 'Awa Diop' }])
    svc.overview.mockRejectedValueOnce({ statusCode: 500, data: { detail: 'x' } })
    await mountPage()
    for (const s of spies) expect(s).not.toHaveBeenCalled()
    spies.forEach(s => s.mockRestore())
  })
})
