import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

// Parcours E2E du mot de passe obligatoire (mustChangePassword) : une session
// seedée avec ce flag ne doit jamais pouvoir atteindre un module protégé tant
// que /admin/me/change-password n'a pas été appelé avec succès.
const ADMIN = {
  id: 'a1',
  email: 'admin.1@yadony.com',
  role: 'ADMIN',
  status: 'ACTIVE',
  mustChangePassword: false,
  permissionOverrides: {},
}

const OVERVIEW = {
  users: { total: 0, active: 0, suspended: 0, banned: 0, pendingDeletion: 0, kycVerified: 0, kycPending: 0, pro: 0, newLast7d: 0, newLast30d: 0 },
  announcements: { active: 0, full: 0, inProgress: 0, completed: 0, cancelled: 0 },
  bids: { pending: 0, accepted: 0, inTransit: 0, completed: 0, cancelled: 0, total: 0 },
  gmv: { escrowHeld: 0, released: 0, refunded: 0, commission: 0 },
  queues: { openDisputes: 0, pendingNoShows: 0, unresolvedAlerts: 0, pendingKyc: 0, escrowJ48: 0 },
}

async function seedAdmin(page: Page, user: typeof ADMIN) {
  await page.addInitScript((u) => {
    ;(window as unknown as { __donyAuthSeed: typeof u }).__donyAuthSeed = u
  }, user)
}

test('unauthenticated access redirects to login', async ({ page }) => {
  await page.goto('/users')
  await expect(page).toHaveURL(/\/login$/)
})

test('required password session cannot open dashboard', async ({ page }) => {
  await seedAdmin(page, { ...ADMIN, mustChangePassword: true })
  await page.goto('/users')
  await expect(page).toHaveURL(/\/change-password$/)
})

test('required password session is redirected even when landing on the root route', async ({ page }) => {
  await seedAdmin(page, { ...ADMIN, mustChangePassword: true })
  await page.goto('/')
  await expect(page).toHaveURL(/\/change-password$/)
})

test('required password session can reach /change-password directly without a redirect loop', async ({ page }) => {
  await seedAdmin(page, { ...ADMIN, mustChangePassword: true })
  await page.goto('/change-password')
  await expect(page).toHaveURL(/\/change-password$/)
  await expect(page.locator('h1').first()).toContainText('Changer le mot de passe')
})

test('admin completes the required password change and reaches the dashboard', async ({ page }) => {
  await seedAdmin(page, { ...ADMIN, mustChangePassword: true })

  await page.route('**/api/v1/admin/me/change-password', (route) => {
    expect(route.request().method()).toBe('POST')
    return route.fulfill({ json: {} })
  })
  // Exact-suffix pattern: does not also match /admin/me/change-password above.
  await page.route('**/api/v1/admin/me', (route) => route.fulfill({ json: { ...ADMIN, mustChangePassword: false } }))
  await page.route('**/api/v1/admin/metrics/overview**', (route) => route.fulfill({ json: OVERVIEW }))

  await page.goto('/change-password')

  // Nuxt dev compiles routes on demand; on a cold route the client hasn't
  // finished hydrating (v-model listeners not yet attached) by the time a
  // first fill() lands, so the keystrokes are lost. Retry the fill+submit
  // until the button reflects the input, instead of a fixed sleep.
  const submit = page.getByRole('button', { name: 'Enregistrer' })
  await expect(async () => {
    await page.locator('#new-password').fill('NewPassw0rd1234!')
    await page.locator('#confirm-password').fill('NewPassw0rd1234!')
    await expect(submit).toBeEnabled({ timeout: 2000 })
  }).toPass({ timeout: 15000 })
  await submit.click()

  await expect(page).toHaveURL('/')
  await expect(page.locator('h1').first()).toContainText(/Vue d.ensemble/)
})
