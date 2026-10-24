import { test, expect } from '@playwright/test'

/** `href` exact, préfixe de l'application (`/siragbe`) compris : rien d'autre avant ni après. */
const hrefIs = (path: string) => new RegExp(`^(/siragbe)?${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)

/**
 * Versements retenus d'un voyageur banni ou dont l'identité est révoquée : filtre, détail,
 * déblocage par dérogation motivée, 409 inattendu, et bandeau de la fiche utilisateur.
 */
const ADMIN = { id: 'a1', email: 'admin.1@yadony.com', role: 'ADMIN', status: 'ACTIVE', mustChangePassword: false, permissionOverrides: {} }

const NORMAL = { id: 'p1', bidId: 'b1', status: 'ESCROW', method: 'STRIPE', amountCents: 12345, commissionCents: 1480, currency: 'EUR', createdAt: '2026-06-01T10:00:00Z', beneficiaryHeld: false, travelerId: 'u1' }
// Voyageur banni : un vrai UUID, car le lien de la cause passe par le registre (`userRoute`).
const HELD_TRAVELER = '7a7a7a7a-1111-4111-8111-777777777777'
const HELD = {
  id: 'p9', bidId: 'b9', status: 'ESCROW', method: 'STRIPE', amountCents: 50000, commissionCents: 6000, currency: 'EUR', createdAt: '2026-09-18T10:00:00Z',
  payoutHeldAt: '2026-09-20T10:00:00Z', beneficiaryHeld: true, beneficiaryHoldReason: 'BANNED', travelerId: HELD_TRAVELER,
}
const detailOf = (p: object) => ({ ...p, refundedCents: 0, stripePaymentIntentId: 'pi_x', escrowReleasedAt: null, disputed: false })
const page1 = (content: object[]) => ({ content, totalElements: content.length, totalPages: 1, number: 0, size: 20 })

type Captured = { url: string; body: string | null }

type ErrorReply = { status: number; body: Record<string, unknown> }

async function routePayments(page: import('@playwright/test').Page, opts: { conflictOnFirstRelease?: string; firstReleaseError?: ErrorReply } = {}) {
  const posts: Captured[] = []
  const lists: string[] = []
  let conflictSent = false
  // Comme le vrai serveur : après un geste réussi, la fiche relue (GET) porte le nouvel état.
  const after: Record<string, object> = {}
  await page.addInitScript((u) => { (window as unknown as { __yadonyAuthSeed: typeof u }).__yadonyAuthSeed = u }, ADMIN)
  await page.route('**/api/v1/admin/payments**', (route) => {
    const req = route.request(); const url = req.url()
    if (req.method() === 'POST') {
      posts.push({ url, body: req.postData() })
      const reply = opts.firstReleaseError
        ?? (opts.conflictOnFirstRelease ? { status: 409, body: { code: opts.conflictOnFirstRelease, detail: 'Refus du serveur' } } : null)
      if (reply && !conflictSent && url.includes('/force-release')) {
        conflictSent = true
        return route.fulfill({
          status: reply.status, contentType: 'application/problem+json',
          body: JSON.stringify({ status: reply.status, ...reply.body }),
        })
      }
      const base = url.includes('/p9/') ? HELD : NORMAL
      after[base.id] = { ...detailOf(base), status: 'RELEASED', payoutHeldAt: undefined, beneficiaryHeld: false }
      return route.fulfill({ json: after[base.id] })
    }
    if (url.includes('/admin/payments/p9')) return route.fulfill({ json: after.p9 ?? detailOf(HELD) })
    if (url.includes('/admin/payments/p1')) return route.fulfill({ json: after.p1 ?? detailOf(NORMAL) })
    lists.push(url)
    return route.fulfill({ json: url.includes('held=true') ? page1([HELD]) : page1([NORMAL, HELD]) })
  })
  return { posts, lists }
}

test('paiement retenu : filtre, détail, puis déblocage avec dérogation motivée', async ({ page }) => {
  const { posts, lists } = await routePayments(page)
  await page.goto('/transactions')
  await expect(page.locator('[data-test="payment-row-p1"]')).toBeVisible({ timeout: 15000 })
  await expect(page.locator('[data-test="payment-held-p9"]')).toHaveText('Versement retenu')
  await expect(page.locator('[data-test="payment-held-p1"]')).toHaveCount(0)

  // « Versements retenus » vit sous « Plus de filtres » et devient l'alerte HELD dans l'URL
  // (`held=true` n'est plus qu'un alias d'entrée ; la liste reçoit toujours held=true).
  await page.locator('[data-test="more-filters"]').click()
  await page.locator('[data-test="chip-held"]').click()
  await expect(page).toHaveURL(/alert=HELD/)
  await expect(page.locator('[data-test="payment-row-p1"]')).toHaveCount(0)
  expect(lists.some((u) => u.includes('held=true'))).toBe(true)

  await page.locator('[data-test="payment-row-p9"]').click()
  // L'encart de la retenue est dans l'onglet Incidents du tiroir.
  await page.locator('[data-test="payment-tab-incidents"]').click()
  const notice = page.locator('[data-test="payment-hold-notice"]')
  await expect(notice).toContainText('Le voyageur a été banni.')
  await expect(notice).toContainText('20/09/2026')
  // Banni : la cause s'explique dans la fiche du voyageur, onglet Gestion (registre `userRoute`).
  await expect(page.locator('[data-test="payment-hold-traveler-link"]')).toHaveAttribute('href', hrefIs(`/users/${HELD_TRAVELER}?tab=manage`))

  // Les gestes vivent dans le menu « Actions » du tiroir.
  await page.locator('[data-test="payment-actions-menu"]').click()
  await page.locator('[data-test="action-release"]').click()
  await expect(page.locator('[data-test="override-warning"]')).toContainText('banni')
  const submit = page.locator('[data-test="override-submit"]')
  await expect(submit).toBeDisabled()
  await page.locator('[data-test="override-reason"]').fill('Livraison vérifiée avec le destinataire')
  await expect(submit).toBeDisabled()
  await page.locator('[data-test="override-checked"]').check()
  await submit.click()

  await expect(page.locator('aside').getByText('Libéré')).toBeVisible()
  expect(posts).toHaveLength(1)
  expect(posts[0]!.url).toContain('/admin/payments/p9/force-release')
  expect(JSON.parse(posts[0]!.body!)).toEqual({ overrideHold: true, overrideReason: 'Livraison vérifiée avec le destinataire' })
})

test('paiement normal : déblocage inchangé, sans case ni corps', async ({ page }) => {
  const { posts } = await routePayments(page)
  await page.goto('/transactions')
  await page.locator('[data-test="payment-row-p1"]').click()
  await page.locator('[data-test="payment-tab-incidents"]').click()
  await expect(page.locator('[data-test="payment-panel-incidents"]')).toBeVisible()
  await expect(page.locator('[data-test="payment-hold-notice"]')).toHaveCount(0)
  // Les gestes vivent dans le menu « Actions » du tiroir.
  await page.locator('[data-test="payment-actions-menu"]').click()
  await page.locator('[data-test="action-release"]').click()
  await expect(page.locator('[data-test="override-dialog"]')).toHaveCount(0)
  await page.locator('[data-test="reason"]').fill('J+48 atteint')
  await page.locator('[data-test="confirm"]').click()
  await expect(page.locator('aside').getByText('Libéré')).toBeVisible()
  expect(posts).toHaveLength(1)
  expect(posts[0]!.body).toBeNull()
})

test('409 inattendu payout-beneficiary-held : bascule en dérogation puis renvoi avec overrideHold', async ({ page }) => {
  const { posts } = await routePayments(page, { conflictOnFirstRelease: 'payout-beneficiary-held' })
  await page.goto('/transactions')
  await page.locator('[data-test="payment-row-p1"]').click()
  // Les gestes vivent dans le menu « Actions » du tiroir.
  await page.locator('[data-test="payment-actions-menu"]').click()
  await page.locator('[data-test="action-release"]').click()
  await page.locator('[data-test="reason"]').fill('J+48 atteint')
  await page.locator('[data-test="confirm"]').click()

  await expect(page.locator('[data-test="override-dialog"]')).toBeVisible()
  await expect(page.locator('[data-test="payment-error"]')).toContainText('Versement retenu')
  await page.locator('[data-test="override-checked"]').check()
  await page.locator('[data-test="override-reason"]').fill('Colis remis en main propre, vérifié')
  await page.locator('[data-test="override-submit"]').click()

  await expect(page.locator('aside').getByText('Libéré')).toBeVisible()
  expect(posts).toHaveLength(2)
  expect(posts[0]!.body).toBeNull()
  expect(JSON.parse(posts[1]!.body!)).toEqual({ overrideHold: true, overrideReason: 'Colis remis en main propre, vérifié' })
})

test('409 stripe-account-unusable : message clair, aucune dérogation proposée', async ({ page }) => {
  await routePayments(page, { firstReleaseError: { status: 409, body: { code: 'stripe-account-unusable', detail: 'x', stripeAccountStatus: 'DISABLED' } } })
  await page.goto('/transactions')
  await page.locator('[data-test="payment-row-p1"]').click()
  // Les gestes vivent dans le menu « Actions » du tiroir.
  await page.locator('[data-test="payment-actions-menu"]').click()
  await page.locator('[data-test="action-release"]').click()
  await page.locator('[data-test="reason"]').fill('J+48 atteint')
  await page.locator('[data-test="confirm"]').click()
  await expect(page.locator('[data-test="payment-error"]')).toContainText('compte Stripe du voyageur est inutilisable (statut : désactivé)')
  await expect(page.locator('[data-test="override-dialog"]')).toHaveCount(0)
})

test('409 à deux blocages : litige bancaire ET compte gelé affichés ensemble', async ({ page }) => {
  await routePayments(page, { firstReleaseError: { status: 409, body: {
    code: 'payment-disputed', detail: 'x', blockers: ['DISPUTED', 'BENEFICIARY_HELD'], holdReasons: ['BANNED', 'KYC_REVOKED'], travelerId: 'u1',
  } } })
  await page.goto('/transactions')
  await page.locator('[data-test="payment-row-p1"]').click()
  // Les gestes vivent dans le menu « Actions » du tiroir.
  await page.locator('[data-test="payment-actions-menu"]').click()
  await page.locator('[data-test="action-release"]').click()
  await page.locator('[data-test="reason"]').fill('J+48 atteint')
  await page.locator('[data-test="confirm"]').click()
  await expect(page.locator('[data-test="override-blocker-DISPUTED"]')).toContainText('litige bancaire')
  await expect(page.locator('[data-test="override-blocker-BENEFICIARY_HELD"]')).toContainText('banni et son identité a été révoquée')
})

test('422 override-reason-invalid : le dialogue reste ouvert avec le détail, puis le renvoi passe', async ({ page }) => {
  const { posts } = await routePayments(page, { firstReleaseError: { status: 422, body: {
    code: 'override-reason-invalid', detail: 'Le motif de dérogation doit faire entre 10 et 500 caractères',
  } } })
  await page.goto('/transactions')
  await page.locator('[data-test="payment-row-p9"]').click()
  // Les gestes vivent dans le menu « Actions » du tiroir.
  await page.locator('[data-test="payment-actions-menu"]').click()
  await page.locator('[data-test="action-release"]').click()
  await page.locator('[data-test="override-checked"]').check()
  await page.locator('[data-test="override-reason"]').fill('Motif accepté côté front')
  await page.locator('[data-test="override-submit"]').click()
  await expect(page.locator('[data-test="override-error"]')).toHaveText('Le motif de dérogation doit faire entre 10 et 500 caractères')
  await expect(page.locator('[data-test="override-reason"]')).toHaveValue('Motif accepté côté front')
  await page.locator('[data-test="override-submit"]').click()
  await expect(page.locator('aside').getByText('Libéré')).toBeVisible()
  expect(posts).toHaveLength(2)
})

test('409 transfer-already-attempted : conseil de vérifier dans Stripe, aucune dérogation', async ({ page }) => {
  await routePayments(page, { firstReleaseError: { status: 409, body: { code: 'transfer-already-attempted', detail: 'x' } } })
  await page.goto('/transactions')
  await page.locator('[data-test="payment-row-p1"]').click()
  // Les gestes vivent dans le menu « Actions » du tiroir.
  await page.locator('[data-test="payment-actions-menu"]').click()
  await page.locator('[data-test="action-release"]').click()
  await page.locator('[data-test="reason"]').fill('J+48 atteint')
  await page.locator('[data-test="confirm"]').click()
  await expect(page.locator('[data-test="payment-error"]')).toContainText('Vérifiez dans Stripe')
  await expect(page.locator('[data-test="override-dialog"]')).toHaveCount(0)
})

test('fiche utilisateur : bandeau des versements bloqués et lien vers Transactions filtré', async ({ page }) => {
  await page.addInitScript((u) => { (window as unknown as { __yadonyAuthSeed: typeof u }).__yadonyAuthSeed = u }, ADMIN)
  const user = {
    id: 'u7', firstName: 'Moussa', lastName: 'Traoré', phoneNumber: '+33677777777', email: 'm@x.fr', city: 'Paris', country: 'FR',
    status: 'BANNED', kycStatus: 'VERIFIED', isProAccount: false, averageRating: null, totalTrips: 4, totalShipments: 0, createdAt: '2026-01-01',
    roles: ['TRAVELER'], stripeAccountStatus: 'ONBOARDING_COMPLETE', commissionRateOverride: null, publishingSuspended: false, gpPro: false,
    cancellationCount: 0, noShowCount: 0, refusedCount: 0, senderHandoverIncidentCount: 0, ratingCount: 0, deletionRequestedAt: null,
    messagingMutedUntil: null, payoutsHeldSince: '2026-09-20T10:00:00Z', payoutsHeldReason: 'BANNED', payoutsHeldReasons: ['BANNED', 'KYC_REVOKED'], heldPaymentsCount: 2,
  }
  await page.route('**/api/v1/admin/users**', (route) => {
    if (route.request().url().includes('/admin/users/u7')) return route.fulfill({ json: user })
    return route.fulfill({ json: page1([user]) })
  })
  await page.route('**/api/v1/admin/payments**', (route) => route.fulfill({ json: page1([HELD]) }))

  await page.goto('/users?query=u7&open=u7')
  const banner = page.locator('[data-test="user-payouts-held"]')
  await expect(banner).toContainText('Versements bloqués depuis le 20/09/2026 (compte banni et identité révoquée) : 2 paiements en attente.')

  await page.locator('[data-test="action-unban"]').click()
  await expect(page.locator('[data-test="overlay"]')).toContainText('ne repartiront pas tout seuls')
  await page.locator('[data-test="cancel"]').click()

  await page.locator('[data-test="user-payouts-held-link"]').click()
  // Le lien garde `?held=true` ; la page le convertit aussitôt en alerte HELD.
  await expect(page).toHaveURL(/\/transactions\?.*alert=HELD/)
  await expect(page.locator('[data-test="chip-held"]')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('[data-test="payment-row-p9"]')).toBeVisible()
})

/** Fiche du voyageur retenu, au minimum : détail, vue d'ensemble, portefeuille, paiements. */
async function routeHeldTraveler(page: import('@playwright/test').Page) {
  const user = {
    id: HELD_TRAVELER, firstName: 'Moussa', lastName: 'Traoré', phoneNumber: '+33677777777', email: 'm@x.fr', city: 'Paris', country: 'FR',
    status: 'BANNED', kycStatus: 'VERIFIED', isProAccount: false, averageRating: null, totalTrips: 4, totalShipments: 0, createdAt: '2026-01-01',
    roles: ['TRAVELER'], stripeAccountStatus: 'ONBOARDING_COMPLETE', commissionRateOverride: null, publishingSuspended: false, gpPro: false,
    cancellationCount: 0, noShowCount: 0, refusedCount: 0, senderHandoverIncidentCount: 0, ratingCount: 0, deletionRequestedAt: null,
    messagingMutedUntil: null, payoutsHeldSince: '2026-09-20T10:00:00Z', payoutsHeldReason: 'BANNED', heldPaymentsCount: 1,
  }
  await page.route('**/api/v1/admin/users**', (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^.*\/admin\/users/, '')
    const sub = path.split('/').slice(2).join('/')
    if (sub === '') return route.fulfill({ json: user })
    if (sub === 'wallet') return route.fulfill({ json: { accounts: [{ currency: 'EUR', balance: 12.5, refundEligibleAmount: 10, frozen: false }] } })
    if (sub === 'overview') return route.fulfill({ json: { kpis: { parcelsInProgress: 0, activeTrips: 0, openDisputes: 0, totalDisputes: 0, reportsReceived: 0, reportsPending: 0, ratingCount: 0 }, inProgress: [] } })
    return route.fulfill({ json: page1([]) })
  })
}

test('paiement retenu : « Voir l’argent du voyageur » mène à l’onglet Argent de sa fiche, Retour revient au tiroir', async ({ page }) => {
  await routePayments(page)
  await routeHeldTraveler(page)
  // Paiement à identifiant UUID : Retour rouvre la fiche par ?open= (qui n'accepte que des UUID).
  const HELD_UUID = '9e9e9e9e-1111-4111-8111-999999999999'
  await page.route(`**/api/v1/admin/payments/${HELD_UUID}`, (route) => route.fulfill({ json: detailOf({ ...HELD, id: HELD_UUID }) }))
  await page.route(`**/api/v1/admin/payments/${HELD_UUID}/timeline`, (route) => route.fulfill({ json: [] }))
  await page.goto(`/transactions?open=${HELD_UUID}&section=incidents`)
  const money = page.locator('[data-test="payment-hold-traveler-money-link"]')
  await expect(money).toHaveAttribute('href', hrefIs(`/users/${HELD_TRAVELER}?tab=money`), { timeout: 15000 })
  await money.click()
  await expect(page).toHaveURL(new RegExp(`/users/${HELD_TRAVELER}\\?tab=money$`))
  await expect(page.locator('[data-test="tab-money"]')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('[data-test="wallet-account-EUR"]')).toContainText('12,50 EUR')
  await page.goBack()
  await expect(page).toHaveURL(new RegExp(`/transactions\\?.*open=${HELD_UUID}.*section=incidents`))
  await expect(page.locator('[data-test="payment-hold-notice"]')).toBeVisible()
})

test('paiement retenu, admin sans USER_VIEW : aucun lien vers la fiche ni l’argent du voyageur', async ({ page }) => {
  await routePayments(page)
  // Seed posé après celui d'ADMIN : il le remplace (même clé), privé de USER_VIEW.
  await page.addInitScript((u) => { (window as unknown as { __yadonyAuthSeed: typeof u }).__yadonyAuthSeed = u }, { ...ADMIN, permissionOverrides: { USER_VIEW: false } })
  // Identifiant de fixture non UUID : la fiche s'ouvre depuis la ligne, pas par ?open=.
  await page.goto('/transactions')
  await page.locator('[data-test="payment-row-p9"]').click({ timeout: 15000 })
  await page.locator('[data-test="payment-tab-incidents"]').click()
  const notice = page.locator('[data-test="payment-hold-notice"]')
  await expect(notice).toContainText('Le voyageur a été banni.')
  await expect(notice.locator('a')).toHaveCount(0)
  await expect(page.locator('[data-test="payment-tab-summary"]')).toBeVisible()
  await page.locator('[data-test="payment-tab-summary"]').click()
  await expect(page.locator('[data-test="party-traveler"]')).toBeVisible()
  await expect(page.locator('[data-test="party-traveler"] a')).toHaveCount(0)
})
