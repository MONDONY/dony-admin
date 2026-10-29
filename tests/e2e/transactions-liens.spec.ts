import { test, expect, type Page } from '@playwright/test'

/**
 * Liens entrants vers Transactions depuis le reste de l'admin, et pages de destination des liens
 * du tiroir paiement (alerte, audit). Chaque test part de la page d'origine, clique le vrai lien,
 * vérifie l'URL d'arrivée exacte et l'état visible (tiroir, puce, vue), puis le retour arrière
 * quand il ne coûte rien. Les routes du back sont simulées ; `finance/counts` répond (nouveau back).
 *
 * Les requêtes reçues se lisent par `expect.poll` : la puce s'affiche depuis l'URL avant que la
 * liste soit demandée, une lecture immédiate tombait parfois avant l'appel (rouge sur main seulement).
 */

const ADMIN = { id: 'a1', email: 'admin.1@yadony.com', role: 'ADMIN', status: 'ACTIVE', mustChangePassword: false, permissionOverrides: {} }

const PAY = '7a7a0000-0000-4000-8000-0000000000a1'
const BID = '1c1a0000-0000-4000-8000-0000000000c1'
const TRIP = '2a2a0000-0000-4000-8000-0000000000a1'
const USER = '3f2b8c1e-4a5d-4e6f-8a9b-0c1d2e3f4a5b'
const ALERT = '4b4b0000-0000-4000-8000-0000000000e1'
const INV11 = '4b4b0000-0000-4000-8000-0000000000e2'
const ORPHAN = '4b4b0000-0000-4000-8000-0000000000e3'
const DISPUTE = 'd1d10000-0000-4000-8000-0000000000d1'

/** URL courante sans le préfixe de l'application (`/siragbe`), pour comparer chemin + query exacts. */
const landing = (page: Page) => {
  const u = new URL(page.url())
  return `${u.pathname.replace(/^\/siragbe/, '')}${u.search}`
}
const page1 = (content: unknown[]) => ({ content, totalElements: content.length, totalPages: 1, number: 0, size: 20 })

const PAYMENT = {
  id: PAY, bidId: BID, announcementId: TRIP, status: 'ESCROW', method: 'STRIPE', amountCents: 3400, commissionCents: 400, currency: 'EUR',
  createdAt: '2026-10-06T19:00:00Z', senderId: USER, senderName: 'Aïcha Diallo', travelerName: 'Moussa Keita', trackingNumber: 'DON-AAAA1111',
  corridor: 'Paris → Dakar', payoutHeldAt: '2026-10-08T09:00:00Z',
}
const PAYMENT_DETAIL = {
  ...PAYMENT, refundedCents: 0, stripePaymentIntentId: 'pi_123', escrowReleasedAt: null, disputed: false,
  openAlerts: [{ id: ALERT, type: 'ESCROW_J48_TIMEOUT', severity: 'WARN' }],
}
const PAY_COUNTS = { attention: 1, escrow: 1, releasedRecent: 0, refunded: 0, failed: 0, all: 1, abandoned: 0, alerts: { held: 1, chargebackOpen: 0, mmFailed: 0, escrowJ48: 1 } }
const FINANCE = { payments: 1, mobileMoney: 1, soldes: 0, chargebacks: 0, details: { paymentsAttention: 1, mobileMoneyAttention: 1, walletRefundsPending: 0, cashCommissionsAttention: 0, chargebacksOpen: 0 } }

interface Calls { payments: URL[]; audit: URL[]; mobileMoney: URL[]; wallets: URL[] }

/** Back commun : Transactions (paiements, mobile money, portefeuilles), audit, alertes. */
async function setup(page: Page): Promise<Calls> {
  const calls: Calls = { payments: [], audit: [], mobileMoney: [], wallets: [] }
  await page.addInitScript((u) => { (window as unknown as { __yadonyAuthSeed: typeof u }).__yadonyAuthSeed = u }, ADMIN)
  await page.route('**/api/v1/admin/finance/counts', route => route.fulfill({ json: FINANCE }))
  await page.route('**/api/v1/admin/payments**', (route) => {
    const u = new URL(route.request().url())
    const path = u.pathname.replace(/^.*\/admin\/payments/, '')
    if (path === '/counts') return route.fulfill({ json: PAY_COUNTS })
    if (path === '/summary') return route.fulfill({ json: [] })
    if (path === '/suggest') return route.fulfill({ json: {} })
    if (path === `/${PAY}/timeline`) return route.fulfill({ json: [] })
    if (path === `/${PAY}`) return route.fulfill({ json: PAYMENT_DETAIL })
    calls.payments.push(u)
    return route.fulfill({ json: page1([PAYMENT]) })
  })
  await page.route('**/api/v1/admin/mobile-money-payments/counts**', route => route.fulfill({ json: { failed: 1, open: 0, done: 0, all: 1, attention: 1 } }))
  await page.route(/\/api\/v1\/admin\/mobile-money-payments(\?.*)?$/, (route) => {
    calls.mobileMoney.push(new URL(route.request().url()))
    return route.fulfill({ json: page1([{
      id: 'mm1', paymentId: PAY, kind: 'PAYOUT', status: 'FAILED', provider: 'ORANGE_SEN', countryCode: 'SN', phoneNumber: '221771234567',
      amountCents: 8000, currency: 'XOF', createdAt: '2026-10-20T10:00:00Z', purpose: 'BID_PAYMENT', personId: USER, personName: 'Moussa Keita', role: 'TRAVELER',
    }]) })
  })
  await page.route(/\/api\/v1\/admin\/wallets(\?.*)?$/, (route) => {
    calls.wallets.push(new URL(route.request().url()))
    return route.fulfill({ json: page1([{ id: 'w1', userId: USER, userName: 'Jean Dupont', balanceCents: 1250, currency: 'EUR', updatedAt: '2026-10-01T10:00:00Z' }]) })
  })
  await page.route('**/api/v1/admin/audit-log**', (route) => {
    calls.audit.push(new URL(route.request().url()))
    return route.fulfill({ json: page1([]) })
  })
  return calls
}

test('colis, onglet Argent → « Voir la retenue » : tiroir paiement ouvert sur Incidents, puis retour au colis', async ({ page }) => {
  await setup(page)
  const row = { id: BID, status: 'IN_TRANSIT', announcementId: TRIP, senderName: 'Aïcha Diallo', travelerName: 'Moussa Keita', corridor: 'Paris → Dakar', weightKg: 5,
    netEur: 30, currency: 'EUR', paymentMethod: 'STRIPE', createdAt: '2026-10-01T10:00:00', trackingNumber: 'DON-AAAA1111' }
  await page.route('**/api/v1/admin/bids**', (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^.*\/admin\/bids/, '')
    if (path === '' || path === '/') return route.fulfill({ json: page1([row]) })
    if (path === '/counts') return route.fulfill({ json: { todo: 0, active: 1, recent: 0, completed: 0, closed: 0, all: 1, alerts: { disputeOpen: 0, noShow: 0, paymentPending: 0, late: 0 } } })
    if (path.endsWith('/timeline')) return route.fulfill({ json: { bidId: BID, entries: [] } })
    if (path.endsWith('/photos')) return route.fulfill({ json: { bidId: BID, photos: [] } })
    return route.fulfill({ json: { ...row, commissionRate: 0.12, refusalReason: null, recipientName: null, contentCategory: null,
      trip: { announcementId: TRIP, departureCity: 'Paris', arrivalCity: 'Dakar' },
      money: { paymentId: PAY, status: 'ESCROW', rail: 'STRIPE', amountCents: 3400, commissionCents: 400, refundedCents: 0, currency: 'EUR',
        capturedAt: '2026-10-06T19:00:00Z', escrowReleasedAt: null, payoutHeldAt: '2026-10-08T09:00:00', disputed: false },
      links: {}, incidents: { disputes: [], cancellations: [] } } })
  })
  await page.goto(`/colis?open=${BID}&section=money`)
  const held = page.locator('[data-test="money-held-link"]')
  await expect(held).toHaveText('Voir la retenue', { timeout: 15000 })
  await held.click()
  await expect(page).toHaveURL(/\/transactions\?/)
  await expect.poll(() => landing(page)).toBe(`/transactions?open=${PAY}&section=incidents`)
  await expect(page.locator('[data-test="payment-detail"]')).toBeVisible()
  await expect(page.locator('[data-test="payment-tab-incidents"]')).toHaveAttribute('aria-pressed', 'true')
  await page.goBack()
  await expect(page).toHaveURL(new RegExp(`/colis\\?open=${BID}&section=money`))
})

test('annonce → « Paiements de ce trajet » : liste filtrée avec la puce Trajet', async ({ page }) => {
  const calls = await setup(page)
  await page.route('**/api/v1/admin/bids**', route => route.fulfill({ json: page1([]) }))
  await page.route('**/api/v1/admin/announcements**', route => route.fulfill({ json: page1([
    { id: TRIP, status: 'ACTIVE', travelerName: 'Moussa Keita', corridor: 'Paris → Dakar', departureDate: '2026-10-12', availableKg: 10, pricePerKg: 8, currency: 'EUR' },
  ]) }))
  await page.goto('/colis?tab=announcements')
  await page.locator(`[data-test="ann-payments-${TRIP}"]`).click()
  await expect(page.locator('[data-test="active-chip-trip"]')).toContainText('Trajet :', { timeout: 15000 })
  await expect.poll(() => landing(page)).toBe(`/transactions?announcementId=${TRIP}`)
  await expect.poll(() => calls.payments.at(-1)?.searchParams.get('announcementId')).toBe(TRIP)
  await expect(page.locator('[data-test="payment-view-ALL"]')).toHaveAttribute('aria-pressed', 'true')
  await page.goBack()
  await expect(page).toHaveURL(/\/colis\?tab=announcements/)
})

test.describe('fiche utilisateur, onglet Argent', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/admin/users**', (route) => {
      const path = new URL(route.request().url()).pathname.replace(/^.*\/admin\/users/, '')
      if (path === `/${USER}`) {
        return route.fulfill({ json: { id: USER, firstName: 'Jean', lastName: 'Dupont', phoneNumber: '+33611111111', status: 'ACTIVE', kycStatus: 'VERIFIED',
          roles: ['ROLE_SENDER'], createdAt: '2026-01-01T00:00:00Z' } })
      }
      if (path.endsWith('/wallet')) return route.fulfill({ json: { accounts: [] } })
      return route.fulfill({ json: page1([]) })
    })
  })

  test('« Tous ses paiements » : liste filtrée sur la personne, puce Personne', async ({ page }) => {
    const calls = await setup(page)
    await page.goto(`/users/${USER}?tab=money`)
    await page.locator('[data-test="user-payments-all-link"]').click()
    await expect(page.locator('[data-test="active-chip-party"]')).toContainText('Personne :', { timeout: 15000 })
    await expect.poll(() => landing(page)).toBe(`/transactions?partyId=${USER}`)
    await expect.poll(() => calls.payments.at(-1)?.searchParams.get('partyId')).toBe(USER)
    await page.goBack()
    await expect(page).toHaveURL(new RegExp(`/users/${USER}\\?tab=money`))
  })

  test('« Son portefeuille » : onglet Portefeuilles filtré sur la personne', async ({ page }) => {
    const calls = await setup(page)
    await page.goto(`/users/${USER}?tab=money`)
    await page.locator('[data-test="user-wallet-link"]').click()
    await expect(page.locator('[data-test="active-chip-partyId"]')).toContainText('Titulaire', { timeout: 15000 })
    await expect.poll(() => landing(page)).toBe(`/transactions?tab=wallets&partyId=${USER}`)
    await expect.poll(() => calls.wallets.at(-1)?.searchParams.get('partyId')).toBe(USER)
  })
})

test.describe('incidents → « Voir le paiement de ce colis »', () => {
  test('litige : liste filtrée sur le colis, vue Toutes, puce Colis', async ({ page }) => {
    const calls = await setup(page)
    const dispute = { id: DISPUTE, bidId: BID, type: 'DAMAGED', status: 'OPEN', senderName: 'Jean', travelerName: 'Awa', refundFrozen: false, createdAt: '2026-10-01T10:00:00Z' }
    await page.route('**/api/v1/admin/disputes**', (route) => {
      if (route.request().url().includes(`/admin/disputes/${DISPUTE}`)) {
        return route.fulfill({ json: { ...dispute, resolution: null, resolvedAt: null, resolutionNote: null, beneficiaryUserId: null, bidCurrency: 'EUR', evidenceUrls: [] } })
      }
      return route.fulfill({ json: page1([dispute]) })
    })
    await page.route('**/api/v1/admin/cancellations**', route => route.fulfill({ json: page1([]) }))
    await page.goto(`/incidents?open=${DISPUTE}`)
    await page.locator('[data-test="incident-payment-link"]').click()
    await expect(page.locator('[data-test="active-chip-bid"]')).toContainText('Colis :', { timeout: 15000 })
    await expect.poll(() => landing(page)).toBe(`/transactions?bidId=${BID}&view=ALL`)
    await expect.poll(() => calls.payments.at(-1)?.searchParams.get('bidId')).toBe(BID)
    await expect(page.locator('[data-test="payment-view-ALL"]')).toHaveAttribute('aria-pressed', 'true')
    await page.goBack()
    await expect(page).toHaveURL(/\/incidents/)
  })

  test('absence au rendez-vous : même destination', async ({ page }) => {
    await setup(page)
    await page.route('**/api/v1/admin/disputes**', route => route.fulfill({ json: page1([]) }))
    await page.route('**/api/v1/admin/cancellations**', route => route.fulfill({ json: page1([{
      id: 'c1', bidId: BID, scope: 'HANDOVER', reason: 'SENDER_NO_SHOW', status: 'PENDING_CONFIRMATION', contestationDeadline: '2026-09-28T15:00:00Z',
      remainingMinutes: 300, createdAt: '2026-09-28T10:00:00Z', declarant: { userId: 't1', name: 'Awa D.', role: 'TRAVELER' },
      accused: { userId: 's1', name: 'Moussa K.', role: 'SENDER' }, trip: { departureCity: 'Bamako', arrivalCity: 'Abidjan', departureDate: '2026-09-15' },
      handoverAt: '2026-09-15T12:30:00Z', amount: 45, currency: 'EUR', paymentMethod: 'STRIPE', paymentStatus: 'ESCROW', bidStatus: 'ACCEPTED', canConfirm: true, canReject: true,
    }]) }))
    await page.goto('/incidents?tab=noshows&open=c1')
    await page.locator('[data-test="incident-payment-link"]').click()
    await expect(page.locator('[data-test="active-chip-bid"]')).toContainText('Colis :', { timeout: 15000 })
    await expect.poll(() => landing(page)).toBe(`/transactions?bidId=${BID}&view=ALL`)
  })
})

test('vue d’ensemble, carte Escrow J+48 → vue « À traiter » filtrée sur l’alerte J+48', async ({ page }) => {
  const calls = await setup(page)
  await page.route('**/api/v1/admin/metrics/overview', route => route.fulfill({ json: {
    users: { total: 1, active: 1, suspended: 0, banned: 0, pendingDeletion: 0, kycVerified: 1, kycPending: 0, pro: 0, newLast7d: 0, newLast30d: 0 },
    announcements: { active: 0, full: 0, inProgress: 0, completed: 0, cancelled: 0 },
    bids: { pending: 0, accepted: 0, inTransit: 0, completed: 0, cancelled: 0, total: 0 },
    gmv: { escrowHeld: 0, released: 0, refunded: 0, commission: 0 }, gmvByCurrency: [],
    queues: { openDisputes: 0, pendingNoShows: 0, unresolvedAlerts: 0, pendingKyc: 0, escrowJ48: 1 },
  } }))
  await page.goto('/')
  const card = page.locator('[data-test="queue-escrowJ48"]')
  await expect(card).toContainText('1')
  await card.click()
  await expect(page.locator('[data-test="active-chip-alert"]')).toBeVisible({ timeout: 15000 })
  await expect.poll(() => landing(page)).toBe('/transactions?view=ATTENTION&alert=ESCROW_J48')
  await expect.poll(() => calls.payments.at(-1)?.searchParams.get('alert')).toBe('ESCROW_J48')
  await expect(page.locator('[data-test="payment-view-ATTENTION"]')).toHaveAttribute('aria-pressed', 'true')
  // Le nombre de la carte est celui de la liste où l'on arrive.
  await expect(page.locator(`[data-test="payment-row-${PAY}"]`)).toHaveCount(1)
})

/**
 * INV-11 (« opération en attente depuis plus d'une heure ») et MM_PAYOUT_ORPHAN_* (« versement repris
 * à surveiller ») désignent une opération EN COURS : le lien atterrit sur la vue « En cours ».
 */
for (const c of [
  { name: 'INV-11', id: INV11, type: 'MONEY_INVARIANT_INV-11', detail: 'Incohérence INV-11', payload: { invariant: 'INV-11' } },
  { name: 'MM_PAYOUT_ORPHAN_*', id: ORPHAN, type: 'MM_PAYOUT_ORPHAN_7d1f', detail: 'Versement repris', payload: {} },
]) {
  test(`alerte ${c.name} → mobile money, vue En cours`, async ({ page }) => {
    const calls = await setup(page)
    const alert = { id: c.id, type: c.type, severity: 'WARN', detail: c.detail, payload: c.payload, resolved: false, resolvedAt: null, createdAt: '2026-10-06T12:00:00' }
    await page.route('**/api/v1/admin/alerts**', (route) => {
      if (route.request().url().includes('/violations')) return route.fulfill({ json: { invariant: 'INV-11', title: 'x', severity: 'MOYENNE', total: 0, rows: [] } })
      return route.fulfill({ json: page1([alert]) })
    })
    await page.goto('/alertes')
    await page.locator('[data-test="alert-link-transactions"]', { hasText: 'Opérations mobile money en cours' }).click()
    await expect(page.locator('[data-test="mm-view-OPEN"]')).toHaveAttribute('aria-pressed', 'true', { timeout: 15000 })
    await expect.poll(() => landing(page)).toBe('/transactions?tab=mobile-money&view=open')
    await expect.poll(() => calls.mobileMoney.at(-1)?.searchParams.get('view')).toBe('OPEN')
  })
}

test('tiroir paiement → « journal d’audit » : filtres PAYMENT appliqués, puis retour au tiroir', async ({ page }) => {
  const calls = await setup(page)
  await page.goto(`/transactions?open=${PAY}&section=timeline`)
  await page.locator('[data-test="payment-audit-link"]').click()
  await expect(page.locator('[data-test="filter-entity-id"]')).toHaveValue(PAY, { timeout: 15000 })
  await expect.poll(() => landing(page)).toBe(`/audit?entityType=PAYMENT&entityId=${PAY}`)
  await expect(page.locator('[data-test="filter-entity"]')).toHaveValue('PAYMENT')
  await expect.poll(() => calls.audit.at(-1)?.searchParams.get('entityType')).toBe('PAYMENT')
  await expect.poll(() => calls.audit.at(-1)?.searchParams.get('entityId')).toBe(PAY)
  await page.goBack()
  await expect(page.locator('[data-test="payment-detail"]')).toBeVisible()
  await expect.poll(() => landing(page)).toBe(`/transactions?open=${PAY}&section=timeline`)
})

test.describe('tiroir paiement → « Ouvrir l’alerte »', () => {
  test('alerte hors de la file : lue par identifiant et ouverte, ?open conservé', async ({ page }) => {
    await setup(page)
    await page.route('**/api/v1/admin/alerts**', (route) => {
      if (route.request().url().includes(`/admin/alerts/${ALERT}`)) {
        return route.fulfill({ json: { id: ALERT, type: 'ESCROW_J48_TIMEOUT', severity: 'WARN', detail: 'Séquestre de plus de 48 h', payload: { paymentId: PAY },
          resolved: false, resolvedAt: null, createdAt: '2026-10-06T12:00:00' } })
      }
      return route.fulfill({ json: page1([]) })
    })
    await page.goto(`/transactions?open=${PAY}&section=incidents`)
    await page.locator(`[data-test="payment-open-alert-link-${ALERT}"]`).click()
    await expect(page.locator('[data-test="alert-case"]')).toBeVisible({ timeout: 15000 })
    await expect.poll(() => landing(page)).toBe(`/alertes?open=${ALERT}`)
    await expect(page.locator('[data-test="alert-detail-summary"]')).toHaveText('Séquestre de plus de 48 h')
    // La file est vide : l'alerte du lien reste ouverte à côté de sa décision.
    await expect(page.locator('[data-test="alert-decision-panel"]')).toBeVisible()
  })

  test('alerte introuvable (404) : message visible, la page reste utilisable', async ({ page }) => {
    await setup(page)
    await page.route('**/api/v1/admin/alerts**', (route) => {
      if (route.request().url().includes(`/admin/alerts/${ALERT}`)) {
        return route.fulfill({ status: 404, contentType: 'application/problem+json', json: { status: 404, code: 'alert-not-found', detail: 'Alerte introuvable' } })
      }
      return route.fulfill({ json: page1([]) })
    })
    await page.goto(`/alertes?open=${ALERT}`)
    await expect(page.locator('[data-test="alert-open-error"]')).toContainText('Alerte introuvable')
    await expect(page.locator('[data-test="alert-detail-title"]')).toHaveCount(0)
    await expect(page.locator('[data-test="tab-OPEN"]')).toBeVisible()
  })
})
