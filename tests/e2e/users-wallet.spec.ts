import { test, expect, type Page, type Request } from '@playwright/test'

const ADMIN = { id: 'a1', email: 'admin.1@yadony.com', role: 'ADMIN', status: 'ACTIVE', mustChangePassword: false, permissionOverrides: {} }

const USER = {
  id: 'u1', firstName: 'Jean', lastName: 'Dupont', phoneNumber: '+33611111111', city: 'Paris', country: 'FR',
  status: 'ACTIVE', kycStatus: 'VERIFIED', isProAccount: false, averageRating: 4.5, totalTrips: 2, totalShipments: 3,
  createdAt: '2026-01-01',
}
const LIST_PAGE = { content: [USER], totalElements: 1, totalPages: 1, number: 0, size: 20 }
const DETAIL = {
  ...USER, email: 'jean@x.fr', roles: ['SENDER'], stripeAccountStatus: 'ONBOARDING_COMPLETE', commissionRateOverride: null,
  publishingSuspended: false, kiloPro: false, cancellationCount: 0, noShowCount: 1, refusedCount: 0,
  senderHandoverIncidentCount: 0, ratingCount: 10, deletionRequestedAt: null, messagingMutedUntil: null,
}
const ACCOUNT_EUR = { currency: 'EUR', balance: 12.5, refundEligibleAmount: 10, frozen: false }
const TOP_UP = { id: 't1', currency: 'EUR', type: 'TOP_UP', amount: 20, balanceAfter: 20, createdAt: '2026-09-01T10:00:00Z' }
const BID = { id: 't2', currency: 'EUR', type: 'BID_PAYMENT', amount: -7.5, balanceAfter: 12.5, bidId: 'b1', createdAt: '2026-09-02T10:00:00Z' }
const CREDIT = {
  id: 't3', currency: 'EUR', type: 'ADMIN_CREDIT', amount: 5, balanceAfter: 17.5, createdAt: '2026-09-27T10:00:00Z',
  adminReason: 'Geste commercial après incident', adminActorId: 'a1', adminActorEmail: 'admin.1@yadony.com',
}
const txPage = (content: unknown[]) => ({ content, totalElements: content.length, totalPages: 1, number: 0, size: 20 })

type AdjustmentMode = 'success' | 'cap-exceeded'
interface Mocks { adjustments: Request[] }

async function mockBackend(
  page: Page,
  opts: { walletMissing?: boolean; adjustment?: AdjustmentMode; refundableUnknown?: boolean } = {},
): Promise<Mocks> {
  const mocks: Mocks = { adjustments: [] }
  let credited = false
  await page.addInitScript((u) => {
    ;(window as unknown as { __yadonyAuthSeed: typeof u }).__yadonyAuthSeed = u
  }, ADMIN)
  await page.route('**/api/v1/admin/users**', (route) => {
    const req = route.request()
    const url = req.url()
    if (url.includes('/u1/wallet/adjustments') && req.method() === 'POST') {
      mocks.adjustments.push(req)
      if (opts.adjustment === 'cap-exceeded') {
        return route.fulfill({
          status: 422,
          contentType: 'application/problem+json',
          json: {
            type: 'https://api.yadony.com/errors/wallet-adjustment-cap-exceeded', title: 'Plafond dépassé', status: 422,
            code: 'wallet-adjustment-cap-exceeded', detail: 'Une correction ne peut pas dépasser 500 € d’équivalent par opération.',
          },
        })
      }
      credited = true
      return route.fulfill({ json: { account: { ...ACCOUNT_EUR, balance: 17.5 }, transaction: CREDIT } })
    }
    if (url.includes('/u1/wallet')) {
      if (opts.walletMissing) {
        return route.fulfill({
          status: 404, contentType: 'application/problem+json',
          json: { type: 'https://api.yadony.com/errors/not-found', title: 'Not Found', status: 404, detail: 'No endpoint matches this path' },
        })
      }
      if (url.includes('/u1/wallet/transactions')) {
        return route.fulfill({ json: txPage(credited ? [CREDIT, BID, TOP_UP] : [BID, TOP_UP]) })
      }
      const account = credited ? { ...ACCOUNT_EUR, balance: 17.5 } : ACCOUNT_EUR
      return route.fulfill({ json: { accounts: [opts.refundableUnknown ? { ...account, refundEligibleAmount: null } : account] } })
    }
    if (url.includes('/u1') && req.method() === 'GET') return route.fulfill({ json: DETAIL })
    return route.fulfill({ json: LIST_PAGE })
  })
  return mocks
}

async function openWalletTab(page: Page) {
  await page.goto('/users')
  await page.locator('[data-test="row-u1"]').click()
  await page.locator('[data-test="tab-wallet"]').click()
  await expect(page.locator('[data-test="wallet-account-EUR"]')).toContainText('12,50 EUR')
}

async function fillCredit(page: Page) {
  await page.locator('[data-test="wallet-adjust-open"]').click()
  await page.locator('[data-test="adj-amount"]').fill('5')
  await page.locator('[data-test="adj-reason"]').fill('Geste commercial après incident')
  await expect(page.locator('[data-test="adj-recap"]')).toContainText('17,50 EUR')
  await page.locator('[data-test="adj-continue"]').click()
  await page.locator('[data-test="adj-confirm"]').click()
}

test('admin voit les soldes et le journal puis crédite le portefeuille', async ({ page }) => {
  const mocks = await mockBackend(page, { adjustment: 'success' })
  await openWalletTab(page)
  await expect(page.locator('[data-test="wallet-tx-t2"] [data-test="wallet-tx-amount"]')).toHaveText('−7,50 EUR')
  await expect(page.locator('[data-test="wallet-tx-t1"]')).toContainText('Recharge')

  await fillCredit(page)

  await expect(page.locator('[data-test="wallet-success"]')).toContainText('Solde corrigé')
  await expect(page.locator('[data-test="wallet-account-EUR"]')).toContainText('17,50 EUR')
  await expect(page.locator('[data-test="wallet-tx-t3"] [data-test="wallet-tx-admin"]')).toContainText('admin.1@yadony.com')
  expect(mocks.adjustments).toHaveLength(1)
  const req = mocks.adjustments[0]!
  expect(req.headers()['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/)
  expect(req.postDataJSON()).toEqual({ currency: 'EUR', direction: 'CREDIT', amount: 5, reason: 'Geste commercial après incident' })
})

test('un refus 422 du back est affiché dans le dialogue', async ({ page }) => {
  await mockBackend(page, { adjustment: 'cap-exceeded' })
  await openWalletTab(page)
  await fillCredit(page)
  await expect(page.locator('[data-test="adj-error"]')).toHaveText('Une correction ne peut pas dépasser 500 € d’équivalent par opération.')
  await expect(page.locator('[data-test="adj-dialog"]')).toBeVisible()
  await expect(page.locator('[data-test="wallet-account-EUR"]')).toContainText('12,50 EUR')
})

test('part remboursable non calculable (null côté back) : mention discrète', async ({ page }) => {
  await mockBackend(page, { refundableUnknown: true })
  await openWalletTab(page)
  await expect(page.locator('[data-test="wallet-account-EUR"] [data-test="wallet-refundable"]')).toHaveText('Remboursable : non calculable')
})

test('ancien back sans endpoint portefeuille : mention discrète et aucune correction', async ({ page }) => {
  await mockBackend(page, { walletMissing: true })
  await page.goto('/users')
  await page.locator('[data-test="row-u1"]').click()
  await page.locator('[data-test="tab-wallet"]').click()
  await expect(page.locator('[data-test="wallet-unavailable"]')).toHaveText('Portefeuille indisponible pour le moment')
  await expect(page.locator('[data-test="wallet-error"]')).toHaveCount(0)
  await expect(page.locator('[data-test="wallet-adjust-open"]')).toHaveCount(0)
})

test('une ligne de l’onglet Portefeuilles ouvre la fiche de l’utilisateur', async ({ page }) => {
  await mockBackend(page)
  await page.route('**/api/v1/admin/payments**', (route) => route.fulfill({
    json: txPage([{ id: 'p1', bidId: 'b1', status: 'ESCROW', method: 'STRIPE', amountCents: 1000, commissionCents: 120, currency: 'EUR', createdAt: '2026-09-01T10:00:00Z' }]),
  }))
  await page.route('**/api/v1/admin/wallets**', (route) => route.fulfill({
    json: txPage([{ id: 'w1', userId: 'u1', balanceCents: 1250, currency: 'EUR', updatedAt: '2026-09-01T10:00:00Z' }]),
  }))
  await page.goto('/transactions')
  // Ancrage sur une ligne chargée côté client (page hydratée) avant de changer d'onglet :
  // l'état vide, lui, sort déjà du rendu serveur et ne prouve rien.
  await expect(page.locator('[data-test="payment-row-p1"]')).toBeVisible()
  await page.locator('[data-test="tab-wallets"]').click()
  await page.locator('[data-test="wallet-row-w1"]').click()
  await expect(page).toHaveURL(/\/users\?query=u1&open=u1/)
  await expect(page.locator('aside').getByText('jean@x.fr')).toBeVisible()
})
