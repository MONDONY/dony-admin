import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

// Parcours E2E du panel super-admin (/administrateurs) : création d'un
// administrateur, affichage ponctuel du mot de passe temporaire puis
// disparition du DOM à la fermeture ; et confirmation que ADMIN/SUPPORT
// n'ont ni le lien de navigation ni l'accès à la page.
const SUPER_ADMIN = {
  id: 's1',
  email: 'super.admin@yadony.com',
  role: 'SUPER_ADMIN',
  status: 'ACTIVE',
  mustChangePassword: false,
  permissionOverrides: {},
}

const ADMIN = {
  id: 'a1',
  email: 'admin.1@yadony.com',
  role: 'ADMIN',
  status: 'ACTIVE',
  mustChangePassword: false,
  permissionOverrides: {},
}

const SUPPORT = {
  id: 'su1',
  email: 'support.1@yadony.com',
  role: 'SUPPORT',
  status: 'ACTIVE',
  mustChangePassword: false,
  permissionOverrides: {},
}

const EMPTY_PAGE = { content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 }

async function seedAdmin(page: Page, user: typeof SUPER_ADMIN | typeof ADMIN | typeof SUPPORT) {
  await page.addInitScript((u) => {
    ;(window as unknown as { __donyAuthSeed: typeof u }).__donyAuthSeed = u
  }, user)
}

test('super admin creates an admin and sees the one-time credentials, then they leave the DOM', async ({ page }) => {
  await seedAdmin(page, SUPER_ADMIN)

  const credentials = { email: 'new.admin@yadony.com', temporaryPassword: 'TempPass123!Example' }
  await page.route('**/api/v1/admin/admins**', (route) => {
    const method = route.request().method()
    if (method === 'POST') return route.fulfill({ json: credentials })
    return route.fulfill({ json: EMPTY_PAGE })
  })

  await page.goto('/administrateurs')
  await expect(page.locator('h1').first()).toContainText('Administrateurs')

  // Nuxt dev compiles routes on demand; on a cold route the client hasn't
  // finished hydrating (click listeners not yet attached) by the time the
  // first click lands. Retry until the dialog actually opens.
  await expect(async () => {
    await page.locator('[data-test="new-admin"]').click()
    await expect(page.locator('[data-test="create-admin-email"]')).toBeVisible({ timeout: 2000 })
  }).toPass({ timeout: 15000 })

  await page.locator('[data-test="create-admin-email"]').fill('new.admin@yadony.com')
  await page.locator('[data-test="create-admin-role"]').selectOption('ADMIN')
  await page.locator('[data-test="create-admin-submit"]').click()

  await expect(page.locator('[data-test="credentials-password"]')).toHaveText('TempPass123!Example')
  await expect(page.getByText('TempPass123!Example')).toBeVisible()

  await page.locator('[data-test="credentials-close"]').click()
  await expect(page.getByText('TempPass123!Example')).toHaveCount(0)
  await expect(page.locator('[data-test="credentials-overlay"]')).toHaveCount(0)
})

test('super admin sees the Administrateurs link in the sidebar', async ({ page }) => {
  await seedAdmin(page, SUPER_ADMIN)
  await page.route('**/api/v1/admin/admins**', (route) => route.fulfill({ json: EMPTY_PAGE }))
  await page.goto('/administrateurs')
  await expect(page.getByRole('link', { name: 'Administrateurs' })).toBeVisible()
})

test('admin role has no admin accounts link and is redirected from /administrateurs', async ({ page }) => {
  await seedAdmin(page, ADMIN)
  await page.route('**/api/v1/admin/**', (route) => route.abort())

  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Administrateurs' })).toHaveCount(0)

  await page.goto('/administrateurs')
  await expect(page).toHaveURL(/\/denied$/)
})

test('support role has no admin accounts link and is redirected from /administrateurs', async ({ page }) => {
  await seedAdmin(page, SUPPORT)
  await page.route('**/api/v1/admin/**', (route) => route.abort())

  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Administrateurs' })).toHaveCount(0)

  await page.goto('/administrateurs')
  await expect(page).toHaveURL(/\/denied$/)
})
