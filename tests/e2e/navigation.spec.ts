import { test, expect } from '@playwright/test'

const ADMIN_USER = { id: 'user-1', email: 'admin.1@yadony.com', role: 'ADMIN', status: 'ACTIVE', mustChangePassword: false, permissionOverrides: {} }

async function fakeLogin(page: import('@playwright/test').Page, user = ADMIN_USER) {
  await page.addInitScript((u) => {
    ;(window as unknown as { __yadonyAuthSeed: typeof u }).__yadonyAuthSeed = u
  }, user)
}

// Abort all admin API calls so 401s don't trigger auth.clear() / navigateTo('/login')
// during navigation tests that don't set up per-endpoint mocks.
test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/admin/**', (route) => route.abort())
})

test('unauthenticated user is redirected to /login', async ({ page }) => {
  // null seed = explicitly unauthenticated (skips Firebase, no session set)
  await page.addInitScript(() => {
    ;(window as unknown as { __yadonyAuthSeed: null }).__yadonyAuthSeed = null
  })
  await page.goto('/users')
  await expect(page).toHaveURL(/\/login$/)
})

test('non-admin user is redirected to /denied', async ({ page }) => {
  await fakeLogin(page, { ...ADMIN_USER, role: null })
  await page.goto('/users')
  await expect(page).toHaveURL(/\/denied$/)
})

test('admin navigates across the 11 modules', async ({ page }) => {
  await fakeLogin(page)
  await page.goto('/')
  await expect(page.locator('h1').first()).toContainText(/Vue d.ensemble/)

  const sections: [string, RegExp, RegExp][] = [
    ['Utilisateurs', /Utilisateurs/, /\/users$/],
    ['Transactions', /Transactions/, /\/transactions$/],
    ['Colis', /Colis/, /\/colis$/],
    ['Incidents', /Incidents/, /\/incidents$/],
    ['Alertes', /Alertes/, /\/alertes$/],
    ['Modération', /Modération/, /\/moderation$/],
    ['Codes promo', /Codes promo/, /\/promo$/],
    ['Audit', /Audit/, /\/audit$/],
    ['Exports', /Exports/, /\/exports$/],
    ['Signalements', /Signalements/, /\/signalements$/],
  ]
  for (const [link, title, url] of sections) {
    await page.getByRole('link', { name: link }).first().click()
    // Attendre la fin de la navigation (URL + titre) avant le clic suivant :
    // la sidebar se re-render au changement de route, sinon le lien suivant
    // peut être détaché du DOM pendant le clic (flake).
    await expect(page).toHaveURL(url)
    await expect(page.locator('h1').first()).toContainText(title)
  }
})
