/**
 * Formes de lien acceptées, identiques au contrat (le back valide de la même façon, 422 sinon) :
 * `youtu.be/ID`, `youtube.com/watch?v=ID`, `youtube.com/shorts/ID`, `youtube.com/embed/ID`.
 * L'ID fait 11 caractères `[A-Za-z0-9_-]`. Les paramètres en plus (`?si=`, `&t=`) sont tolérés.
 */
const ID_RE = /^[A-Za-z0-9_-]{11}$/
const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com'])

function parseUrl(raw: string): URL | null {
  const value = raw.trim()
  if (!value) return null
  // Un lien copié sans schéma (« youtu.be/ID ») reste reconnu.
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`
  try {
    return new URL(withScheme)
  } catch {
    return null
  }
}

/** ID de la vidéo, ou null si le lien n'est pas un lien YouTube reconnu. */
export function extractYoutubeId(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null
  const url = parseUrl(raw)
  if (!url) return null
  const host = url.hostname.toLowerCase()
  const segments = url.pathname.split('/').filter(Boolean)

  let id: string | null = null
  if (host === 'youtu.be') {
    id = segments.length === 1 ? segments[0]! : null
  } else if (YOUTUBE_HOSTS.has(host)) {
    if (segments.length === 1 && segments[0] === 'watch') id = url.searchParams.get('v')
    else if (segments.length === 2 && (segments[0] === 'shorts' || segments[0] === 'embed')) id = segments[1]!
  }
  return id && ID_RE.test(id) ? id : null
}

/** Miniature publique de la vidéo (aucune clé d'API nécessaire). */
export function youtubeThumbnailUrl(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
}

/** Lien de visionnage à ouvrir dans un nouvel onglet pour vérifier la vidéo. */
export function youtubeWatchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`
}

/** Durée affichée sur la miniature : `3:24`, `1:02:05`. */
export function formatDuration(seconds: number | null | undefined): string | null {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) return null
  const total = Math.round(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}
