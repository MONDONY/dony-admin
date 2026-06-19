import { test, expect } from '@playwright/test'

const ADMIN = { id: 'a1', phoneNumber: '+33600000000', displayName: 'Admin Dony', isProAccount: false, roles: ['ADMIN'], avatarUrl: null }
const OVERVIEW = {
  users: { total: 120, active: 100, suspended: 5, banned: 3, pendingDeletion: 2, kycVerified: 80, kycPending: 10, pro: 7, newLast7d: 4, newLast30d: 20 },
  trips: { active: 12, inProgress: 3, completed: 40, cancelled: 5 },
  bids: { pending: 8, accepted: 15, inTransit: 4, completed: 60, cancelled: 6, total: 93 },
  gmv: { escrowHeldCents: 123456, releasedCents: 500000, refundedCents: 10000, commissionCents: 60000 },
  queues: { openDisputes: 2, pendingNoShows: 1, unresolvedAlerts: 3, pendingKyc: 10, escrowJ48: 1 },
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript((u) => { (window as unknown as { __donyAuthSeed: typeof u }).__donyAuthSeed = u }, ADMIN)
  await page.route('**/api/v1/admin/metrics/overview', (route) => route.fulfill({ json: OVERVIEW }))
})

test('overview shows KPIs and action queues', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1').first()).toContainText(/Vue d.ensemble/)
  await expect(page.locator('[data-test="kpi-users-total"]')).toContainText('120')
  await expect(page.locator('[data-test="queue-disputes"]')).toContainText('2')
  await expect(page.locator('[data-test="kpi-gmv-escrow"]')).toContainText('234')
})
