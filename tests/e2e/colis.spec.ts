import { test, expect } from '@playwright/test'

const ADMIN = { id: 'a1', email: 'admin.1@yadony.com', role: 'ADMIN', status: 'ACTIVE', mustChangePassword: false, permissionOverrides: {} }
const BIDS_PAGE = { content: [
  { id: 'b1', status: 'COMPLETED', announcementId: 'a1', senderName: 'Jean', travelerName: 'Awa', corridor: 'Paris → Dakar', weightKg: 5, netEur: 30, paymentMethod: 'STRIPE', createdAt: '2026-06-01T10:00:00Z' },
], totalElements: 1, totalPages: 1, number: 0, size: 20 }
const BID_DETAIL = { ...BIDS_PAGE.content[0], declaredValueEur: 100, contentCategory: 'Vêtements', recipientName: 'Fatou', trackingNumber: 'YADONY12345678', commissionRate: 0.12, refusalReason: null }
const TIMELINE = { bidId: 'b1', entries: [
  { at: '2026-06-01T08:00:00Z', kind: 'SCAN', label: 'Scan départ', detail: 'Paris CDG', photoUrl: null, gpsLat: 49.0, gpsLon: 2.5 },
  { at: '2026-06-02T08:00:00Z', kind: 'SCAN', label: 'Scan arrivée', detail: 'Dakar', photoUrl: null },
] }
const ANNS = { content: [{ id: 'an1', status: 'ACTIVE', travelerName: 'Awa', corridor: 'Lyon → Abidjan', departureDate: '2026-07-01', availableKg: 10, pricePerKg: 8 }], totalElements: 1, totalPages: 1, number: 0, size: 20 }

test.beforeEach(async ({ page }) => {
  await page.addInitScript((u) => { (window as unknown as { __yadonyAuthSeed: typeof u }).__yadonyAuthSeed = u }, ADMIN)

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
  await expect(page.getByText('YADONY12345678')).toBeVisible()
  await expect(page.locator('[data-test="timeline-entry"]')).toHaveCount(2)
  await expect(page.getByText('Scan départ')).toBeVisible()
})

test('admin switches to announcements tab', async ({ page }) => {
  await page.goto('/colis')
  await expect(page.locator('[data-test="bid-row-b1"]')).toBeVisible()
  await page.locator('[data-test="tab-announcements"]').click()
  await expect(page.locator('[data-test="ann-row-an1"]')).toContainText('Lyon → Abidjan')
})

test('admin retire une annonce avec un motif puis la restaure', async ({ page }) => {
  const removeCalls: { reason: string }[] = []
  const ANN_REMOVED = { ...ANNS.content[0], status: 'REMOVED_BY_ADMIN' as const }

  // Route dédiée à ce test : /an1/remove et /an1/restore ne partagent pas de
  // préfixe ambigu entre eux, mais doivent être branchées avant le catch-all
  // générique (GET liste) déjà enregistré dans le beforeEach.
  await page.route('**/api/v1/admin/announcements**', (route) => {
    const req = route.request()
    const url = req.url()
    const method = req.method()

    if (method === 'POST' && url.includes('/an1/restore')) {
      return route.fulfill({ json: ANNS.content[0] })
    }
    if (method === 'POST' && url.includes('/an1/remove')) {
      removeCalls.push(req.postDataJSON() as { reason: string })
      return route.fulfill({ json: ANN_REMOVED })
    }
    return route.fulfill({ json: ANNS })
  })

  await page.goto('/colis')
  // Attendre que la première liste soit rendue avant de changer d'onglet : sans ce
  // point d'ancrage, le clic part avant l'hydratation et l'onglet ne bascule pas.
  await expect(page.locator('[data-test="bid-row-b1"]')).toBeVisible()
  await page.locator('[data-test="tab-announcements"]').click()
  await expect(page.locator('[data-test="ann-row-an1"]')).toBeVisible()

  await page.locator('[data-test="remove-an1"]').click()
  await page.locator('[data-test="reason"]').fill('annonce frauduleuse')
  await page.locator('[data-test="confirm"]').click()

  await expect(page.locator('[data-test="restore-an1"]')).toBeVisible()
  await expect.poll(() => removeCalls.length).toBe(1)
  expect(removeCalls[0]).toEqual({ reason: 'annonce frauduleuse' })

  await page.locator('[data-test="restore-an1"]').click()
  await expect(page.locator('[data-test="remove-an1"]')).toBeVisible()
})
