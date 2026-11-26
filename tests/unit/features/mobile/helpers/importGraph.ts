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

/** Filtre de fichiers. */
// eslint-disable-next-line no-unused-vars
export type Scope = (file: string) => boolean

/** Exception étroite : ce fichier, et seulement les lignes dont le texte (sans espaces aux bords) est EXACTEMENT `line`. */
export interface Allow { file: string; line: string }

/**
 * Retourne `fichier:ligne: motif` pour chaque ligne du graphe qui correspond au motif, sauf les lignes
 * couvertes par une entrée `allow` (même fichier ET ligne entière identique, espaces de bord retirés).
 * Recherche sur le texte brut : un commentaire qui contient le motif est donc signalé aussi (voir
 * `withoutComments` pour l'ignorer). `scope` limite les fichiers examinés.
 */
export function violations(g: Graph, pattern: RegExp, allow: readonly Allow[] = [], scope: Scope = () => true): string[] {
  const out: string[] = []
  for (const [f, src] of g.sources) {
    if (!scope(f)) continue
    src.split('\n').forEach((line, i) => {
      const m = pattern.exec(line)
      if (!m) return
      if (allow.some(a => a.file === f && line.trim() === a.line)) return
      out.push(`${f}:${i + 1}: ${m[0]}`)
    })
  }
  return out
}

/** Fichiers mobiles du graphe : `app/features/mobile/**` et `app/pages/m/**`. */
export const isMobileFile = (f: string) => f.startsWith('app/features/mobile/') || f.startsWith('app/pages/m/')

/** `useApi.ts` : `Promise.resolve(...)` de la déconnexion, aucun lien avec une alerte ou un billet. */
export const ALLOW_API_PROMISE_RESOLVE: Allow = {
  file: 'app/composables/useApi.ts', line: 'await Promise.resolve(fbSignOut($firebaseAuth as Auth)).catch(() => {})',
}
/** `auth.ts` : `Set.delete` sur les permissions, aucune requête. */
export const ALLOW_AUTH_SET_DELETE: Allow = { file: 'app/stores/auth.ts', line: 'else set.delete(name as AdminPermission)' }

/** Mots interdits dans tout fichier mobile (même sans point : déstructuration, référence). */
export const wordRe = (names: readonly string[]) => new RegExp(`\\b(?:${names.join('|')})\\b`)

const blank = (m: string) => m.replace(/[^\n]/g, ' ')

/**
 * Retire les commentaires en gardant les numéros de ligne : `/* … *\/`, `<!-- … -->` et `// …` (sauf le
 * `//` d'une URL `https://`, précédé de `:`). Sert aux gardes « surface d'appels » et « réseau ».
 */
export function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/(^|[^:'"`\w])\/\/.*$/gm, '$1')
}

/** Le même graphe, sources sans commentaires. */
export function withoutComments(g: Graph): Graph {
  return { ...g, sources: new Map([...g.sources].map(([f, src]) => [f, stripComments(src)])) }
}

/** Tous les fichiers .ts et .vue sous `dir` (relatif à la racine), chemins relatifs à la racine. */
export function listFiles(dir: string, root: string = ROOT): string[] {
  const out: string[] = []
  const walk = (abs: string) => {
    for (const name of readdirSync(abs)) {
      const full = join(abs, name)
      if (statSync(full).isDirectory()) walk(full)
      else if (/\.(ts|vue)$/.test(name)) out.push(relative(root, full))
    }
  }
  walk(join(root, dir))
  return out.sort()
}

const IMPORT_CLAUSE_RE = /\bimport\s+(?!type\b)([^'";]*?)\s+from\s*(['"])([^'"\n]+)\2/g
/** Module dont les exports touchent au réseau ou à l'état partagé : services, stores, composables. */
const TRACKED_MODULE = /\/(services|stores|composables)\//

/** Noms locaux importés d'un service, d'un store ou d'un composable (hors `import type` et `type X`). */
function trackedImports(src: string): Set<string> {
  const names = new Set<string>()
  for (const m of src.matchAll(IMPORT_CLAUSE_RE)) {
    if (!TRACKED_MODULE.test(m[3]!)) continue
    const clause = m[1]!
    const braces = /\{([^}]*)\}/.exec(clause)?.[1] ?? ''
    for (const part of braces.split(',')) {
      const p = part.trim()
      if (!p || p.startsWith('type ')) continue
      names.add(p.split(/\s+as\s+/).pop()!.trim())
    }
    const def = clause.replace(/\{[^}]*\}/, '').replace(/,/g, ' ').trim()
    if (def && /^[A-Za-z_$][\w$]*$/.test(def)) names.add(def)
  }
  return names
}

/**
 * Surface d'appels d'un fichier (commentaires retirés), triée et sans doublon :
 *  - `useX()` : tout appel d'un composable `use…(` (auto-import Nuxt compris), hors sa définition ;
 *  - `nom()` : appel direct d'une fonction importée d'un service, d'un store ou d'un composable ;
 *  - `x.m()` : appel d'un membre d'une liaison suivie (nom importé de ces modules, ou `const x = useY(…)`) ;
 *  - `x.m` : lecture d'un membre d'un store ou d'un service (`…Service`, `const x = use…Store()`),
 *    pour qu'une fonction passée par référence (`markRead: store.markRead`) ne s'échappe pas ;
 *  - `useY().m` : membre déstructuré (`const { m } = useY(…)`) ou appelé en chaîne (`useY().m(`).
 */
export function callSurface(raw: string): string[] {
  const src = stripComments(raw)
  const out = new Set<string>()
  const imported = trackedImports(src)
  const bound = new Set<string>(imported)
  const stores = new Set<string>([...imported].filter(n => /Service$/.test(n)))
  for (const m of src.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(use[A-Z][\w$]*)\s*\(/g)) {
    bound.add(m[1]!)
    if (/Store$/.test(m[2]!)) stores.add(m[1]!)
  }
  for (const m of src.matchAll(/(?<!function\s+)(?<![.\w$])(use[A-Z][\w$]*)\s*\(/g)) out.add(`${m[1]}()`)
  for (const m of src.matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(/g)) {
    const name = m[1]!
    if (imported.has(name) && !name.startsWith('use')) out.add(`${name}()`)
  }
  for (const m of src.matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)\s*\??\.\s*([A-Za-z_$][\w$]*)(\s*\()?/g)) {
    const [, obj, member, call] = m
    if (call && bound.has(obj!)) out.add(`${obj}.${member}()`)
    else if (!call && stores.has(obj!) && member !== 'value') out.add(`${obj}.${member}`)
  }
  for (const m of src.matchAll(/(?<![.\w$])(use[A-Z][\w$]*)\s*\([^()]*\)\s*\??\.\s*([A-Za-z_$][\w$]*)/g)) out.add(`${m[1]}().${m[2]}`)
  for (const m of src.matchAll(/\b(?:const|let|var)\s*\{([^}]*)\}\s*=\s*(use[A-Z][\w$]*|[A-Za-z_$][\w$]*Service)\b/g)) {
    for (const part of m[1]!.split(',')) {
      const key = part.split(/[:=]/)[0]!.replace(/\.\.\./, '').trim()
      if (key) out.add(`${m[2]}().${key}`)
    }
  }
  return [...out].sort()
}
