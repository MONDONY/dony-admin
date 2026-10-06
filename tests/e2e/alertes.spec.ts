import { test, expect } from '@playwright/test'

const ADMIN = { id: 'a1', email: 'admin.1@yadony.com', role: 'ADMIN', status: 'ACTIVE', mustChangePassword: false, permissionOverrides: {} }
const OPEN_PAGE = {
  content: [
    { id: 'al1', type: 'ESCROW_J48_TIMEOUT', severity: 'CRITICAL', payload: { bidId: 'b1' }, resolved: false, resolvedAt: null, createdAt: '2026-06-01T10:00:00Z' },
  ],
  totalElements: 1, totalPages: 1, number: 0, size: 20,
}
const INVARIANT_ALERT = {
  id: 'al2', type: 'MONEY_INVARIANT_INV-06', severity: 'WARN',
  detail: 'Incohérence d’argent INV-06 (HAUTE) : Colis livré depuis plus de 2 h bien payé au voyageur — 1 ligne(s) en faute',
  payload: { invariant: 'INV-06', regle: 'Colis livré depuis plus de 2 h bien payé au voyageur', gravite: 'HAUTE', lignesEnFaute: 1, passagePrecedent: 0 },
  resolved: false, resolvedAt: null, createdAt: '2026-10-06T12:00:00',
}
const VIOLATIONS = {
  invariant: 'INV-06', title: 'Colis livré depuis plus de 2 h bien payé au voyageur', severity: 'HAUTE', total: 1,
  rows: [{ payment_id: '11111111-2222-3333-4444-555555555555', rail: 'STRIPE', amount: 42, currency: 'EUR', disputed: false, payout_held_at: null, bid_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', delivered_at: '2026-10-06 08:00:00.0' }],
}
const RESOLVED_ALERT = { ...OPEN_PAGE.content[0], resolved: true, resolvedAt: '2026-06-03T10:00:00Z' }

test.beforeEach(async ({ page }) => {
  await page.addInitScript((u) => { (window as unknown as { __yadonyAuthSeed: typeof u }).__yadonyAuthSeed = u }, ADMIN)
  await page.route('**/api/v1/admin/alerts**', (route) => {
    const url = route.request().url()
    const method = route.request().method()
    if (method === 'POST' && url.includes('/resolve')) return route.fulfill({ json: RESOLVED_ALERT })
    if (url.includes('/al2/violations')) return route.fulfill({ json: VIOLATIONS })
    if (url.includes('severity=WARN')) return route.fulfill({ json: { ...OPEN_PAGE, content: [INVARIANT_ALERT] } })
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

test('admin opens an alert and sees what to do and the faulty rows', async ({ page }) => {
  await page.goto('/alertes')
  await expect(page.locator('[data-test="alert-row-al1"]')).toBeVisible()
  await page.locator('[data-test="severity-WARN"]').click()
  await page.locator('[data-test="details-al2"]').click()
  await expect(page.locator('[data-test="alert-detail-title"]')).toHaveText('Colis livré mais voyageur pas encore payé')
  await expect(page.locator('[data-test="alert-detail-actions"]')).toContainText('Débloquer (force-release)')
  await expect(page.locator('[data-test="alert-violations-total"]')).toContainText('1 ligne(s) en faute')
  await expect(page.locator('[data-test="alert-rows"] a').first()).toHaveAttribute('href', /\/transactions\?open=11111111-2222-3333-4444-555555555555$/)
  if (process.env.ALERT_SCREENSHOT) await page.screenshot({ path: process.env.ALERT_SCREENSHOT, fullPage: true })
})
