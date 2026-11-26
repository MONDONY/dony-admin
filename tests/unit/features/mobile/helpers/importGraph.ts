import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

/**
 * Graphe d'imports des écrans mobiles : suit TOUS les imports de `app/` (alias `@/` et `~/`, chemins relatifs,
 * guillemets simples ou doubles, `import`/`export ... from`, `import()` dynamique, import à effet de bord),
 * sauf `import type`. Les paquets tiers ne sont pas ouverts. Relève aussi les balises de composants des
 * gabarits et les composants utilisés par auto-import Nuxt sans être importés.
 */
export const ROOT = resolve(__dirname, '../../../../..')
const APP = join(ROOT, 'app')

const EXTENSIONS = ['', '.ts', '.vue', '.js', '/index.ts', '/index.vue', '/index.js']

export function resolveSpecifier(spec: string, fromFile: string): string | null {
  let base: string
  if (spec.startsWith('@/')) base = join(APP, spec.slice(2))
  else if (spec.startsWith('~/')) base = join(APP, spec.slice(2))
  else if (spec.startsWith('.')) base = resolve(dirname(fromFile), spec)
  else return null
  for (const ext of EXTENSIONS) {
    const candidate = base + ext
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  }
  return null
}

const FROM_RE = /\b(import|export)\s+(type\s+)?([^'";]*?)\sfrom\s*(['"])([^'"\n]+)\4/g
const SIDE_EFFECT_RE = /(?:^|[\n;])\s*import\s*(['"])([^'"\n]+)\1/g
const DYNAMIC_RE = /\bimport\s*\(\s*(['"])([^'"\n]+)\1\s*\)/g

export function importsOf(source: string): string[] {
  const out = new Set<string>()
  for (const m of source.matchAll(FROM_RE)) if (!m[2]) out.add(m[5]!)
  for (const m of source.matchAll(SIDE_EFFECT_RE)) out.add(m[2]!)
  for (const m of source.matchAll(DYNAMIC_RE)) out.add(m[2]!)
  return [...out]
}

function walkDir(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walkDir(full, acc)
    else if (name.endsWith('.vue')) acc.push(full)
  }
  return acc
}

const pascal = (s: string) => s.replace(/(^|-)(\w)/g, (_m, _d, c: string) => c.toUpperCase())

/** Composants que Nuxt enregistre seul : `app/components/**` et `app/features/<x>/components/**` (hors mobile). */
function autoImportable(): Map<string, string> {
  const map = new Map<string, string>()
  for (const f of walkDir(APP)) {
    const rel = relative(APP, f)
    const inComponents = rel.startsWith('components/') || /^features\/[^/]+\/components\//.test(rel)
    if (!inComponents || rel.startsWith('features/mobile/')) continue
    const name = f.slice(f.lastIndexOf('/') + 1).replace(/\.vue$/, '')
    if (!map.has(name)) map.set(name, rel)
  }
  return map
}

export interface Graph {
  /** Chemins relatifs à la racine du dépôt. */
  files: string[]
  sources: Map<string, string>
  /** Balises de composants (PascalCase) par fichier .vue. */
  tags: Map<string, string[]>
  /** `fichier -> composants utilisés par auto-import` (ni importés ni sous `features/mobile`). */
  autoImports: Map<string, string[]>
}

export function crawl(entries: readonly string[]): Graph {
  const known = autoImportable()
  const files = new Set<string>()
  const sources = new Map<string, string>()
  const tags = new Map<string, string[]>()
  const autoImports = new Map<string, string[]>()
  const visit = (abs: string) => {
    const rel = relative(ROOT, abs)
    if (files.has(rel)) return
    files.add(rel)
    const src = readFileSync(abs, 'utf8')
    sources.set(rel, src)
    if (abs.endsWith('.vue')) {
      const tpl = /<template[^>]*>([\s\S]*)<\/template>/.exec(src)?.[1] ?? ''
      const used = [...new Set([...tpl.matchAll(/<([A-Za-z][\w-]*)/g)].map(m => m[1]!).filter(t => /^[A-Z]/.test(t) || t.includes('-')).map(pascal))]
      tags.set(rel, used)
      const imported = new Set([...src.matchAll(/import\s+(\w+)\s+from/g)].map(m => m[1]!))
      const auto = used.filter(t => !imported.has(t) && known.has(t))
      if (auto.length) autoImports.set(rel, auto)
    }
    for (const spec of importsOf(src)) {
      const target = resolveSpecifier(spec, abs)
      if (target) visit(target)
    }
  }
  for (const e of entries) {
    const abs = join(ROOT, e)
    if (!existsSync(abs)) throw new Error(`entry missing: ${e}`)
    visit(abs)
  }
  return { files: [...files], sources, tags, autoImports }
}

/** Appels de méthode : `.nom(` (un appel, pas la définition `nom(` d'un objet). */
export const callRe = (names: readonly string[]) => new RegExp(`\\.(?:${names.join('|')})\\s*\\(`)

/** Retourne `fichier: motif` pour chaque fichier du graphe (hors `allow`) dont la source correspond. */
export function violations(g: Graph, pattern: RegExp, allow: readonly string[] = []): string[] {
  const out: string[] = []
  for (const [f, src] of g.sources) {
    if (allow.includes(f)) continue
    const m = pattern.exec(src)
    if (m) out.push(`${f}: ${m[0]}`)
  }
  return out
}
