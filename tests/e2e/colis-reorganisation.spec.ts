import { test, expect, type Page } from '@playwright/test'

/**
 * Onglet Colis réorganisé : vues à nombres, alertes, recherche à suggestions, puces retirables,
 * tiroir à onglets (Résumé · Suivi · Argent · Échanges · Incidents), photos par étape et
 * visionneuse, onglet du tiroir dans l'URL, repli face à un ancien back. Les routes du back sont
 * simulées par un seul gestionnaire `/admin/bids**` qui lit le chemin, plus les messages de
 * conversation et les images (servies par une route `https://photos.test/**`).
 */

const ADMIN = { id: 'a1', email: 'admin.1@yadony.com', role: 'ADMIN', status: 'ACTIVE', mustChangePassword: false, permissionOverrides: {} }
const SUPPORT_NO_CHAT = { id: 's1', email: 'support@yadony.com', role: 'SUPPORT', status: 'ACTIVE', mustChangePassword: false, permissionOverrides: { MODERATION_VIEW: false } }

const B1 = '1c1a0000-0000-4000-8000-0000000000c1'
const B2 = '1c1a0000-0000-4000-8000-0000000000c2'
const B3 = '1c1a0000-0000-4000-8000-0000000000c3'
const SENDER = '5e5e0000-0000-4000-8000-0000000000a1'
const TRAVELER = '5e5e0000-0000-4000-8000-0000000000a2'
const TRIP = '2a2a0000-0000-4000-8000-0000000000a1'
const CONV = 'fs-conv-1'

const ROWS = [
  { id: B1, status: 'COMPLETED', announcementId: TRIP, senderName: 'Aïcha Diallo', travelerName: 'Moussa Keita', corridor: 'Paris → Dakar', weightKg: 5, netEur: 30,
    currency: 'EUR', paymentMethod: 'STRIPE', createdAt: '2026-10-01T10:00:00', trackingNumber: 'DON-AAAA1111', senderId: SENDER, travelerId: TRAVELER,
    recipientName: 'Fatou', departureDate: '2026-10-12', updatedAt: '2026-10-20T09:00:00', alert: 'DISPUTE_OPEN', contentCategory: 'Vêtements' },
  { id: B2, status: 'IN_TRANSIT', announcementId: TRIP, senderName: 'Jean Martin', travelerName: 'Moussa Keita', corridor: 'Paris → Dakar', weightKg: 2, netEur: 16,
    currency: 'EUR', paymentMethod: 'STRIPE', createdAt: '2026-10-02T10:00:00', trackingNumber: 'DON-BBBB2222', senderId: '5e5e0000-0000-4000-8000-0000000000a3',
    travelerId: TRAVELER, departureDate: '2026-10-12', updatedAt: '2026-10-19T09:00:00', alert: 'LATE', contentCategory: 'Documents' },
  { id: B3, status: 'COMPLETED', announcementId: TRIP, senderName: 'Jean Martin', travelerName: 'Moussa Keita', corridor: 'Paris → Dakar', weightKg: 1, netEur: 8,
    currency: 'EUR', paymentMethod: 'CASH', createdAt: '2026-09-02T10:00:00', trackingNumber: 'DON-CCCC3333', senderId: '5e5e0000-0000-4000-8000-0000000000a3',
    travelerId: TRAVELER, departureDate: '2026-09-12', updatedAt: '2026-09-19T09:00:00' },
]
const COUNTS = { todo: 2, active: 1, recent: 0, completed: 2, closed: 0, all: 3, alerts: { disputeOpen: 1, noShow: 0, paymentPending: 0, late: 1 } }
const SUGGEST = {
  senders: [{ id: SENDER, name: 'Aïcha Diallo', count: 1 }],
  recipients: [{ name: 'Aïcha Sow', count: 2 }],
  trips: [{ label: 'Paris → Dakar', departureCity: 'Paris', arrivalCity: 'Dakar', count: 3 }],
}
/** Seul B1 porte un litige ouvert (alerte, onglet Incidents) ; B2 reste annulable. */
const detailOf = (row: typeof ROWS[number]) => ({
  ...row, recipientName: row.recipientName ?? null, commissionRate: 0.12, refusalReason: null, description: 'Pagnes',
  trip: { announcementId: TRIP, status: 'ACTIVE', departureCity: 'Paris', arrivalCity: 'Dakar', departureCountryCode: 'FR', arrivalCountryCode: 'SN',
    departureDate: '2026-10-12', departureTime: '09:30:00', departureAt: null, arrivalDate: '2026-10-13', arrivalTime: null, timezone: 'Europe/Paris',
    pickupAddressLabel: null, deliveryAddressLabel: null, transportMode: 'PLANE', totalKg: 23, availableKg: 15, reservedKg: 0,
    capacityUnit: 'KG', pricePerKg: 8, tripGroupId: null, tripLegIndex: null, handoverDeadline: null, otherBidsCount: 2 },
  sender: { id: row.senderId, name: row.senderName, username: 'aicha', phoneMasked: '•••• 5678', status: 'ACTIVE', kycStatus: 'VERIFIED' },
  traveler: { id: TRAVELER, name: 'Moussa Keita', username: 'moussa', phoneMasked: '•••• 1234', status: 'ACTIVE', kycStatus: 'VERIFIED',
    stripeAccountStatus: 'ONBOARDING_COMPLETE', stripeConnectUsable: true, mobileMoneyUsable: false },
  recipient: { name: 'Fatou', phoneMasked: '•••• 1122' },
  money: { paymentId: '7a7a0000-0000-4000-8000-0000000000p1', status: 'ESCROW', rail: 'STRIPE', amountCents: 3400, commissionCents: 400, refundedCents: 0,
    currency: 'EUR', capturedAt: '2026-10-06T19:00:00Z' },
  links: row.id === B1 ? { disputeId: 'd1d10000-0000-4000-8000-0000000000d1', disputeStatus: 'OPEN', conversationId: CONV } : { conversationId: CONV },
  confirmationCodePresent: true, photoUrls: ['https://photos.test/legacy-created.jpg'],
  incidents: row.id === B1
    ? { disputes: [{ id: 'd1d10000-0000-4000-8000-0000000000d1', type: 'DAMAGED', status: 'OPEN', createdAt: '2026-10-18T10:00:00' }], cancellations: [] }
    : { disputes: [], cancellations: [] },
})
const TIMELINE = (id: string) => ({ bidId: id, entries: [
  { at: '2026-10-12T08:00:00', kind: 'SCAN', label: 'DEPART', detail: 'Paris CDG', photoUrl: 'https://photos.test/legacy-depart.jpg' },
  { at: '2026-10-13T08:00:00', kind: 'SCAN', label: 'ARRIVEE', detail: 'Dakar' },
] })
const PHOTOS = (v = 1, firstUrl?: string) => ({ bidId: B1, photos: [
  { id: 'c1', stage: 'CREATION', label: 'Création', at: '2026-10-01T10:00:00', url: firstUrl ?? `https://photos.test/c1.jpg?v=${v}` },
  { id: 'd1', stage: 'DEPART', label: 'Remise', at: '2026-10-12T08:00:00', url: `https://photos.test/d1.jpg?v=${v}`, gpsLabel: 'Roissy' },
  { id: 'd2', stage: 'DEPART', label: 'Remise', at: '2026-10-12T08:05:00', url: `https://photos.test/d2.jpg?v=${v}` },
  { id: 't1', stage: 'TRANSIT', label: 'Transit', at: '2026-10-12T15:00:00', url: `https://photos.test/t1.jpg?v=${v}` },
] })
const MESSAGES = [
  { id: 'm1', senderId: SENDER, senderName: 'Aïcha Diallo', content: 'Bonjour, le colis est prêt.', createdAt: '2026-10-11T09:00:00', deleted: false, deletedAt: null, type: 'TEXT', imageUrl: null, thumbUrl: null },
  { id: 'm2', senderId: TRAVELER, senderName: 'Moussa Keita', content: 'Parfait, à demain.', createdAt: '2026-10-11T09:05:00', deleted: false, deletedAt: null, type: 'TEXT', imageUrl: null, thumbUrl: null },
]
const ANNS = { content: [{ id: TRIP, status: 'ACTIVE', travelerName: 'Moussa Keita', corridor: 'Lyon → Abidjan', departureDate: '2026-07-01', availableKg: 10, pricePerKg: 8, currency: 'EUR' }], totalElements: 1, totalPages: 1, number: 0, size: 20 }
const PR_PAGE = { content: [{ id: '9e9e0000-0000-4000-8000-0000000000e1', status: 'OPEN', senderName: 'Awa', departureCity: 'Paris', arrivalCity: 'Bamako',
  weightKg: 3, currency: 'EUR', openNegotiationCount: 0, createdAt: '2026-10-10T10:00:00', reportCount: 0 }],
  totalElements: 1, totalPages: 1, number: 0, size: 20 }
const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')
const page1 = (content: unknown[]) => ({ content, totalElements: content.length, totalPages: 1, number: 0, size: 20 })
/** 404 sans `code` : un ancien back qui ne connaît pas l'endpoint. */
const MISSING = { status: 404, contentType: 'application/problem+json', json: { status: 404, title: 'Not Found' } }

interface Mocks { listUrls: URL[]; photoCalls: number; messageCalls: number }

/** Liste filtrée comme le ferait le back (vue, alerte, recherche à portée) ; un ancien back ignore vue et alerte. */
function filterRows(u: URL, legacy = false) {
  const view = legacy ? 'ALL' : (u.searchParams.get('view') ?? 'ALL')
  const alert = legacy ? null : u.searchParams.get('alert')
  const query = (u.searchParams.get('query') ?? '').toLowerCase()
  const scope = u.searchParams.get('scope') ?? 'ALL'
  return ROWS.filter((r) => {
    if (view === 'TODO' && !r.alert) return false
    if (view === 'ACTIVE' && r.status !== 'IN_TRANSIT') return false
    if (view === 'COMPLETED' && r.status !== 'COMPLETED') return false
    if (view === 'RECENT' || view === 'CLOSED') return false
    if (alert && r.alert !== alert) return false
    if (!query) return true
    const fields = scope === 'SENDER' ? [r.senderName] : [r.senderName, r.travelerName, r.trackingNumber, r.corridor, r.recipientName ?? '']
    return fields.some(f => f.toLowerCase().includes(query))
  })
}

async function setup(page: Page, opts: { user?: typeof ADMIN; legacy?: boolean; expiredFirstPhoto?: boolean } = {}): Promise<Mocks> {
  const m: Mocks = { listUrls: [], photoCalls: 0, messageCalls: 0 }
  await page.addInitScript((u) => { (window as unknown as { __yadonyAuthSeed: typeof u }).__yadonyAuthSeed = u }, opts.user ?? ADMIN)
  await page.route('**/api/v1/admin/bids**', (route) => {
    const u = new URL(route.request().url())
    const path = u.pathname.replace(/^.*\/admin\/bids/, '')
    if (path === '' || path === '/') {
      m.listUrls.push(u)
      return route.fulfill({ json: page1(filterRows(u, opts.legacy)) })
    }
    if (path === '/counts') return route.fulfill(opts.legacy ? MISSING : { json: COUNTS })
    if (path === '/suggest') {
      if (opts.legacy) return route.fulfill(MISSING)
      const q = (u.searchParams.get('q') ?? '').toLowerCase()
      const parcels = ROWS.filter(r => r.trackingNumber.toLowerCase().startsWith(q)).map(r => ({ bidId: r.id, trackingNumber: r.trackingNumber, status: r.status, content: r.contentCategory }))
      return route.fulfill({ json: q.startsWith('don') ? { parcels } : SUGGEST })
    }
    const [, id, sub] = path.split('/')
    const row = ROWS.find(r => r.id === id)
    if (!row) return route.fulfill({ status: 404, contentType: 'application/problem+json', json: { status: 404, code: 'bid-not-found', detail: 'Colis introuvable' } })
    if (sub === 'timeline') return route.fulfill({ json: TIMELINE(row.id) })
    if (sub === 'photos') {
      if (opts.legacy) return route.fulfill(MISSING)
      m.photoCalls++
      // Première réponse : URL présignée déjà expirée ; la relecture donne des URL neuves.
      const expired = opts.expiredFirstPhoto && m.photoCalls === 1
      return route.fulfill({ json: PHOTOS(m.photoCalls, expired ? 'https://photos.test/expired-c1.jpg' : undefined) })
    }
    const legacyDetail = { ...row, commissionRate: 0.12, refusalReason: null, photoUrls: ['https://photos.test/legacy-created.jpg'] }
    return route.fulfill({ json: opts.legacy ? legacyDetail : detailOf(row) })
  })
  await page.route('**/api/v1/admin/conversations/**', (route) => {
    m.messageCalls++
    return route.fulfill({ json: MESSAGES })
  })
  await page.route('**/api/v1/admin/announcements**', r => r.fulfill({ json: ANNS }))
  await page.route('**/api/v1/admin/package-requests**', r => r.fulfill({ json: PR_PAGE }))
  await page.route('https://photos.test/**', (route) => {
    if (route.request().url().includes('expired')) return route.fulfill({ status: 403, body: 'expired' })
    return route.fulfill({ status: 200, contentType: 'image/png', body: PNG_1X1 })
  })
  return m
}

const lastList = (m: Mocks) => m.listUrls[m.listUrls.length - 1]!
const row = (page: Page, id: string) => page.locator(`[data-test="bid-row-${id}"]`)

async function openB1(page: Page) {
  await page.goto('/colis')
  await expect(row(page, B1)).toBeVisible()
  await row(page, B1).locator('td').first().click()
  await expect(page.locator('[data-test="bid-detail"]')).toBeVisible()
}

test('landsOnTodoView_withCounts', async ({ page }) => {
  const m = await setup(page)
  await page.goto('/colis')
  await expect(page.locator('[data-test="bid-view-TODO"]')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('[data-test="bid-view-TODO"] [data-test="tab-count"]')).toHaveText('2')
  await expect(page.locator('[data-test="bid-view-ALL"] [data-test="tab-count"]')).toHaveText('3')
  await expect(page.locator('[data-test="bid-view-ACTIVE"] [data-test="tab-count"]')).toHaveText('1')
  await expect(row(page, B1)).toBeVisible()
  await expect(row(page, B2)).toBeVisible()
  await expect(row(page, B3)).toHaveCount(0)
  expect(lastList(m).searchParams.get('view')).toBe('TODO')
})

test('switchView_changesListAndUrl', async ({ page }) => {
  const m = await setup(page)
  await page.goto('/colis')
  await expect(row(page, B1)).toBeVisible()
  await page.locator('[data-test="bid-view-ACTIVE"]').click()
  await expect(row(page, B1)).toHaveCount(0)
  await expect(row(page, B2)).toBeVisible()
  await expect(page).toHaveURL(/[?&]view=ACTIVE/)
  expect(lastList(m).searchParams.get('view')).toBe('ACTIVE')
  await page.locator('[data-test="bid-view-ALL"]').click()
  await expect(row(page, B3)).toBeVisible()
  await expect(page).toHaveURL(/[?&]view=ALL/)
})

test('alertPill_filtersList', async ({ page }) => {
  const m = await setup(page)
  await page.goto('/colis')
  await expect(page.locator('[data-test="alert-pill-LATE"]')).toContainText('1')
  await page.locator('[data-test="alert-pill-LATE"]').click()
  await expect(page.locator('[data-test="alert-pill-LATE"]')).toHaveAttribute('aria-pressed', 'true')
  await expect(row(page, B1)).toHaveCount(0)
  await expect(row(page, B2)).toBeVisible()
  expect(lastList(m).searchParams.get('alert')).toBe('LATE')
  await expect(page).toHaveURL(/[?&]alert=LATE/)
})

test('searchTyping_showsGroupedSuggestions', async ({ page }) => {
  await setup(page)
  await page.goto('/colis')
  await expect(row(page, B1)).toBeVisible()
  await page.locator('[data-test="search"]').fill('aïcha')
  const list = page.getByRole('listbox', { name: 'Suggestions' })
  await expect(list).toBeVisible()
  await expect(list.getByRole('group', { name: 'Expéditeurs' })).toContainText('Aïcha Diallo')
  await expect(list.getByRole('group', { name: 'Destinataires' })).toContainText('Aïcha Sow')
  await expect(list.getByRole('group', { name: 'Trajets' })).toContainText('Paris → Dakar')
  await expect(page.locator('[data-test="suggestion-sender-0"]')).toContainText('1 colis')
})

test('pickSender_addsRemovableChip', async ({ page }) => {
  const m = await setup(page)
  await page.goto('/colis')
  await page.locator('[data-test="bid-view-ALL"]').click()
  await expect(row(page, B3)).toBeVisible()
  await page.locator('[data-test="search"]').fill('aïcha')
  await page.locator('[data-test="suggestion-sender-0"]').click()
  await expect(page.locator('[data-test="active-chip-search"]')).toContainText('Aïcha Diallo')
  await expect(page.locator('[data-test="active-chip-search-remove"]')).toBeVisible()
  await expect(row(page, B1)).toBeVisible()
  await expect(row(page, B3)).toHaveCount(0)
  expect(lastList(m).searchParams.get('scope')).toBe('SENDER')
  expect(lastList(m).searchParams.get('query')).toBe('Aïcha Diallo')
})

test('removeChip_restoresList', async ({ page }) => {
  const m = await setup(page)
  await page.goto('/colis?view=ALL&scope=SENDER&query=A%C3%AFcha')
  await expect(row(page, B1)).toBeVisible()
  await expect(page.locator('[data-test="active-chip-search"]')).toBeVisible()
  await expect(row(page, B3)).toHaveCount(0)
  await page.locator('[data-test="active-chip-search-remove"]').click()
  await expect(page.locator('[data-test="active-chip-search"]')).toHaveCount(0)
  await expect(row(page, B3)).toBeVisible()
  expect(lastList(m).searchParams.get('query')).toBeNull()
  await expect(page).not.toHaveURL(/query=/)
})

test('exactTracking_opensDrawer', async ({ page }) => {
  await setup(page)
  await page.goto('/colis')
  await expect(row(page, B1)).toBeVisible()
  await page.locator('[data-test="search"]').fill('DON-BBBB2222')
  await expect(page.locator('[data-test="suggestion-parcel-0"]')).toContainText('DON-BBBB2222')
  await page.locator('[data-test="search"]').press('Enter')
  await expect(page.locator('[data-test="bid-detail"]')).toBeVisible()
  await expect(page.locator('[data-test="bid-tracking"]')).toHaveText('DON-BBBB2222')
  await expect(page).toHaveURL(new RegExp(`open=${B2}`))
})

test('rowClick_opensDrawerWithTabs', async ({ page }) => {
  await setup(page)
  await openB1(page)
  await expect(page).toHaveURL(new RegExp(`open=${B1}`))
  for (const t of ['summary', 'tracking', 'money', 'chat', 'incidents']) {
    await expect(page.locator(`[data-test="bid-tab-${t}"]`)).toBeVisible()
  }
  await expect(page.locator('[data-test="bid-panel-summary"]')).toBeVisible()
  await expect(page.locator('[data-test="bid-tab-incidents"] [data-test="tab-count"]')).toHaveText('1')
})

test('personLink_goesToUsersId_withoutOpeningDrawer', async ({ page }) => {
  await setup(page)
  await page.goto('/colis')
  await expect(row(page, B1)).toBeVisible()
  await row(page, B1).getByRole('link', { name: 'Aïcha Diallo' }).click()
  await expect(page).toHaveURL(new RegExp(`/users/${SENDER}$`))
  expect(page.url()).not.toContain('open=')
  await expect(page.locator('[data-test="bid-detail"]')).toHaveCount(0)
})

test('tabs_summaryTrackingMoneyIncidents', async ({ page }) => {
  await setup(page)
  await openB1(page)
  await expect(page.locator('[data-test="trip-departure"]')).toHaveText('lundi 12 octobre 2026 à 09:30')
  await page.locator('[data-test="bid-tab-tracking"]').click()
  await expect(page.locator('[data-test="bid-tracking-tab"]')).toBeVisible()
  await expect(page.locator('[data-test="timeline-entry"]')).toHaveCount(2)
  await expect(page).toHaveURL(/[?&]section=tracking/)
  await page.locator('[data-test="bid-tab-money"]').click()
  await expect(page.locator('[data-test="money-status"]')).toHaveText('Sous séquestre')
  await expect(page).toHaveURL(/[?&]section=money/)
  await page.locator('[data-test="bid-tab-incidents"]').click()
  await expect(page.locator('[data-test="incident-dispute"]')).toHaveCount(1)
  await expect(page.locator('[data-test="incident-dispute-link-d1d10000-0000-4000-8000-0000000000d1"]')).toHaveAttribute('href', /\/incidents\?open=d1d10000-0000-4000-8000-0000000000d1$/)
  await page.locator('[data-test="bid-tab-summary"]').click()
  await expect(page.locator('[data-test="bid-panel-summary"]')).toBeVisible()
  await expect(page).not.toHaveURL(/section=/)
})

test('sectionParam_opensTab', async ({ page }) => {
  await setup(page)
  await page.goto(`/colis?open=${B1}&section=money`)
  await expect(page.locator('[data-test="bid-panel-money"]')).toBeVisible()
  await expect(page.locator('[data-test="money-status"]')).toHaveText('Sous séquestre')
  // Valeur inconnue : Résumé.
  await page.goto(`/colis?open=${B1}&section=pirate`)
  await expect(page.locator('[data-test="bid-panel-summary"]')).toBeVisible()
})

test('photosGallery_groupsByStage', async ({ page }) => {
  await setup(page)
  await page.goto(`/colis?open=${B1}&section=tracking`)
  const stages = page.locator('[data-test^="photos-stage-"]')
  await expect(stages).toHaveCount(4)
  await expect(page.locator('[data-test="photos-stage-DEPART"]')).toContainText('Remise du colis')
  await expect(page.locator('[data-test="photos-stage-DEPART"]')).toContainText('2 photos')
  await expect(page.locator('[data-test="photos-stage-DEPART"]')).toContainText('Roissy')
  await expect(page.locator('[data-test="photo-DEPART-1"] img')).toHaveAttribute('src', 'https://photos.test/d2.jpg?v=1')
  await expect(page.locator('[data-test="photos-empty-ARRIVEE"]')).toBeVisible()
})

test('photoViewer_keyboardZoomNavEscape', async ({ page }) => {
  await setup(page)
  await page.goto(`/colis?open=${B1}&section=tracking`)
  await page.locator('[data-test="photo-DEPART-0"]').click()
  const viewer = page.locator('[data-test="photo-viewer"]')
  await expect(viewer).toBeVisible()
  await expect(page.locator('[data-test="photo-position"]')).toHaveText('2 sur 4')
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('[data-test="photo-position"]')).toHaveText('3 sur 4')
  await expect(page.locator('[data-test="photo-main"]')).toHaveAttribute('src', 'https://photos.test/d2.jpg?v=1')
  await page.keyboard.press('ArrowLeft')
  await expect(page.locator('[data-test="photo-position"]')).toHaveText('2 sur 4')
  await page.keyboard.press('+')
  await expect(page.locator('[data-test="photo-zoom-level"]')).toHaveText('125 %')
  await page.keyboard.press('-')
  await page.keyboard.press('-')
  await expect(page.locator('[data-test="photo-zoom-level"]')).toHaveText('75 %')
  // Échap ferme d'abord la visionneuse, le tiroir reste ; un second Échap ferme le tiroir.
  await page.keyboard.press('Escape')
  await expect(viewer).toHaveCount(0)
  await expect(page.locator('[data-test="bid-detail"]')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-test="bid-detail"]')).toHaveCount(0)
  await expect(page).not.toHaveURL(/open=/)
})

test('photoViewer_expiredPhoto_reload', async ({ page }) => {
  const m = await setup(page, { expiredFirstPhoto: true })
  await page.goto(`/colis?open=${B1}&section=tracking`)
  await expect(page.locator('[data-test="photo-CREATION-0"]')).toContainText('Photo indisponible')
  await page.locator('[data-test="photo-CREATION-0"]').click()
  await expect(page.locator('[data-test="photo-error"]')).toBeVisible()
  await page.locator('[data-test="photo-reload"]').click()
  await expect.poll(() => m.photoCalls).toBe(2)
  await expect(page.locator('[data-test="photo-error"]')).toHaveCount(0)
  await expect(page.locator('[data-test="photo-main"]')).toHaveAttribute('src', 'https://photos.test/c1.jpg?v=2')
})

test('chatTab_loadsMessages', async ({ page }) => {
  const m = await setup(page)
  await openB1(page)
  expect(m.messageCalls).toBe(0)
  await page.locator('[data-test="bid-tab-chat"]').click()
  await expect(page.locator('[data-test="chat-message-m1"]')).toContainText('Bonjour, le colis est prêt.')
  await expect(page.locator('[data-test="chat-message-m2"]')).toContainText('Moussa Keita')
  await expect(page.locator('[data-test="bid-tab-chat"] [data-test="tab-count"]')).toHaveText('2')
  await expect(page.locator('[data-test="chat-open-moderation"]')).toHaveAttribute('href', new RegExp(`/moderation\\?open=${CONV}$`))
  await expect(page).toHaveURL(/[?&]section=chat/)
})

test('actionsMenu_cancelAndDisputeStillAvailable', async ({ page }) => {
  await setup(page, { user: { ...ADMIN, role: 'SUPER_ADMIN' } })
  await page.goto(`/colis?open=${B2}`)
  await page.locator('[data-test="bid-actions-menu"]').click()
  await expect(page.locator('[data-test="action-payment"]')).toBeVisible()
  await expect(page.locator('[data-test="action-cancel"]')).toBeVisible()
  await expect(page.locator('[data-test="action-cancel"]')).not.toHaveAttribute('aria-disabled', 'true')
  await expect(page.locator('[data-test="action-open-dispute"]')).toBeVisible()
  await page.locator('[data-test="action-cancel"]').click()
  await expect(page.locator('[data-test="cancel-dialog"]')).toBeVisible()
  await page.locator('[data-test="cancel-dismiss"]').click()
  await expect(page.locator('[data-test="cancel-dialog"]')).toHaveCount(0)
  await page.locator('[data-test="bid-actions-menu"]').click()
  await page.locator('[data-test="action-open-dispute"]').click()
  await expect(page.locator('[data-test="dispute-dialog"]')).toBeVisible()
})

test('legacyBackend_countsSuggestPhotos404_stillUsable', async ({ page }) => {
  const m = await setup(page, { legacy: true })
  await page.goto('/colis')
  // Pas de vues ni d'alertes, l'ancienne liste complète.
  await expect(row(page, B3)).toBeVisible()
  await expect(page.locator('[data-test^="bid-view-"]')).toHaveCount(0)
  await expect(page.locator('[data-test^="alert-pill-"]')).toHaveCount(0)
  await expect(page.locator('[data-test="filter-status"]')).toBeVisible()
  // Recherche à Entrée, sans suggestions.
  await page.locator('[data-test="search"]').fill('jean')
  await page.waitForTimeout(400)
  await expect(page.getByRole('listbox', { name: 'Suggestions' })).toHaveCount(0)
  await page.locator('[data-test="search"]').press('Enter')
  await expect(row(page, B1)).toHaveCount(0)
  await expect(row(page, B2)).toBeVisible()
  expect(lastList(m).searchParams.get('query')).toBe('jean')
  expect(lastList(m).searchParams.get('view')).toBeNull()
  // Photos du détail : celles de la fiche et de la chronologie.
  await row(page, B2).locator('td').first().click()
  await page.locator('[data-test="bid-tab-tracking"]').click()
  await expect(page.locator('[data-test="photo-CREATION-0"] img')).toHaveAttribute('src', 'https://photos.test/legacy-created.jpg')
  await expect(page.locator('[data-test="photo-DEPART-0"] img')).toHaveAttribute('src', 'https://photos.test/legacy-depart.jpg')
})

test('deepLink_announcementId_showsAllView', async ({ page }) => {
  const m = await setup(page)
  await page.goto(`/colis?announcementId=${TRIP}`)
  await expect(page.locator('[data-test="trip-filter"]')).toBeVisible()
  await expect(page.locator('[data-test="bid-view-ALL"]')).toHaveAttribute('aria-pressed', 'true')
  await expect(row(page, B3)).toBeVisible()
  expect(lastList(m).searchParams.get('announcementId')).toBe(TRIP)
  expect(lastList(m).searchParams.get('view')).toBeNull()
})

test('deepLink_openId_opensDrawer', async ({ page }) => {
  await setup(page)
  await page.goto(`/colis?open=${B2}`)
  await expect(page.locator('[data-test="bid-detail"]')).toBeVisible()
  await expect(page.locator('[data-test="bid-tracking"]')).toHaveText('DON-BBBB2222')
  await expect(page.locator('[data-test="bid-panel-summary"]')).toBeVisible()
  // La liste derrière garde sa vue par défaut.
  await expect(page.locator('[data-test="bid-view-TODO"]')).toHaveAttribute('aria-pressed', 'true')
})

test('supportRole_noChatTabWithoutModerationView', async ({ page }) => {
  await setup(page, { user: SUPPORT_NO_CHAT })
  await page.goto(`/colis?open=${B1}&section=chat`)
  await expect(page.locator('[data-test="bid-detail"]')).toBeVisible()
  await expect(page.locator('[data-test="bid-tab-incidents"]')).toBeVisible()
  await expect(page.locator('[data-test="bid-tab-chat"]')).toHaveCount(0)
  // Le lien ?section=chat retombe sur Résumé, rien de la conversation n'est montré.
  await expect(page.locator('[data-test="bid-panel-summary"]')).toBeVisible()
  await expect(page.locator('[data-test="bid-chat-tab"]')).toHaveCount(0)
})

test('announcementsAndDemandesTabs_untouched', async ({ page }) => {
  await setup(page)
  await page.goto('/colis')
  await expect(row(page, B1)).toBeVisible()
  await page.locator('[data-test="tab-announcements"]').click()
  await expect(page.locator(`[data-test="ann-row-${TRIP}"]`)).toContainText('Lyon → Abidjan')
  await expect(page).toHaveURL(/[?&]tab=announcements/)
  await expect(page.locator('[data-test^="bid-view-"]')).toHaveCount(0)
  await page.locator('[data-test="tab-demandes"]').click()
  await expect(page).toHaveURL(/[?&]tab=demandes/)
  await expect(page.locator('[data-test="pr-row-9e9e0000-0000-4000-8000-0000000000e1"]')).toContainText('Paris → Bamako')
  await page.locator('[data-test="tab-bids"]').click()
  await expect(row(page, B1)).toBeVisible()
})
