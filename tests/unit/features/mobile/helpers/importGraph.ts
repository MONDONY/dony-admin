import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

/**
 * Graphe d'imports des écrans mobiles : suit TOUS les imports de `app/` (alias `@/` et `~/`, chemins relatifs,
 * guillemets simples ou doubles, `import`/`export ... from`, `import()` dynamique, import à effet de bord),
 * sauf `import type`. Les paquets tiers ne sont pas ouverts. Relève aussi les balises de composants des
 * gabarits et les composants utilisés par auto-import Nuxt sans être importés.
 */
export const ROOT = resolve(__dirname, '../../../../..')

const EXTENSIONS = ['', '.ts', '.vue', '.js', '/index.ts', '/index.vue', '/index.js']

/** `root` : racine du dépôt (réglable pour les fixtures temporaires des tests du helper). */
export function resolveSpecifier(spec: string, fromFile: string, root: string = ROOT): string | null {
  const APP = join(root, 'app')
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
function autoImportable(root: string): Map<string, string> {
  const APP = join(root, 'app')
  const map = new Map<string, string>()
  for (const f of existsSync(APP) ? walkDir(APP) : []) {
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

export function crawl(entries: readonly string[], root: string = ROOT): Graph {
  const known = autoImportable(root)
  const files = new Set<string>()
  const sources = new Map<string, string>()
  const tags = new Map<string, string[]>()
  const autoImports = new Map<string, string[]>()
  const visit = (abs: string) => {
    const rel = relative(root, abs)
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
      const target = resolveSpecifier(spec, abs, root)
      if (target) visit(target)
    }
  }
  for (const e of entries) {
    const abs = join(root, e)
    if (!existsSync(abs)) throw new Error(`entry missing: ${e}`)
    visit(abs)
  }
  return { files: [...files], sources, tags, autoImports }
}

/** Appels de méthode : `.nom(` (un appel, pas la définition `nom(` d'un objet). */
export const callRe = (names: readonly string[]) => new RegExp(`\\.(?:${names.join('|')})\\s*\\(`)

/** Exception étroite : ce fichier, et seulement les lignes qui contiennent exactement ce texte. */
/** Filtre de fichiers. */
// eslint-disable-next-line no-unused-vars
export type Scope = (file: string) => boolean

export interface Allow { file: string; text: string }

/**
 * Retourne `fichier:ligne: motif` pour chaque ligne du graphe qui correspond au motif, sauf les lignes
 * couvertes par une entrée `allow` (même fichier ET texte exact). Simple recherche de sous-chaîne : un
 * commentaire qui contient le motif est donc signalé aussi. `scope` limite les fichiers examinés.
 */
export function violations(g: Graph, pattern: RegExp, allow: readonly Allow[] = [], scope: Scope = () => true): string[] {
  const out: string[] = []
  for (const [f, src] of g.sources) {
    if (!scope(f)) continue
    src.split('\n').forEach((line, i) => {
      const m = pattern.exec(line)
      if (!m) return
      if (allow.some(a => a.file === f && line.includes(a.text))) return
      out.push(`${f}:${i + 1}: ${m[0]}`)
    })
  }
  return out
}

/** Fichiers mobiles du graphe : `app/features/mobile/**` et `app/pages/m/**`. */
export const isMobileFile = (f: string) => f.startsWith('app/features/mobile/') || f.startsWith('app/pages/m/')

/** `useApi.ts` : `Promise.resolve(...)` de la déconnexion, aucun lien avec une alerte ou un billet. */
export const ALLOW_API_PROMISE_RESOLVE: Allow = { file: 'app/composables/useApi.ts', text: 'Promise.resolve(' }
/** `auth.ts` : `Set.delete` sur les permissions, aucune requête. */
export const ALLOW_AUTH_SET_DELETE: Allow = { file: 'app/stores/auth.ts', text: 'set.delete(' }

/** Mots interdits dans tout fichier mobile (même sans point : déstructuration, référence). */
export const wordRe = (names: readonly string[]) => new RegExp(`\\b(?:${names.join('|')})\\b`)
