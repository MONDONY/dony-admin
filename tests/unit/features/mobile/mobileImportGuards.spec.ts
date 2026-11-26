import { describe, it, expect } from 'vitest'
import {
  ALLOW_API_PROMISE_RESOLVE, ALLOW_AUTH_SET_DELETE, callRe, crawl, isMobileFile, ROOT, resolveSpecifier, violations, wordRe,
  type Allow,
} from './helpers/importGraph'

describe('mobile import guards (alerts list, overview, diffuser)', () => {
  it('alerts pages: no resolve, snooze, unsnooze, reopen or resolveMany anywhere in the import graph', () => {
    const g = crawl(['app/pages/m/alertes/index.vue', 'app/pages/m/alertes/[id].vue'])
    expect(g.files.length).toBeGreaterThanOrEqual(24)
    expect(g.files).toContain('app/features/mobile/composables/useMobileAlertList.ts')
    expect(g.files).toContain('app/features/alerts/composables/useAlerts.ts')
    // Entrées autorisées (fichier + texte exact de la ligne) :
    //  - useApi.ts / `Promise.resolve(` : déconnexion, pas une alerte ;
    //  - useAlerts.ts, composable partagé qui DÉFINIT les écritures : uniquement ses 5 appels au service,
    //    chacun nommé. Aucune autre ligne de ce fichier n'est exemptée.
    const allow: Allow[] = [
      ALLOW_API_PROMISE_RESOLVE,
      ...['alertsService.resolve(', 'alertsService.resolveBatch(', 'alertsService.reopen(', 'alertsService.snooze(', 'alertsService.unsnooze(']
        .map(text => ({ file: 'app/features/alerts/composables/useAlerts.ts', text })),
    ]
    const names = ['resolve', 'resolveBatch', 'resolveMany', 'snooze', 'unsnooze', 'reopen']
    expect(violations(g, callRe(names), allow)).toEqual([])
    // Mots seuls (déstructuration comprise) dans tout fichier mobile du graphe.
    expect(violations(g, wordRe(names), [], isMobileFile)).toEqual([])
    // useAlerts : seule la liste mobile le touche, et seulement par ses lectures.
    const users = g.files.filter(f => isMobileFile(f) && /\buseAlerts\b/.test(g.sources.get(f) ?? ''))
    expect(users).toEqual(['app/features/mobile/composables/useMobileAlertList.ts'])
    const src = g.sources.get('app/features/mobile/composables/useMobileAlertList.ts') ?? ''
    expect(/\}\s*=\s*useAlerts\(\)/.test(src)).toBe(false)
    const members = [...new Set([...src.matchAll(/\blist\.(\w+)/g)].map(m => m[1]!))].sort()
    expect(members).toEqual(['alerts', 'error', 'fetchAlerts', 'isLoading', 'setResolvedFilter'])
    expect([...g.autoImports]).toEqual([])
  })

  it('overview page: no write call (post, put, patch, delete, non-GET method) anywhere in the import graph', () => {
    const g = crawl(['app/pages/m/ensemble.vue'])
    expect(g.files.length).toBeGreaterThanOrEqual(8)
    expect(g.files).toContain('app/features/overview/services/overviewService.ts')
    // Entrée autorisée (fichier + texte exact) : auth.ts / `set.delete(`, sur les permissions, sans requête.
    expect(violations(g, /\.(post|put|patch|delete)\s*\(|method:\s*['"](POST|PUT|PATCH|DELETE)/i, [ALLOW_AUTH_SET_DELETE])).toEqual([])
    expect([...g.autoImports]).toEqual([])
  })

  it('diffuser page: cannot reach a group send, an audience builder, recipients or a CSV export', () => {
    const g = crawl(['app/pages/m/diffuser.vue'])
    expect(g.files.length).toBeGreaterThanOrEqual(9)
    expect(g.files).toContain('app/features/mobile/services/mobileNotifyService.ts')
    expect(g.files).toContain('app/features/broadcast/composables/useUserSearch.ts')
    const forbidden = [
      'app/features/broadcast/services/broadcastService.ts',
      'app/features/broadcast/components/BroadcastComposer.vue',
      'app/features/broadcast/composables/useBroadcast.ts',
      'app/features/broadcast/composables/audienceRule.ts',
      'app/features/broadcast/composables/useAudienceRule.ts',
      'app/features/broadcast/composables/useBroadcastSegments.ts',
    ]
    for (const f of forbidden) expect(g.files).not.toContain(f)
    expect(g.files.filter(f => /recipientsCsv|downloadBlob|BroadcastRecipients|BroadcastSegments|AudienceRule/i.test(f))).toEqual([])
    expect(violations(g, /downloadRecipientsCsv|recipients\.csv|broadcast\/(preview|recipients)|serializeRule|segmentId/)).toEqual([])
    // Entrées autorisées (fichier + texte exact) : auth.ts / `set.delete(` ; usersService.ts définit les écritures
    // du poste utilisateurs, une entrée par route (la recherche partagée n'appelle que `usersService.list` et `.get`).
    const usersAllow: Allow[] = ['/pro-grant', '/commission-rate', '/monthly-trip-limit', '/recette-tester']
      .map(text => ({ file: 'app/features/users/services/usersService.ts', text }))
    expect(violations(g, /\.(put|patch|delete)\s*\(|method:\s*['"](PUT|PATCH|DELETE)/i, [ALLOW_AUTH_SET_DELETE, ...usersAllow])).toEqual([])
    expect([...(g.sources.get('app/features/broadcast/composables/useUserSearch.ts') ?? '').matchAll(/usersService\.(\w+)/g)].map(m => m[1]).sort()).toEqual(['get', 'list'])
    expect([...g.autoImports]).toEqual([])
  })

  it('resolveSpecifier handles aliases, relative paths, index files and packages (independent of the cwd)', () => {
    const from = `${ROOT}/app/pages/m/ensemble.vue`
    expect(resolveSpecifier('@/lib/safeInput', from)).toBe(`${ROOT}/app/lib/safeInput.ts`)
    expect(resolveSpecifier('~/lib/safeInput', from)).toBe(`${ROOT}/app/lib/safeInput.ts`)
    expect(resolveSpecifier('../../lib/safeInput', from)).toBe(`${ROOT}/app/lib/safeInput.ts`)
    expect(resolveSpecifier('@/features/notifications/types', from)).toBe(`${ROOT}/app/features/notifications/types/index.ts`)
    expect(resolveSpecifier('vue', from)).toBeNull()
    expect(resolveSpecifier('@/nope/missing', from)).toBeNull()
  })
})
