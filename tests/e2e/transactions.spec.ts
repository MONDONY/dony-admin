import { test, expect } from '@playwright/test'

const ADMIN = { id: 'a1', email: 'admin.1@yadony.com', role: 'ADMIN', status: 'ACTIVE', mustChangePassword: false, permissionOverrides: {} }
const PAYMENTS = { content: [
  { id: 'p1', bidId: 'b1', status: 'ESCROW', method: 'STRIPE', amountCents: 12345, commissionCents: 1480, createdAt: '2026-06-01T10:00:00Z' },
], totalElements: 1, totalPages: 1, number: 0, size: 20 }
const DETAIL = { ...PAYMENTS.content[0], refundedCents: 0, stripePaymentIntentId: 'pi_123', escrowReleasedAt: null, disputed: false }
const RELEASED = { ...DETAIL, status: 'RELEASED' }
const CBS = { content: [{ id: 'cb1', bidId: 'b1', amountCents: 5000, reason: 'fraudulent', status: 'OPEN', openedAt: '2026-06-01T10:00:00Z' }], totalElements: 1, totalPages: 1, number: 0, size: 20 }

const WALLETS = { content: [
  { id: 'w1', userId: 'u1', balanceCents: 25000, currency: 'EUR', updatedAt: '2026-06-01T10:00:00Z' },
], totalElements: 1, totalPages: 1, number: 0, size: 20 }
const MOBILE_MONEY = { content: [
  { id: 'mm1', bidId: 'b1', provider: 'ORANGE_MONEY', countryCode: 'SN', phoneNumber: '221771234567', amountCents: 8000, currency: 'XOF', status: 'COMPLETED', createdAt: '2026-06-01T10:00:00Z' },
], totalElements: 1, totalPages: 1, number: 0, size: 20 }
const CASH_COMMISSIONS = { content: [
  { bidId: 'b2', amountCents: 15000, commissionCents: 1800, currency: 'EUR', status: 'CHARGED', chargedVia: 'CARD', retryCount: 0, createdAt: '2026-06-01T10:00:00Z' },
], totalElements: 1, totalPages: 1, number: 0, size: 20 }

test.beforeEach(async ({ page }) => {
  await page.addInitScript((u) => { (window as unknown as { __yadonyAuthSeed: typeof u }).__yadonyAuthSeed = u }, ADMIN)
  await page.route('**/api/v1/admin/payments**', (route) => {
    const url = route.request().url(); const m = route.request().method()
    if (m === 'POST' && url.includes('/force-release')) return route.fulfill({ json: RELEASED })
    if (m === 'POST' && url.includes('/refund')) return route.fulfill({ json: { ...DETAIL, status: 'REFUNDED' } })
    if (url.includes('/admin/payments/p1')) return route.fulfill({ json: DETAIL })
    return route.fulfill({ json: PAYMENTS })
  })
  await page.route('**/api/v1/admin/chargebacks**', (route) => route.fulfill({ json: CBS }))
  await page.route('**/api/v1/admin/wallets**', (route) => route.fulfill({ json: WALLETS }))
  await page.route('**/api/v1/admin/mobile-money-payments**', (route) => route.fulfill({ json: MOBILE_MONEY }))
  await page.route('**/api/v1/admin/cash-commissions**', (route) => route.fulfill({ json: CASH_COMMISSIONS }))
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

test('admin bascule sur les trois onglets financiers, avec masquage du numéro de téléphone', async ({ page }) => {
  await page.goto('/transactions')
  // Point d'ancrage sur la liste des paiements déjà rendue, avant tout changement d'onglet.
  await expect(page.locator('[data-test="payment-row-p1"]')).toBeVisible()

  await page.locator('[data-test="tab-wallets"]').click()
  await expect(page.locator('[data-test="wallet-row-w1"]')).toBeVisible({ timeout: 15000 })
  await expect(page.locator('[data-test="wallet-row-w1"]')).toContainText('250,00')
  await expect(page.locator('[data-test="wallet-row-w1"]')).toContainText('u1')

  await page.locator('[data-test="tab-mobile-money"]').click()
  await expect(page.locator('[data-test="mm-row-mm1"]')).toBeVisible({ timeout: 15000 })
  // Le numéro de téléphone en clair ne doit jamais apparaître dans la table — seuls les
  // 4 derniers chiffres sont visibles, précédés de puces (mobile_money_payments.phone_number
  // est une donnée personnelle stockée en clair côté back).
  await expect(page.locator('[data-test="mm-phone-mm1"]')).toHaveText('••••••••4567')
  await expect(page.locator('[data-test="mm-row-mm1"]')).not.toContainText('221771234567')

  await page.locator('[data-test="tab-cash-commissions"]').click()
  await expect(page.locator('[data-test="cash-commission-row-b2"]')).toBeVisible({ timeout: 15000 })
  await expect(page.locator('[data-test="cash-commission-row-b2"]')).toContainText('150,00')
  await expect(page.locator('[data-test="cash-commission-row-b2"]')).toContainText('18,00')
  await expect(page.locator('[data-test="cash-commission-row-b2"]')).toContainText('Prélevée')
})
