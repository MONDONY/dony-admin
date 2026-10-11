import { describe, it, expect } from 'vitest'
import { formatUtc, formatBytes, formatDuration } from '@/features/photo-storage/utils/format'

describe('formatUtc', () => {
  it('lit une LocalDateTime sans fuseau comme de l\'UTC (04:10 UTC = 06:10 à Paris en octobre)', () => {
    expect(formatUtc('2026-10-10T04:10:00', 'Europe/Paris')).toContain('06:10')
  })

  it('ne double pas le fuseau d\'une date qui en porte déjà un', () => {
    expect(formatUtc('2026-10-10T04:10:00Z', 'Europe/Paris')).toContain('06:10')
    expect(formatUtc('2026-10-10T06:10:00+02:00', 'Europe/Paris')).toContain('06:10')
    expect(formatUtc('2026-10-10T06:10:00+0200', 'Europe/Paris')).toContain('06:10')
  })

  it('accepte les microsecondes Java', () => {
    expect(formatUtc('2026-10-10T04:10:00.123456', 'Europe/Paris')).toContain('06:10')
  })

  it('sans fuseau fourni, suit le contrat UTC de la machine', () => {
    const attendu = new Date(Date.UTC(2026, 9, 10, 4, 10)).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    })
    expect(formatUtc('2026-10-10T04:10:00')).toBe(attendu)
  })

  it('renvoie « Inconnue » pour null ou une date invalide, sans tiret cadratin', () => {
    expect(formatUtc(null)).toBe('Inconnue')
    expect(formatUtc('pas une date')).toBe('Inconnue')
  })
})

describe('formatBytes', () => {
  it('formate les paliers à la française', () => {
    expect(formatBytes(512)).toBe('512 o')
    expect(formatBytes(1536)).toBe('1,5 Ko')
    expect(formatBytes(5 * 1024 ** 2)).toBe('5 Mo')
    expect(formatBytes(2.25 * 1024 ** 3)).toBe('2,3 Go')
  })
})

describe('formatDuration', () => {
  it('en secondes sous la minute, en minutes au-delà', () => {
    expect(formatDuration('2026-10-10T04:10:00', '2026-10-10T04:10:42')).toBe('durée 42 s')
    expect(formatDuration('2026-10-10T04:10:00', '2026-10-10T04:11:30.500000')).toBe('durée 1,5 min')
    expect(formatDuration('2026-10-10T04:10:00', '2026-10-10T04:10:00')).toBe('durée 0 s')
  })

  it('sans fin : « en cours »', () => {
    expect(formatDuration('2026-10-10T04:10:00', null)).toBe('en cours')
  })

  it('dates illisibles ou inversées : durée inconnue', () => {
    expect(formatDuration('x', '2026-10-10T04:10:00')).toBe('durée inconnue')
    expect(formatDuration('2026-10-10T04:11:00', '2026-10-10T04:10:00')).toBe('durée inconnue')
  })
})
