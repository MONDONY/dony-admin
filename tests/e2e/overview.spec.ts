import { test, expect } from '@playwright/test'

const ADMIN = { id: 'a1', email: 'admin.1@yadony.com', role: 'ADMIN', status: 'ACTIVE', mustChangePassword: false, permissionOverrides: {} }
const OVERVIEW = {
  users: { total: 120, active: 100, suspended: 5, banned: 3, pendingDeletion: 2, kycVerified: 80, kycPending: 10, pro: 7, newLast7d: 4, newLast30d: 20 },
  announcements: { active: 12, full: 2, inProgress: 3, completed: 40, cancelled: 5 },
  bids: { pending: 8, accepted: 15, inTransit: 4, completed: 60, cancelled: 6, total: 93 },
  gmv: { escrowHeld: 1234.56, released: 5000, refunded: 100, commission: 600 },
  gmvByCurrency: [
    { currency: 'EUR', escrowHeldCents: 123456, releasedCents: 500000, refundedCents: 10000, commissionCents: 60000 },
    { currency: 'XOF', escrowHeldCents: 990000, releasedCents: 1980000, refundedCents: 0, commissionCents: 180000 },
  ],
  queues: { openDisputes: 2, pendingNoShows: 1, unresolvedAlerts: 3, pendingKyc: 10, escrowJ48: 1 },
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript((u) => { (window as unknown as { __yadonyAuthSeed: typeof u }).__yadonyAuthSeed = u }, ADMIN)
  await page.route('**/api/v1/admin/metrics/overview', (route) => route.fulfill({ json: OVERVIEW }))
})

test('overview shows KPIs, per-currency volumes and action queues', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1').first()).toContainText(/Vue d.ensemble/)
  await expect(page.locator('[data-test="kpi-users-total"]')).toContainText('120')
  await expect(page.locator('[data-test="queue-disputes"]')).toContainText('2')
  // Recette du 2026-09-09 : plus aucun total en euros mêlant les devises, une ligne par devise.
  await expect(page.locator('[data-test="kpi-gmv-escrow"]')).toHaveCount(0)
  await expect(page.locator('[data-test="volume-escrow-EUR"]')).toHaveText(/1.234,56 EUR/)
  await expect(page.locator('[data-test="volume-released-XOF"]')).toHaveText(/19.800,00 XOF/)
  await expect(page.locator('[data-test="volume-commission-XOF"]')).toHaveText(/1.800,00 XOF/)
  await expect(page.locator('[data-test="volume-row-XOF"]')).not.toContainText('€')
})
