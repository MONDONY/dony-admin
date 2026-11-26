import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { callRe, crawl, importsOf, violations } from './helpers/importGraph'

/** Contrôle négatif permanent du helper : des fixtures temporaires prouvent que le garde traverse vraiment le graphe. */
let root = ''
const put = (rel: string, content: string) => {
  const abs = join(root, rel)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, content)
}
const DESTRUCTIVE = /deleteMessage|restoreMessage|addNote|moderationService/

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'import-graph-'))
  // Chaîne transitive : entrée -> helper (alias, guillemets doubles) -> deep (relatif) qui appelle la suppression.
  put('app/pages/m/entry.vue', `<script setup lang="ts">\nimport { help } from "@/features/x/helper"\n</script>\n<template><div>{{ help }}</div></template>\n`)
  put('app/features/x/helper.ts', `import { deep } from '../y/deep'\nexport const help = deep\n`)
  put('app/features/y/deep.ts', `export const deep = () => moderationService.deleteMessage('c', 'm')\n`)
  // Import de type seulement : jamais suivi.
  put('app/pages/m/typeonly.vue', `<script setup lang="ts">\nimport type { Deep } from '@/features/y/deep'\nexport type { Deep as D } from '@/features/y/deep'\n</script>\n<template><div /></template>\n`)
  // Autres formes d'import.
  put('app/features/z/reexport.ts', `export { z } from './target-a'\n`)
  put('app/features/z/target-a.ts', `export const z = 1\n`)
  put('app/features/z/dyn.ts', `export const load = () => import("./target-b")\n`)
  put('app/features/z/target-b.ts', `export const b = 2\n`)
  put('app/features/z/side.ts', `import './target-c'\n`)
  put('app/features/z/target-c.ts', `export const c = 3\n`)
  put('app/pages/m/forms.vue', `<script setup lang="ts">\nexport { z } from '@/features/z/reexport'\nimport { load } from "~/features/z/dyn"\nimport '@/features/z/side'\n</script>\n<template><div /></template>\n`)
  // Commentaire : le garde est une simple recherche de sous-chaîne, un commentaire est donc signalé.
  put('app/features/c/commented.ts', `// ne jamais appeler moderationService ici\nexport const c = 1\n`)
  put('app/pages/m/commented.vue', `<script setup lang="ts">\nimport { c } from '@/features/c/commented'\n</script>\n<template><div>{{ c }}</div></template>\n`)
  // Appel déstructuré.
  put('app/features/d/destructured.ts', `const { deleteMessage } = svc\nexport const d = () => deleteMessage('a')\n`)
  put('app/pages/m/destructured.vue', `<script setup lang="ts">\nimport { d } from '@/features/d/destructured'\n</script>\n<template><div>{{ d }}</div></template>\n`)
  // Composant desktop utilisé par balise, sans import (auto-import Nuxt).
  put('app/features/moderation/components/ModerationThread.vue', `<template><div /></template>\n`)
  put('app/pages/m/tag.vue', `<script setup lang="ts">\n</script>\n<template><div><ModerationThread /><moderation-thread /></div></template>\n`)
  put('app/pages/m/tag-imported.vue', `<script setup lang="ts">\nimport ModerationThread from '@/features/moderation/components/ModerationThread.vue'\n</script>\n<template><ModerationThread /></template>\n`)
})
afterAll(() => rmSync(root, { recursive: true, force: true }))

describe('importGraph helper: negative controls on fixtures', () => {
  it('follows the chain entry -> helper -> deep and names the hidden destructive call', () => {
    const g = crawl(['app/pages/m/entry.vue'], root)
    expect(g.files.sort()).toEqual(['app/features/x/helper.ts', 'app/features/y/deep.ts', 'app/pages/m/entry.vue'])
    const v = violations(g, DESTRUCTIVE)
    expect(v).toHaveLength(1)
    expect(v[0]).toMatch(/^app\/features\/y\/deep\.ts:1: moderationService$/)
    expect(violations(g, callRe(['deleteMessage']))).toEqual([expect.stringContaining('app/features/y/deep.ts')])
  })

  it('an allow entry exempts only its file AND its exact text', () => {
    const g = crawl(['app/pages/m/entry.vue'], root)
    expect(violations(g, DESTRUCTIVE, [{ file: 'app/features/y/deep.ts', text: 'moderationService.deleteMessage(' }])).toEqual([])
    expect(violations(g, DESTRUCTIVE, [{ file: 'app/features/y/deep.ts', text: 'other text' }])).toHaveLength(1)
    expect(violations(g, DESTRUCTIVE, [{ file: 'app/features/x/helper.ts', text: 'moderationService' }])).toHaveLength(1)
    expect(violations(g, DESTRUCTIVE, [], f => f.startsWith('app/pages/'))).toEqual([])
  })

  it('a pure type import (import type, export type from) is not followed, so it is not flagged', () => {
    const g = crawl(['app/pages/m/typeonly.vue'], root)
    expect(g.files).toEqual(['app/pages/m/typeonly.vue'])
    expect(violations(g, DESTRUCTIVE)).toEqual([])
  })

  it('follows export-from, dynamic import(), side-effect import, double quotes and the ~/ alias', () => {
    const g = crawl(['app/pages/m/forms.vue'], root)
    expect(g.files.sort()).toEqual([
      'app/features/z/dyn.ts', 'app/features/z/reexport.ts', 'app/features/z/side.ts', 'app/features/z/target-a.ts',
      'app/features/z/target-b.ts', 'app/features/z/target-c.ts', 'app/pages/m/forms.vue',
    ])
  })

  it('a comment containing the pattern IS flagged (plain substring match, by design)', () => {
    const g = crawl(['app/pages/m/commented.vue'], root)
    expect(violations(g, DESTRUCTIVE)).toEqual(['app/features/c/commented.ts:1: moderationService'])
  })

  it('a destructured call is flagged by the word check and by the plain pattern', () => {
    const g = crawl(['app/pages/m/destructured.vue'], root)
    expect(violations(g, /deleteMessage/)).toHaveLength(2)
    expect(violations(g, callRe(['deleteMessage']))).toEqual([])
  })

  it('a desktop component used by tag (PascalCase or kebab-case) without import is reported as an auto-import', () => {
    const g = crawl(['app/pages/m/tag.vue'], root)
    expect(g.tags.get('app/pages/m/tag.vue')).toEqual(['ModerationThread'])
    expect(g.autoImports.get('app/pages/m/tag.vue')).toEqual(['ModerationThread'])
    const imported = crawl(['app/pages/m/tag-imported.vue'], root)
    expect(imported.autoImports.size).toBe(0)
    expect(imported.files).toContain('app/features/moderation/components/ModerationThread.vue')
    expect(imported.files.some(f => /features\/moderation\/components\//.test(f))).toBe(true)
  })

  it('a missing entry throws instead of passing vacuously', () => {
    expect(() => crawl(['app/pages/m/absent.vue'], root)).toThrow(/entry missing/)
  })

  it('importsOf ignores type imports and reads multi-line imports', () => {
    expect(importsOf(`import type { A } from './a'\nimport {\n  b,\n} from "./b"`)).toEqual(['./b'])
  })
})
