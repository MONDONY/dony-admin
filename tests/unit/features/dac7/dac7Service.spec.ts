import { describe, it, expect, vi, beforeEach } from 'vitest'

const api = vi.hoisted(() => Object.assign(vi.fn(), { raw: vi.fn() }))
vi.mock('@/composables/useApi', () => ({ useApi: () => api }))

import { dac7Service } from '@/features/dac7/services/dac7Service'

const UID = '7a2e4b1c-0000-4a00-8000-0000000000a1'
const headers = (h: Record<string, string>) => new Headers(h)

describe('dac7Service : lectures', () => {
  beforeEach(() => { api.mockReset(); api.raw.mockReset() })

  it('overview : année en paramètre', async () => {
    api.mockResolvedValue({ year: 2026 })
    await dac7Service.overview(2026)
    expect(api).toHaveBeenCalledWith('/admin/dac7/overview', { query: { year: 2026 } })
  })

  it('sellers : année et filtre, tableau rendu tel quel', async () => {
    api.mockResolvedValue([{ userId: UID }])
    expect(await dac7Service.sellers(2026, 'MISSING_TAX_INFO')).toEqual([{ userId: UID }])
    expect(api).toHaveBeenCalledWith('/admin/dac7/sellers', { query: { year: 2026, filter: 'MISSING_TAX_INFO' } })
  })

  it('sellers : tolère une page Spring ou un corps vide', async () => {
    api.mockResolvedValueOnce({ content: [{ userId: UID }] })
    expect(await dac7Service.sellers(2026, 'ALL')).toEqual([{ userId: UID }])
    api.mockResolvedValueOnce(undefined)
    expect(await dac7Service.sellers(2026, 'ALL')).toEqual([])
  })

  it('diligence, refunds et anomalies', async () => {
    api.mockResolvedValue([])
    await dac7Service.diligence(UID)
    expect(api).toHaveBeenLastCalledWith(`/admin/dac7/sellers/${UID}/diligence`)
    await dac7Service.refunds(2026)
    expect(api).toHaveBeenLastCalledWith('/admin/dac7/refunds', { query: { year: 2026 } })
    await dac7Service.anomalies(2025)
    expect(api).toHaveBeenLastCalledWith('/admin/dac7/anomalies', { query: { year: 2025 } })
  })

  it('l’identifiant du voyageur est encodé dans le chemin', async () => {
    api.mockResolvedValue([])
    await dac7Service.diligence('a/b?c')
    expect(api).toHaveBeenLastCalledWith('/admin/dac7/sellers/a%2Fb%3Fc/diligence')
  })
})

describe('dac7Service : gestes', () => {
  beforeEach(() => { api.mockReset(); api.raw.mockReset() })

  it('remind : POST sans corps', async () => {
    api.mockResolvedValue(undefined)
    await dac7Service.remind(UID)
    expect(api).toHaveBeenCalledWith(`/admin/dac7/sellers/${UID}/remind`, { method: 'POST' })
  })

  it('decision : POST avec la note, rognée', async () => {
    api.mockResolvedValue(undefined)
    await dac7Service.decision(UID, '  Revu à la main  ')
    expect(api).toHaveBeenCalledWith(`/admin/dac7/sellers/${UID}/decision`, { method: 'POST', body: { note: 'Revu à la main' } })
  })

  it('sendStatements : POST avec l’année', async () => {
    api.mockResolvedValue({ sent: 3, skipped: 1 })
    expect(await dac7Service.sendStatements(2026)).toEqual({ sent: 3, skipped: 1 })
    expect(api).toHaveBeenCalledWith('/admin/dac7/statements/send', { method: 'POST', body: { year: 2026 } })
  })
})

describe('dac7Service : fichiers', () => {
  beforeEach(() => { api.mockReset(); api.raw.mockReset() })

  it('exportFile : POST en Blob, nom, exclus et chiffrement lus dans les en-têtes', async () => {
    const blob = new Blob(['x'])
    api.raw.mockResolvedValue({
      _data: blob,
      headers: headers({ 'content-disposition': 'attachment; filename="FR_DAC7_2026.xml.gz.pgp"', 'x-dac7-excluded': '4', 'x-dac7-encrypted': 'true' }),
    })
    const res = await dac7Service.exportFile(2026, 'PARTIAL')
    expect(api.raw).toHaveBeenCalledWith('/admin/dac7/exports', { method: 'POST', body: { year: 2026, mode: 'PARTIAL' }, responseType: 'blob' })
    expect(res).toEqual({ blob, filename: 'FR_DAC7_2026.xml.gz.pgp', filenameFallback: false, excluded: 4, encrypted: true })
  })

  it('exportFile : non chiffré, sans exclus ni nom (repli sur un nom neutre)', async () => {
    api.raw.mockResolvedValue({ _data: new Blob(['x']), headers: headers({ 'x-dac7-encrypted': 'false' }) })
    const res = await dac7Service.exportFile(2026, 'FULL')
    expect(res.encrypted).toBe(false)
    expect(res.excluded).toBeNull()
    expect(res.filename).toBe('dac7-2026-complet')
    expect(res.filenameFallback).toBe(true)
  })

  it('exportFile : en-têtes illisibles = inconnus, jamais « chiffré » par défaut', async () => {
    api.raw.mockResolvedValue({ _data: new Blob(['x']), headers: headers({ 'x-dac7-excluded': 'abc', 'x-dac7-encrypted': 'peut-être' }) })
    const res = await dac7Service.exportFile(2026, 'PARTIAL')
    expect(res.encrypted).toBeNull()
    expect(res.excluded).toBeNull()
    expect(res.filename).toBe('dac7-2026-partiel')
  })

  it('controlCsv : GET en Blob, nom de l’en-tête ou repli', async () => {
    api.raw.mockResolvedValueOnce({ _data: new Blob(['a;b']), headers: headers({ 'content-disposition': 'attachment; filename="controle.csv"' }) })
    const a = await dac7Service.controlCsv(2026)
    expect(api.raw).toHaveBeenCalledWith('/admin/dac7/exports/control.csv', { query: { year: 2026 }, responseType: 'blob' })
    expect(a.filename).toBe('controle.csv')
    api.raw.mockResolvedValueOnce({ _data: new Blob(['a;b']), headers: headers({}) })
    expect((await dac7Service.controlCsv(2026)).filename).toBe('dac7-controle-2026.csv')
  })
})
