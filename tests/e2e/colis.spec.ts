import { test, expect } from '@playwright/test'

const ADMIN = { id: 'a1', email: 'admin.1@yadony.com', role: 'ADMIN', status: 'ACTIVE', mustChangePassword: false, permissionOverrides: {} }
const BIDS_PAGE = { content: [
  { id: 'b1', status: 'COMPLETED', announcementId: 'a1', senderName: 'Jean', travelerName: 'Awa', corridor: 'Paris → Dakar', weightKg: 5, netEur: 30, paymentMethod: 'STRIPE', createdAt: '2026-06-01T10:00:00Z' },
], totalElements: 1, totalPages: 1, number: 0, size: 20 }
// Ancien back : uniquement les champs historiques de la fiche.
const BID_DETAIL = { ...BIDS_PAGE.content[0], contentCategory: 'Vêtements', recipientName: 'Fatou', trackingNumber: 'YADONY12345678', commissionRate: 0.12, refusalReason: null }
// Back « fiche colis » : trajet, personnes, argent, liens.
const BID_FULL = {
  ...BID_DETAIL, id: '1c1a0000-0000-4000-8000-0000000000b2', status: 'ACCEPTED', trackingNumber: 'DON-8ANH6EZR', description: 'Pagnes',
  trip: { announcementId: 'an1', status: 'ACTIVE', departureCity: 'Paris', arrivalCity: 'Dakar', departureCountryCode: 'FR', arrivalCountryCode: 'SN',
    departureDate: '2026-10-12', departureTime: '09:30:00', departureAt: null, arrivalDate: '2026-10-13', arrivalTime: null, timezone: 'Europe/Paris',
    pickupAddressLabel: 'Aéroport CDG', deliveryAddressLabel: null, transportMode: 'PLANE', totalKg: 23, availableKg: 15, reservedKg: 0,
    capacityUnit: 'KG', pricePerKg: 8, tripGroupId: null, tripLegIndex: null, handoverDeadline: null, otherBidsCount: 1 },
  sender: { id: 'u-s', name: 'Jean', username: 'jean', phoneMasked: '•••• 5678', status: 'ACTIVE', kycStatus: 'NOT_STARTED',
    stripeAccountStatus: null, stripeConnectUsable: null, mobileMoneyStatus: null, mobileMoneyUsable: null },
  traveler: { id: 'u-t', name: 'Awa', username: 'awa', phoneMasked: '•••• 1234', status: 'ACTIVE', kycStatus: 'VERIFIED',
    stripeAccountStatus: 'ONBOARDING_COMPLETE', stripeConnectUsable: true, mobileMoneyStatus: null, mobileMoneyUsable: false },
  recipient: { name: 'Fatou', phoneMasked: '•••• 1122' },
  money: { paymentId: 'p1', status: 'ESCROW', rail: 'STRIPE', amountCents: 3400, commissionCents: 400, refundedCents: 0, currency: 'EUR',
    capturedAt: '2026-10-06T19:00:00Z', escrowReleasedAt: null, payoutHeldAt: null, disputed: false },
  links: { negotiationThreadId: null, disputeId: null, disputeStatus: null, conversationId: 'fs-1', cancellationId: null },
  confirmationCodePresent: true, photoUrls: [], milestones: null,
}
const TIMELINE = { bidId: 'b1', entries: [
  { at: '2026-06-01T08:00:00Z', kind: 'SCAN', label: 'DEPART', detail: 'Paris CDG', photoUrl: null, gpsLat: 49.0, gpsLon: 2.5 },
  { at: '2026-06-02T08:00:00Z', kind: 'SCAN', label: 'ARRIVEE', detail: 'Dakar', photoUrl: null },
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
    if (url.includes('/1c1a0000-0000-4000-8000-0000000000b2/timeline')) {
      return route.fulfill({ json: { bidId: '1c1a0000-0000-4000-8000-0000000000b2', entries: [
        { at: '2026-10-06T18:53:36', kind: 'EVENT', label: 'CREATED_FROM_THREAD', source: 'AUDIT' },
        { at: '2026-10-06T18:54:01', kind: 'EVENT', label: 'PRESENCE_CONFIRMED', source: 'AUDIT', actorKind: 'USER', actorLabel: 'Awa' },
      ] } })
    }
    if (url.match(new RegExp('/bids/1c1a0000-0000-4000-8000-0000000000b2(\\?|$)'))) {
      return route.fulfill({ json: BID_FULL })
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
  await expect(page.locator('[data-test="bid-tracking"]')).toHaveText('YADONY12345678')
  await expect(page.locator('[data-test="timeline-entry"]')).toHaveCount(2)
  await expect(page.getByText('Scan de départ')).toBeVisible()
  // Ancien back : sections présentes, détail annoncé comme non disponible.
  await expect(page.locator('[data-test="bid-legacy"]')).toBeVisible()
  await expect(page.locator('[data-test="trip-unavailable"]')).toBeVisible()
})

test('fiche colis complète : trajet, personnes, argent, chronologie, actions', async ({ page }) => {
  await page.goto('/colis?open=1c1a0000-0000-4000-8000-0000000000b2')
  await expect(page.locator('[data-test="bid-tracking"]')).toHaveText('DON-8ANH6EZR')
  await expect(page.locator('[data-test="bid-phrase"]')).toHaveText('Accepté par le voyageur, en attente de la remise du colis.')
  await expect(page.locator('[data-test="trip-departure"]')).toHaveText('lundi 12 octobre 2026 à 09:30')
  await expect(page.locator('[data-test="party-traveler-stripe"]')).toContainText('Utilisable')
  await expect(page.locator('[data-test="money-status"]')).toHaveText('Sous séquestre')
  await expect(page.getByText('Présence confirmée par le voyageur')).toBeVisible()
  await expect(page.locator('[data-test="action-payment"]')).toBeVisible()
  // Rôle ADMIN (sans ADMIN_MANAGE) : gestes super-admin visibles mais désactivés, avec la raison.
  await expect(page.locator('[data-test="action-cancel"]')).toBeDisabled()
  await expect(page.locator('[data-test="cancel-disabled-reason"]')).toContainText('Réservé aux super-administrateurs')
  await page.locator('[data-test="trip-open-announcement"]').click()
  await expect(page.locator('[data-test="announcement-focus"]')).toBeVisible()
  await expect(page.locator('[data-test="ann-row-an1"]')).toBeVisible()
})

test('super-admin annule un colis : effet argent confirmé, fiche relue', async ({ page }) => {
  await page.addInitScript((u) => { (window as unknown as { __yadonyAuthSeed: typeof u }).__yadonyAuthSeed = u }, { ...ADMIN, role: 'SUPER_ADMIN' })
  const calls: unknown[] = []
  let cancelled = false
  await page.route('**/api/v1/admin/bids/1c1a0000-0000-4000-8000-0000000000b2**', (route) => {
    const req = route.request()
    if (req.method() === 'POST' && req.url().endsWith('/cancel')) {
      calls.push(req.postDataJSON())
      cancelled = true
      return route.fulfill({ json: { bidId: BID_FULL.id, status: 'CANCELLED', previousStatus: 'ACCEPTED', alreadyCancelled: false,
        refundRequested: true, paymentStatus: 'ESCROW', refundAmount: 34, currency: 'EUR', parcelWithTraveler: false } })
    }
    if (req.url().includes('/timeline')) return route.fulfill({ json: { bidId: BID_FULL.id, entries: [] } })
    return route.fulfill({ json: cancelled
      ? { ...BID_FULL, status: 'CANCELLED', money: { ...BID_FULL.money, status: 'REFUNDED', refundedCents: 3400 } }
      : BID_FULL })
  })
  await page.goto('/colis?open=1c1a0000-0000-4000-8000-0000000000b2')
  await page.locator('[data-test="action-cancel"]').click()
  await expect(page.locator('[data-test="cancel-money-effect"]')).toContainText('L’expéditeur sera remboursé de 34,00 EUR ; aucun versement au voyageur.')
  await page.locator('[data-test="cancel-reason"]').selectOption('SENDER_REQUEST')
  await expect(page.locator('[data-test="cancel-confirm"]')).toBeDisabled()
  await page.locator('[data-test="cancel-ack"]').check()
  await page.locator('[data-test="cancel-confirm"]').click()
  await expect(page.locator('[data-test="action-success"]')).toContainText('Remboursement de 34,00 EUR lancé')
  await expect(page.locator('[data-test="bid-status"]')).toHaveText('Annulé')
  await expect(page.locator('[data-test="cancel-disabled-reason"]')).toContainText('Colis déjà annulé.')
  expect(calls).toEqual([{ reason: 'SENDER_REQUEST', note: null }])
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
  // Motif catalogué obligatoire ; la note libre reste interne et ne part pas au voyageur.
  await page.locator('[data-test="reason-choice"]').selectOption('SUSPECTED_FRAUD')
  await page.locator('[data-test="reason"]').fill('signalé par un tiers, ticket #4821')
  await page.locator('[data-test="confirm"]').click()

  await expect(page.locator('[data-test="restore-an1"]')).toBeVisible()
  await expect.poll(() => removeCalls.length).toBe(1)
  expect(removeCalls[0]).toEqual({ publicReason: 'SUSPECTED_FRAUD', internalNote: 'signalé par un tiers, ticket #4821' })

  await page.locator('[data-test="restore-an1"]').click()
  await expect(page.locator('[data-test="remove-an1"]')).toBeVisible()
})

test('les annonces se paginent au-delà de 20', async ({ page }) => {
  const pages: string[] = []
  await page.route('**/api/v1/admin/announcements**', (route) => {
    const p = new URL(route.request().url()).searchParams.get('page') ?? ''
    pages.push(p)
    return route.fulfill({ json: { ...ANNS, totalElements: 30, totalPages: 2, number: Number(p) } })
  })
  await page.goto('/colis')
  await expect(page.locator('[data-test="bid-row-b1"]')).toBeVisible()
  await page.locator('[data-test="tab-announcements"]').click()
  await expect.poll(() => pages).toEqual(['0'])
  await page.locator('[data-test="next"]').click()
  await expect.poll(() => pages).toEqual(['0', '1'])
})
