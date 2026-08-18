import { test, expect } from '@playwright/test'

const ADMIN = { id: 'a1', email: 'admin.1@yadony.com', role: 'ADMIN', status: 'ACTIVE', mustChangePassword: false, permissionOverrides: {} }
const DISPUTES = { content: [
  { id: 'd1', bidId: 'b1', type: 'SENDER_NO_SHOW_CONTESTED', status: 'OPEN', senderName: 'Jean', travelerName: 'Awa', refundFrozen: true, createdAt: '2026-06-01T10:00:00Z' },
], totalElements: 1, totalPages: 1, number: 0, size: 20 }
const DISPUTE_DETAIL = { ...DISPUTES.content[0], resolution: null, resolvedAt: null, resolutionNote: null, declaredValueEur: 120, beneficiaryUserId: 's1' }
const DISPUTE_RESOLVED = { ...DISPUTE_DETAIL, status: 'RESOLVED', resolution: 'GUARANTEE_PAID' }
const NOSHOWS = { content: [
  { id: 'c1', bidId: 'b9', cancelledBy: 'TRAVELER', reason: 'SENDER_NO_SHOW', noShowStatus: 'PENDING_CONFIRMATION', contestationDeadline: '2026-06-05T10:00:00Z', createdAt: '2026-06-01T10:00:00Z' },
], totalElements: 1, totalPages: 1, number: 0, size: 20 }

test.beforeEach(async ({ page }) => {
  await page.addInitScript((u) => { (window as unknown as { __yadonyAuthSeed: typeof u }).__yadonyAuthSeed = u }, ADMIN)
  await page.route('**/api/v1/admin/disputes**', (route) => {
    const url = route.request().url(); const m = route.request().method()
    if (m === 'POST' && url.includes('/guarantee-fund')) return route.fulfill({ json: DISPUTE_RESOLVED })
    if (m === 'POST' && url.includes('/resolve')) return route.fulfill({ json: DISPUTE_RESOLVED })
    if (url.includes('/admin/disputes/d1')) return route.fulfill({ json: DISPUTE_DETAIL })
    return route.fulfill({ json: DISPUTES })
  })
  await page.route('**/api/v1/admin/cancellations**', (route) => route.fulfill({ json: NOSHOWS }))
})

test('admin sees open disputes', async ({ page }) => {
  await page.goto('/incidents')
  await expect(page.locator('h1').first()).toContainText('Incidents')
  await expect(page.locator('[data-test="dispute-row-d1"]')).toContainText('SENDER_NO_SHOW_CONTESTED')
})

test('admin activates the guarantee fund (≤200€) on a dispute', async ({ page }) => {
  await page.goto('/incidents')
  await page.locator('[data-test="dispute-row-d1"]').click()
  await expect(page.locator('aside').getByText('Fonds de garantie').first()).toBeVisible()
  // over 200 → submit disabled
  await page.locator('[data-test="gf-amount"]').fill('250')
  await page.locator('[data-test="gf-reason"]').fill('colis perdu')
  await expect(page.locator('[data-test="gf-submit"]')).toBeDisabled()
  // valid amount → enabled, submit
  await page.locator('[data-test="gf-amount"]').fill('150')
  await expect(page.locator('[data-test="gf-submit"]')).toBeEnabled()
  await page.locator('[data-test="gf-submit"]').click()
  await expect(page.locator('aside').getByText('Résolu', { exact: true })).toBeVisible()
})

test('admin switches to no-shows tab', async ({ page }) => {
  await page.goto('/incidents')
  await page.locator('[data-test="dispute-row-d1"]').waitFor({ state: 'visible' })
  await page.locator('[data-test="tab-noshows"]').click()
  await expect(page.locator('[data-test="noshow-row-c1"]')).toBeVisible({ timeout: 15000 })
  await expect(page.locator('[data-test="confirm-noshow-b9"]')).toBeVisible()
})
