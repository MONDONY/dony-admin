import { test, expect } from '@playwright/test'

const ADMIN = { id: 'a1', phoneNumber: '+33600000000', displayName: 'Admin Dony', isProAccount: false, roles: ['ADMIN'], avatarUrl: null }
const BIDS_PAGE = { content: [
  { id: 'b1', status: 'COMPLETED', announcementId: 'a1', senderName: 'Jean', travelerName: 'Awa', corridor: 'Paris → Dakar', weightKg: 5, netEur: 30, paymentMethod: 'STRIPE', createdAt: '2026-06-01T10:00:00Z' },
], totalElements: 1, totalPages: 1, number: 0, size: 20 }
const BID_DETAIL = { ...BIDS_PAGE.content[0], declaredValueEur: 100, contentCategory: 'Vêtements', recipientName: 'Fatou', trackingNumber: 'DONY12345678', commissionRate: 0.12, refusalReason: null }
const TIMELINE = { bidId: 'b1', entries: [
  { at: '2026-06-01T08:00:00Z', kind: 'SCAN', label: 'Scan départ', detail: 'Paris CDG', photoUrl: null, gpsLat: 49.0, gpsLon: 2.5 },
  { at: '2026-06-02T08:00:00Z', kind: 'SCAN', label: 'Scan arrivée', detail: 'Dakar', photoUrl: null },
] }
const ANNS = { content: [{ id: 'an1', status: 'ACTIVE', travelerName: 'Awa', corridor: 'Lyon → Abidjan', departureDate: '2026-07-01', availableKg: 10, pricePerKg: 8 }], totalElements: 1, totalPages: 1, number: 0, size: 20 }

test.beforeEach(async ({ page }) => {
  await page.addInitScript((u) => { (window as unknown as { __donyAuthSeed: typeof u }).__donyAuthSeed = u }, ADMIN)

  // Single consolidated handler for all /api/v1/admin/bids** requests.
  // Branches on URL to avoid multi-route ordering/precedence issues.
  await page.route('**/api/v1/admin/bids**', (route) => {
    const url = route.request().url()
    if (url.includes('/b1/timeline')) {
      return route.fulfill({ json: TIMELINE })
    }
    if (url.match(/\/bids\/b1(\?|$)/)) {
      return route.fulfill({ json: BID_DETAIL })
    }
    return route.fulfill({ json: BIDS_PAGE })
  })

  await page.route('**/api/v1/admin/announcements**', (r) => r.fulfill({ json: ANNS }))
})

test('admin sees the bids list', async ({ page }) => {
  await page.goto('/colis')
  await expect(page.locator('h1').first()).toContainText('Colis')
  await expect(page.locator('[data-test="bid-row-b1"]')).toContainText('Paris → Dakar')
})

test('admin opens a bid detail with transaction timeline', async ({ page }) => {
  await page.goto('/colis')
  await page.locator('[data-test="bid-row-b1"]').click()
  await expect(page.getByText('DONY12345678')).toBeVisible()
  await expect(page.locator('[data-test="timeline-entry"]')).toHaveCount(2)
  await expect(page.getByText('Scan départ')).toBeVisible()
})

test('admin switches to announcements tab', async ({ page }) => {
  await page.goto('/colis')
  await expect(page.locator('[data-test="bid-row-b1"]')).toBeVisible()
  await page.locator('[data-test="tab-announcements"]').click()
  await expect(page.locator('[data-test="ann-row-an1"]')).toContainText('Lyon → Abidjan')
})
