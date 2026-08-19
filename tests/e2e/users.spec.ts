import { test, expect } from '@playwright/test'

const ADMIN = { id: 'a1', email: 'admin.1@yadony.com', role: 'ADMIN', status: 'ACTIVE', mustChangePassword: false, permissionOverrides: {} }

const LIST_PAGE = {
  content: [
    {
      id: 'u1',
      firstName: 'Jean',
      lastName: 'Dupont',
      phoneNumber: '+33611111111',
      city: 'Paris',
      country: 'FR',
      status: 'ACTIVE',
      kycStatus: 'VERIFIED',
      isProAccount: false,
      averageRating: 4.5,
      totalTrips: 2,
      totalShipments: 3,
      createdAt: '2026-01-01',
    },
    {
      id: 'u2',
      firstName: 'Awa',
      lastName: 'Diallo',
      phoneNumber: '+33622222222',
      city: 'Lyon',
      country: 'FR',
      status: 'SUSPENDED',
      kycStatus: 'PENDING',
      isProAccount: true,
      averageRating: null,
      totalTrips: 0,
      totalShipments: 1,
      createdAt: '2026-02-01',
    },
  ],
  totalElements: 2,
  totalPages: 1,
  number: 0,
  size: 20,
}

const DETAIL_U1 = {
  ...LIST_PAGE.content[0],
  email: 'jean@x.fr',
  roles: ['SENDER'],
  stripeAccountStatus: 'ONBOARDING_COMPLETE',
  commissionRateOverride: null,
  publishingSuspended: false,
  kiloPro: false,
  cancellationCount: 0,
  noShowCount: 1,
  refusedCount: 0,
  senderHandoverIncidentCount: 0,
  ratingCount: 10,
  deletionRequestedAt: null,
  messagingMutedUntil: null,
}

const DETAIL_U1_SUSPENDED = { ...DETAIL_U1, status: 'SUSPENDED' }

async function seedAdmin(page: import('@playwright/test').Page) {
  await page.addInitScript((u) => {
    ;(window as unknown as { __yadonyAuthSeed: typeof u }).__yadonyAuthSeed = u
  }, ADMIN)
}

test.beforeEach(async ({ page }) => {
  await seedAdmin(page)

  // Local mutable state for the publishing-suspension toggle, mirrored by the
  // GET detail response below (suspend-publishing/lift-publishing-suspension
  // return 204 with no body, so the panel re-fetches the detail afterwards).
  let publishingSuspended = false

  // Single consolidated handler for all /api/v1/admin/users** requests.
  // Branches on URL and method to avoid multi-route ordering/precedence issues.
  await page.route('**/api/v1/admin/users**', (route) => {
    const url = route.request().url()
    const method = route.request().method()

    // POST suspend-publishing (checked before the generic '/u1/suspend' match below,
    // since '/u1/suspend-publishing' also contains the '/u1/suspend' substring)
    if (method === 'POST' && url.includes('/suspend-publishing')) {
      publishingSuspended = true
      return route.fulfill({ status: 204, body: '' })
    }
    // POST lift-publishing-suspension
    if (method === 'POST' && url.includes('/lift-publishing-suspension')) {
      publishingSuspended = false
      return route.fulfill({ status: 204, body: '' })
    }
    // POST suspend
    if (url.includes('/u1/suspend')) {
      return route.fulfill({ json: DETAIL_U1_SUSPENDED })
    }
    // GET detail /admin/users/u1
    if (url.includes('/u1') && method === 'GET') {
      return route.fulfill({ json: { ...DETAIL_U1, publishingSuspended } })
    }
    // GET list (with or without query string)
    return route.fulfill({ json: LIST_PAGE })
  })
})

test('admin sees the user list', async ({ page }) => {
  await page.goto('/users')
  await expect(page.locator('h1').first()).toContainText('Utilisateurs')
  await expect(page.getByText('Jean Dupont')).toBeVisible()
  await expect(page.getByText('Awa Diallo')).toBeVisible()
})

test('admin opens a user detail', async ({ page }) => {
  await page.goto('/users')
  await page.locator('[data-test="row-u1"]').click()
  await expect(page.getByText('jean@x.fr')).toBeVisible()
  await expect(page.locator('[data-test="action-suspend"]')).toBeVisible()
})

test('admin suspends a user with a reason', async ({ page }) => {
  await page.goto('/users')
  await page.locator('[data-test="row-u1"]').click()
  await page.locator('[data-test="action-suspend"]').click()
  await page.locator('[data-test="reason"]').fill('contenu frauduleux')
  await page.locator('[data-test="confirm"]').click()
  // After action, detail.user.value is updated to DETAIL_U1_SUSPENDED → status badge becomes Suspendu
  // Scope assertion to the detail aside panel to avoid conflict with list row badges
  await expect(page.locator('aside').getByText('Suspendu')).toBeVisible()
})

test('admin suspend la publication depuis la fiche user', async ({ page }) => {
  await page.goto('/users')
  await page.locator('[data-test="row-u1"]').click()
  await page.locator('[data-test="action-suspend-publishing"]').click()
  await page.locator('[data-test="reason"]').fill('annonces frauduleuses')
  await page.locator('[data-test="confirm"]').click()
  await expect(page.locator('[data-test="action-lift-publishing"]')).toBeVisible()
})

test('admin coupe la messagerie avec une durée choisie puis la rétablit', async ({ page }) => {
  const muteCalls: { durationHours: number | null; reason: string }[] = []

  // Route dédiée à ce test : POST /u1/mute-messaging et /u1/unmute-messaging
  // partagent le même préfixe (« unmute-messaging » contient la sous-chaîne
  // « mute-messaging »), donc la branche unmute doit être testée avant la
  // branche mute — même piège que suspend-publishing/suspend plus haut.
  await page.route('**/api/v1/admin/users**', (route) => {
    const req = route.request()
    const url = req.url()
    const method = req.method()

    if (method === 'POST' && url.includes('/u1/unmute-messaging')) {
      return route.fulfill({ json: { ...DETAIL_U1, messagingMutedUntil: null } })
    }
    if (method === 'POST' && url.includes('/u1/mute-messaging')) {
      muteCalls.push(req.postDataJSON() as { durationHours: number | null; reason: string })
      return route.fulfill({ json: { ...DETAIL_U1, messagingMutedUntil: '2026-06-09T10:00:00Z' } })
    }
    if (url.includes('/u1') && method === 'GET') {
      return route.fulfill({ json: DETAIL_U1 })
    }
    return route.fulfill({ json: LIST_PAGE })
  })

  await page.goto('/users')
  await page.locator('[data-test="row-u1"]').click()
  await expect(page.locator('[data-test="messaging-status"]')).toContainText('Autorisée')

  await page.locator('[data-test="mute-duration"]').selectOption('168')
  await page.locator('[data-test="action-mute"]').click()
  await page.locator('[data-test="reason"]').fill('propos déplacés répétés')
  await page.locator('[data-test="confirm"]').click()

  await expect(page.locator('[data-test="messaging-status"]')).toContainText('Coupée jusqu')
  await expect.poll(() => muteCalls.length).toBe(1)
  expect(muteCalls[0]).toEqual({ durationHours: 168, reason: 'propos déplacés répétés' })

  await page.locator('[data-test="action-unmute"]').click()
  await expect(page.locator('[data-test="messaging-status"]')).toContainText('Autorisée')
})
