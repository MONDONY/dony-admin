import { test, expect, type Page } from '@playwright/test'

const ADMIN = { id: 'a1', email: 'admin.1@yadony.com', role: 'ADMIN', status: 'ACTIVE', mustChangePassword: false, permissionOverrides: {} }
const EMPTY = { content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 }

const ROW = {
  id: 'pr1', senderId: 's1', senderName: 'Awa Ndiaye', departureCity: 'Paris', arrivalCity: 'Dakar',
  desiredDate: '2026-10-01', weightKg: 4, parcelSize: 'SMALL', transportMode: 'PLANE', status: 'NEGOTIATING',
  currency: 'EUR', targetPrice: 40, createdAt: '2026-09-20T10:00:00Z', reportCount: 2, openNegotiationCount: 2,
}
const DETAIL = {
  ...ROW, dateToleranceDays: 2, recipientCity: 'Rufisque', description: 'Deux paires de chaussures', contentCategory: 'Vêtements',
  pickupNeighborhood: 'Belleville', deliveryNeighborhood: 'Plateau', pickupAddressLabel: null, deliveryAddressLabel: null,
  acceptedPaymentMethods: ['STRIPE'], negotiable: true, statusBeforeRemoval: null,
  photos: [{ url: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' }],
  negotiations: [{ id: 'n1', travelerId: 't1', travelerName: 'Karim', status: 'OPEN', lastPrice: 35, currency: 'EUR', updatedAt: '2026-09-21T10:00:00Z' }],
  reports: [{ id: 'r1', reporterId: 'u2', reporterName: 'Moussa', reason: 'SCAM_ATTEMPT', details: 'prix louche', status: 'OPEN', createdAt: '2026-09-22T09:00:00Z' }],
  canRemove: true, removeBlockedReason: null, canRestore: false,
}
const REMOVED = { ...DETAIL, status: 'REMOVED_BY_ADMIN', statusBeforeRemoval: 'NEGOTIATING', openNegotiationCount: 0, canRemove: false, removeBlockedReason: 'package-request-already-removed', canRestore: true }
const RESTORED = { ...DETAIL, status: 'OPEN', openNegotiationCount: 0 }

async function mockBase(page: Page) {
  await page.addInitScript((u) => { (window as unknown as { __yadonyAuthSeed: typeof u }).__yadonyAuthSeed = u }, ADMIN)
  await page.route('**/api/v1/admin/bids**', (r) => r.fulfill({ json: EMPTY }))
  await page.route('**/api/v1/admin/announcements**', (r) => r.fulfill({ json: EMPTY }))
}

/** Faux back des demandes d'envoi : `state` porte la fiche courante, modifiée par les POST. */
async function mockRequests(page: Page, opts: { removeStatus?: number; removeBody?: unknown } = {}) {
  const state = { detail: DETAIL as typeof DETAIL | typeof REMOVED | typeof RESTORED, removeBodies: [] as unknown[] }
  await page.route('**/api/v1/admin/package-requests**', (route) => {
    const req = route.request()
    const url = new URL(req.url())
    if (req.method() === 'POST' && url.pathname.endsWith('/pr1/remove')) {
      state.removeBodies.push(req.postDataJSON())
      if (opts.removeStatus) {
        return route.fulfill({ status: opts.removeStatus, contentType: 'application/problem+json', body: JSON.stringify(opts.removeBody) })
      }
      state.detail = REMOVED
      return route.fulfill({ json: REMOVED })
    }
    if (req.method() === 'POST' && url.pathname.endsWith('/pr1/restore')) {
      state.detail = RESTORED
      return route.fulfill({ json: RESTORED })
    }
    if (url.pathname.endsWith('/package-requests/pr1')) return route.fulfill({ json: state.detail })
    const { id, senderId, senderName, departureCity, arrivalCity, desiredDate, weightKg, parcelSize, transportMode,
      status, currency, targetPrice, createdAt, reportCount, openNegotiationCount } = state.detail
    return route.fulfill({ json: { content: [{ id, senderId, senderName, departureCity, arrivalCity, desiredDate, weightKg,
      parcelSize, transportMode, status, currency, targetPrice, createdAt, reportCount, openNegotiationCount }],
    totalElements: 1, totalPages: 1, number: 0, size: 20 } })
  })
  return state
}

test.beforeEach(async ({ page }) => { await mockBase(page) })

test('liste des demandes, fiche puis retrait avec motif public et note interne', async ({ page }) => {
  const state = await mockRequests(page)
  await page.goto('/colis')
  await expect(page.locator('[data-test="tab-demandes"]')).toBeVisible()
  await page.locator('[data-test="tab-demandes"]').click()
  await expect(page).toHaveURL(/tab=demandes/)

  const row = page.locator('[data-test="pr-row-pr1"]')
  await expect(row).toContainText('Paris → Dakar')
  await expect(page.locator('[data-test="pr-reports-pr1"]')).toHaveText('2 signalements')

  await row.click()
  await expect(page).toHaveURL(/open=pr1/)
  const panel = page.locator('[data-test="pr-detail"]')
  await expect(panel).toContainText('Deux paires de chaussures')
  await expect(page.locator('[data-test="pr-negotiation-n1"]')).toContainText('Karim')
  await expect(page.locator('[data-test="pr-report-r1"]')).toContainText('Tentative d’arnaque')
  await expect(page.locator('[data-test="pr-report-status-r1"]')).toHaveText('Ouvert')
  await expect(page.locator('[data-test="pr-budget"]')).toContainText('40,00')
  await expect(page.locator('[data-test="pr-date-tolerance"]')).toHaveText('± 2 jours')

  await page.locator('[data-test="pr-photo-0"]').click()
  await expect(page.locator('[data-test="photo-viewer"]')).toBeVisible()
  await page.locator('[data-test="photo-viewer-close"]').click()

  await page.locator('[data-test="pr-remove"]').click()
  await expect(page.locator('[data-test="overlay"]')).toContainText('Seul le motif public est envoyé à l’expéditeur')
  await expect(page.locator('[data-test="overlay"]')).toContainText('Les 2 négociations ouvertes seront annulées')
  await page.locator('[data-test="reason-choice"]').selectOption('DUPLICATE')
  await page.locator('[data-test="reason"]').fill('doublon signalé par Moussa')
  await page.locator('[data-test="confirm"]').click()

  await expect(page.locator('[data-test="pr-restore"]')).toBeVisible()
  await expect(row).toContainText('Retirée')
  expect(state.removeBodies).toEqual([{ publicReason: 'DUPLICATE', internalNote: 'doublon signalé par Moussa' }])
})

test('409 envoi en cours : le message du back et le lien vers les litiges', async ({ page }) => {
  await mockRequests(page, {
    removeStatus: 409,
    removeBody: {
      type: 'about:blank', title: 'Conflict', status: 409, code: 'package-request-has-active-shipment',
      detail: 'Un envoi est en cours sur cette demande : traitez-le depuis les litiges.',
    },
  })
  await page.goto('/colis?tab=demandes&open=pr1')
  await expect(page.locator('[data-test="pr-detail"]')).toBeVisible()
  await page.locator('[data-test="pr-remove"]').click()
  await page.locator('[data-test="reason-choice"]').selectOption('OTHER')
  await page.locator('[data-test="confirm"]').click()
  const err = page.locator('[data-test="pr-action-error"]')
  await expect(err).toContainText('Un envoi est en cours sur cette demande : traitez-le depuis les litiges.')
  await expect(page.locator('[data-test="pr-error-disputes-link"]')).toHaveAttribute('href', /\/incidents$/)
  await expect(page.locator('[data-test="pr-row-pr1"]')).toContainText('En négociation')
})

test('retrait bloqué par le back : bouton désactivé avec son explication', async ({ page }) => {
  await page.route('**/api/v1/admin/package-requests**', (route) => {
    if (new URL(route.request().url()).pathname.endsWith('/pr1')) {
      return route.fulfill({ json: { ...DETAIL, canRemove: false, removeBlockedReason: 'package-request-has-active-shipment' } })
    }
    return route.fulfill({ json: { content: [ROW], totalElements: 1, totalPages: 1, number: 0, size: 20 } })
  })
  await page.goto('/colis?tab=demandes&open=pr1')
  await expect(page.locator('[data-test="pr-remove"]')).toBeDisabled()
  await expect(page.locator('[data-test="pr-remove-blocked"]')).toContainText('Un envoi est en cours')
  await expect(page.locator('[data-test="pr-disputes-link"]')).toBeVisible()
})

test('fiche introuvable (404 package-request-not-found) : message du back', async ({ page }) => {
  await page.route('**/api/v1/admin/package-requests**', (route) => {
    if (new URL(route.request().url()).pathname.endsWith('/zz')) {
      return route.fulfill({ status: 404, contentType: 'application/problem+json', body: JSON.stringify({
        type: 'about:blank', title: 'Not Found', status: 404, code: 'package-request-not-found', detail: 'Demande d’envoi introuvable.',
      }) })
    }
    return route.fulfill({ json: { content: [ROW], totalElements: 1, totalPages: 1, number: 0, size: 20 } })
  })
  await page.goto('/colis?tab=demandes&open=zz')
  await expect(page.locator('[data-test="pr-detail-error"]')).toHaveText('Demande d’envoi introuvable.')
  await expect(page.locator('[data-test="pr-unavailable"]')).toHaveCount(0)
})

test('restauration d’une demande retirée, avec l’avertissement sur les négociations', async ({ page }) => {
  const state = await mockRequests(page)
  state.detail = REMOVED
  await page.goto('/colis?tab=demandes&open=pr1')
  await expect(page.locator('[data-test="pr-status-before"]')).toContainText('En négociation')
  await page.locator('[data-test="pr-restore"]').click()
  await expect(page.locator('[data-test="overlay"]')).toContainText('Les négociations annulées lors du retrait ne reviennent pas')
  await page.locator('[data-test="confirm"]').click()
  await expect(page.locator('[data-test="pr-remove"]')).toBeVisible()
  await expect(page.locator('[data-test="pr-row-pr1"]')).toContainText('Ouverte')
})

test('depuis Signalements, « Voir la demande » ouvre la fiche dans /colis', async ({ page }) => {
  await mockRequests(page)
  await page.route('**/api/v1/admin/reports**', (r) => r.fulfill({ json: {
    content: [{
      id: 'rep1', targetType: 'PACKAGE_REQUEST', targetId: 'pr1', targetLabel: 'Paris → Dakar', reason: 'SCAM_ATTEMPT',
      description: 'prix louche', reporterName: 'Moussa', status: 'OPEN', actionTaken: null, resolutionNote: null,
      resolvedAt: null, createdAt: '2026-09-22T09:00:00Z', photoUrls: [],
    }],
    totalElements: 1, totalPages: 1, number: 0, size: 20,
  } }))
  await page.goto('/signalements')
  const row = page.locator('[data-test="report-row-rep1"]')
  await expect(row).toContainText('Demande d\'envoi')
  await expect(page.locator('[data-test="report-target-type-filter"]')).toContainText('Demande d\'envoi')
  await page.locator('[data-test="report-open-request-rep1"]').click()
  await expect(page).toHaveURL(/\/colis\?tab=demandes&open=pr1/)
  await expect(page.locator('[data-test="pr-detail"]')).toContainText('Deux paires de chaussures')
})

test('ancien back (404 sans code) : mention discrète, pas d’erreur rouge', async ({ page }) => {
  await page.route('**/api/v1/admin/package-requests**', (r) => r.fulfill({
    status: 404, contentType: 'application/json',
    body: JSON.stringify({ type: 'about:blank', title: 'Not Found', status: 404, detail: 'No endpoint GET /api/v1/admin/package-requests.' }),
  }))
  await page.goto('/colis?tab=demandes')
  await expect(page.locator('[data-test="pr-unavailable"]')).toHaveText('Modération des demandes indisponible pour le moment')
  await expect(page.locator('[data-test="pr-error"]')).toHaveCount(0)
})
