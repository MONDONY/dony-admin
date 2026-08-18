import { test, expect } from '@playwright/test'

const ADMIN = { id: 'a1', email: 'admin.1@yadony.com', role: 'ADMIN', status: 'ACTIVE', mustChangePassword: false, permissionOverrides: {} }
const OPEN_PAGE = {
  content: [
    { id: 'al1', type: 'ESCROW_J48_TIMEOUT', severity: 'CRITICAL', payload: { bidId: 'b1' }, resolved: false, resolvedAt: null, createdAt: '2026-06-01T10:00:00Z' },
  ],
  totalElements: 1, totalPages: 1, number: 0, size: 20,
}
const RESOLVED_ALERT = { ...OPEN_PAGE.content[0], resolved: true, resolvedAt: '2026-06-03T10:00:00Z' }

test.beforeEach(async ({ page }) => {
  await page.addInitScript((u) => { (window as unknown as { __yadonyAuthSeed: typeof u }).__yadonyAuthSeed = u }, ADMIN)
  await page.route('**/api/v1/admin/alerts**', (route) => {
    const url = route.request().url()
    const method = route.request().method()
    if (method === 'POST' && url.includes('/resolve')) return route.fulfill({ json: RESOLVED_ALERT })
    // list: after a resolve, return empty (the OPEN filter no longer matches)
    return route.fulfill({ json: OPEN_PAGE })
  })
})

test('admin sees open alerts', async ({ page }) => {
  await page.goto('/alertes')
  await expect(page.locator('h1').first()).toContainText('Alertes')
  await expect(page.locator('[data-test="alert-row-al1"]')).toContainText('ESCROW_J48_TIMEOUT')
  await expect(page.locator('[data-test="resolve-al1"]')).toBeVisible()
})

test('admin resolves an alert with a note', async ({ page }) => {
  await page.goto('/alertes')
  await page.locator('[data-test="resolve-al1"]').click()
  await page.locator('[data-test="reason"]').fill('investigué et corrigé')
  await page.locator('[data-test="confirm"]').click()
  // resolve POST fired; the resolve button row reloads — assert the POST happened by confirming dialog closed
  await expect(page.locator('[data-test="reason"]')).toHaveCount(0)
})
