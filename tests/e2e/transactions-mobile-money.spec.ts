import { test, expect, type Page } from '@playwright/test'

/** `href` exact, préfixe de l'application (`/siragbe`) compris : rien d'autre avant ni après. */
const hrefIs = (path: string) => new RegExp(`^(/siragbe)?${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)

/**
 * Section Mobile money de /transactions : vues à nombres (Échecs, En cours, Réussies, Toutes),
 * recherche, filtres, liens selon le motif de l'opération, numéro toujours masqué, repli sur
 * l'ancien back (sans nombres).
 */
const ADMIN = { id: 'a1', email: 'admin.1@yadony.com', role: 'ADMIN', status: 'ACTIVE', mustChangePassword: false, permissionOverrides: {} }
const PERSON = '11111111-2222-4333-8444-555555555555'
const BID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const PAY = 'cccccccc-0000-4000-8000-000000000001'
const WRR = 'dddddddd-0000-4000-8000-000000000002'
const COUNTS = { failed: 2, open: 1, done: 7, all: 10, attention: 2 }
const RAW_PHONE = '221771234567'

const base = { countryCode: 'CI', phoneNumber: RAW_PHONE, amountCents: 75000, currency: 'XOF', createdAt: '2026-10-20T10:00:00Z', provider: 'ORANGE_CIV' }
const FAILED_PAYOUT = {
  ...base, id: 'f1', paymentId: PAY, kind: 'PAYOUT', status: 'FAILED', failureCode: 'PAYER_LIMIT_REACHED', purpose: 'BID_PAYMENT',
  personId: PERSON, personName: 'Ibrahima Ndiaye', role: 'TRAVELER', bidId: BID, trackingNumber: 'YD-8F3K2Q', corridor: 'Paris → Dakar', retryable: true,
}
const TOPUP = {
  ...base, id: 't1', paymentId: null, kind: 'DEPOSIT', status: 'COMPLETED', purpose: 'WALLET_TOPUP', personId: PERSON, personName: 'Awa Diallo', role: 'USER',
}
const WALLET_REFUND = {
  ...base, id: 'w1', paymentId: null, kind: 'REFUND', status: 'COMPLETED', purpose: 'WALLET_REFUND', personId: PERSON, personName: 'Awa Diallo', role: 'USER', walletRefundRequestId: WRR,
}
const SUPPLEMENT = {
  ...base, id: 's1', paymentId: null, kind: 'DEPOSIT', status: 'COMPLETED', purpose: 'BID_SUPPLEMENT', personId: PERSON, personName: 'Awa Diallo', role: 'SENDER', bidId: BID, trackingNumber: 'YD-8F3K2Q', corridor: 'Paris → Dakar',
}
const BID_PAYMENT = {
  ...base, id: 'b1', paymentId: PAY, kind: 'DEPOSIT', status: 'COMPLETED', purpose: 'BID_PAYMENT', personId: PERSON, personName: 'Awa Diallo', role: 'SENDER', bidId: BID, trackingNumber: 'YD-8F3K2Q', corridor: 'Paris → Dakar',
}
const page1 = (content: object[]) => ({ content, totalElements: content.length, totalPages: 1, number: 0, size: 20 })

async function setup(page: Page, opts: { countsMissing?: boolean; byView?: Record<string, object[]> } = {}) {
  const lists: URL[] = []
  const countsCalls: URL[] = []
  const byView = opts.byView ?? { FAILED: [FAILED_PAYOUT], DONE: [TOPUP, WALLET_REFUND, SUPPLEMENT, BID_PAYMENT], '': [FAILED_PAYOUT, TOPUP, WALLET_REFUND, SUPPLEMENT, BID_PAYMENT] }
  await page.addInitScript((u) => { (window as unknown as { __yadonyAuthSeed: typeof u }).__yadonyAuthSeed = u }, ADMIN)
  await page.route('**/api/v1/admin/payments**', route => route.fulfill({ json: page1([]) }))
  await page.route('**/api/v1/admin/mobile-money-payments/counts**', (route) => {
    countsCalls.push(new URL(route.request().url()))
    if (opts.countsMissing) return route.fulfill({ status: 404, contentType: 'application/problem+json', body: JSON.stringify({ status: 404, detail: 'No endpoint' }) })
    return route.fulfill({ json: COUNTS })
  })
  await page.route(/\/api\/v1\/admin\/mobile-money-payments(\?.*)?$/, (route) => {
    const url = new URL(route.request().url())
    lists.push(url)
    const view = url.searchParams.get('view') ?? ''
    return route.fulfill({ json: page1(byView[view] ?? byView[''] ?? []) })
  })
  return { lists, countsCalls }
}

test('vues à nombres : Échecs par défaut, rouge, puis Réussies dans l’URL', async ({ page }) => {
  const { lists, countsCalls } = await setup(page)
  await page.goto('/transactions?tab=mobile-money')
  await expect(page.locator('[data-test="mm-row-f1"]')).toBeVisible({ timeout: 15000 })
  await expect(page.locator('[data-test="mm-view-FAILED"]')).toHaveAttribute('aria-pressed', 'true')
  expect(lists[0].searchParams.get('view')).toBe('FAILED')
  const failedBadge = page.locator('[data-test="mm-view-FAILED"] [data-test="tab-count"]')
  await expect(failedBadge).toHaveText('2')
  await expect(failedBadge).toHaveClass(/danger/)
  await expect(page.locator('[data-test="mm-view-DONE"] [data-test="tab-count"]')).toHaveText('7')
  await expect(page.locator('[data-test="mm-view-ALL"] [data-test="tab-count"]')).toHaveText('10')
  // Les nombres ne portent pas la vue.
  expect(countsCalls[0].searchParams.get('view')).toBeNull()
  await expect(page).toHaveURL(/tab=mobile-money.*view=failed|view=failed.*tab=mobile-money/)

  await page.locator('[data-test="mm-view-DONE"]').click()
  await expect(page.locator('[data-test="mm-row-t1"]')).toBeVisible()
  await expect(page).toHaveURL(/view=done/)
  expect(lists.at(-1)!.searchParams.get('view')).toBe('DONE')
  expect(lists.at(-1)!.searchParams.get('page')).toBe('0')
})

test('lien entrant ?tab=mobile-money&view=done&kind=PAYOUT : filtres appliqués', async ({ page }) => {
  const { lists } = await setup(page)
  await page.goto('/transactions?tab=mobile-money&view=done&kind=PAYOUT')
  await expect(page.locator('[data-test="mm-row-t1"]')).toBeVisible({ timeout: 15000 })
  expect(lists[0].searchParams.get('view')).toBe('DONE')
  expect(lists[0].searchParams.get('kind')).toBe('PAYOUT')
  await expect(page.locator('[data-test="mm-filter-kind"]')).toHaveValue('PAYOUT')
})

test('vue Échecs vide : « Aucune opération en échec »', async ({ page }) => {
  await setup(page, { byView: { FAILED: [], '': [TOPUP] } })
  await page.goto('/transactions?tab=mobile-money')
  await expect(page.getByText('Aucune opération en échec')).toBeVisible({ timeout: 15000 })
})

test('recherche : 300 ms après la frappe, Entrée tout de suite, sans mention du téléphone', async ({ page }) => {
  const { lists, countsCalls } = await setup(page)
  await page.goto('/transactions?tab=mobile-money&view=all')
  await expect(page.locator('[data-test="mm-row-f1"]')).toBeVisible({ timeout: 15000 })
  const search = page.locator('[data-test="mm-search"]')
  const placeholder = await search.getAttribute('placeholder')
  expect(placeholder).toBe('Chercher : nom, référence d’opération, n° de suivi, trajet')
  await search.fill('YD-8F')
  await expect.poll(() => lists.at(-1)!.searchParams.get('q')).toBe('YD-8F')
  await expect(page).toHaveURL(/query=YD-8F/)
  // Les nombres suivent la recherche.
  expect(countsCalls.at(-1)!.searchParams.get('q')).toBe('YD-8F')
  await search.fill('awa')
  await search.press('Enter')
  await expect.poll(() => lists.at(-1)!.searchParams.get('q')).toBe('awa')
})

test('filtre Opérateur : les opérateurs vus sont proposés', async ({ page }) => {
  const { lists } = await setup(page)
  await page.goto('/transactions?tab=mobile-money&view=all')
  await expect(page.locator('[data-test="mm-row-f1"]')).toBeVisible({ timeout: 15000 })
  await page.locator('[data-test="mm-filter-provider"]').selectOption('ORANGE_CIV')
  await expect.poll(() => lists.at(-1)!.searchParams.get('provider')).toBe('ORANGE_CIV')
  await expect(page).toHaveURL(/provider=ORANGE_CIV/)
})

test('liens selon le motif, numéro toujours masqué', async ({ page }) => {
  await setup(page)
  await page.goto('/transactions?tab=mobile-money&view=all')
  await expect(page.locator('[data-test="mm-row-f1"]')).toBeVisible({ timeout: 15000 })
  // BID_PAYMENT : colis, personne, paiement.
  await expect(page.locator('[data-test="mm-route-b1"]')).toHaveAttribute('href', hrefIs(`/colis?open=${BID}`))
  await expect(page.locator('[data-test="mm-tracking-b1"]')).toHaveAttribute('href', hrefIs(`/colis?open=${BID}`))
  await expect(page.locator('[data-test="mm-person-b1"]')).toHaveAttribute('href', hrefIs(`/users/${PERSON}`))
  await expect(page.locator('[data-test="mm-main-b1"]')).toHaveText('Ouvrir le paiement')
  await expect(page.locator('[data-test="mm-main-b1"]')).toHaveAttribute('href', hrefIs(`/transactions?open=${PAY}`))
  // WALLET_TOPUP : la personne seule, onglet Argent.
  await expect(page.locator('[data-test="mm-person-t1"]')).toHaveAttribute('href', hrefIs(`/users/${PERSON}?tab=money`))
  await expect(page.locator('[data-test="mm-main-t1"]')).toHaveCount(0)
  await expect(page.locator('[data-test="mm-route-t1"]')).toHaveCount(0)
  // WALLET_REFUND : la demande de remboursement.
  await expect(page.locator('[data-test="mm-main-w1"]')).toHaveAttribute('href', hrefIs(`/transactions?tab=wallet-refunds&open=${WRR}`))
  // BID_SUPPLEMENT : le colis, onglet Argent.
  await expect(page.locator('[data-test="mm-route-s1"]')).toHaveAttribute('href', hrefIs(`/colis?open=${BID}&section=money`))
  // Relance : vers le tiroir du paiement, onglet Incidents ; aucun bouton ici.
  await expect(page.locator('[data-test="mm-retry-f1"]')).toHaveText('Relancer depuis le paiement')
  await expect(page.locator('[data-test="mm-retry-f1"]')).toHaveAttribute('href', hrefIs(`/transactions?open=${PAY}&section=incidents`))
  await expect(page.locator('[data-test="mm-failure-f1"]')).toHaveText('PAYER_LIMIT_REACHED')
  // Numéro masqué partout, jamais en clair dans la page.
  await expect(page.locator('[data-test="mm-phone-f1"]')).toHaveText('••••••••4567')
  expect(await page.content()).not.toContain(RAW_PHONE)
})

test('ancien backend : pas de vues ni de nombres, liste plate sans paramètre view', async ({ page }) => {
  const { lists } = await setup(page, { countsMissing: true })
  await page.goto('/transactions?tab=mobile-money&view=failed')
  await expect(page.locator('[data-test="mm-row-f1"]')).toBeVisible({ timeout: 15000 })
  await expect(page.locator('[data-test="mm-view-FAILED"]')).toHaveCount(0)
  expect(lists[0].searchParams.get('view')).toBeNull()
  await expect(page).not.toHaveURL(/view=/)
})

test('changer de section ne mélange pas les filtres : view/query de Mobile money ne passent pas aux Paiements', async ({ page }) => {
  const paymentLists: string[] = []
  await setup(page)
  await page.route('**/api/v1/admin/payments**', (route) => { paymentLists.push(route.request().url()); return route.fulfill({ json: page1([]) }) })
  await page.goto('/transactions?tab=mobile-money&view=done&query=awa')
  await expect(page.locator('[data-test="mm-row-t1"]')).toBeVisible({ timeout: 15000 })
  await page.locator('[data-test="tab-payments"]').click()
  await expect(page).not.toHaveURL(/view=done/)
  await expect(page).not.toHaveURL(/query=awa/)
  await expect(page).not.toHaveURL(/tab=/)
  expect(paymentLists.some(u => u.includes('query=awa') || u.includes('view=DONE'))).toBe(false)
  // Et retour : les filtres de Mobile money reviennent depuis l'état, dans l'URL.
  await page.locator('[data-test="tab-mobile-money"]').click()
  await expect(page).toHaveURL(/tab=mobile-money/)
  await expect(page).toHaveURL(/view=done/)
})
