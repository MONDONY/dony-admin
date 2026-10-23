import { test, expect, type Page, type Request } from '@playwright/test'

/**
 * Parcours de la fiche utilisateur complète (/users/<id>). Les routes du back sont simulées par un
 * seul gestionnaire qui lit le chemin après /admin/users et enregistre les écritures.
 */

const ADMIN = { id: 'a1', email: 'admin.1@yadony.com', role: 'ADMIN', status: 'ACTIVE', mustChangePassword: false, permissionOverrides: {} }
const SUPPORT = { id: 's1', email: 'support@yadony.com', role: 'SUPPORT', status: 'ACTIVE', mustChangePassword: false, permissionOverrides: {} }

const ID = '3f2b8c1e-4a5d-4e6f-8a9b-0c1d2e3f4a5b'
const UNKNOWN_ID = '9a9a9a9a-1111-4222-8333-444455556666'

const ROW = {
  id: ID, firstName: 'Jean', lastName: 'Dupont', phoneNumber: '+33611111111', city: 'Paris', country: 'FR',
  status: 'ACTIVE', kycStatus: 'VERIFIED', isProAccount: false, averageRating: 4.5, totalTrips: 2, totalShipments: 3,
  createdAt: '2026-01-01T00:00:00Z',
}
const LIST_PAGE = { content: [ROW], totalElements: 1, totalPages: 1, number: 0, size: 20 }
const DETAIL = {
  ...ROW, email: 'jean@x.fr', roles: ['ROLE_SENDER'], stripeAccountStatus: 'ONBOARDING_COMPLETE', commissionRateOverride: null,
  publishingSuspended: false, gpPro: false, cancellationCount: 0, noShowCount: 1, refusedCount: 0,
  senderHandoverIncidentCount: 0, ratingCount: 10, deletionRequestedAt: null, messagingMutedUntil: null,
}
const OVERVIEW = {
  kpis: {
    parcelsInProgress: 3, activeTrips: 1,
    heldByCurrency: [{ currency: 'EUR', amountCents: 12000 }, { currency: 'XOF', amountCents: 5000000 }],
    openDisputes: 1, totalDisputes: 4, reportsReceived: 2, reportsSent: 0, reportsPending: 0, averageRating: 4.5, ratingCount: 10,
  },
  inProgress: [], timeline: [],
}
const page1 = (content: unknown[]) => ({ content, totalElements: content.length, totalPages: 1, number: 0, size: 20 })
const problem = (status: number, json: Record<string, unknown>) =>
  ({ status, contentType: 'application/problem+json', json: { status, ...json } })

interface Mocks {
  posts: { path: string; body: unknown; method: string }[]
  hits: Record<string, number>
  detail: Record<string, unknown>
}
interface Opts {
  overview?: 'ok' | 'missing' | 'not-found' | 'sparse'
  detailStatus?: 404
  deletionBlocked?: boolean
}

async function seed(page: Page, user: unknown) {
  await page.addInitScript((u) => {
    ;(window as unknown as { __yadonyAuthSeed: unknown }).__yadonyAuthSeed = u
  }, user)
}

async function mockBackend(page: Page, opts: Opts = {}): Promise<Mocks> {
  const mocks: Mocks = { posts: [], hits: {}, detail: { ...DETAIL } }
  await page.route('**/api/v1/admin/users**', (route) => {
    const req: Request = route.request()
    const method = req.method()
    const path = new URL(req.url()).pathname.replace(/^.*\/admin\/users/, '')
    const hit = (k: string) => { mocks.hits[k] = (mocks.hits[k] ?? 0) + 1 }

    if (path === '' || path === '/') return route.fulfill({ json: LIST_PAGE })
    const [, id, ...rest] = path.split('/')
    const sub = rest.join('/')

    if (method !== 'GET') {
      let body: unknown = null
      try { body = req.postDataJSON() } catch { /* pas de corps */ }
      mocks.posts.push({ path: `${sub}`, body, method })
      if (sub === 'suspend') { mocks.detail = { ...mocks.detail, status: 'SUSPENDED' }; return route.fulfill({ json: mocks.detail }) }
      if (sub === 'commission-rate') {
        mocks.detail = { ...mocks.detail, commissionRateOverride: (body as { rate: number }).rate }
        return route.fulfill({ json: mocks.detail })
      }
      if (sub === 'delete') {
        if (opts.deletionBlocked) return route.fulfill(problem(422, { code: 'deletion-blocked', detail: 'Suppression impossible' }))
        return route.fulfill({ status: 204, body: '' })
      }
      return route.fulfill({ status: 204, body: '' })
    }

    if (id === UNKNOWN_ID) return route.fulfill(problem(404, { code: 'user-not-found', detail: 'Utilisateur introuvable' }))
    hit(sub || 'detail')
    switch (sub) {
      case '':
        if (opts.detailStatus === 404) return route.fulfill(problem(404, { code: 'user-not-found' }))
        return route.fulfill({ json: mocks.detail })
      case 'overview':
        if (opts.overview === 'missing') return route.fulfill(problem(404, { title: 'Not Found', detail: 'No endpoint matches this path' }))
        // Comme Jackson NON_NULL : compte neuf sans avis, droits partiels, clés nulles OMISES (pas de null).
        if (opts.overview === 'sparse') {
          return route.fulfill({
            json: {
              kpis: { parcelsInProgress: 0, activeTrips: 0, openDisputes: 0, totalDisputes: 0, reportsReceived: 0, reportsPending: 0, ratingCount: 0 },
              inProgress: [{ kind: 'TRIP', id: 't1', corridor: 'Paris → Dakar', role: 'TRAVELER', status: 'PUBLISHED', updatedAt: '2026-10-20T10:00:00Z' }],
            },
          })
        }
        if (opts.overview === 'not-found') return route.fulfill(problem(404, { code: 'user-not-found' }))
        return route.fulfill({ json: OVERVIEW })
      case 'wallet':
        return route.fulfill({ json: { accounts: [{ currency: 'EUR', balance: 12.5, refundEligibleAmount: 10, frozen: false }] } })
      case 'wallet/transactions':
        return route.fulfill({ json: page1([{ id: 't1', currency: 'EUR', type: 'TOP_UP', amount: 20, balanceAfter: 20, createdAt: '2026-09-01T10:00:00Z' }]) })
      case 'payments':
        return route.fulfill({
          json: page1([{
            id: 'p1', bidId: 'b1', status: 'HELD', method: 'CARD', amountCents: 4200, commissionCents: 500, currency: 'EUR',
            createdAt: '2026-09-02T10:00:00Z', payoutHeldAt: null, beneficiaryHeld: false, role: 'PAYER',
          }]),
        })
      case 'kyc':
        return route.fulfill({
          json: {
            userId: ID, kycStatus: 'VERIFIED', verificationStatus: 'VERIFIED', rejectionReason: null, rejectionCode: null,
            stripeSessionId: 'vs_001', stripeStatus: 'verified', stripeLastErrorCode: null, stripeLastErrorReason: null,
            stripeCreatedAt: '2026-08-01T10:00:00', stripeUnavailable: false,
          },
        })
      case 'deletion-impact':
        return route.fulfill({ json: { blocked: false, findings: [] } })
      default:
        return route.fulfill({ json: page1([]) })
    }
  })
  return mocks
}

test.describe('admin', () => {
  test.beforeEach(async ({ page }) => { await seed(page, ADMIN) })

  test('admin ouvre la fiche depuis la liste', async ({ page }) => {
    await mockBackend(page)
    await page.goto('/users')
    await page.locator(`[data-test="row-${ID}"]`).click()

    await expect(page).toHaveURL(new RegExp(`/users/${ID}$`))
    await expect(page.locator('[data-test="profile-name"]')).toHaveText('Jean Dupont')
    await expect(page.locator('[data-test="kpi-parcels"]')).toContainText('3')
    await expect(page.locator('[data-test="kpi-trips"]')).toContainText('1')
    await expect(page.locator('[data-test="kpi-disputes"]')).toContainText('sur 4 au total')

    // Argent retenu : une ligne par devise, jamais de somme entre devises.
    await expect(page.locator('[data-test="kpi-held-line"]')).toHaveCount(2)
    const band = page.locator('[data-test="alert-band-content"]')
    await expect(band).toContainText('À surveiller')
    await expect(band.locator('[data-test="alert-disputes"]')).toHaveText('1 litige ouvert')
    const held = band.locator('[data-test="alert-held"]')
    await expect(held).toContainText('120,00')
    await expect(held).toContainText('EUR')
    await expect(held).toContainText('XOF')
  })

  test('onglet Argent charge le wallet et les paiements', async ({ page }) => {
    const mocks = await mockBackend(page)
    await page.goto(`/users/${ID}`)
    await page.locator('[data-test="tab-money"]').click()

    await expect(page).toHaveURL(/tab=money/)
    await expect(page.locator('[data-test="wallet-account-EUR"]')).toContainText('12,50 EUR')
    await expect(page.locator('[data-test="section-payments"]')).toContainText('42,00')
    expect(mocks.hits['wallet']).toBeGreaterThanOrEqual(1)
    expect(mocks.hits['wallet/transactions']).toBeGreaterThanOrEqual(1)
    expect(mocks.hits['payments']).toBeGreaterThanOrEqual(1)
  })

  test('admin suspend depuis le menu Actions du compte', async ({ page }) => {
    const mocks = await mockBackend(page)
    await page.goto(`/users/${ID}`)
    await expect(page.locator('[data-test="profile-name"]')).toBeVisible()

    await page.locator('[data-test="actions-trigger"]').click()
    await page.locator('[data-test="menu-suspend"]').click()
    // Le menu se ferme dès le choix du geste.
    await expect(page.locator('[data-test="actions-list"]')).toHaveCount(0)
    await page.locator('[data-test="reason"]').fill('contenu frauduleux')
    await page.locator('[data-test="confirm"]').click()

    await expect.poll(() => mocks.posts.filter(p => p.path === 'suspend').length).toBe(1)
    expect(mocks.posts.find(p => p.path === 'suspend')?.body).toEqual({ reason: 'contenu frauduleux' })
    await expect(page.locator('[data-test="alert-suspended"]')).toHaveText('Compte suspendu')
    // Une fois suspendu, le geste n'est plus proposé et la réactivation l'est.
    await page.locator('[data-test="actions-trigger"]').click()
    await expect(page.locator('[data-test="menu-suspend"]')).toHaveCount(0)
    await expect(page.locator('[data-test="menu-unsuspend"]')).toBeVisible()
  })

  test('Échap ferme le menu des actions', async ({ page }) => {
    await mockBackend(page)
    await page.goto(`/users/${ID}`)
    await page.locator('[data-test="actions-trigger"]').click()
    await expect(page.locator('[data-test="actions-list"]')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('[data-test="actions-list"]')).toHaveCount(0)
    await expect(page.locator('[data-test="actions-trigger"]')).toBeFocused()
  })

  test('l’onglet Identité charge le KYC une seule fois', async ({ page }) => {
    const mocks = await mockBackend(page)
    await page.goto(`/users/${ID}`)
    await expect(page.locator('[data-test="profile-name"]')).toBeVisible()
    expect(mocks.hits['kyc'] ?? 0).toBe(0) // chargement paresseux : rien avant l'ouverture de l'onglet

    await page.locator('[data-test="tab-identity"]').click()
    await expect(page.locator('[data-test="kyc-status"]')).toContainText('VERIFIED')
    await expect(page.locator('[data-test="kyc-stripe-session"]')).toContainText('vs_001')
    expect(mocks.hits['kyc']).toBe(1)
  })

  test('onglet Gestion : la commission appliquée envoie le taux après confirmation', async ({ page }) => {
    const mocks = await mockBackend(page)
    await page.goto(`/users/${ID}?tab=manage`)
    await page.locator('[data-test="commission-input"]').fill('8')
    await page.locator('[data-test="commission-apply"]').click()
    // Rien n'est envoyé avant la confirmation.
    expect(mocks.posts).toHaveLength(0)
    await page.locator('[data-test="confirm"]').click()

    await expect.poll(() => mocks.posts.filter(p => p.path === 'commission-rate').length).toBe(1)
    const call = mocks.posts.find(p => p.path === 'commission-rate')!
    expect(call.method).toBe('PUT')
    expect(call.body).toEqual({ rate: 0.08 })
    await expect(page.locator('[data-test="commission-state"]')).toContainText('8.0 %')
  })

  test('onglet Gestion : la suppression du compte envoie le motif puis revient à la liste', async ({ page }) => {
    const mocks = await mockBackend(page)
    await page.goto(`/users/${ID}?tab=manage`)
    await page.locator('[data-test="action-delete"]').click()
    await page.selectOption('[data-test="deletion-reason-code"]', 'FRAUD')
    await page.fill('[data-test="deletion-reason"]', 'faux documents')
    await page.fill('[data-test="deletion-confirmation-input"]', 'Jean Dupont')
    await page.click('[data-test="deletion-confirm"]')

    await expect.poll(() => mocks.posts.filter(p => p.path === 'delete').length).toBe(1)
    expect(mocks.posts.find(p => p.path === 'delete')?.body).toEqual({ reasonCode: 'FRAUD', reason: 'faux documents' })
    await expect(page).toHaveURL(/\/users$/)
  })

  test('onglet Gestion : un refus de suppression reste affiché sur la fiche', async ({ page }) => {
    await mockBackend(page, { deletionBlocked: true })
    await page.goto(`/users/${ID}?tab=manage`)
    await page.locator('[data-test="action-delete"]').click()
    await page.selectOption('[data-test="deletion-reason-code"]', 'FRAUD')
    await page.fill('[data-test="deletion-reason"]', 'faux documents')
    await page.fill('[data-test="deletion-confirmation-input"]', 'Jean Dupont')
    await page.click('[data-test="deletion-confirm"]')

    await expect(page.locator('[data-test="deletion-error"]')).toContainText('Suppression impossible')
    await expect(page).toHaveURL(new RegExp(`/users/${ID}`))
  })

  test('ancien backend : /overview en 404 sans code renvoie vers le tiroir (legacy=1)', async ({ page }) => {
    await mockBackend(page, { overview: 'missing' })
    await page.goto(`/users/${ID}`)

    await expect(page).toHaveURL(new RegExp(`/users\\?open=${ID}&legacy=1`))
    await expect(page.locator('aside').getByText('jean@x.fr')).toBeVisible()
    await expect(page.locator('[data-test="user-not-found"]')).toHaveCount(0)
  })

  test('ancien lien /users?open=<id> redirige vers la fiche', async ({ page }) => {
    await mockBackend(page)
    await page.goto(`/users?query=${ID}&open=${ID}`)

    await expect(page).toHaveURL(new RegExp(`/users/${ID}$`))
    await expect(page.locator('[data-test="profile-name"]')).toHaveText('Jean Dupont')
  })

  test('fiche : fil d’Ariane avec le nom du compte et bouton Retour vers la liste', async ({ page }) => {
    await mockBackend(page)
    await page.goto(`/users/${ID}`)
    await expect(page.locator('[data-test="profile-name"]')).toHaveText('Jean Dupont')

    const crumbs = page.locator('[data-test="breadcrumb"]')
    await expect(crumbs.locator('[aria-current="page"]')).toHaveText('Jean Dupont')
    await expect(crumbs.getByRole('link', { name: 'Utilisateurs' })).toHaveAttribute('href', /\/users$/)

    // Lien ouvert à froid : aucune page précédente dans l'admin, le Retour mène à la liste.
    await page.locator('[data-test="topbar-back"]').click()
    await expect(page).toHaveURL(/\/users$/)
    await expect(page.locator('[data-test="topbar-back"]')).toHaveCount(0)
  })

  test('utilisateur introuvable : message et lien de retour', async ({ page }) => {
    await mockBackend(page)
    await page.goto(`/users/${UNKNOWN_ID}`)

    await expect(page.locator('[data-test="user-not-found"]')).toContainText('Utilisateur introuvable')
    await page.locator('[data-test="back-to-users"]').click()
    await expect(page).toHaveURL(/\/users$/)
  })

  test('identifiant invalide : même message, pas de page blanche', async ({ page }) => {
    await mockBackend(page)
    await page.goto('/users/pas-un-uuid')
    await expect(page.locator('[data-test="user-not-found"]')).toContainText('Utilisateur introuvable')
  })
})

test('synthèse aux clés nulles omises (JSON NON_NULL) : la fiche s’affiche, les cartes absentes sont masquées', async ({ page }) => {
  await seed(page, SUPPORT)
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  await mockBackend(page, { overview: 'sparse' })
  await page.goto(`/users/${ID}`)

  await expect(page.locator('[data-test="profile-name"]')).toHaveText('Jean Dupont')
  await expect(page.locator('[data-test="kpi-parcels"]')).toContainText('0')
  await expect(page.locator('[data-test="kpi-disputes"]')).toContainText('0')
  // Note moyenne et argent retenu absents : cartes masquées, jamais « 0 » ni « Aucun ».
  await expect(page.locator('[data-test="kpi-rating"]')).toHaveCount(0)
  await expect(page.locator('[data-test="kpi-held"]')).toHaveCount(0)
  await expect(page.locator('[data-test="alert-band-content"]')).toHaveCount(0)
  // Le trajet en cours n'a pas de référence : libellé de repli et lien nommé d'après le trajet.
  const row = page.locator('[data-test="in-progress-row"]')
  await expect(row).toContainText('Paris → Dakar')
  await expect(row).not.toContainText('undefined')
  await expect(row.getByRole('link')).toHaveAttribute('aria-label', 'Ouvrir le trajet Paris → Dakar')
  // Frise absente (permission) : carte masquée.
  await expect(page.locator('[data-test="timeline-card"]')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('SUPPORT ne voit ni Gestion ni les gestes de modération mais peut écrire à l’utilisateur', async ({ page }) => {
  await seed(page, SUPPORT)
  await mockBackend(page)
  await page.goto(`/users/${ID}`)
  await expect(page.locator('[data-test="profile-name"]')).toHaveText('Jean Dupont')

  // Aucun onglet de gestion, même en forçant l'URL.
  await expect(page.locator('[data-test="tab-overview"]')).toBeVisible()
  await expect(page.locator('[data-test="tab-manage"]')).toHaveCount(0)
  await page.goto(`/users/${ID}?tab=manage`)
  await expect(page.locator('[data-test="profile-name"]')).toBeVisible()
  await expect(page.locator('[data-test="tab-content-manage"]')).toHaveCount(0)
  await expect(page.locator('[data-test="action-delete"]')).toHaveCount(0)

  await page.locator('[data-test="actions-trigger"]').click()
  await expect(page.locator('[data-test="menu-writeSupport"]')).toBeVisible()
  for (const id of ['suspend', 'ban', 'mute', 'suspendPublishing']) {
    await expect(page.locator(`[data-test="menu-${id}"]`)).toHaveCount(0)
  }
})
