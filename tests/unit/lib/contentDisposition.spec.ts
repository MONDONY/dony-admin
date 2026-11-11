import { describe, it, expect } from 'vitest'
import { filenameFromContentDisposition } from '@/lib/contentDisposition'

describe('filenameFromContentDisposition', () => {
  it('lit filename entre guillemets', () => {
    expect(filenameFromContentDisposition('attachment; filename="FR_DPI-DAC7_2026.xml.gz.pgp"')).toBe('FR_DPI-DAC7_2026.xml.gz.pgp')
  })
  it('lit filename sans guillemets', () => {
    expect(filenameFromContentDisposition('attachment; filename=export.csv')).toBe('export.csv')
  })
  it('préfère filename* (UTF-8, encodé en pourcentage)', () => {
    expect(filenameFromContentDisposition('attachment; filename="x.csv"; filename*=UTF-8\'\'r%C3%A9sum%C3%A9.csv')).toBe('résumé.csv')
  })
  it('écarte tout chemin : le nom ne peut pas sortir du dossier de téléchargement', () => {
    expect(filenameFromContentDisposition('attachment; filename="../../etc/passwd"')).toBe('passwd')
    expect(filenameFromContentDisposition('attachment; filename="a\\b\\c.xml"')).toBe('c.xml')
  })
  it('en-tête absent, vide ou sans nom : null', () => {
    expect(filenameFromContentDisposition(null)).toBeNull()
    expect(filenameFromContentDisposition(undefined)).toBeNull()
    expect(filenameFromContentDisposition('attachment')).toBeNull()
    expect(filenameFromContentDisposition('attachment; filename=""')).toBeNull()
  })
  it('encodage cassé : retombe sur filename', () => {
    expect(filenameFromContentDisposition('attachment; filename="ok.csv"; filename*=UTF-8\'\'%E0%A4%A')).toBe('ok.csv')
  })
})
