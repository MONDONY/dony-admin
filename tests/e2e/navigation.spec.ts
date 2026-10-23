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

  // [lien, domaine du rail, titre de la page, URL]
  const sections: [string, string, RegExp, RegExp][] = [
    ['Utilisateurs', 'accounts', /Utilisateurs/, /\/users$/],
    ['Transactions', 'money', /Transactions/, /\/transactions$/],
    ['Colis', 'activity', /Colis/, /\/colis$/],
    ['Incidents', 'activity', /Incidents/, /\/incidents$/],
    ['Alertes', 'activity', /Alertes/, /\/alertes$/],
    ['Modération', 'community', /Modération/, /\/moderation$/],
    ['Codes promo', 'money', /Codes promo/, /\/promo$/],
    ['Codes de recharge', 'money', /Codes de recharge/, /\/topup-codes$/],
    ['Audit', 'system', /Audit/, /\/audit$/],
    ['Exports', 'system', /Exports/, /\/exports$/],
    ['Signalements', 'activity', /Signalements/, /\/signalements$/],
  ]
  for (const [link, group, title, url] of sections) {
    // Un seul geste : survoler l'icône du domaine ouvre son panneau, un clic ouvre la page.
    await page.locator(`[data-test="nav-rail-${group}"]`).hover()
    await page.getByRole('link', { name: link }).first().click()
    // Attendre la fin de la navigation (URL + titre) avant le clic suivant :
    // la nav se re-render au changement de route, sinon le lien suivant
    // peut être détaché du DOM pendant le clic (flake).
    await expect(page).toHaveURL(url)
    await expect(page.locator('h1').first()).toContainText(title)
  }
})

test('le rail allume le domaine de la page et l’en-tête le nomme', async ({ page }) => {
  await fakeLogin(page)
  await page.goto('/colis')
  await expect(page.locator('[data-test="nav-rail-activity"]')).toHaveAttribute('aria-current', 'true')
  await expect(page.locator('[data-test="nav-rail-money"]')).not.toHaveAttribute('aria-current', 'true')
  await expect(page.locator('[data-test="topbar-section"]')).toHaveText('Activité')
})

test('le panneau s’ouvre au survol et se referme après le clic', async ({ page }) => {
  await fakeLogin(page)
  await page.goto('/')
  const panel = page.locator('[data-test="nav-panel-money"]')
  await expect(panel).toBeHidden()
  await page.locator('[data-test="nav-rail-money"]').hover()
  await expect(panel).toBeVisible()
  await panel.getByRole('link', { name: 'Transactions' }).click()
  await expect(page).toHaveURL(/\/transactions$/)
  await expect(panel).toBeHidden()
})
