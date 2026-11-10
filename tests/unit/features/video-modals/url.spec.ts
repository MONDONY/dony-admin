import { describe, it, expect } from 'vitest'
import { httpsUrlError, isValidHttpsUrl } from '@/features/video-modals/lib/url'

describe('isValidHttpsUrl', () => {
  it.each([
    'https://yadony.com', 'https://www.yadony.com/aide?x=1#a', ' https://yadony.com/p ', 'HTTPS://YADONY.COM',
  ])('accepte %s', (u) => { expect(isValidHttpsUrl(u)).toBe(true) })

  it.each([
    '', '   ', 'http://yadony.com', 'javascript:alert(1)', 'data:text/html,hi', 'mailto:a@b.fr', 'yadony.com',
    '//yadony.com', 'ftp://yadony.com', 'https://', 'https:// yadony.com', 'https://exa mple.com',
  ])('refuse %j', (u) => { expect(isValidHttpsUrl(u)).toBe(false) })

  it('refuse null, undefined et au-delà de 2000 caractères', () => {
    expect(isValidHttpsUrl(null)).toBe(false)
    expect(isValidHttpsUrl(undefined)).toBe(false)
    expect(isValidHttpsUrl(`https://yadony.com/${'a'.repeat(1990)}`)).toBe(false)
    expect(isValidHttpsUrl(`https://yadony.com/${'a'.repeat(1900)}`)).toBe(true)
  })
})

describe('httpsUrlError', () => {
  it('trois messages distincts, null si valide', () => {
    expect(httpsUrlError('')).toContain('https://')
    expect(httpsUrlError('http://x.fr')).toContain('Seuls les liens https://')
    expect(httpsUrlError(`https://x.fr/${'a'.repeat(2000)}`)).toContain('trop long')
    expect(httpsUrlError('https://x.fr')).toBeNull()
    expect(httpsUrlError(undefined)).toContain('https://')
  })
})
