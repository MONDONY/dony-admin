import { test, expect, type Page } from '@playwright/test'

/** `href` exact, préfixe de l'application (`/siragbe`) compris : rien d'autre avant ni après. */
const hrefIs = (path: string) => new RegExp(`^(/siragbe)?${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)

/**
 * Sections Soldes (portefeuilles, commissions cash, remboursements wallet) et Litiges bancaires
 * de /transactions : noms et liens au lieu d'UUID, vues à nombres, ligne ouverte par `?open=`,
 * paramètres d'URL propres à chaque onglet, repli sur l'ancien back.
 */
const ADMIN = { id: 'a1', email: 'admin.1@yadony.com', role: 'ADMIN', status: 'ACTIVE', mustChangePassword: false, permissionOverrides: {} }
const HOLDER = '11111111-2222-4333-8444-555555555555'
const SENDER = '33333333-2222-4333-8444-555555555555'
const TRAVELER = '22222222-3333-4444-8555-666666666666'
const BID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const PAY = 'bbbbbbbb-1111-4222-8333-444444444444'
const CB = 'cccccccc-1111-4222-8333-444444444444'
const CB_WON = 'cccccccc-2222-4222-8333-444444444444'
const REQ = 'dddddddd-1111-4222-8333-444444444444'
const PARENT = 'dddddddd-2222-4222-8333-444444444444'
const page1 = (content: object[]) => ({ content, totalElements: content.length, totalPages: 1, number: 0, size: 20 })
const missing = { status: 404, contentType: 'application/problem+json', body: JSON.stringify({ status: 404, detail: 'No endpoint' }) }

const WALLETS = [
  { id: 'w1', userId: HOLDER, userName: 'Mariam Koné (@mariam)', balanceCents: 12840, currency: 'EUR', updatedAt: '2026-10-22T10:00:00' },
  { id: 'w2', userId: TRAVELER, balanceCents: -620, currency: 'EUR', updatedAt: '2026-10-20T10:00:00' },
]
const CASH = [{
  bidId: BID, amountCents: 15000, commissionCents: 1800, currency: 'EUR', status: 'FAILED', chargedVia: 'CARD', retryCount: 2, createdAt: '2026-10-20T10:00:00',
  trackingNumber: 'YD-4PX9TN', corridor: 'Paris → Dakar', travelerId: TRAVELER, travelerName: 'Oumar Keita',
}]
const cb = (id: string, status: string, over: object = {}) => ({
  id, bidId: BID, amountCents: 35100, currency: 'EUR', reason: 'fraudulent', status, openedAt: '2026-10-21T10:00:00',
  paymentId: PAY, trackingNumber: 'YD-7LQ2WA', corridor: 'Marseille → Bamako', senderId: SENDER, senderName: 'Fatou Sow', travelerId: TRAVELER, travelerName: 'Oumar Keita', ...over,
})
const req = (id: string, status: string, over: object = {}) => ({ id, userId: HOLDER, userName: 'Mariam Koné', currency: 'XOF', amount: 5000, status, requestedAt: '2026-10-18T10:00:00', channel: 'MANUAL_ADMIN', ...over })

interface Calls { wallets: URL[]; cash: URL[]; cbs: URL[]; refunds: URL[]; payments: URL[] }

async function setup(page: Page, opts: { old?: boolean; walletRefundsPending?: number } = {}): Promise<Calls> {
  const calls: Calls = { wallets: [], cash: [], cbs: [], refunds: [], payments: [] }
  const track = (list: URL[]) => (url: string) => { const u = new URL(url); list.push(u); return u }
  await page.addInitScript((u) => { (window as unknown as { __yadonyAuthSeed: typeof u }).__yadonyAuthSeed = u }, ADMIN)
  await page.route('**/api/v1/admin/payments**', (route) => {
    track(calls.payments)(route.request().url())
    return route.fulfill({ json: page1([{ id: 'p1', bidId: 'b1', status: 'ESCROW', method: 'STRIPE', amountCents: 1000, commissionCents: 120, currency: 'EUR', createdAt: '2026-10-01T10:00:00Z' }]) })
  })
  await page.route('**/api/v1/admin/finance/counts', route => (opts.walletRefundsPending === undefined
    ? route.fulfill(missing)
    : route.fulfill({ json: { payments: 0, mobileMoney: 0, soldes: opts.walletRefundsPending, chargebacks: 1, details: { paymentsAttention: 0, mobileMoneyAttention: 0, walletRefundsPending: opts.walletRefundsPending, cashCommissionsAttention: 0, chargebacksOpen: 1 } } })))
  await page.route(/\/api\/v1\/admin\/wallets(\?.*)?$/, (route) => {
    track(calls.wallets)(route.request().url())
    return route.fulfill({ json: page1(opts.old ? WALLETS.map(({ userName: _n, ...w }) => w) : WALLETS) })
  })
  await page.route('**/api/v1/admin/cash-commissions/counts**', route => (opts.old ? route.fulfill(missing) : route.fulfill({ json: { attention: 1, all: 4 } })))
  await page.route(/\/api\/v1\/admin\/cash-commissions(\?.*)?$/, (route) => {
    track(calls.cash)(route.request().url())
    const old = { bidId: BID, amountCents: 15000, commissionCents: 1800, currency: 'EUR', status: 'FAILED', chargedVia: 'CARD', retryCount: 2, createdAt: '2026-10-20T10:00:00' }
    return route.fulfill({ json: page1(opts.old ? [old] : CASH) })
  })
  await page.route('**/api/v1/admin/chargebacks/counts**', route => (opts.old ? route.fulfill(missing) : route.fulfill({ json: { open: 1, won: 1, lost: 0, all: 2 } })))
  await page.route(/\/api\/v1\/admin\/chargebacks(\?.*)?$/, (route) => {
    const url = track(calls.cbs)(route.request().url())
    if (opts.old) return route.fulfill({ json: page1([{ id: CB, bidId: BID, amountCents: 35100, currency: 'EUR', reason: 'fraudulent', status: 'OPEN', openedAt: '2026-10-21T10:00:00' }]) })
    const view = url.searchParams.get('view')
    const rows = view === 'OPEN' ? [cb(CB, 'OPEN')] : [cb(CB, 'OPEN'), cb(CB_WON, 'WON', { outcome: 'won', resolvedAt: '2026-10-23T09:00:00' })]
    return route.fulfill({ json: page1(rows) })
  })
  await page.route(/\/api\/v1\/admin\/wallet-refund-requests(\?.*)?$/, (route) => {
    const url = track(calls.refunds)(route.request().url())
    const statuses = url.searchParams.get('status') ?? ''
    const rows = statuses === 'PENDING'
      ? [req(REQ, 'PENDING', { parentRequestId: PARENT })]
      : [req(REQ, 'PENDING', { parentRequestId: PARENT }), req(PARENT, 'FAILED', { failureReason: 'PAWAPAY_WALLET_OUT_OF_FUNDS' })]
    return route.fulfill({ json: page1(rows) })
  })
  return calls
}

test('portefeuilles : noms reliés à la fiche (onglet Argent), aucun UUID, compte supprimé en texte, filtres dans l’URL', async ({ page }) => {
  const calls = await setup(page)
  await page.goto('/transactions?tab=wallets')
  const named = page.locator('[data-test="wallet-holder-w1"]')
  await expect(named).toHaveText('Mariam Koné (@mariam)', { timeout: 15000 })
  await expect(named).toHaveAttribute('href', hrefIs(`/users/${HOLDER}?tab=money`))
  await expect(page.locator('[data-test="wallet-row-w1"]')).not.toContainText(HOLDER.slice(0, 8))
  // Compte supprimé : identifiant abrégé, pas de lien.
  await expect(page.locator('[data-test="wallet-holder-w2"]')).toHaveText(TRAVELER.slice(0, 8))
  await expect(page.locator('[data-test="wallet-row-w2"] a')).toHaveCount(0)
  await expect(page.locator('[data-test="wallet-balance-w2"]')).toHaveText(/6,20 EUR/)

  await page.locator('[data-test="wallets-filter-sign"]').selectOption('NEGATIVE')
  await expect(page).toHaveURL(/\/transactions\?tab=wallets&balanceSign=NEGATIVE$/)
  expect(calls.wallets.at(-1)!.searchParams.get('balanceSign')).toBe('NEGATIVE')
  await page.locator('[data-test="wallets-search"]').fill('mariam')
  await page.locator('[data-test="wallets-search"]').press('Enter')
  await expect.poll(() => calls.wallets.at(-1)!.searchParams.get('q')).toBe('mariam')
  await expect(page).toHaveURL(/query=mariam/)
})

test('lien entrant ?tab=wallets&partyId= (fiche utilisateur) : portefeuilles du titulaire, puce retirable', async ({ page }) => {
  const calls = await setup(page)
  await page.goto(`/transactions?tab=wallets&partyId=${HOLDER}`)
  await expect(page.locator('[data-test="active-chip-partyId"]')).toContainText('Titulaire : Mariam Koné (@mariam)', { timeout: 15000 })
  expect(calls.wallets[0].searchParams.get('partyId')).toBe(HOLDER)
  // Le titulaire n'est pas un filtre des Paiements.
  expect(calls.payments.every(u => u.searchParams.get('partyId') === null)).toBe(true)
  await page.locator('[data-test="active-chip-partyId-remove"]').click()
  await expect(page).toHaveURL(/\/transactions\?tab=wallets$/)
  expect(calls.wallets.at(-1)!.searchParams.get('partyId')).toBeNull()
})

test('commissions cash : vue À traiter (rouge) par défaut, colis et voyageur reliés, Toutes au clic', async ({ page }) => {
  const calls = await setup(page)
  await page.goto('/transactions?tab=cash-commissions')
  await expect(page.locator('[data-test="cash-view-ATTENTION"]')).toHaveAttribute('aria-pressed', 'true', { timeout: 15000 })
  const badge = page.locator('[data-test="cash-view-ATTENTION"] [data-test="tab-count"]')
  await expect(badge).toHaveText('1')
  await expect(badge).toHaveClass(/danger/)
  expect(calls.cash[0].searchParams.get('view')).toBe('ATTENTION')
  await expect(page).toHaveURL(/tab=cash-commissions&view=attention$/)
  await expect(page.locator(`[data-test="cash-route-${BID}"]`)).toHaveAttribute('href', hrefIs(`/colis?open=${BID}&section=money`))
  await expect(page.locator(`[data-test="cash-tracking-${BID}"]`)).toHaveText('YD-4PX9TN')
  await expect(page.locator(`[data-test="cash-traveler-${BID}"]`)).toHaveAttribute('href', hrefIs(`/users/${TRAVELER}`))
  await expect(page.locator(`[data-test="cash-commission-row-${BID}"]`)).not.toContainText(BID.slice(0, 8))

  await page.locator('[data-test="cash-view-ALL"]').click()
  await expect(page).toHaveURL(/\/transactions\?tab=cash-commissions$/)
  expect(calls.cash.at(-1)!.searchParams.get('view')).toBeNull()
})

test('litiges : vue Ouverts par défaut ; liens colis, personnes et « Ouvrir le paiement »', async ({ page }) => {
  const calls = await setup(page)
  await page.goto('/transactions?tab=chargebacks')
  await expect(page.locator('[data-test="cb-view-OPEN"]')).toHaveAttribute('aria-pressed', 'true', { timeout: 15000 })
  expect(calls.cbs[0].searchParams.get('view')).toBe('OPEN')
  await expect(page.locator('[data-test="cb-view-ALL"] [data-test="tab-count"]')).toHaveText('2')
  await expect(page.locator(`[data-test="cb-route-${CB}"]`)).toHaveAttribute('href', hrefIs(`/colis?open=${BID}`))
  await expect(page.locator(`[data-test="cb-sender-${CB}"]`)).toHaveAttribute('href', hrefIs(`/users/${SENDER}`))
  await expect(page.locator(`[data-test="cb-traveler-${CB}"]`)).toHaveAttribute('href', hrefIs(`/users/${TRAVELER}`))
  await expect(page.locator(`[data-test="cb-payment-${CB}"]`)).toHaveAttribute('href', hrefIs(`/transactions?open=${PAY}`))
  await expect(page.locator(`[data-test="cb-row-${CB}"]`)).toContainText('Fraude présumée')
  await page.locator('[data-test="cb-view-WON"]').click()
  await expect(page).toHaveURL(/tab=chargebacks&view=won$/)
})

test('?tab=chargebacks&open=<litige> (tiroir paiement) : vue Tous, ligne mise en évidence à l’écran, pas de tiroir paiement', async ({ page }) => {
  const calls = await setup(page)
  await page.goto(`/transactions?tab=chargebacks&open=${CB_WON}`)
  const row = page.locator(`[data-test="cb-row-${CB_WON}"]`)
  await expect(row).toHaveAttribute('aria-current', 'true', { timeout: 15000 })
  await expect(row).toBeInViewport()
  await expect(row).toContainText('Tranché le 23 oct.')
  expect(calls.cbs[0].searchParams.get('view')).toBeNull()
  await expect(page.locator('[data-test="payment-detail"]')).toHaveCount(0)
  await expect(page).toHaveURL(new RegExp(`tab=chargebacks&open=${CB_WON}$`))
})

test('remboursements wallet : À traiter par défaut si des tickets attendent ; « Reprise d’un échec » ouvre la demande parente', async ({ page }) => {
  const calls = await setup(page, { walletRefundsPending: 1 })
  await page.goto('/transactions?tab=wallet-refunds')
  await expect(page.locator('[data-test="wrr-view-pending"]')).toHaveAttribute('aria-pressed', 'true', { timeout: 15000 })
  expect(calls.refunds.at(-1)!.searchParams.get('status')).toBe('PENDING')
  await expect(page).toHaveURL(/tab=wallet-refunds&view=pending$/)
  await expect(page.locator(`[data-test="wrr-user-${REQ}"]`)).toHaveAttribute('href', hrefIs(`/users/${HOLDER}?tab=money`))
  // Page déjà ouverte : seule la query change, la demande parente (en échec) est montrée dans Toutes.
  await page.locator(`[data-test="wrr-parent-${REQ}"]`).click()
  await expect(page).toHaveURL(new RegExp(`tab=wallet-refunds&open=${PARENT}$`))
  await expect(page.locator(`[data-test="wrr-row-${PARENT}"]`)).toHaveAttribute('aria-current', 'true')
  await expect(page.locator('[data-test="wrr-view-all"]')).toHaveAttribute('aria-pressed', 'true')
})

test('?tab=wallet-refunds&open=<demande> au chargement : ligne mise en évidence', async ({ page }) => {
  await setup(page, { walletRefundsPending: 1 })
  await page.goto(`/transactions?tab=wallet-refunds&open=${PARENT}`)
  const row = page.locator(`[data-test="wrr-row-${PARENT}"]`)
  await expect(row).toHaveAttribute('aria-current', 'true', { timeout: 15000 })
  await expect(row).toBeInViewport()
})

test('portée de l’URL : les paramètres des Paiements ne passent pas dans Soldes ni dans Litiges, et reviennent avec les Paiements', async ({ page }) => {
  const calls = await setup(page)
  await page.goto('/transactions?view=ALL&query=awa&currency=XOF')
  await expect(page.locator('[data-test="payment-row-p1"]')).toBeVisible({ timeout: 15000 })
  await page.locator('[data-test="tab-wallets"]').click()
  await expect(page.locator('[data-test="wallet-row-w1"]')).toBeVisible()
  await expect(page).toHaveURL(/\/transactions\?tab=wallets$/)
  expect(calls.wallets[0].searchParams.get('currency')).toBeNull()
  expect(calls.wallets[0].searchParams.get('q')).toBeNull()

  await page.locator('[data-test="tab-chargebacks"]').click()
  await expect(page.locator(`[data-test="cb-row-${CB}"]`)).toBeVisible()
  await page.locator('[data-test="cb-view-WON"]').click()
  await expect(page).toHaveURL(/\/transactions\?tab=chargebacks&view=won$/)

  await page.locator('[data-test="tab-cash-commissions"]').click()
  await expect(page).toHaveURL(/\/transactions\?tab=cash-commissions&view=attention$/)

  await page.locator('[data-test="tab-payments"]').click()
  await expect(page).toHaveURL(/\/transactions\?(?=.*query=awa)(?=.*currency=XOF)[^#]*$/)
  await expect(page).not.toHaveURL(/tab=/)
})

test('ancien back : pas de vues ni de nombres, colonnes d’avant avec identifiants abrégés, jamais « undefined »', async ({ page }) => {
  await setup(page, { old: true })
  await page.goto('/transactions?tab=chargebacks&view=open')
  await expect(page.locator(`[data-test="cb-row-${CB}"]`)).toBeVisible({ timeout: 15000 })
  await expect(page.locator('[data-test="cb-view-OPEN"]')).toHaveCount(0)
  await expect(page.locator(`[data-test="cb-bid-${CB}"]`)).toHaveText(BID.slice(0, 8))
  await expect(page.locator(`[data-test="cb-row-${CB}"]`)).not.toContainText('Ouvrir le paiement')

  await page.locator('[data-test="tab-cash-commissions"]').click()
  await expect(page.locator(`[data-test="cash-bid-${BID}"]`)).toHaveText(BID.slice(0, 8))
  await expect(page.locator('[data-test="cash-view-ATTENTION"]')).toHaveCount(0)

  await page.locator('[data-test="tab-wallets"]').click()
  // Ancien back : identifiant abrégé, toujours relié à la fiche (comme la ligne cliquable d'avant).
  await expect(page.locator('[data-test="wallet-holder-w1"]')).toHaveText(HOLDER.slice(0, 8))
  await expect(page.locator('[data-test="wallet-holder-w1"]')).toHaveAttribute('href', hrefIs(`/users/${HOLDER}?tab=money`))
  await expect(page.locator('main')).not.toContainText('undefined')
})
