import { test, expect } from '@playwright/test'

const ADMIN = { id: 'a1', login: 'admin.1', role: 'ADMIN', status: 'ACTIVE', mustChangePassword: false, permissionOverrides: {} }
const PAYMENTS = { content: [
  { id: 'p1', bidId: 'b1', status: 'ESCROW', method: 'STRIPE', amountCents: 12345, commissionCents: 1480, createdAt: '2026-06-01T10:00:00Z' },
], totalElements: 1, totalPages: 1, number: 0, size: 20 }
const DETAIL = { ...PAYMENTS.content[0], refundedCents: 0, stripePaymentIntentId: 'pi_123', escrowReleasedAt: null, disputed: false }
const RELEASED = { ...DETAIL, status: 'RELEASED' }
const CBS = { content: [{ id: 'cb1', bidId: 'b1', amountCents: 5000, reason: 'fraudulent', status: 'OPEN', openedAt: '2026-06-01T10:00:00Z' }], totalElements: 1, totalPages: 1, number: 0, size: 20 }

test.beforeEach(async ({ page }) => {
  await page.addInitScript((u) => { (window as unknown as { __donyAuthSeed: typeof u }).__donyAuthSeed = u }, ADMIN)
  await page.route('**/api/v1/admin/payments**', (route) => {
    const url = route.request().url(); const m = route.request().method()
    if (m === 'POST' && url.includes('/force-release')) return route.fulfill({ json: RELEASED })
    if (m === 'POST' && url.includes('/refund')) return route.fulfill({ json: { ...DETAIL, status: 'REFUNDED' } })
    if (url.includes('/admin/payments/p1')) return route.fulfill({ json: DETAIL })
    return route.fulfill({ json: PAYMENTS })
  })
  await page.route('**/api/v1/admin/chargebacks**', (route) => route.fulfill({ json: CBS }))
})

test('admin sees payments with formatted amount', async ({ page }) => {
  await page.goto('/transactions')
  await expect(page.locator('h1').first()).toContainText('Transactions')
  await expect(page.locator('[data-test="payment-row-p1"]')).toContainText('123,45')
})

test('admin force-releases an escrow payment', async ({ page }) => {
  await page.goto('/transactions')
  await page.locator('[data-test="payment-row-p1"]').click()
  await expect(page.getByText('pi_123')).toBeVisible()
  await page.locator('[data-test="action-release"]').click()
  await page.locator('[data-test="reason"]').fill('livraison validée J+48')
  await page.locator('[data-test="confirm"]').click()
  await expect(page.locator('aside').getByText('Libéré')).toBeVisible()
})

test('admin switches to chargebacks tab', async ({ page }) => {
  await page.goto('/transactions')
  await page.locator('[data-test="payment-row-p1"]').waitFor({ state: 'visible' })
  await page.locator('[data-test="tab-chargebacks"]').click()
  await expect(page.locator('[data-test="cb-row-cb1"]')).toBeVisible({ timeout: 15000 })
})
