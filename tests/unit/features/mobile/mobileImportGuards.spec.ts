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
