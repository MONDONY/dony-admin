import { describe, it, expect } from 'vitest'
import { extractYoutubeId, formatDuration, youtubeThumbnailUrl, youtubeWatchUrl } from '@/features/video-modals/lib/youtube'

const ID = 'dQw4w9WgXcQ'

describe('extractYoutubeId', () => {
  it.each([
    `https://youtu.be/${ID}`,
    `https://youtu.be/${ID}?si=abc123`,
    `youtu.be/${ID}`,
    `https://www.youtube.com/watch?v=${ID}`,
    `https://youtube.com/watch?v=${ID}&t=42s`,
    `https://m.youtube.com/watch?feature=share&v=${ID}`,
    `https://www.youtube.com/shorts/${ID}`,
    `https://www.youtube.com/embed/${ID}?rel=0`,
    `http://www.youtube.com/embed/${ID}/`,
    `  https://youtu.be/${ID}  `,
    'https://youtu.be/a_b-C1d2E3f',
  ])('reconnaît %s', (url) => {
    expect(extractYoutubeId(url)).toMatch(/^[A-Za-z0-9_-]{11}$/)
  })

  it('renvoie exactement l’ID', () => {
    expect(extractYoutubeId(`https://www.youtube.com/watch?v=${ID}`)).toBe(ID)
  })

  it.each([
    '',
    '   ',
    'pas un lien',
    `https://vimeo.com/${ID}`,
    `https://youtu.be/${ID}x`,
    'https://youtu.be/court',
    `https://youtu.be/${ID}/plus`,
    'https://www.youtube.com/watch',
    'https://www.youtube.com/watch?v=abc',
    `https://www.youtube.com/channel/${ID}`,
    `https://www.youtube.com/shorts/${ID}/extra`,
    'https://www.youtube.com/embed/abc$def!gh',
    `https://notyoutube.com/watch?v=${ID}`,
    'http://[invalide',
  ])('refuse « %s »', (url) => {
    expect(extractYoutubeId(url)).toBeNull()
  })

  it('refuse une valeur qui n’est pas une chaîne', () => {
    expect(extractYoutubeId(null)).toBeNull()
    expect(extractYoutubeId(undefined)).toBeNull()
  })
})

describe('liens dérivés', () => {
  it('miniature hqdefault et lien de visionnage', () => {
    expect(youtubeThumbnailUrl(ID)).toBe(`https://i.ytimg.com/vi/${ID}/hqdefault.jpg`)
    expect(youtubeWatchUrl(ID)).toBe(`https://www.youtube.com/watch?v=${ID}`)
  })
})

describe('formatDuration', () => {
  it.each([
    [204, '3:24'],
    [65, '1:05'],
    [9, '0:09'],
    [3725, '1:02:05'],
    [59.6, '1:00'],
  ])('%s s donne %s', (s, out) => {
    expect(formatDuration(s)).toBe(out)
  })
  it.each([null, undefined, 0, -3, Number.NaN, Number.POSITIVE_INFINITY])('rien pour %s', (s) => {
    expect(formatDuration(s as number | null | undefined)).toBeNull()
  })
})
