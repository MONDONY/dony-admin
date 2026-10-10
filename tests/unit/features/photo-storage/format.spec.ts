import { describe, it, expect } from 'vitest'
import { formatUtc, formatBytes } from '@/features/photo-storage/utils/format'

describe('formatUtc', () => {
  it('lit une LocalDateTime sans fuseau comme de l\'UTC (04:10 UTC = 06:10 à Paris en octobre)', () => {
    expect(formatUtc('2026-10-10T04:10:00', 'Europe/Paris')).toContain('06:10')
  })

  it('ne double pas le fuseau d\'une date qui en porte déjà un', () => {
    expect(formatUtc('2026-10-10T04:10:00Z', 'Europe/Paris')).toContain('06:10')
    expect(formatUtc('2026-10-10T06:10:00+02:00', 'Europe/Paris')).toContain('06:10')
  })

  it('sans fuseau fourni, suit le contrat UTC de la machine', () => {
    const attendu = new Date(Date.UTC(2026, 9, 10, 4, 10)).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    })
    expect(formatUtc('2026-10-10T04:10:00')).toBe(attendu)
  })

  it('renvoie un tiret pour null ou une date invalide', () => {
    expect(formatUtc(null)).toBe('—')
    expect(formatUtc('pas une date')).toBe('—')
  })
})

describe('formatBytes', () => {
  it('formate les paliers', () => {
    expect(formatBytes(512)).toBe('512 o')
    expect(formatBytes(1536)).toBe('1.5 Ko')
    expect(formatBytes(5 * 1024 ** 2)).toBe('5.0 Mo')
    expect(formatBytes(2 * 1024 ** 3)).toBe('2.00 Go')
  })
})
