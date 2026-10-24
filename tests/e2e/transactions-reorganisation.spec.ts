import { test, expect, type Page } from '@playwright/test'

/**
 * Page Transactions réorganisée, ce que les autres e2e ne couvrent pas : vue « À traiter » par
 * défaut avec ses nombres et l'avertissement de recoupement, recherche à suggestions (personne ->
 * puce retirable, trajet, montant), vues dans l'URL, filtre de montant, liens entrants historiques,
 * tiroir à cinq onglets et retour arrière, gestes du menu « Actions » et bandeau de retenue selon
 * les droits, quatre sections à pastilles et sous-onglets, export CSV, repli sur un ancien back,
 * et la règle « permission = existence » des liens sortants (aucun `<a>` sans la permission de sa
 * destination, l'ensemble exact des liens avec toutes les permissions).
 *
 * Les routes du back sont simulées par un gestionnaire par ressource qui lit le chemin (comme
 * `colis-reorganisation.spec.ts`) ; la liste filtre comme le ferait le back (vue, personne, q).
 */

const ADMIN = { id: 'a1', email: 'admin.1@yadony.com', role: 'ADMIN', status: 'ACTIVE', mustChangePassword: false, permissionOverrides: {} }
/** Rôle SUPPORT : lit les paiements, ne débloque ni ne rembourse (pas de PAYMENT_RELEASE/REFUND), pas d'export. */
const SUPPORT = { id: 's1', email: 'support@yadony.com', role: 'SUPPORT', status: 'ACTIVE', mustChangePassword: false, permissionOverrides: {} }
/** PAYMENT_VIEW seul parmi les destinations des liens : ni colis, ni fiches, ni litiges, ni modération, ni alertes, ni journal, ni support. */
const PAYMENTS_ONLY = {
  ...SUPPORT,
  permissionOverrides: { BID_VIEW: false, USER_VIEW: false, DISPUTE_VIEW: false, MODERATION_VIEW: false, ALERT_VIEW: false, AUDIT_VIEW: false, SUPPORT_TICKET_VIEW: false },
}

const PAY1 = '7a7a0000-0000-4000-8000-0000000000a1'
const PAY2 = '7a7a0000-0000-4000-8000-0000000000a2'
const PAY3 = '7a7a0000-0000-4000-8000-0000000000a3'
const BID = '1c1a0000-0000-4000-8000-0000000000c1'
const BID2 = '1c1a0000-0000-4000-8000-0000000000c2'
const TRIP = '2a2a0000-0000-4000-8000-0000000000a1'
const SENDER = '5e5e0000-0000-4000-8000-0000000000a1'
const TRAVELER = '5e5e0000-0000-4000-8000-0000000000a2'
const SENDER2 = '5e5e0000-0000-4000-8000-0000000000a3'
const DISPUTE = 'd1d10000-0000-4000-8000-0000000000d1'
const CANCEL = 'c0c00000-0000-4000-8000-0000000000c1'
const CB = 'cbcb0000-0000-4000-8000-0000000000b1'
const PR = '9e9e0000-0000-4000-8000-0000000000e1'
const ALERT = '4b4b0000-0000-4000-8000-0000000000e1'
const CONV = 'fs-conv-1'

const page1 = (content: unknown[]) => ({ content, totalElements: content.length, totalPages: 1, number: 0, size: 20 })
/** 404 sans `code` : un ancien back qui ne connaît pas l'endpoint. */
const MISSING = { status: 404, contentType: 'application/problem+json', json: { status: 404, title: 'Not Found' } }
/** URL courante sans le préfixe de l'application (`/siragbe`). */
const landing = (page: Page) => {
  const u = new URL(page.url())
  return `${u.pathname.replace(/^\/siragbe/, '')}${u.search}`
}
const stripPrefix = (href: string) => href.replace(/^\/siragbe/, '')

const insight = (bidId: string, sender: { id: string; name: string }, traveler: { id: string; name: string }) => ({
  kind: 'BID', bidId, negotiationThreadId: null, sender, traveler, departureCity: 'Paris', arrivalCity: 'Dakar', bidStatus: 'IN_TRANSIT',
  abandoned: false, netTravelerCents: 3000, capturedAt: '2026-10-06T19:00:00Z', fxExchangeRate: null, stripeChargeId: 'ch_1',
  stripeDashboardUrl: 'https://dashboard.stripe.com/test/payments/pi_1',
})
/** PAY1 : en séquestre, versement retenu (voyageur banni) — alerte HELD ; PAY3 : séquestre de plus de 48 h ; PAY2 : versé. */
const ROWS = [
  { id: PAY1, bidId: BID, announcementId: TRIP, status: 'ESCROW', method: 'STRIPE', amountCents: 3400, commissionCents: 400, currency: 'EUR',
    createdAt: '2026-10-06T19:00:00Z', trackingNumber: 'DON-AAAA1111', alert: 'HELD', travelerId: TRAVELER,
    payoutHeldAt: '2026-10-08T09:00:00Z', beneficiaryHeld: true, beneficiaryHoldReason: 'BANNED',
    insight: insight(BID, { id: SENDER, name: 'Awa Diallo' }, { id: TRAVELER, name: 'Moussa Keita' }) },
  { id: PAY3, bidId: BID2, announcementId: TRIP, status: 'ESCROW', method: 'STRIPE', amountCents: 10000, commissionCents: 1200, currency: 'EUR',
    createdAt: '2026-10-01T10:00:00Z', trackingNumber: 'DON-CCCC3333', alert: 'ESCROW_J48', travelerId: TRAVELER,
    insight: insight(BID2, { id: SENDER2, name: 'Jean Martin' }, { id: TRAVELER, name: 'Moussa Keita' }) },
  { id: PAY2, bidId: null, status: 'RELEASED', method: 'PAWAPAY', amountCents: 660000, commissionCents: 60000, currency: 'XOF',
    createdAt: '2026-09-09T15:09:00Z', trackingNumber: null, insight: null },
]
const COUNTS = { attention: 2, escrow: 2, releasedRecent: 1, refunded: 0, failed: 0, all: 3, abandoned: 0, alerts: { held: 1, chargebackOpen: 1, mmFailed: 0, escrowJ48: 1 } }
const FINANCE = { payments: 2, mobileMoney: 3, soldes: 1, chargebacks: 1, details: { paymentsAttention: 2, mobileMoneyAttention: 3, walletRefundsPending: 1, cashCommissionsAttention: 0, chargebacksOpen: 1 } }
const SUGGEST = {
  senders: [{ id: SENDER, name: 'Awa Diallo', count: 1 }],
  travelers: [],
  trips: [{ label: 'Paris → Dakar', departureCity: 'Paris', arrivalCity: 'Dakar', count: 2 }],
  parcels: [],
}
/** Fiche de PAY1 : tous les champs de lien remplis (contexte, bloc `links`, alertes, litige bancaire). */
const DETAIL1 = {
  ...ROWS[0], refundedCents: 0, stripePaymentIntentId: 'pi_1', escrowReleasedAt: null, disputed: true, capturedAt: '2026-10-06T19:00:00Z',
  links: { announcementId: TRIP, disputeId: DISPUTE, disputeStatus: 'OPEN', cancellationId: CANCEL, conversationId: CONV, chargebackId: CB, packageRequestId: PR },
  openAlerts: [{ id: ALERT, type: 'ESCROW_J48_TIMEOUT', severity: 'WARN' }],
  chargeback: { id: CB, status: 'OPEN', reason: 'fraudulent', openedAt: '2026-10-20T08:00:00' },
}
const TIMELINE = [
  { at: '2026-10-06T19:00:00Z', action: 'PAYMENT_CREATED', source: 'PAYMENT', actorId: SENDER, actorKind: 'USER', actorLabel: 'Awa Diallo', payload: {} },
]

interface Calls { list: URL[]; counts: URL[]; suggest: URL[]; exports: URL[]; posts: { url: string; body: unknown }[]; wallets: URL[]; refunds: URL[] }

/** Liste filtrée comme le back : vue, personne, colis ; un ancien back ignore la vue. */
function filterRows(u: URL, legacy: boolean) {
  const view = legacy ? 'ALL' : (u.searchParams.get('view') ?? 'ALL')
  const partyId = u.searchParams.get('partyId')
  return ROWS.filter((r) => {
    if (view === 'ATTENTION' && !r.alert) return false
    if (view === 'ESCROW' && r.status !== 'ESCROW') return false
    if (view === 'RELEASED_RECENT' && r.status !== 'RELEASED') return false
    if (view === 'REFUNDED' || view === 'FAILED') return false
    if (partyId && r.insight?.sender.id !== partyId && r.insight?.traveler.id !== partyId) return false
    return true
  })
}

async function setup(page: Page, opts: { user?: object; legacy?: boolean; delayCountsMs?: number } = {}): Promise<Calls> {
  const calls: Calls = { list: [], counts: [], suggest: [], exports: [], posts: [], wallets: [], refunds: [] }
  await page.addInitScript((u) => { (window as unknown as { __yadonyAuthSeed: typeof u }).__yadonyAuthSeed = u }, opts.user ?? ADMIN)
  const wait = () => new Promise(r => setTimeout(r, opts.delayCountsMs ?? 0))
  await page.route('**/api/v1/admin/finance/counts', async (route) => {
    await wait()
    return route.fulfill(opts.legacy ? MISSING : { json: FINANCE })
  })
  let released = false
  await page.route('**/api/v1/admin/payments**', async (route) => {
    const req = route.request()
    const u = new URL(req.url())
    const path = u.pathname.replace(/^.*\/admin\/payments/, '')
    if (req.method() === 'POST') {
      calls.posts.push({ url: req.url(), body: req.postDataJSON() })
      released = true
      return route.fulfill({ json: { ...DETAIL1, status: 'RELEASED', alert: null, payoutHeldAt: null, beneficiaryHeld: false } })
    }
    if (path === '/counts') {
      calls.counts.push(u)
      await wait()
      return route.fulfill(opts.legacy ? MISSING : { json: COUNTS })
    }
    if (path === '/suggest') {
      calls.suggest.push(u)
      if (opts.legacy) return route.fulfill(MISSING)
      return route.fulfill({ json: SUGGEST })
    }
    if (path === '/summary') return route.fulfill({ json: [] })
    if (path === '/export') {
      calls.exports.push(u)
      return route.fulfill({ status: 200, contentType: 'text/csv', body: 'id;statut\n' })
    }
    if (path.endsWith('/timeline')) return route.fulfill({ json: TIMELINE })
    if (path === `/${PAY1}`) {
      return route.fulfill({ json: released ? { ...DETAIL1, status: 'RELEASED', alert: null, payoutHeldAt: null, beneficiaryHeld: false } : DETAIL1 })
    }
    const row = ROWS.find(r => path === `/${r.id}`)
    if (row) return route.fulfill({ json: { ...row, refundedCents: 0, stripePaymentIntentId: null, escrowReleasedAt: null, disputed: false } })
    calls.list.push(u)
    return route.fulfill({ json: page1(filterRows(u, !!opts.legacy)) })
  })
  // Autres sections, pour les liens entrants historiques et les sous-onglets.
  await page.route(/\/api\/v1\/admin\/wallets(\?.*)?$/, (route) => {
    calls.wallets.push(new URL(route.request().url()))
    return route.fulfill({ json: page1([{ id: 'w1', userId: SENDER, userName: 'Awa Diallo', balanceCents: 1250, currency: 'EUR', updatedAt: '2026-10-01T10:00:00Z' }]) })
  })
  await page.route(/\/api\/v1\/admin\/wallet-refund-requests(\?.*)?$/, (route) => {
    calls.refunds.push(new URL(route.request().url()))
    return route.fulfill({ json: page1([{ id: 'r1', userId: SENDER, userName: 'Awa Diallo', currency: 'XOF', amount: 5000, status: 'PENDING', requestedAt: '2026-10-18T10:00:00', channel: 'MANUAL_ADMIN' }]) })
  })
  await page.route('**/api/v1/admin/mobile-money-payments/counts**', route => route.fulfill(opts.legacy ? MISSING : { json: { failed: 1, open: 1, done: 1, all: 3, attention: 1 } }))
  await page.route(/\/api\/v1\/admin\/mobile-money-payments(\?.*)?$/, route => route.fulfill({ json: page1([]) }))
  await page.route('**/api/v1/admin/mobile-money-commissions**', route => route.fulfill({ json: { from: '2026-01-01T00:00:00', to: '2026-10-01T00:00:00', byCurrency: [], monthly: [] } }))
  await page.route('**/api/v1/admin/cash-commissions/counts**', route => route.fulfill(opts.legacy ? MISSING : { json: { attention: 0, all: 0 } }))
  await page.route(/\/api\/v1\/admin\/cash-commissions(\?.*)?$/, route => route.fulfill({ json: page1([]) }))
  await page.route('**/api/v1/admin/chargebacks/counts**', route => route.fulfill(opts.legacy ? MISSING : { json: { open: 1, won: 0, lost: 0, all: 1 } }))
  await page.route(/\/api\/v1\/admin\/chargebacks(\?.*)?$/, route => route.fulfill({ json: page1([]) }))
  return calls
}

const row = (page: Page, id: string) => page.locator(`[data-test="payment-row-${id}"]`)
const lastList = (calls: Calls) => calls.list.at(-1)!.searchParams

test.describe('vue « À traiter » et recherche', () => {
  test('par défaut : vue À traiter avec ses nombres, avertissement de recoupement, liste des paiements à alerte', async ({ page }) => {
    const calls = await setup(page)
    await page.goto('/transactions')
    await expect(row(page, PAY1)).toBeVisible({ timeout: 15000 })
    const attention = page.locator('[data-test="payment-view-ATTENTION"]')
    await expect(attention).toHaveAttribute('aria-pressed', 'true')
    await expect(attention.locator('[data-test="tab-count"]')).toHaveText('2')
    await expect(page.locator('[data-test="payment-view-ESCROW"] [data-test="tab-count"]')).toHaveText('2')
    await expect(page.locator('[data-test="payment-view-ALL"] [data-test="tab-count"]')).toHaveText('3')
    await expect(page.locator('[data-test="payment-view-help"]')).toContainText('recoup')
    // Le nombre de la vue est la longueur de la liste affichée.
    await expect(page.locator('[data-test^="payment-row-"]')).toHaveCount(2)
    await expect(row(page, PAY2)).toHaveCount(0)
    expect(lastList(calls).get('view')).toBe('ATTENTION')
    // Vue par défaut : rien dans l'URL.
    expect(landing(page)).toBe('/transactions')
  })

  test('changer de vue met à jour l’URL et la liste ; l’URL d’une vue la rouvre', async ({ page }) => {
    const calls = await setup(page)
    await page.goto('/transactions')
    await expect(row(page, PAY1)).toBeVisible({ timeout: 15000 })
    await page.locator('[data-test="payment-view-ALL"]').click()
    await expect(row(page, PAY2)).toBeVisible()
    await expect.poll(() => landing(page)).toBe('/transactions?view=ALL')
    expect(lastList(calls).get('view')).toBeNull()
    await page.locator('[data-test="payment-view-RELEASED_RECENT"]').click()
    await expect(row(page, PAY1)).toHaveCount(0)
    await expect(row(page, PAY2)).toBeVisible()
    await expect.poll(() => landing(page)).toBe('/transactions?view=RELEASED_RECENT')
    expect(lastList(calls).get('view')).toBe('RELEASED_RECENT')
    await page.goto('/transactions?view=ESCROW')
    await expect(page.locator('[data-test="payment-view-ESCROW"]')).toHaveAttribute('aria-pressed', 'true', { timeout: 15000 })
    expect(lastList(calls).get('view')).toBe('ESCROW')
  })

  test('suggestions : choisir un expéditeur pose une puce retirable et `partyId` dans l’URL', async ({ page }) => {
    const calls = await setup(page)
    await page.goto('/transactions')
    await expect(row(page, PAY1)).toBeVisible({ timeout: 15000 })
    await page.locator('[data-test="payment-search"]').fill('awa')
    const option = page.locator('[data-test="payment-suggestion-sender-0"]')
    await expect(option).toContainText('Awa Diallo')
    expect(calls.suggest.at(-1)!.searchParams.get('q')).toBe('awa')
    await option.click()
    const chip = page.locator('[data-test="active-chip-party"]')
    await expect(chip).toHaveText(/Personne : Awa Diallo/)
    await expect.poll(() => new URL(page.url()).searchParams.get('partyId')).toBe(SENDER)
    await expect.poll(() => lastList(calls).get('partyId')).toBe(SENDER)
    // Page déjà ouverte : la vue choisie reste (À traiter), écrite dans l'URL puisqu'un filtre est
    // présent ; le nom choisi n'est pas envoyé comme recherche libre.
    await expect(page.locator('[data-test="payment-view-ATTENTION"]')).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(() => landing(page)).toBe(`/transactions?partyId=${SENDER}&view=ATTENTION`)
    expect(lastList(calls).get('view')).toBe('ATTENTION')
    expect(lastList(calls).get('q')).toBeNull()
    await expect(page.locator('[data-test^="payment-row-"]')).toHaveCount(1)
    await expect(row(page, PAY1)).toBeVisible()
    await page.locator('[data-test="active-chip-party-remove"]').click()
    await expect(chip).toHaveCount(0)
    await expect.poll(() => new URL(page.url()).searchParams.get('partyId')).toBeNull()
    await expect.poll(() => lastList(calls).get('partyId')).toBeNull()
  })

  test('recherche par trajet (suggestion) puis par montant : la requête envoyée au back', async ({ page }) => {
    const calls = await setup(page)
    await page.goto('/transactions')
    await expect(row(page, PAY1)).toBeVisible({ timeout: 15000 })
    await page.locator('[data-test="payment-search"]').fill('paris')
    await page.locator('[data-test="payment-suggestion-trip-0"]').click()
    await expect.poll(() => lastList(calls).get('q')).toBe('Paris Dakar')
    await expect(page.locator('[data-test="active-chip-search"]')).toContainText('Paris Dakar')
    await expect.poll(() => new URL(page.url()).searchParams.get('query')).toBe('Paris Dakar')

    await page.locator('[data-test="payment-search"]').fill('34,00')
    await page.locator('[data-test="payment-search"]').press('Enter')
    await expect.poll(() => lastList(calls).get('q')).toBe('34,00')
    await expect.poll(() => new URL(page.url()).searchParams.get('query')).toBe('34,00')
  })

  test('filtre de montant dans l’URL : unités principales dans l’URL, centimes envoyés, puce affichée', async ({ page }) => {
    const calls = await setup(page)
    await page.goto('/transactions?amountMin=100')
    await expect(page.locator('[data-test="active-chip-amount"]')).toBeVisible({ timeout: 15000 })
    await expect.poll(() => calls.list.length).toBeGreaterThan(0)
    expect(lastList(calls).get('amountMin')).toBe('10000')
    expect(calls.counts.at(-1)!.searchParams.get('amountMin')).toBe('10000')
    await expect(page.locator('[data-test="payment-view-ALL"]')).toHaveAttribute('aria-pressed', 'true')
    expect(new URL(page.url()).searchParams.get('amountMin')).toBe('100')
  })
})

test.describe('liens entrants historiques', () => {
  test('?tab=wallets et ?tab=wallet-refunds : section Soldes, bon sous-onglet, liste chargée', async ({ page }) => {
    const calls = await setup(page)
    await page.goto('/transactions?tab=wallets')
    await expect(page.locator('[data-test="section-wallets"]')).toHaveAttribute('aria-pressed', 'true', { timeout: 15000 })
    await expect(page.locator('[data-test="sub-wallets"]')).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(() => calls.wallets.length).toBeGreaterThan(0)
    await page.goto('/transactions?tab=wallet-refunds')
    await expect(page.locator('[data-test="section-wallets"]')).toHaveAttribute('aria-pressed', 'true', { timeout: 15000 })
    await expect(page.locator('[data-test="sub-wallet-refunds"]')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('[data-test="wrr-row-r1"]')).toBeVisible()
  })

  test('?held=true : alerte HELD, vue À traiter, puce enfoncée ; l’alias est remplacé dans l’URL', async ({ page }) => {
    const calls = await setup(page)
    await page.goto('/transactions?held=true')
    await expect(page.locator('[data-test="active-chip-alert"]')).toContainText('Versement retenu', { timeout: 15000 })
    await expect.poll(() => landing(page)).toBe('/transactions?alert=HELD&view=ATTENTION')
    await expect.poll(() => calls.list.length).toBeGreaterThan(0)
    expect(lastList(calls).get('alert')).toBe('HELD')
    await expect(page.locator('[data-test="payment-view-ATTENTION"]')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('[data-test="chip-held"]')).toHaveAttribute('aria-pressed', 'true')
  })

  test('?open=<paiement> : tiroir ouvert sur Résumé', async ({ page }) => {
    await setup(page)
    await page.goto(`/transactions?open=${PAY1}`)
    await expect(page.locator('[data-test="payment-detail"]')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('[data-test="payment-panel-summary"]')).toBeVisible()
    await expect(page.locator('[data-test="payment-tab-summary"]')).toHaveAttribute('aria-pressed', 'true')
  })

  test('?status=ESCROW&method=PAWAPAY : filtres appliqués au premier chargement, vue Toutes, puces', async ({ page }) => {
    const calls = await setup(page)
    await page.goto('/transactions?status=ESCROW&method=PAWAPAY')
    await expect(page.locator('[data-test="active-chip-status"]')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('[data-test="active-chip-method"]')).toBeVisible()
    await expect.poll(() => calls.list.length).toBeGreaterThan(0)
    const first = calls.list[0]!.searchParams
    expect(first.get('status')).toBe('ESCROW')
    expect(first.get('method')).toBe('PAWAPAY')
    expect(first.get('view')).toBeNull()
    await expect(page.locator('[data-test="payment-view-ALL"]')).toHaveAttribute('aria-pressed', 'true')
  })
})

test.describe('tiroir paiement', () => {
  test('cinq onglets, chacun dans l’URL (`section=`), Échap ferme et nettoie l’URL', async ({ page }) => {
    await setup(page)
    await page.goto('/transactions')
    await row(page, PAY1).click({ timeout: 15000 })
    const drawer = page.locator('[data-test="payment-detail"]')
    await expect(drawer).toBeVisible()
    const tabs = drawer.locator('[data-test^="payment-tab-"]')
    await expect(tabs).toHaveCount(5)
    await expect.poll(() => landing(page)).toBe(`/transactions?open=${PAY1}`)
    for (const s of ['incidents', 'money', 'timeline', 'references']) {
      await page.locator(`[data-test="payment-tab-${s}"]`).click()
      await expect(page.locator(`[data-test="payment-panel-${s}"]`)).toBeVisible()
      await expect.poll(() => landing(page)).toBe(`/transactions?open=${PAY1}&section=${s}`)
    }
    await page.locator('[data-test="payment-tab-summary"]').click()
    await expect.poll(() => landing(page)).toBe(`/transactions?open=${PAY1}`)
    await page.keyboard.press('Escape')
    await expect(drawer).toHaveCount(0)
    await expect.poll(() => landing(page)).toBe('/transactions')
  })

  test('retour arrière : ouvrir le tiroir n’ajoute pas d’entrée ; d’une page liée, Retour revient au tiroir puis à la page d’avant', async ({ page }) => {
    await setup(page)
    await page.route('**/api/v1/admin/disputes**', route => route.fulfill({ json: page1([]) }))
    await page.route('**/api/v1/admin/cancellations**', route => route.fulfill({ json: page1([]) }))
    await page.goto('/alertes')
    await page.goto('/transactions')
    await row(page, PAY1).click({ timeout: 15000 })
    await page.locator('[data-test="payment-tab-incidents"]').click()
    await expect.poll(() => landing(page)).toBe(`/transactions?open=${PAY1}&section=incidents`)
    await page.locator('[data-test="payment-dispute-link"]').click()
    await expect.poll(() => landing(page)).toBe(`/incidents?open=${DISPUTE}`)
    await page.goBack()
    await expect(page.locator('[data-test="payment-panel-incidents"]')).toBeVisible({ timeout: 15000 })
    await expect.poll(() => landing(page)).toBe(`/transactions?open=${PAY1}&section=incidents`)
    // Tiroir et onglet écrits par `router.replace` : la page d'avant est à un seul Retour.
    await page.goBack()
    await expect.poll(() => landing(page)).toBe('/alertes')
  })

  test('SUPPORT (sans PAYMENT_RELEASE ni PAYMENT_REFUND) : gestes grisés avec leur raison, rien n’est envoyé ; pas d’export', async ({ page }) => {
    const calls = await setup(page, { user: SUPPORT })
    await page.goto(`/transactions?open=${PAY1}`)
    await expect(page.locator('[data-test="payment-detail"]')).toBeVisible({ timeout: 15000 })
    // Bandeau de retenue : les deux gestes visibles, grisés, avec la raison.
    const banner = page.locator('[data-test="payment-alert-banner"]')
    await expect(banner).toHaveAttribute('data-code', 'HELD')
    await expect(page.locator('[data-test="banner-override"]')).toHaveAttribute('aria-disabled', 'true')
    await expect(page.locator('[data-test="banner-refund"]')).toHaveAttribute('aria-disabled', 'true')
    await expect(banner).toContainText('Permission manquante')
    // Un clic sur un geste grisé (aria-disabled, donc focalisable) n'ouvre rien.
    await page.locator('[data-test="banner-override"]').dispatchEvent('click')
    await page.locator('[data-test="banner-refund"]').dispatchEvent('click')
    await expect(page.locator('[data-test="override-dialog"]')).toHaveCount(0)
    await expect(page.locator('[data-test="confirm"]')).toHaveCount(0)
    // Menu « Actions » : chaque geste reste lisible et dit pourquoi il est impossible.
    await page.locator('[data-test="payment-actions-menu"]').click()
    await expect(page.locator('[data-test="action-release"]')).toHaveAttribute('aria-disabled', 'true')
    await expect(page.locator('[data-test="release-disabled-reason"]')).toContainText('Permission manquante')
    await expect(page.locator('[data-test="action-refund"]')).toHaveAttribute('aria-disabled', 'true')
    await expect(page.locator('[data-test="refund-disabled-reason"]')).toContainText('Permission manquante')
    await expect(page.locator('[data-test="retry-payout-disabled-reason"]')).toBeVisible()
    await page.locator('[data-test="action-release"]').dispatchEvent('click')
    await page.locator('[data-test="action-refund"]').dispatchEvent('click')
    await expect(page.locator('[data-test="override-dialog"]')).toHaveCount(0)
    await expect(page.locator('[data-test="confirm"]')).toHaveCount(0)
    expect(calls.posts).toHaveLength(0)
    await page.keyboard.press('Escape')
    await page.keyboard.press('Escape')
    await expect(page.locator('[data-test="payments-export"]')).toHaveCount(0)
  })

  test('ADMIN : bandeau de retenue → dérogation motivée depuis le bandeau, puis la fiche relue n’est plus retenue', async ({ page }) => {
    const calls = await setup(page)
    await page.goto(`/transactions?open=${PAY1}`)
    const banner = page.locator('[data-test="payment-alert-banner"]')
    await expect(banner).toHaveAttribute('data-code', 'HELD', { timeout: 15000 })
    await expect(page.locator('[data-test="banner-cause"]')).toContainText('banni')
    await page.locator('[data-test="banner-override"]').click()
    const dialog = page.locator('[data-test="override-dialog"]')
    await expect(dialog).toBeVisible()
    await expect(page.locator('[data-test="override-warning"]')).toContainText('banni')
    await page.locator('[data-test="override-reason"]').fill('Livraison confirmée par le destinataire')
    await page.locator('[data-test="override-checked"]').check()
    await page.locator('[data-test="override-submit"]').click()
    await expect(dialog).toHaveCount(0)
    await expect.poll(() => calls.posts.length).toBe(1)
    expect(calls.posts[0]!.url).toContain(`/admin/payments/${PAY1}/force-release`)
    expect(calls.posts[0]!.body).toEqual({ overrideHold: true, overrideReason: 'Livraison confirmée par le destinataire' })
    await expect(banner).toHaveCount(0)
  })
})

test.describe('sections, sous-onglets, export', () => {
  test('quatre sections à pastilles ; sous-onglets de Mobile money et de Soldes', async ({ page }) => {
    await setup(page)
    await page.goto('/transactions')
    await expect(row(page, PAY1)).toBeVisible({ timeout: 15000 })
    const sections = page.locator('[data-test^="section-"]')
    await expect(sections).toHaveCount(4)
    await expect(page.locator('[data-test="section-payments"] [data-test="tab-count"]')).toHaveText('2')
    await expect(page.locator('[data-test="section-mobile-money"] [data-test="tab-count"]')).toHaveText('3')
    await expect(page.locator('[data-test="section-wallets"] [data-test="tab-count"]')).toHaveText('1')
    await expect(page.locator('[data-test="section-chargebacks"] [data-test="tab-count"]')).toHaveText('1')
    await expect(page.locator('[data-test^="sub-"]')).toHaveCount(0)

    await page.locator('[data-test="section-mobile-money"]').click()
    await expect(page.locator('[data-test="sub-mobile-money"]')).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(() => landing(page)).toMatch(/^\/transactions\?tab=mobile-money/)
    await page.locator('[data-test="sub-mm-commissions"]').click()
    await expect.poll(() => landing(page)).toBe('/transactions?tab=mm-commissions')

    await page.locator('[data-test="section-wallets"]').click()
    await expect(page.locator('[data-test^="sub-"]')).toHaveCount(3)
    await expect(page.locator('[data-test="sub-wallets"]')).toHaveAttribute('aria-pressed', 'true')
    await page.locator('[data-test="sub-cash-commissions"]').click()
    await expect.poll(() => landing(page)).toMatch(/^\/transactions\?tab=cash-commissions/)

    await page.locator('[data-test="section-payments"]').click()
    await expect(row(page, PAY1)).toBeVisible()
    await expect.poll(() => landing(page)).toBe('/transactions')
  })

  test('nombres lents : sections sans pastille et barre des vues réservée, la liste ne saute pas à leur arrivée', async ({ page }) => {
    await setup(page, { delayCountsMs: 2500 })
    await page.goto('/transactions')
    await expect(page.locator('[data-test="payment-views-skeleton"]')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('[data-test^="section-"]')).toHaveCount(4)
    await expect(page.locator('[data-test="tab-count"]')).toHaveCount(0)
    await expect(page.locator('[data-test="tab-payments"]')).toHaveCount(0)
    const search = page.locator('[data-test="payment-search"]')
    const before = (await search.boundingBox())!.y
    await expect(page.locator('[data-test="payment-view-ATTENTION"]')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('[data-test="payment-views-skeleton"]')).toHaveCount(0)
    await expect(page.locator('[data-test="section-payments"] [data-test="tab-count"]')).toHaveText('2')
    const after = (await search.boundingBox())!.y
    expect(Math.abs(after - before)).toBeLessThanOrEqual(1)
  })

  test('export CSV : avec EXPORT_RUN, le bouton envoie les filtres de la liste au back', async ({ page }) => {
    const calls = await setup(page)
    await page.goto('/transactions?view=ESCROW')
    await expect(row(page, PAY1)).toBeVisible({ timeout: 15000 })
    await page.locator('[data-test="payments-export"]').click()
    await expect.poll(() => calls.exports.length).toBe(1)
    expect(calls.exports[0]!.searchParams.get('view')).toBe('ESCROW')
  })
})

test('ancien back (nombres, suggestions et nombres des sections en 404) : sept onglets plats, aucun nombre, la liste marche', async ({ page }) => {
  const calls = await setup(page, { legacy: true })
  await page.goto('/transactions')
  await expect(row(page, PAY1)).toBeVisible({ timeout: 15000 })
  await expect(row(page, PAY2)).toBeVisible()
  await expect(page.locator('[data-test="tab-payments"]')).toBeVisible()
  for (const t of ['chargebacks', 'mobile-money', 'mm-commissions', 'wallets', 'wallet-refunds', 'cash-commissions']) {
    await expect(page.locator(`[data-test="tab-${t}"]`)).toBeVisible()
  }
  await expect(page.locator('[data-test^="section-"]')).toHaveCount(0)
  await expect(page.locator('[data-test="tab-count"]')).toHaveCount(0)
  await expect(page.locator('[data-test^="payment-view-"]')).toHaveCount(0)
  await expect(page.locator('[data-test="payment-views-skeleton"]')).toHaveCount(0)
  // Recherche simple : pas de liste de suggestions, la saisie est envoyée telle quelle, sans vue
  // (le premier chargement a pu porter `view=ATTENTION`, qu'un ancien back ignore).
  await page.locator('[data-test="payment-search"]').fill('awa')
  await page.locator('[data-test="payment-search"]').press('Enter')
  await expect.poll(() => lastList(calls).get('q')).toBe('awa')
  expect(lastList(calls).get('view')).toBeNull()
  await expect(page.locator('[data-test^="payment-suggestion-"]')).toHaveCount(0)
  // Les onglets plats restent utilisables.
  await page.locator('[data-test="tab-wallets"]').click()
  await expect(page.locator('[data-test="wallet-row-w1"]')).toBeVisible({ timeout: 15000 })
})

test.describe('permission = existence : liens sortants du tiroir et du tableau', () => {
  const FORBIDDEN = ['/colis', '/users', '/incidents', '/moderation', '/alertes', '/audit', '/support']

  /** Tous les `href` internes du tiroir (ses cinq onglets) et du tableau, sans préfixe d'application. */
  async function collectHrefs(page: Page): Promise<string[]> {
    const seen = new Set<string>()
    const grab = async (scope: string) => {
      for (const h of await page.locator(`${scope} a[href]`).evaluateAll(els => els.map(e => e.getAttribute('href') ?? ''))) {
        if (h.startsWith('/')) seen.add(stripPrefix(h))
      }
    }
    await grab('tbody')
    for (const s of ['summary', 'incidents', 'money', 'timeline', 'references']) {
      await page.locator(`[data-test="payment-tab-${s}"]`).click()
      await expect(page.locator(`[data-test="payment-panel-${s}"]`)).toBeVisible()
      await grab('[data-test="payment-detail"]')
    }
    return [...seen].sort()
  }

  test('PAYMENT_VIEW seul : aucun `<a>` vers colis, fiches, litiges, modération, alertes, journal ni support ; le texte reste lisible', async ({ page }) => {
    await setup(page, { user: PAYMENTS_ONLY })
    await page.goto(`/transactions?open=${PAY1}`)
    await expect(page.locator('[data-test="payment-detail"]')).toBeVisible({ timeout: 15000 })
    const hrefs = await collectHrefs(page)
    for (const prefix of FORBIDDEN) {
      expect(hrefs.filter(h => h === prefix || h.startsWith(`${prefix}?`) || h.startsWith(`${prefix}/`)), prefix).toEqual([])
      for (const scope of ['tbody', '[data-test="payment-detail"]']) {
        await expect(page.locator(`${scope} a[href^="${prefix}"], ${scope} a[href^="/siragbe${prefix}"]`)).toHaveCount(0)
      }
    }
    // Seule destination autorisée par PAYMENT_VIEW : le litige bancaire, dans la même page.
    expect(hrefs).toEqual([`/transactions?tab=chargebacks&open=${CB}`])
    // Le texte reste lisible là où le lien manque.
    await expect(page.locator(`[data-test="payment-sender-${PAY1}"]`)).toHaveText('Awa Diallo')
    await expect(page.locator(`[data-test="payment-tracking-${PAY1}"]`)).toContainText('DON-AAAA1111')
    await page.locator('[data-test="payment-tab-summary"]').click()
    await expect(page.locator('[data-test="party-traveler"]')).toContainText('Moussa Keita')
  })

  test('toutes les permissions : l’ensemble exact des liens attendus', async ({ page }) => {
    await setup(page)
    await page.goto(`/transactions?open=${PAY1}`)
    await expect(page.locator('[data-test="payment-detail"]')).toBeVisible({ timeout: 15000 })
    // La vue À traiter montre aussi PAY3 : ne garder que les liens de PAY1 dans le tableau.
    await page.locator('[data-test="payment-view-ATTENTION"]').waitFor()
    const hrefs = (await collectHrefs(page)).filter(h => !h.includes(BID2) && !h.includes(SENDER2))
    expect(hrefs).toEqual([
      `/alertes?open=${ALERT}`,
      `/audit?entityType=PAYMENT&entityId=${PAY1}`,
      `/colis?announcementId=${TRIP}`,
      `/colis?open=${BID}`,
      `/colis?open=${BID}&section=chat`,
      `/colis?open=${BID}&section=incidents`,
      `/colis?open=${BID}&section=money`,
      `/colis?open=${BID}&section=tracking`,
      `/colis?tab=announcements&announcement=${TRIP}`,
      `/colis?tab=demandes&open=${PR}`,
      `/incidents?open=${DISPUTE}`,
      `/incidents?tab=noshows&open=${CANCEL}`,
      `/moderation?open=${CONV}`,
      `/support?userId=${SENDER}`,
      `/support?userId=${TRAVELER}`,
      `/transactions?tab=chargebacks&open=${CB}`,
      `/users/${SENDER}`,
      `/users/${TRAVELER}`,
      `/users/${TRAVELER}?tab=manage`,
      `/users/${TRAVELER}?tab=money`,
    ].sort())
  })
})
