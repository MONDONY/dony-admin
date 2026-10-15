import { test, expect } from '@playwright/test'

const ADMIN = { id: 'a1', email: 'admin.1@yadony.com', role: 'ADMIN', status: 'ACTIVE', mustChangePassword: false, permissionOverrides: {} }

const TOPUP_CODE = {
  id: 't1', code: 'BIENVENUE', amount: 2000, currency: 'XOF', maxRedemptions: 1, redeemedCount: 0, remaining: 1,
  expiresAt: null, displayStatus: 'ACTIVE', note: null, createdAt: '2026-10-15T10:00:00',
  createdBy: 'a1', createdByEmail: 'admin.1@yadony.com', revokedAt: null,
}

function routeTopup(page: import('@playwright/test').Page, sink: { method: string; url: string; body: string }[]) {
  return page.route('**/api/v1/admin/topup-codes**', (route) => {
    const req = route.request()
    const method = req.method()
    if (method !== 'GET') sink.push({ method, url: req.url(), body: req.postData() ?? '' })
    if (method === 'POST') return route.fulfill({ status: 201, json: { ...TOPUP_CODE, id: 't2', code: 'NOUVEAU2000' } })
    return route.fulfill({ json: [] })
  })
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript((u) => { (window as unknown as { __yadonyAuthSeed: typeof u }).__yadonyAuthSeed = u }, ADMIN)
})

test('admin creates a topup code', async ({ page }) => {
  const calls: { method: string; url: string; body: string }[] = []
  await routeTopup(page, calls)
  await page.goto('/topup-codes')
  await expect(page.locator('h1').first()).toContainText('Codes de recharge')
  await expect(page.getByText('Aucun code de recharge')).toBeVisible()
  // Le SSR affiche le bouton avant l'hydratation : on réessaie le clic jusqu'à l'ouverture du formulaire.
  await expect(async () => {
    await page.locator('[data-test="new-topup-code"]').click()
    await expect(page.locator('[data-test="topup-overlay"]')).toBeVisible({ timeout: 1000 })
  }).toPass({ timeout: 15000 })
  await page.locator('[data-test="topup-amount"]').fill('2000')
  await page.locator('[data-test="topup-currency"]').selectOption('XOF')
  await page.locator('[data-test="topup-submit"]').click()
  await expect.poll(() => calls.find((c) => c.method === 'POST')?.body ?? '').toContain('2000')
  const postBody = JSON.parse(calls.find((c) => c.method === 'POST')!.body)
  expect(postBody).toMatchObject({ amount: 2000, currency: 'XOF' })
  await expect(page.locator('[data-test="topup-overlay"]')).toHaveCount(0)
})
