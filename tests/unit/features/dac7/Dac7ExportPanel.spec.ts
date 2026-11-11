import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const svc = vi.hoisted(() => ({ exportFile: vi.fn(), controlCsv: vi.fn() }))
vi.mock('@/features/dac7/services/dac7Service', () => ({ dac7Service: svc }))
const download = vi.hoisted(() => vi.fn())
vi.mock('@/lib/downloadBlob', () => ({ downloadBlob: download }))

import Dac7ExportPanel from '@/features/dac7/components/Dac7ExportPanel.vue'

const BLOB = new Blob(['<xml/>'])
const ok = (extra: Record<string, unknown> = {}) => ({ blob: BLOB, filename: 'FR_DAC7_2026.xml.gz.pgp', filenameFallback: false, excluded: 0, encrypted: true, ...extra })
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
    const banner = w.get('[data-test="dac7-unencrypted-banner"]').text()
    expect(banner).toContain('Fichier non chiffré, ne pas déposer')
    expect(banner).toMatch(/supprimez-le de votre ordinateur/)
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

  it('une nouvelle année efface les blocages mais garde le fichier déjà téléchargé, avec son année', async () => {
    svc.exportFile.mockResolvedValueOnce(ok({ encrypted: false }))
    const w = mountIt()
    await run(w)
    svc.exportFile.mockRejectedValueOnce(blocked(['NO_SELLERS']))
    await run(w)
    await w.setProps({ year: 2025 })
    expect(w.find('[data-test="dac7-export-blocked"]').exists()).toBe(false)
  })

  it('le bandeau « non chiffré » reste tant qu’aucun autre export n’a été lancé, même si l’année change', async () => {
    svc.exportFile.mockResolvedValue(ok({ encrypted: false }))
    const w = mountIt()
    await run(w)
    await w.setProps({ year: 2025 })
    expect(w.find('[data-test="dac7-unencrypted-banner"]').exists()).toBe(true)
    expect(w.get('[data-test="dac7-export-result"]').text()).toContain('année 2026')
  })

  it('un nom de repli (sans extension) est signalé : à renommer avant tout test', async () => {
    svc.exportFile.mockResolvedValue(ok({ filename: 'dac7-2026-complet', filenameFallback: true }))
    const w = mountIt()
    await run(w)
    expect(w.get('[data-test="dac7-filename-fallback"]').text())
      .toBe('Nom de fichier inconnu : renommez-le selon la règle de nommage de la DGFiP avant tout test.')
    svc.exportFile.mockResolvedValue(ok())
    await run(w)
    expect(w.find('[data-test="dac7-filename-fallback"]').exists()).toBe(false)
  })

  it('refus en mode Partiel : pas de « complet », pas de suggestion de passer en Partiel', async () => {
    svc.exportFile.mockRejectedValue(blocked(['NO_SELLERS']))
    const w = mountIt()
    await w.get('[data-test="dac7-mode-PARTIAL"]').setValue(true)
    await run(w)
    const t = w.get('[data-test="dac7-export-blocked"]').text()
    expect(t).toContain('Export partiel refusé')
    expect(t).not.toMatch(/complet refusé/)
    expect(t).not.toMatch(/choisir le mode Partiel/)
  })

  it('refus en mode Complet pour société non configurée : explication, pas de suggestion Partiel', async () => {
    svc.exportFile.mockRejectedValue(blocked(['OPERATOR_CONFIG_MISSING']))
    const w = mountIt()
    await run(w)
    const t = w.get('[data-test="dac7-export-blocked"]').text()
    expect(t).toContain('Export complet refusé')
    expect(t).toContain('contactez l’équipe technique')
    expect(t).not.toMatch(/choisir le mode Partiel/)
  })

  it('refus en mode Complet pour numéro fiscal manquant : le mode Partiel est suggéré', async () => {
    svc.exportFile.mockRejectedValue(blocked(['TAX_INFO_MISSING']))
    const w = mountIt()
    await run(w)
    expect(w.get('[data-test="dac7-export-blocked"]').text()).toMatch(/choisir le mode Partiel/)
  })

  it('blocage inconnu : message générique en français, aucune suggestion', async () => {
    svc.exportFile.mockRejectedValue(blocked(['CODE_NEUF']))
    const w = mountIt()
    await run(w)
    const t = w.get('[data-test="dac7-export-blocker-CODE_NEUF"]').text()
    expect(t).toContain('Blocage non reconnu : CODE_NEUF')
    expect(w.get('[data-test="dac7-export-blocked"]').text()).not.toMatch(/choisir le mode Partiel/)
  })

  it('404 AVEC code métier (corps Blob) : ce n’est pas un ancien back, le message du serveur s’affiche', async () => {
    svc.exportFile.mockRejectedValue({ statusCode: 404, data: new Blob([JSON.stringify({ code: 'dac7-year-unknown', detail: 'Année inconnue du registre' })]) })
    const w = mountIt()
    await run(w)
    expect(w.find('[data-test="dac7-unavailable"]').exists()).toBe(false)
    expect(w.get('[data-test="dac7-export-error"]').text()).toContain('Année inconnue du registre')
  })

  it('405 avec code métier aussi, pour le CSV de contrôle', async () => {
    svc.controlCsv.mockRejectedValue({ statusCode: 405, data: new Blob([JSON.stringify({ code: 'dac7-csv-closed', detail: 'CSV fermé' })]) })
    const w = mountIt()
    await w.get('[data-test="dac7-export-csv"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="dac7-unavailable"]').exists()).toBe(false)
    expect(w.get('[data-test="dac7-export-error"]').text()).toContain('CSV fermé')
  })

  it('404 sans code (corps Blob vide ou JSON sans code) : ancien back, pour l’export comme pour le CSV', async () => {
    svc.exportFile.mockRejectedValue({ statusCode: 404, data: new Blob([JSON.stringify({ title: 'Not Found', type: 'about:blank' })]) })
    const w = mountIt()
    await run(w)
    expect(w.find('[data-test="dac7-unavailable"]').exists()).toBe(true)
    svc.controlCsv.mockRejectedValue({ statusCode: 405, data: new Blob(['']) })
    await w.get('[data-test="dac7-export-csv"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="dac7-unavailable"]').exists()).toBe(true)
    expect(w.find('[data-test="dac7-export-error"]').exists()).toBe(false)
  })

  it('« Non disponible » disparaît à l’essai suivant, et ne s’affiche jamais avec une autre erreur', async () => {
    svc.exportFile.mockRejectedValueOnce({ statusCode: 404, data: new Blob(['']) })
    const w = mountIt()
    await run(w)
    expect(w.find('[data-test="dac7-unavailable"]').exists()).toBe(true)
    svc.exportFile.mockRejectedValueOnce({ statusCode: 500, data: new Blob([JSON.stringify({ detail: 'Panne' })]) })
    await run(w)
    expect(w.find('[data-test="dac7-unavailable"]').exists()).toBe(false)
    expect(w.get('[data-test="dac7-export-error"]').text()).toContain('Panne')
    await run(w)
    expect(w.find('[data-test="dac7-unavailable"]').exists()).toBe(false)
  })

  it('erreur brute d’ofetch : texte de repli en français, pas l’URL', async () => {
    svc.exportFile.mockRejectedValue(Object.assign(new Error('[POST] "https://api/admin/dac7/exports": 500 Internal Server Error'), { statusCode: 500, data: new Blob(['']) }))
    const w = mountIt()
    await run(w)
    expect(w.get('[data-test="dac7-export-error"]').text()).toBe('Le fichier n’a pas pu être généré')
  })

  it('prévient la page quand une génération commence et finit (verrou du sélecteur d’année)', async () => {
    let resolve: (_value: unknown) => void = () => {}
    svc.exportFile.mockReturnValue(new Promise((r) => { resolve = r }))
    const w = mountIt()
    await w.get('[data-test="dac7-export-run"]').trigger('click')
    await flushPromises()
    expect(w.emitted('busy')?.at(-1)).toEqual([true])
    resolve(ok())
    await flushPromises()
    expect(w.emitted('busy')?.at(-1)).toEqual([false])
  })
})
