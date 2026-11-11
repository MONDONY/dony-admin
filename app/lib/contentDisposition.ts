/**
 * Nom de fichier d'un en-tête `Content-Disposition`. `filename*` (UTF-8, encodé en pourcentage)
 * l'emporte sur `filename`. Seul le dernier segment est gardé : un nom venu du réseau ne doit
 * jamais pouvoir désigner un chemin. Rend null quand l'en-tête est absent ou sans nom.
 */
export function filenameFromContentDisposition(header: string | null | undefined): string | null {
  if (!header) return null
  const star = /filename\*\s*=\s*(?:[\w-]+)?'[^']*'([^;]+)/i.exec(header)
  if (star?.[1]) {
    try {
      const decoded = lastSegment(decodeURIComponent(star[1].trim()))
      if (decoded) return decoded
    } catch { /* encodage cassé : on retombe sur filename */ }
  }
  const plain = /filename\s*=\s*(?:"([^"]*)"|([^;]+))/i.exec(header)
  const raw = (plain?.[1] ?? plain?.[2] ?? '').trim()
  return lastSegment(raw) || null
}

function lastSegment(name: string): string {
  return name.split(/[\\/]/).pop()?.trim() ?? ''
}
