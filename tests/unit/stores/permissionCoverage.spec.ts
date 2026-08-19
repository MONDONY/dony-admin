import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { ALL_PERMISSIONS } from '@/stores/auth'

/**
 * Critère d'acceptation n°2 de la feature RBAC, versant front : **toute permission déclarée
 * est consommée par au moins un élément d'interface**, et le miroir du back reste exact.
 *
 * Le pendant backend est `AdminPermissionCoverageTest`, qui prouve la même chose côté
 * endpoints. Les deux ensemble referment le critère : une permission ne peut plus exister
 * sans être à la fois gardée par une route et exposée par un écran.
 */

/** Remonte l'arborescence jusqu'au dossier parent contenant `dony-back`. */
function findBackendRepo(): string | null {
  let dir = process.cwd()
  for (let i = 0; i < 8; i++) {
    const candidate = join(dir, 'dony-back')
    if (existsSync(candidate)) return candidate
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return null
}

function collectSourceFiles(root: string, extensions: string[]): string[] {
  const out: string[] = []
  for (const entry of readdirSync(root)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue
    const full = join(root, entry)
    if (statSync(full).isDirectory()) out.push(...collectSourceFiles(full, extensions))
    else if (extensions.some((ext) => entry.endsWith(ext))) out.push(full)
  }
  return out
}

describe('couverture des permissions', () => {
  const backendRepo = findBackendRepo()

  // Ce dépôt et `dony-back` sont deux dépôts distincts : dans une CI qui ne clone que le
  // front, l'enum n'est pas là. On l'annonce plutôt que de faire rougir un build pour une
  // dépendance absente — la garantie tient localement et dans un checkout complet, et le
  // test backend couvre le même invariant de son côté.
  const enumPath = backendRepo
    ? resolve(backendRepo, 'src/main/java/com/yadony/api/admin/account/AdminPermission.java')
    : null
  const hasEnum = enumPath !== null && existsSync(enumPath)

  it.runIf(hasEnum)('ALL_PERMISSIONS reproduit exactement l’enum backend, nom pour nom', () => {
    const source = readFileSync(enumPath!, 'utf8')
    // Le corps de l'enum s'arrête à la première accolade fermante de premier niveau.
    const body = source.slice(source.indexOf('{') + 1, source.lastIndexOf('}'))
    const backendNames = body
      .split('\n')
      .map((line) => line.replace(/\/\/.*$/, '').trim())
      .filter((line) => /^[A-Z][A-Z0-9_]*,?;?$/.test(line))
      .map((line) => line.replace(/[,;]$/, ''))

    expect(backendNames.length).toBeGreaterThan(0)
    // Comparaison ensembliste : l'ordre de déclaration n'est pas un contrat, les noms le sont.
    expect([...ALL_PERMISSIONS].sort()).toEqual([...backendNames].sort())
  })

  it('chaque permission est consommée par au moins un can(...) ou un definePageMeta', () => {
    const appDir = resolve(process.cwd(), 'app')
    const sources = collectSourceFiles(appDir, ['.vue', '.ts'])
      // Le store lui-même déclare la liste : s'en servir comme preuve d'usage rendrait le
      // test tautologique — toute permission y figure par construction.
      .filter((file) => !file.endsWith(join('stores', 'auth.ts')))
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n')

    const unused = ALL_PERMISSIONS.filter((permission) => !sources.includes(`'${permission}'`))

    expect(unused, `Permissions déclarées mais consommées par aucun écran : ${unused.join(', ')}`)
      .toEqual([])
  })
})
