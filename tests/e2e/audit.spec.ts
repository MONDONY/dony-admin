import { test, expect } from '@playwright/test'

const ADMIN = { id: 'a1', login: 'admin.1', role: 'ADMIN', status: 'ACTIVE', mustChangePassword: false, permissionOverrides: {} }

const AUDIT_PAGE = {
  content: [
    {
      id: 'e1', action: 'USER_SUSPENDED', entityType: 'USER', entityId: 'u9',
      actorId: 'a1', actorName: 'Admin Dony', ipAddress: '10.0.0.1',
      payload: { reason: 'fraude avérée' }, createdAt: '2026-06-01T10:00:00Z',
    },
  ],
  totalElements: 1, totalPages: 1, number: 0, size: 20,
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript((u) => { (window as unknown as { __donyAuthSeed: typeof u }).__donyAuthSeed = u }, ADMIN)
})

test('admin sees audit entries', async ({ page }) => {
  await page.route('**/api/v1/admin/audit-log**', (route) => route.fulfill({ json: AUDIT_PAGE }))
  await page.goto('/audit')
  await expect(page.locator('h1').first()).toContainText('Audit')
  await expect(page.locator('[data-test="audit-row-e1"]')).toContainText('USER_SUSPENDED')
})

test('admin toggles the payload viewer', async ({ page }) => {
  await page.route('**/api/v1/admin/audit-log**', (route) => route.fulfill({ json: AUDIT_PAGE }))
  await page.goto('/audit')
  await expect(page.locator('[data-test="audit-row-e1"]')).toBeVisible()
  await expect(page.locator('[data-test="payload-e1"]')).toHaveCount(0)
  await page.locator('[data-test="toggle-e1"]').click()
  await expect(page.locator('[data-test="payload-e1"]')).toContainText('fraude avérée')
})

test('admin filters by action', async ({ page }) => {
  const urls: string[] = []
  await page.route('**/api/v1/admin/audit-log**', (route) => {
    urls.push(route.request().url())
    return route.fulfill({ json: AUDIT_PAGE })
  })
  await page.goto('/audit')
  await expect(page.locator('[data-test="audit-row-e1"]')).toBeVisible()
  await page.locator('[data-test="filter-action"]').fill('USER_SUSPENDED')
  await page.locator('[data-test="apply-filters"]').click()
  await expect.poll(() => urls.some((u) => u.includes('action=USER_SUSPENDED'))).toBe(true)
})

test('admin resets filters', async ({ page }) => {
  await page.route('**/api/v1/admin/audit-log**', (route) => route.fulfill({ json: AUDIT_PAGE }))
  await page.goto('/audit')
  await expect(page.locator('[data-test="audit-row-e1"]')).toBeVisible()
  await page.locator('[data-test="filter-action"]').fill('USER_BANNED')
  await page.locator('[data-test="reset-filters"]').click()
  await expect(page.locator('[data-test="filter-action"]')).toHaveValue('')
})
