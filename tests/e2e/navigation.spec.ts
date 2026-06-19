import { test, expect } from '@playwright/test'

const ADMIN_USER = {
  id: 'user-1',
  phoneNumber: '+33612345678',
  displayName: 'Admin Dony',
  isProAccount: false,
  roles: ['ADMIN'],
  avatarUrl: null,
}

async function fakeLogin(page: import('@playwright/test').Page, user = ADMIN_USER) {
  await page.addInitScript((u) => {
    ;(window as unknown as { __donyAuthSeed: typeof u }).__donyAuthSeed = u
  }, user)
}

test('unauthenticated user is redirected to /login', async ({ page }) => {
  await page.goto('/users')
  await expect(page).toHaveURL(/\/login$/)
})

test('non-admin user is redirected to /denied', async ({ page }) => {
  await fakeLogin(page, { ...ADMIN_USER, roles: ['SENDER'] })
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
