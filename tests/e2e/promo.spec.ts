import { test, expect } from '@playwright/test'

const ADMIN = { id: 'a1', login: 'admin.1', role: 'ADMIN', status: 'ACTIVE', mustChangePassword: false, permissionOverrides: {} }

const PROMO_PAGE = {
  content: [
    { id: 'p1', code: 'WELCOME10', type: 'PERCENT', value: 10, maxRedemptions: 100, redemptionCount: 12, expiresAt: '2026-12-31T00:00:00Z', active: true, createdAt: '2026-06-01T10:00:00Z' },
  ],
  totalElements: 1, totalPages: 1, number: 0, size: 20,
}

function routePromo(page: import('@playwright/test').Page, sink: { method: string; url: string; body: string }[]) {
  return page.route('**/api/v1/admin/promo-codes**', (route) => {
    const req = route.request()
    const method = req.method()
    if (method !== 'GET') sink.push({ method, url: req.url(), body: req.postData() ?? '' })
    if (method === 'POST') return route.fulfill({ json: { id: 'p2', code: 'SUMMER20', type: 'PERCENT', value: 20, maxRedemptions: null, redemptionCount: 0, expiresAt: null, active: true, createdAt: '2026-06-10T10:00:00Z' } })
    if (method === 'PUT') return route.fulfill({ json: { ...PROMO_PAGE.content[0], value: 15 } })
    if (method === 'DELETE') return route.fulfill({ status: 204, body: '' })
    return route.fulfill({ json: PROMO_PAGE })
  })
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript((u) => { (window as unknown as { __donyAuthSeed: typeof u }).__donyAuthSeed = u }, ADMIN)
})

test('admin sees promo codes', async ({ page }) => {
  await routePromo(page, [])
  await page.goto('/promo')
  await expect(page.locator('h1').first()).toContainText('Codes promo')
  await expect(page.locator('[data-test="promo-row-p1"]')).toContainText('WELCOME10')
})

test('admin creates a promo code', async ({ page }) => {
  const calls: { method: string; url: string; body: string }[] = []
  await routePromo(page, calls)
  await page.goto('/promo')
  await expect(page.locator('[data-test="promo-row-p1"]')).toBeVisible()
  await page.locator('[data-test="new-promo"]').click()
  await page.locator('[data-test="promo-code"]').fill('SUMMER20')
  await page.locator('[data-test="promo-value"]').fill('20')
  await page.locator('[data-test="promo-submit"]').click()
  await expect.poll(() => calls.find((c) => c.method === 'POST')?.body ?? '').toContain('SUMMER20')
  await expect(page.locator('[data-test="promo-overlay"]')).toHaveCount(0)
})

test('admin edits a promo code', async ({ page }) => {
  const calls: { method: string; url: string; body: string }[] = []
  await routePromo(page, calls)
  await page.goto('/promo')
  await expect(page.locator('[data-test="promo-row-p1"]')).toBeVisible()
  await page.locator('[data-test="edit-p1"]').click()
  await expect(page.locator('[data-test="promo-code"]')).toHaveValue('WELCOME10')
  await page.locator('[data-test="promo-value"]').fill('15')
  await page.locator('[data-test="promo-submit"]').click()
  await expect.poll(() => calls.some((c) => c.method === 'PUT' && c.url.includes('/promo-codes/p1'))).toBe(true)
})

test('admin deletes a promo code', async ({ page }) => {
  const calls: { method: string; url: string; body: string }[] = []
  await routePromo(page, calls)
  await page.goto('/promo')
  await expect(page.locator('[data-test="promo-row-p1"]')).toBeVisible()
  await page.locator('[data-test="remove-p1"]').click()
  await page.locator('[data-test="confirm"]').click()
  await expect.poll(() => calls.some((c) => c.method === 'DELETE' && c.url.includes('/promo-codes/p1'))).toBe(true)
  await expect(page.locator('[data-test="overlay"]')).toHaveCount(0)
})
