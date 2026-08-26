import { test, expect } from '@playwright/test'

/**
 * Parcours end-to-end pour la suppression administrative d'un compte utilisateur.
 * Modèle calqué sur users-kyc-rgpd.spec.ts : même helper seedAdmin, même navigation.
 */

const ADMIN = {
  id: 'a1', email: 'admin.1@yadony.com', role: 'ADMIN',
  status: 'ACTIVE', mustChangePassword: false, permissionOverrides: {},
}

const USER_ID = 'u-42'

const userDetail = {
  id: USER_ID, firstName: 'Jean', lastName: 'Dupont', email: 'jean@x.fr',
  phoneNumber: '+33600000000', city: 'Paris', country: 'FR',
  status: 'ACTIVE', kycStatus: 'VERIFIED', isProAccount: false,
  averageRating: 4.5, totalTrips: 3, totalShipments: 2, createdAt: '2026-01-01T00:00:00Z',
  roles: ['SENDER'], stripeAccountStatus: null, commissionRateOverride: null,
  publishingSuspended: false, kiloPro: false, cancellationCount: 0, noShowCount: 0,
  refusedCount: 0, senderHandoverIncidentCount: 0, ratingCount: 2,
  deletionRequestedAt: null, messagingMutedUntil: null,
}

async function seedAdmin(page: import('@playwright/test').Page) {
  await page.addInitScript((u) => {
    ;(window as unknown as { __yadonyAuthSeed: typeof u }).__yadonyAuthSeed = u
  }, ADMIN)
}

async function stubUsers(page: import('@playwright/test').Page) {
  await page.route('**/api/v1/admin/users**', (route) => {
    const req = route.request()
    const url = req.url()

    if (req.method() === 'GET' && url.includes(`/${USER_ID}`)) {
      return route.fulfill({ json: userDetail })
    }
    // Liste paginée par défaut
    return route.fulfill({
      json: { content: [userDetail], totalElements: 1, totalPages: 1, number: 0, size: 20 },
    })
  })
}

test.beforeEach(async ({ page }) => {
  await seedAdmin(page)
})

test('un escrow actif empêche la confirmation et explique pourquoi', async ({ page }) => {
  await page.route('**/api/v1/admin/users**', (route) => {
    const req = route.request()
    const url = req.url()

    if (req.method() === 'GET' && url.includes(`/${USER_ID}/deletion-impact`)) {
      return route.fulfill({
        json: {
          blocked: true,
          findings: [{ severity: 'BLOCKING', code: 'ACTIVE_ESCROW', count: 1, parties: [] }],
        },
      })
    }
    if (req.method() === 'GET' && url.includes(`/${USER_ID}`)) {
      return route.fulfill({ json: userDetail })
    }
    return route.fulfill({
      json: { content: [userDetail], totalElements: 1, totalPages: 1, number: 0, size: 20 },
    })
  })

  await page.goto('/users')
  await page.click(`[data-test="row-${USER_ID}"]`)
  // Attendre que la fiche soit rendue avant d'interagir
  await expect(page.locator('[data-test="action-delete"]')).toBeVisible()
  await page.click('[data-test="action-delete"]')

  await expect(page.locator('[data-test="finding-ACTIVE_ESCROW"]')).toBeVisible()
  await expect(page.locator('[data-test="deletion-confirm-zone"]')).toHaveCount(0)
  await expect(page.locator('[data-test="deletion-confirm"]')).toHaveCount(0)
})

test('un rapport propre permet de supprimer après double confirmation', async ({ page }) => {
  let deleteBody: unknown = null

  await page.route('**/api/v1/admin/users**', (route) => {
    const req = route.request()
    const url = req.url()
    const method = req.method()

    if (method === 'DELETE' && url.includes(`/${USER_ID}/delete`)) {
      deleteBody = req.postDataJSON()
      return route.fulfill({ status: 204, body: '' })
    }
    if (method === 'POST' && url.includes(`/${USER_ID}/delete`)) {
      deleteBody = req.postDataJSON()
      return route.fulfill({ status: 204, body: '' })
    }
    if (method === 'GET' && url.includes(`/${USER_ID}/deletion-impact`)) {
      return route.fulfill({
        json: {
          blocked: false,
          findings: [{
            severity: 'WARNING', code: 'PARCEL_IN_TRANSIT', count: 1,
            parties: [{ userId: 'u-99', displayName: 'Awa D.', relatedEntityId: 'b-1' }],
          }],
        },
      })
    }
    if (method === 'GET' && url.includes(`/${USER_ID}`)) {
      return route.fulfill({ json: userDetail })
    }
    return route.fulfill({
      json: { content: [userDetail], totalElements: 1, totalPages: 1, number: 0, size: 20 },
    })
  })

  await page.goto('/users')
  await page.click(`[data-test="row-${USER_ID}"]`)
  await expect(page.locator('[data-test="action-delete"]')).toBeVisible()
  await page.click('[data-test="action-delete"]')

  await expect(page.locator('[data-test="party-u-99"]')).toContainText('Awa D.')

  await page.selectOption('[data-test="deletion-reason-code"]', 'FRAUD')
  await page.fill('[data-test="deletion-reason"]', 'faux documents')
  await page.fill('[data-test="deletion-confirmation-input"]', 'Jean Dupont')
  await page.click('[data-test="deletion-confirm"]')

  await expect.poll(() => deleteBody)
    .toEqual({ reasonCode: 'FRAUD', reason: 'faux documents' })
})

test('un refus du back laisse le dialogue ouvert avec le message', async ({ page }) => {
  await page.route('**/api/v1/admin/users**', (route) => {
    const req = route.request()
    const url = req.url()
    const method = req.method()

    if ((method === 'DELETE' || method === 'POST') && url.includes(`/${USER_ID}/delete`)) {
      return route.fulfill({
        status: 422,
        contentType: 'application/problem+json',
        json: {
          code: 'deletion-blocked',
          detail: 'Suppression impossible — des engagements financiers sont encore en cours',
        },
      })
    }
    if (method === 'GET' && url.includes(`/${USER_ID}/deletion-impact`)) {
      return route.fulfill({
        json: { blocked: false, findings: [] },
      })
    }
    if (method === 'GET' && url.includes(`/${USER_ID}`)) {
      return route.fulfill({ json: userDetail })
    }
    return route.fulfill({
      json: { content: [userDetail], totalElements: 1, totalPages: 1, number: 0, size: 20 },
    })
  })

  await page.goto('/users')
  await page.click(`[data-test="row-${USER_ID}"]`)
  await expect(page.locator('[data-test="action-delete"]')).toBeVisible()
  await page.click('[data-test="action-delete"]')
  await page.selectOption('[data-test="deletion-reason-code"]', 'FRAUD')
  await page.fill('[data-test="deletion-reason"]', 'faux documents')
  await page.fill('[data-test="deletion-confirmation-input"]', 'Jean Dupont')
  await page.click('[data-test="deletion-confirm"]')

  await expect(page.locator('[data-test="deletion-error"]'))
    .toContainText('engagements financiers')
  await expect(page.locator('[data-test="deletion-confirm-zone"]')).toBeVisible()
})
