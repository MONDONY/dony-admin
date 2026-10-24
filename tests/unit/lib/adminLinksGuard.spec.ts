import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

/**
 * Garde-fous du registre `app/lib/adminLinks.ts` :
 * 1. `unchecked` (constructeurs sans contrôle d'UUID) ne sert qu'à la migration à l'identique des
 *    fichiers déjà migrés ci-dessous ; tout nouveau code passe par les constructeurs stricts.
 * 2. Aucune URL `/colis?…` ni `/transactions?…` écrite à la main hors du registre (guillemets
 *    simples, doubles ou gabarit à backtick) ; les commentaires ne comptent pas.
 */
const UNCHECKED_ALLOWED = [
  'app/features/alerts/lib/alertCatalog.ts',
  'app/features/bids/lib/bidLinks.ts',
  'app/features/search/services/globalSearchService.ts',
  'app/features/signalements/components/ReportsTable.vue',
  'app/features/user-profile/lib/objectLinks.ts',
  'app/features/user-profile/lib/sectionColumns.ts',
]
const REGISTRY = 'app/lib/adminLinks.ts'

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return files(path)
    return /\.(ts|vue)$/.test(name) ? [path] : []
  })
}

/** Source sans commentaires (`/* … *\/`, `<!-- … -->`, `// …` en début de ligne ou après un blanc). */
export function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/(^|\s)\/\/.*$/gm, '$1')
}

const usesUnchecked = (src: string) => /\bunchecked\b/.test(stripComments(src))
const handBuiltUrl = (src: string) => /['"`]\/(colis|transactions)\?/.test(stripComments(src))

const sources = files(join(process.cwd(), 'app')).map(f => ({
  file: relative(process.cwd(), f).split(sep).join('/'),
  src: readFileSync(f, 'utf8'),
}))

describe('détecteurs', () => {
  it('unchecked : vu dans le code, pas dans un commentaire', () => {
    expect(usesUnchecked('const r = unchecked.bidRoute(id)')).toBe(true)
    expect(usesUnchecked('import { unchecked } from \'@/lib/adminLinks\'')).toBe(true)
    expect(usesUnchecked('// unchecked.bidRoute(id)\n/* unchecked */ const a = 1')).toBe(false)
    expect(usesUnchecked('const uncheckedCount = 1')).toBe(false)
  })

  it('URL écrite à la main : trois sortes de guillemets, commentaires exclus', () => {
    expect(handBuiltUrl('const u = \'/colis?open=\' + id')).toBe(true)
    expect(handBuiltUrl('const u = "/transactions?tab=wallets"')).toBe(true)
    expect(handBuiltUrl('const u = `/colis?open=${id}`')).toBe(true)
    expect(handBuiltUrl('const u = `/transactions?open=${id}`')).toBe(true)
    expect(handBuiltUrl('// lien `/colis?open=<id>`\n/** `/transactions?open=` */\n<!-- "/colis?x" -->')).toBe(false)
    expect(handBuiltUrl('const u = \'/colis\'')).toBe(false)
    expect(handBuiltUrl('fetch(\'https://x.test/a\') // \'/colis?open=\'')).toBe(false)
  })
})

describe('registre des liens : garde-fous sur app/', () => {
  it('`unchecked` n’est utilisé que dans les fichiers déjà migrés', () => {
    const offenders = sources.filter(s => s.file !== REGISTRY && usesUnchecked(s.src)).map(s => s.file)
    expect(offenders.filter(f => !UNCHECKED_ALLOWED.includes(f))).toEqual([])
  })

  it('la liste blanche de `unchecked` ne garde pas de fichier qui ne l’utilise plus', () => {
    const users = new Set(sources.filter(s => usesUnchecked(s.src)).map(s => s.file))
    expect(UNCHECKED_ALLOWED.filter(f => !users.has(f))).toEqual([])
  })

  it('aucune URL `/colis?` ni `/transactions?` écrite à la main hors du registre', () => {
    const offenders = sources.filter(s => s.file !== REGISTRY && handBuiltUrl(s.src)).map(s => s.file)
    expect(offenders).toEqual([])
  })

  it('`unchecked` est marqué @deprecated dans le registre', () => {
    const registry = sources.find(s => s.file === REGISTRY)!.src
    expect(registry).toMatch(/@deprecated[\s\S]*?\*\/\s*export const unchecked\b/)
  })
})
