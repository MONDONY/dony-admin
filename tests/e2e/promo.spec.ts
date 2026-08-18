import { test, expect } from '@playwright/test'

const ADMIN = { id: 'a1', email: 'admin.1@yadony.com', role: 'ADMIN', status: 'ACTIVE', mustChangePassword: false, permissionOverrides: {} }

const PROMO_LIST = [
  {
    id: 'p1', code: 'WELCOME10', rate: 0.1, target: 'ANY',
    validFrom: null, validTo: '2026-12-31T23:59:59', maxRedemptions: 100,
    perUserLimit: 1, redeemedCount: 12, status: 'ACTIVE', createdAt: '2026-06-01T10:00:00',
  },
]

function routePromo(page: import('@playwright/test').Page, sink: { method: string; url: string; body: string }[]) {
  return page.route('**/api/v1/admin/promo-codes**', (route) => {
    const req = route.request()
    const method = req.method()
    const url = req.url()
    if (method !== 'GET') sink.push({ method, url, body: req.postData() ?? '' })
    if (method === 'POST') {
      return route.fulfill({ json: { ...PROMO_LIST[0], id: 'p2', code: 'SUMMER20', rate: 0.2, redeemedCount: 0 } })
    }
    if (method === 'PUT' && url.includes('/status')) {
      return route.fulfill({ json: { ...PROMO_LIST[0], status: 'DISABLED' } })
    }
    if (method === 'PUT') return route.fulfill({ json: { ...PROMO_LIST[0], rate: 0.15 } })
    if (method === 'DELETE') return route.fulfill({ status: 204, body: '' })
    return route.fulfill({ json: PROMO_LIST })
  })
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript((u) => { (window as unknown as { __yadonyAuthSeed: typeof u }).__yadonyAuthSeed = u }, ADMIN)
})

test('admin sees promo codes', async ({ page }) => {
  await routePromo(page, [])
  await page.goto('/promo')
  await expect(page.locator('h1').first()).toContainText('Codes promo')
  await expect(page.locator('[data-test="promo-row-p1"]')).toContainText('WELCOME10')
  await expect(page.locator('[data-test="promo-row-p1"]')).toContainText('10 %')
})

test('admin creates a promo code', async ({ page }) => {
  const calls: { method: string; url: string; body: string }[] = []
  await routePromo(page, calls)
  await page.goto('/promo')
  await expect(page.locator('[data-test="promo-row-p1"]')).toBeVisible()
  await page.locator('[data-test="new-promo"]').click()
  await page.locator('[data-test="promo-code"]').fill('SUMMER20')
  await page.locator('[data-test="promo-rate"]').fill('20')
  await page.locator('[data-test="promo-submit"]').click()
  await expect.poll(() => calls.find((c) => c.method === 'POST')?.body ?? '').toContain('SUMMER20')
  const postBody = JSON.parse(calls.find((c) => c.method === 'POST')!.body)
  expect(postBody.rate).toBe(0.2)
  await expect(page.locator('[data-test="promo-overlay"]')).toHaveCount(0)
})

test('admin edits a promo code', async ({ page }) => {
  const calls: { method: string; url: string; body: string }[] = []
  await routePromo(page, calls)
  await page.goto('/promo')
  await expect(page.locator('[data-test="promo-row-p1"]')).toBeVisible()
  await page.locator('[data-test="edit-p1"]').click()
  await expect(page.locator('[data-test="promo-code"]')).toHaveValue('WELCOME10')
  await page.locator('[data-test="promo-rate"]').fill('15')
  await page.locator('[data-test="promo-submit"]').click()
  await expect.poll(() => calls.some((c) => c.method === 'PUT' && c.url.includes('/promo-codes/p1'))).toBe(true)
})

test('admin toggles promo status', async ({ page }) => {
  const calls: { method: string; url: string; body: string }[] = []
  await routePromo(page, calls)
  await page.goto('/promo')
  await expect(page.locator('[data-test="promo-row-p1"]')).toBeVisible()
  await page.locator('[data-test="toggle-p1"]').click()
  await expect.poll(() => calls.some((c) => c.method === 'PUT' && c.url.includes('/promo-codes/p1/status'))).toBe(true)
  const statusBody = JSON.parse(calls.find((c) => c.url.includes('/status'))!.body)
  expect(statusBody.status).toBe('DISABLED')
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
