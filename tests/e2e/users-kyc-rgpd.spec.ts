import { test, expect } from '@playwright/test'

const ADMIN = {
  id: 'a1', email: 'admin.1@yadony.com', role: 'ADMIN',
  status: 'ACTIVE', mustChangePassword: false, permissionOverrides: {},
}

const LIST_PAGE = {
  content: [{
    id: 'u1', firstName: 'Jean', lastName: 'Dupont', phoneNumber: '+33611111111',
    city: 'Paris', country: 'FR', status: 'ACTIVE', kycStatus: 'REJECTED',
    isProAccount: false, averageRating: 4.5, totalTrips: 2, totalShipments: 3,
    createdAt: '2026-01-01',
  }],
  totalElements: 1, totalPages: 1, number: 0, size: 20,
}

const DETAIL_U1 = {
  ...LIST_PAGE.content[0],
  email: 'jean@x.fr', roles: ['SENDER'], stripeAccountStatus: 'ONBOARDING_COMPLETE',
  commissionRateOverride: null, publishingSuspended: false, kiloPro: false,
  cancellationCount: 0, noShowCount: 1, refusedCount: 0, senderHandoverIncidentCount: 0,
  ratingCount: 10, deletionRequestedAt: null, messagingMutedUntil: null,
}

const KYC_REJECTED = {
  userId: 'u1', kycStatus: 'REJECTED', verificationStatus: 'REJECTED',
  rejectionReason: 'document_expired', rejectionCode: 'document_expired',
  stripeSessionId: 'vs_001', stripeStatus: 'requires_input',
  stripeLastErrorCode: 'document_expired', stripeLastErrorReason: 'The document has expired.',
  stripeCreatedAt: '2026-08-01T10:00:00', stripeUnavailable: false,
}

const KYC_RESET = {
  userId: 'u1', kycStatus: 'NOT_STARTED', verificationStatus: 'PENDING',
  rejectionReason: null, rejectionCode: null, stripeSessionId: null, stripeStatus: null,
  stripeLastErrorCode: null, stripeLastErrorReason: null, stripeCreatedAt: null,
  stripeUnavailable: false,
}

const GDPR_PAGE = {
  content: [{
    id: 'u1', firstName: 'Jean', lastName: 'Dupont', email: 'jean@x.fr',
    status: 'PENDING_DELETION', deletionRequestedAt: '2026-07-01T00:00:00', ageDays: 48,
  }],
  totalElements: 1, totalPages: 1, number: 0, size: 20,
}

const GDPR_EMPTY = { content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 }

async function seedAdmin(page: import('@playwright/test').Page) {
  await page.addInitScript((u) => {
    ;(window as unknown as { __yadonyAuthSeed: typeof u }).__yadonyAuthSeed = u
  }, ADMIN)
}

test.beforeEach(async ({ page }) => {
  await seedAdmin(page)
})

test('admin consulte le KYC d\'un utilisateur puis le réinitialise', async ({ page }) => {
  const resetCalls: { reason: string }[] = []
  let kycState = KYC_REJECTED

  await page.route('**/api/v1/admin/users**', (route) => {
    const req = route.request()
    const url = req.url()
    const method = req.method()

    // '/u1/kyc/reset' contient '/u1/kyc' : la branche reset passe en premier.
    if (method === 'POST' && url.includes('/u1/kyc/reset')) {
      resetCalls.push(req.postDataJSON() as { reason: string })
      kycState = KYC_RESET
      return route.fulfill({ json: KYC_RESET })
    }
    if (method === 'GET' && url.includes('/u1/kyc')) {
      return route.fulfill({ json: kycState })
    }
    if (method === 'GET' && url.includes('/u1')) {
      return route.fulfill({ json: DETAIL_U1 })
    }
    return route.fulfill({ json: LIST_PAGE })
  })

  await page.goto('/users')
  await page.locator('[data-test="row-u1"]').click()
  // Attendre que la fiche soit rendue avant de basculer d'onglet : sans ce point
  // d'ancrage, le clic part avant l'hydratation et l'onglet ne bascule pas (fde633a).
  await expect(page.locator('[data-test="action-suspend"]')).toBeVisible()
  await page.locator('[data-test="tab-kyc"]').click()

  await expect(page.locator('[data-test="kyc-status"]')).toContainText('REJECTED')
  await expect(page.locator('[data-test="kyc-stripe-session"]')).toContainText('vs_001')
  await expect(page.getByText('The document has expired.')).toBeVisible()

  await page.locator('[data-test="action-reset-kyc"]').click()
  await page.locator('[data-test="reason"]').fill('document illisible')
  await page.locator('[data-test="confirm"]').click()

  await expect(page.locator('[data-test="kyc-status"]')).toContainText('NOT_STARTED')
  await expect(page.locator('[data-test="kyc-stripe-session"]')).toContainText('Aucune session')
  await expect.poll(() => resetCalls.length).toBe(1)
  expect(resetCalls[0]).toEqual({ reason: 'document illisible' })
})

test('Stripe indisponible : le KYC local reste affiché avec un avertissement', async ({ page }) => {
  await page.route('**/api/v1/admin/users**', (route) => {
    const req = route.request()
    const url = req.url()
    if (req.method() === 'GET' && url.includes('/u1/kyc')) {
      return route.fulfill({ json: { ...KYC_REJECTED, stripeStatus: null, stripeLastErrorReason: null, stripeUnavailable: true } })
    }
    if (req.method() === 'GET' && url.includes('/u1')) {
      return route.fulfill({ json: DETAIL_U1 })
    }
    return route.fulfill({ json: LIST_PAGE })
  })

  await page.goto('/users')
  await page.locator('[data-test="row-u1"]').click()
  await expect(page.locator('[data-test="action-suspend"]')).toBeVisible()
  await page.locator('[data-test="tab-kyc"]').click()

  await expect(page.locator('[data-test="kyc-stripe-unavailable"]')).toBeVisible()
  await expect(page.locator('[data-test="kyc-status"]')).toContainText('REJECTED')
})

test('admin exécute une suppression RGPD après double confirmation par le nom', async ({ page }) => {
  const executeCalls: { reason: string }[] = []
  let queue = GDPR_PAGE

  await page.route('**/api/v1/admin/users**', (route) => {
    const req = route.request()
    const url = req.url()
    const method = req.method()

    // '/gdpr-requests' et '/gdpr-execute' partagent le préfixe '/gdpr-' :
    // on discrimine sur la méthode ET le chemin complet.
    if (method === 'POST' && url.includes('/u1/gdpr-execute')) {
      executeCalls.push(req.postDataJSON() as { reason: string })
      queue = GDPR_EMPTY
      return route.fulfill({ status: 204, body: '' })
    }
    if (method === 'GET' && url.includes('/gdpr-requests')) {
      return route.fulfill({ json: queue })
    }
    return route.fulfill({ json: LIST_PAGE })
  })

  await page.goto('/users/rgpd')
  await expect(page.locator('h1').first()).toContainText('Demandes RGPD')
  await expect(page.getByText('Jean Dupont')).toBeVisible()
  await expect(page.getByText('48 j')).toBeVisible()

  await page.locator('[data-test="action-gdpr-execute-u1"]').click()

  // La confirmation reste bloquée tant que le nom exact n'est pas saisi.
  await page.locator('[data-test="reason"]').fill('demande utilisateur confirmée')
  await expect(page.locator('[data-test="confirm"]')).toBeDisabled()
  await page.locator('[data-test="confirmation-input"]').fill('Jean Dupon')
  await expect(page.locator('[data-test="confirm"]')).toBeDisabled()
  await page.locator('[data-test="confirmation-input"]').fill('Jean Dupont')
  await expect(page.locator('[data-test="confirm"]')).toBeEnabled()
  await page.locator('[data-test="confirm"]').click()

  await expect(page.locator('[data-test="gdpr-empty"]')).toBeVisible()
  await expect.poll(() => executeCalls.length).toBe(1)
  expect(executeCalls[0]).toEqual({ reason: 'demande utilisateur confirmée' })
})

test('un refus 422 du back est affiché et la demande reste dans la file', async ({ page }) => {
  await page.route('**/api/v1/admin/users**', (route) => {
    const req = route.request()
    const url = req.url()
    const method = req.method()

    if (method === 'POST' && url.includes('/u1/gdpr-execute')) {
      return route.fulfill({
        status: 422,
        contentType: 'application/problem+json',
        json: {
          type: 'https://yadony.com/problems/active-transactions',
          title: 'Unprocessable', status: 422,
          detail: 'Impossible — cet utilisateur a des transactions en cours',
          code: 'active-transactions',
        },
      })
    }
    if (method === 'GET' && url.includes('/gdpr-requests')) {
      return route.fulfill({ json: GDPR_PAGE })
    }
    return route.fulfill({ json: LIST_PAGE })
  })

  await page.goto('/users/rgpd')
  // Attendre que la file soit rendue avant le premier clic : sans ce point d'ancrage,
  // le clic part avant l'hydratation et n'ouvre pas la modale de confirmation.
  await expect(page.locator('[data-test="row-u1"]')).toBeVisible()
  await page.locator('[data-test="action-gdpr-execute-u1"]').click()
  await page.locator('[data-test="reason"]').fill('motif')
  await page.locator('[data-test="confirmation-input"]').fill('Jean Dupont')
  await page.locator('[data-test="confirm"]').click()

  await expect(page.locator('[data-test="gdpr-error"]'))
    .toContainText('Impossible — cet utilisateur a des transactions en cours')
  await expect(page.locator('[data-test="row-u1"]')).toBeVisible()
})
