import { describe, it, expect } from 'vitest'
import { formatDayUtc } from '@/features/user-profile/lib/formatDayUtc'

describe('formatDayUtc', () => {
  it('null : tiret', () => {
    expect(formatDayUtc(null)).toBe('—')
  })
  it('minuit UTC reste le même jour sous un fuseau négatif', () => {
    const prev = process.env.TZ
    process.env.TZ = 'America/Los_Angeles'
    try {
      expect(formatDayUtc('2026-11-02T00:00:00Z')).toBe('02/11/2026')
    } finally {
      if (prev === undefined) delete process.env.TZ
      else process.env.TZ = prev
    }
  })
})
