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

import { defaultYear, currentUtcYear } from '@/features/dac7/types/index'

const YEAR = defaultYear()
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

  it('le sélecteur propose l’année UTC courante et les deux précédentes, jamais une année postérieure', async () => {
    const w = await mountPage()
    const years = w.findAll('[data-test="dac7-year"] option').map(o => Number(o.text()))
    expect(years).toEqual([currentUtcYear(), currentUtcYear() - 1, currentUtcYear() - 2])
    expect(Math.max(...years)).toBeLessThanOrEqual(new Date().getUTCFullYear())
    expect(svc.overview).toHaveBeenCalledWith(expect.any(Number))
    expect(svc.overview.mock.calls[0][0]).toBeLessThanOrEqual(new Date().getUTCFullYear())
  })

  it('en janvier, l’année par défaut est l’année écoulée (déclaration due le 31 janvier)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2027-01-15T10:00:00Z'))
    try {
      const w = await mountPage()
      expect(svc.overview).toHaveBeenCalledWith(2026)
      expect((w.get('[data-test="dac7-year"]').element as HTMLSelectElement).value).toBe('2026')
      expect(w.findAll('[data-test="dac7-year"] option').map(o => Number(o.text()))).toEqual([2027, 2026, 2025])
    } finally { vi.useRealTimers() }
  })

  it('changer d’année relit la synthèse et la liste', async () => {
    const w = await mountPage()
    svc.overview.mockClear(); svc.sellers.mockClear()
    const other = currentUtcYear() - 2
    await w.get('[data-test="dac7-year"]').setValue(String(other))
    await flushPromises()
    expect(svc.overview).toHaveBeenCalledWith(other)
    expect(svc.sellers).toHaveBeenCalledWith(other, 'ALL')
  })

  it('course : la synthèse tardive d’une année abandonnée n’écrase pas celle de l’année affichée', async () => {
    const pending: ((_v: unknown) => void)[] = []
    svc.overview.mockReset()
    svc.overview.mockImplementation(() => new Promise((resolve) => { pending.push(resolve) }))
    const w = await mountPage()
    pending[0]({ ...OVERVIEW, declarableSellers: 11 })
    await flushPromises()
    expect(w.get('[data-test="dac7-card-declarableSellers"]').text()).toContain('11')
    const y1 = currentUtcYear() - 1
    const y2 = currentUtcYear() - 2
    await w.get('[data-test="dac7-year"]').setValue(String(y1))
    await flushPromises()
    // L'ancienne année disparaît tout de suite : chargement visible, pas de chiffres périmés.
    expect(w.find('[data-test="dac7-card-declarableSellers"]').exists()).toBe(false)
    expect(w.text()).toContain('Chargement')
    await w.get('[data-test="dac7-year"]').setValue(String(y2))
    await flushPromises()
    pending[2]({ ...OVERVIEW, declarableSellers: 22 })
    await flushPromises()
    pending[1]({ ...OVERVIEW, declarableSellers: 99 })
    await flushPromises()
    expect(w.get('[data-test="dac7-card-declarableSellers"]').text()).toContain('22')
    expect(w.get('[data-test="dac7-card-declarableSellers"]').text()).not.toContain('99')
  })

  it('le sélecteur d’année est verrouillé pendant un export, puis rendu', async () => {
    let resolve: (_value: unknown) => void = () => {}
    svc.exportFile.mockReturnValue(new Promise((r) => { resolve = r }))
    const w = await mountPage()
    await w.get('[data-test="dac7-tab-export"]').trigger('click')
    await w.get('[data-test="dac7-export-run"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-test="dac7-year"]').attributes('disabled')).toBeDefined()
    resolve({ blob: new Blob(['x']), filename: 'f.pgp', filenameFallback: false, excluded: 0, encrypted: true })
    await flushPromises()
    expect(w.get('[data-test="dac7-year"]').attributes('disabled')).toBeUndefined()
  })

  it('le sélecteur est aussi verrouillé pendant l’envoi des récapitulatifs', async () => {
    let resolve: (_value: unknown) => void = () => {}
    svc.sendStatements.mockReturnValue(new Promise((r) => { resolve = r }))
    const w = await mountPage()
    await w.get('[data-test="dac7-tab-export"]').trigger('click')
    await w.get('[data-test="dac7-statements-send"]').trigger('click')
    await w.get('[data-test="confirmation-input"]').setValue('ENVOYER')
    await w.get('[data-test="confirm"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-test="dac7-year"]').attributes('disabled')).toBeDefined()
    resolve({ sent: 1, skipped: 0 })
    await flushPromises()
    expect(w.get('[data-test="dac7-year"]').attributes('disabled')).toBeUndefined()
  })

  it('le bandeau « non chiffré » survit au changement d’onglet', async () => {
    svc.exportFile.mockResolvedValue({ blob: new Blob(['x']), filename: 'f.xml', filenameFallback: false, excluded: 0, encrypted: false })
    const w = await mountPage()
    await w.get('[data-test="dac7-tab-export"]').trigger('click')
    await w.get('[data-test="dac7-export-run"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="dac7-unencrypted-banner"]').exists()).toBe(true)
    await w.get('[data-test="dac7-tab-anomalies"]').trigger('click')
    await flushPromises()
    await w.get('[data-test="dac7-tab-export"]').trigger('click')
    expect(w.find('[data-test="dac7-unencrypted-banner"]').exists()).toBe(true)
  })

  it('synthèse sans liste de blocages : « État inconnu »', async () => {
    svc.overview.mockResolvedValue({ year: YEAR })
    const w = await mountPage()
    expect(w.find('[data-test="dac7-state-unknown"]').exists()).toBe(true)
    expect(w.find('[data-test="dac7-ready"]').exists()).toBe(false)
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
    expect(w.get('[data-test="dac7-export-panel"]').isVisible()).toBe(true)
    expect(w.get('[data-test="dac7-statements-panel"]').isVisible()).toBe(true)
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
