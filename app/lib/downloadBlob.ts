/**
 * Déclenche le téléchargement d'un Blob côté navigateur via un lien temporaire.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  // L'ancre doit être dans le DOM pour que Chromium honore le téléchargement.
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
