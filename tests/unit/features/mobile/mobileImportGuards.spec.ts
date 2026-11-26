import { describe, it, expect } from 'vitest'
import { callRe, crawl, resolveSpecifier, violations } from './helpers/importGraph'

describe('mobile import guards (alerts list, overview)', () => {
  it('alerts pages: no resolve, snooze, unsnooze, reopen or resolveMany call anywhere in the import graph', () => {
    const g = crawl(['app/pages/m/alertes/index.vue', 'app/pages/m/alertes/[id].vue'])
    expect(g.files).toContain('app/features/mobile/composables/useMobileAlertList.ts')
    // Entrées autorisées, une par module partagé :
    //  - app/composables/useApi.ts : `Promise.resolve` de la déconnexion, pas une alerte ;
    //  - app/features/alerts/composables/useAlerts.ts : composable partagé qui DÉFINIT resolve/resolveMany,
    //    la liste mobile n'appelle que fetchAlerts et setResolvedFilter (les fichiers mobiles ne sont pas autorisés).
    const allow = ['app/composables/useApi.ts', 'app/features/alerts/composables/useAlerts.ts']
    expect(violations(g, callRe(['resolve', 'resolveBatch', 'resolveMany', 'snooze', 'unsnooze', 'reopen']), allow)).toEqual([])
    expect(g.sources.get('app/features/mobile/composables/useMobileAlertList.ts')).not.toMatch(/\b(resolve|resolveMany|snooze|unsnooze|reopen)\b/)
    expect([...g.autoImports]).toEqual([])
  })

  it('overview page: no write call (post, put, patch, delete, non-GET method) anywhere in the import graph', () => {
    const g = crawl(['app/pages/m/ensemble.vue'])
    expect(g.files).toContain('app/features/overview/services/overviewService.ts')
    // Entrée autorisée : app/stores/auth.ts, `Set.delete` sur les permissions (aucune requête).
    expect(violations(g, /\.(post|put|patch|delete)\s*\(|method:\s*['"](POST|PUT|PATCH|DELETE)/i, ['app/stores/auth.ts'])).toEqual([])
    expect([...g.autoImports]).toEqual([])
  })

  it('diffuser page: cannot reach a group send, an audience builder, recipients or a CSV export', () => {
    const g = crawl(['app/pages/m/diffuser.vue'])
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
    // Entrées autorisées : app/stores/auth.ts (`Set.delete`) ; usersService.ts définit les écritures du poste
    // utilisateurs, mais la recherche partagée (useUserSearch) n'appelle que `usersService.list` et `usersService.get`.
    expect(violations(g, /\.(put|patch|delete)\s*\(|method:\s*['"](PUT|PATCH|DELETE)/i, ['app/stores/auth.ts', 'app/features/users/services/usersService.ts'])).toEqual([])
    expect([...(g.sources.get('app/features/broadcast/composables/useUserSearch.ts') ?? '').matchAll(/usersService\.(\w+)/g)].map(m => m[1]).sort()).toEqual(['get', 'list'])
    expect([...g.autoImports]).toEqual([])
  })

  it('resolveSpecifier handles aliases, relative paths, index files and packages', () => {
    const from = `${process.cwd()}/app/pages/m/ensemble.vue`
    expect(resolveSpecifier('@/lib/safeInput', from)).toMatch(/app\/lib\/safeInput\.ts$/)
    expect(resolveSpecifier('~/lib/safeInput', from)).toMatch(/app\/lib\/safeInput\.ts$/)
    expect(resolveSpecifier('../../lib/safeInput', from)).toMatch(/app\/lib\/safeInput\.ts$/)
    expect(resolveSpecifier('@/features/notifications/types', from)).toMatch(/types\/index\.ts$/)
    expect(resolveSpecifier('vue', from)).toBeNull()
    expect(resolveSpecifier('@/nope/missing', from)).toBeNull()
  })
})
