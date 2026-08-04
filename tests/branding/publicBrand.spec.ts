import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('public Yadony ADMIN brand', () => {
  it('does not expose the former brand in active UI copy', () => {
    const files = [
      'app/components/layout/AppSidebar.vue',
      'app/features/auth/components/LoginLeftPanel.vue',
      'app/layouts/default.vue',
      'app/pages/change-password.vue',
      'app/pages/denied.vue',
      'app/pages/login.vue',
      'nuxt.config.ts',
    ]
    const offenders = files.filter((file) => {
      const source = readFileSync(file, 'utf8')
        .replaceAll(/dony-theme|dony-admin-session|admin\.dony\.invalid/gi, '')
      return /\bdony\b/i.test(source)
    })
    expect(offenders).toEqual([])
  })
})
