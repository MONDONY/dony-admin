import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Garde-fou : un `(e as Error).message` affiche « [GET] "/admin/…": 500 » à l'admin au lieu
 * du `detail` du ProblemDetail RFC 7807 écrit pour lui. Toute capture passe par
 * `extractProblemMessage` (ou sa variante asynchrone pour les réponses en Blob).
 */
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return files(path)
    return /\.(ts|vue)$/.test(name) ? [path] : []
  })
}

describe('messages d’erreur affichés', () => {
  it('aucun fichier de app/ n’affiche le message brut d’une erreur', () => {
    const offenders = files(join(process.cwd(), 'app'))
      .filter((f) => !f.endsWith(join('lib', 'problemDetail.ts')))
      .filter((f) => /as Error\)\??\.message|instanceof Error \? \w+\.message/.test(readFileSync(f, 'utf8')))
    expect(offenders).toEqual([])
  })
})
