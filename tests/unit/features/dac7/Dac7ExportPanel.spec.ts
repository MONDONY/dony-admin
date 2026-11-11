import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const svc = vi.hoisted(() => ({ exportFile: vi.fn(), controlCsv: vi.fn() }))
vi.mock('@/features/dac7/services/dac7Service', () => ({ dac7Service: svc }))
const download = vi.hoisted(() => vi.fn())
vi.mock('@/lib/downloadBlob', () => ({ downloadBlob: download }))

import Dac7ExportPanel from '@/features/dac7/components/Dac7ExportPanel.vue'

const BLOB = new Blob(['<xml/>'])
const ok = (extra: Record<string, unknown> = {}) => ({ blob: BLOB, filename: 'FR_DAC7_2026.xml.gz.pgp', excluded: 0, encrypted: true, ...extra })
const blocked = (blockers: unknown) => ({ statusCode: 409, data: new Blob([JSON.stringify({ code: 'dac7-export-blocked', detail: 'Export bloqué', blockers })]) })

function mountIt(props: Record<string, unknown> = {}) {
  return mount(Dac7ExportPanel, { props: { year: 2026, ...props } })
}
const run = async (w: ReturnType<typeof mountIt>) => {
  await w.get('[data-test="dac7-export-run"]').trigger('click')
  await flushPromises()
}

describe('Dac7ExportPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    svc.exportFile.mockResolvedValue(ok())
    svc.controlCsv.mockResolvedValue({ blob: new Blob(['a;b']), filename: 'controle.csv' })
  })

  it('rappelle toujours que le dépôt est un geste humain sur impots.gouv.fr', () => {
    const w = mountIt()
    expect(w.get('[data-test="dac7-export-warning"]').text())
      .toBe('Le fichier doit être déposé par vous sur impots.gouv.fr (Télé-TD). Yadony ne l’envoie jamais.')
  })

  it('propose Complet (par défaut) et Partiel, chacun expliqué', async () => {
    const w = mountIt()
    const full = w.get('[data-test="dac7-mode-FULL"]').element as HTMLInputElement
    const partial = w.get('[data-test="dac7-mode-PARTIAL"]').element as HTMLInputElement
    expect(full.checked).toBe(true)
    expect(partial.checked).toBe(false)
    expect(w.text()).toMatch(/refusé tant qu’il reste un blocage/i)
    expect(w.text()).toMatch(/voyageurs complets seulement/i)
    await w.get('[data-test="dac7-mode-PARTIAL"]').setValue(true)
    expect((w.get('[data-test="dac7-mode-PARTIAL"]').element as HTMLInputElement).checked).toBe(true)
  })

  it('« Exporter le fichier » : demande le mode choisi, télécharge sous le nom du serveur', async () => {
    const w = mountIt()
    await run(w)
    expect(svc.exportFile).toHaveBeenCalledWith(2026, 'FULL')
    expect(download).toHaveBeenCalledWith(BLOB, 'FR_DAC7_2026.xml.gz.pgp')
    const res = w.get('[data-test="dac7-export-result"]').text()
    expect(res).toContain('FR_DAC7_2026.xml.gz.pgp')
    expect(res).toMatch(/chiffré/i)
    expect(w.find('[data-test="dac7-unencrypted-banner"]').exists()).toBe(false)
    expect(w.find('[data-test="dac7-export-excluded"]').exists()).toBe(false)
  })

  it('mode Partiel : affiche le nombre d’exclus', async () => {
    svc.exportFile.mockResolvedValue(ok({ excluded: 3 }))
    const w = mountIt()
    await w.get('[data-test="dac7-mode-PARTIAL"]').setValue(true)
    await run(w)
    expect(svc.exportFile).toHaveBeenCalledWith(2026, 'PARTIAL')
    expect(w.get('[data-test="dac7-export-excluded"]').text()).toContain('3 voyageurs exclus')
    expect(w.get('[data-test="dac7-export-excluded"]').text()).toMatch(/CSV de contrôle/)
  })

  it('un seul exclu : singulier', async () => {
    svc.exportFile.mockResolvedValue(ok({ excluded: 1 }))
    const w = mountIt()
    await run(w)
    expect(w.get('[data-test="dac7-export-excluded"]').text()).toContain('1 voyageur exclu')
    expect(w.get('[data-test="dac7-export-excluded"]').text()).not.toContain('voyageurs exclus')
  })

  it('fichier non chiffré : bandeau « ne pas déposer »', async () => {
    svc.exportFile.mockResolvedValue(ok({ encrypted: false }))
    const w = mountIt()
    await run(w)
    expect(w.get('[data-test="dac7-unencrypted-banner"]').text()).toBe('Fichier non chiffré, ne pas déposer')
    expect(download).toHaveBeenCalled()
  })

  it('chiffrement inconnu (en-tête illisible) : prudence, jamais « chiffré »', async () => {
    svc.exportFile.mockResolvedValue(ok({ encrypted: null }))
    const w = mountIt()
    await run(w)
    expect(w.get('[data-test="dac7-export-encryption-unknown"]').text()).toMatch(/pas indiqué|ne sait pas/i)
    expect(w.get('[data-test="dac7-export-result"]').text()).not.toMatch(/Fichier chiffré/)
  })

  it('409 dac7-export-blocked : montre les blocages renvoyés, sans télécharger', async () => {
    svc.exportFile.mockRejectedValue(blocked(['TAX_INFO_MISSING', 'NO_SELLERS']))
    const w = mountIt()
    await run(w)
    expect(download).not.toHaveBeenCalled()
    expect(w.get('[data-test="dac7-export-blocked"]').text()).toMatch(/refusé/i)
    expect(w.get('[data-test="dac7-export-blocker-TAX_INFO_MISSING"]').text()).toContain('Numéro fiscal manquant')
    expect(w.get('[data-test="dac7-export-blocker-NO_SELLERS"]').text()).toContain('Aucun voyageur à déclarer')
    expect(w.get('[data-test="dac7-export-blocked"]').text()).toMatch(/mode Partiel/)
    expect(w.find('[data-test="dac7-export-result"]').exists()).toBe(false)
  })

  it('409 sans liste exploitable : message de refus quand même', async () => {
    svc.exportFile.mockRejectedValue(blocked('nimporte quoi'))
    const w = mountIt()
    await run(w)
    expect(w.get('[data-test="dac7-export-blocked"]').exists()).toBe(true)
    expect(w.findAll('[data-test^="dac7-export-blocker-"]')).toHaveLength(0)
  })

  it('un nouvel export efface le résultat et les blocages précédents', async () => {
    svc.exportFile.mockRejectedValueOnce(blocked(['NO_SELLERS']))
    const w = mountIt()
    await run(w)
    expect(w.find('[data-test="dac7-export-blocked"]').exists()).toBe(true)
    await run(w)
    expect(w.find('[data-test="dac7-export-blocked"]').exists()).toBe(false)
    expect(w.find('[data-test="dac7-export-result"]').exists()).toBe(true)
  })

  it('autre erreur : message du serveur (corps Blob lu)', async () => {
    svc.exportFile.mockRejectedValue({ statusCode: 500, data: new Blob([JSON.stringify({ detail: 'Clé de chiffrement illisible' })]) })
    const w = mountIt()
    await run(w)
    expect(w.get('[data-test="dac7-export-error"]').text()).toContain('Clé de chiffrement illisible')
  })

  it('ancien back (404 sans code) : « Non disponible », pas d’erreur', async () => {
    svc.exportFile.mockRejectedValue({ statusCode: 404, data: new Blob(['']) })
    const w = mountIt()
    await run(w)
    expect(w.get('[data-test="dac7-unavailable"]').text()).toContain('Non disponible sur cette version du serveur')
    expect(w.find('[data-test="dac7-export-error"]').exists()).toBe(false)
  })

  it('le bouton est désactivé pendant la génération', async () => {
    let resolve: (_value: unknown) => void = () => {}
    svc.exportFile.mockReturnValue(new Promise((r) => { resolve = r }))
    const w = mountIt()
    await w.get('[data-test="dac7-export-run"]').trigger('click')
    expect(w.get('[data-test="dac7-export-run"]').attributes('disabled')).toBeDefined()
    resolve(ok())
    await flushPromises()
    expect(w.get('[data-test="dac7-export-run"]').attributes('disabled')).toBeUndefined()
  })

  it('« CSV de contrôle » télécharge le fichier du serveur', async () => {
    const w = mountIt()
    await w.get('[data-test="dac7-export-csv"]').trigger('click')
    await flushPromises()
    expect(svc.controlCsv).toHaveBeenCalledWith(2026)
    expect(download).toHaveBeenCalledWith(expect.any(Blob), 'controle.csv')
    expect(w.get('[data-test="dac7-export-csv"]').text()).toBe('CSV de contrôle')
  })

  it('CSV de contrôle : erreur et ancien back', async () => {
    svc.controlCsv.mockRejectedValueOnce({ statusCode: 500, data: new Blob([JSON.stringify({ detail: 'Panne' })]) })
    const w = mountIt()
    await w.get('[data-test="dac7-export-csv"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-test="dac7-export-error"]').text()).toContain('Panne')
    svc.controlCsv.mockRejectedValueOnce({ statusCode: 404, data: new Blob(['']) })
    await w.get('[data-test="dac7-export-csv"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="dac7-unavailable"]').exists()).toBe(true)
  })

  it('prévient que le mode Complet sera refusé quand la synthèse signale des blocages', () => {
    const w = mountIt({ blockersCount: 2 })
    expect(w.get('[data-test="dac7-export-hint"]').text()).toMatch(/2 blocages/)
    expect(mountIt({ blockersCount: 0 }).find('[data-test="dac7-export-hint"]').exists()).toBe(false)
    expect(mountIt({ blockersCount: 1 }).get('[data-test="dac7-export-hint"]').text()).toMatch(/1 blocage[^s]/)
  })

  it('une nouvelle année efface le résultat de l’ancienne', async () => {
    const w = mountIt()
    await run(w)
    expect(w.find('[data-test="dac7-export-result"]').exists()).toBe(true)
    await w.setProps({ year: 2025 })
    expect(w.find('[data-test="dac7-export-result"]').exists()).toBe(false)
  })
})
