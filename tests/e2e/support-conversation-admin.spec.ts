import { test, expect, type Page, type Route } from '@playwright/test'

/**
 * Conversation support ouverte par l'admin : depuis la fiche utilisateur ou la page Support,
 * le fil s'ouvre ensuite dans le panneau de la page Support. Tout le back est mocké.
 */
const ADMIN = { id: 'a1', email: 'admin.1@yadony.com', role: 'ADMIN', status: 'ACTIVE', mustChangePassword: false, permissionOverrides: {} }

const USER = {
  id: 'u1', firstName: 'Jean', lastName: 'Dupont', phoneNumber: '+33611111111', email: 'jean@x.fr', city: 'Paris',
  country: 'FR', status: 'ACTIVE', kycStatus: 'VERIFIED', isProAccount: false, averageRating: 4.5, totalTrips: 2,
  totalShipments: 3, createdAt: '2026-01-01',
}
const USER_DETAIL = {
  ...USER, roles: ['SENDER'], stripeAccountStatus: null, commissionRateOverride: null, publishingSuspended: false,
  kiloPro: false, cancellationCount: 0, noShowCount: 0, refusedCount: 0, senderHandoverIncidentCount: 0, ratingCount: 0,
  deletionRequestedAt: null, messagingMutedUntil: null,
}
const USERS_PAGE = { content: [USER], totalElements: 1, totalPages: 1, number: 0, size: 20 }

const ticket = (id: string, over: Record<string, unknown> = {}) => ({
  id, category: 'PAYMENT', subject: `Sujet ${id}`, status: 'WAITING_USER', priority: 'NORMAL', userId: 'u1',
  userDisplayName: 'Jean Dupont', assignedAdminId: 'a1', assignedAdminEmail: 'admin.1@yadony.com',
  createdAt: '2026-09-28T10:00:00Z', lastMessageAt: '2026-09-28T10:00:00Z', resolvedAt: null, messages: null, ...over,
})
const ticketsPage = (content: unknown[]) => ({ content, totalElements: content.length, totalPages: 1, number: 0, size: 20 })

type SupportMock = {
  created: Record<string, unknown>[]
  listQueries: URLSearchParams[]
}

/**
 * Back support mocké. `oldBack` : POST /admin/support/tickets répond 405 (endpoint absent) et
 * ?userId= est ignoré (la file entière revient, tickets d'autres comptes compris).
 */
async function mockBackend(page: Page, opts: { oldBack?: boolean } = {}): Promise<SupportMock> {
  const state: SupportMock = { created: [], listQueries: [] }
  let createdTicket: ReturnType<typeof ticket> | null = null

  await page.route('**/api/v1/admin/users**', (route: Route) => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/admin/users/u1')) return route.fulfill({ json: USER_DETAIL })
    return route.fulfill({ json: USERS_PAGE })
  })

  await page.route('**/api/v1/admin/support/tickets**', (route: Route) => {
    const req = route.request()
    const url = new URL(req.url())
    const path = url.pathname.replace(/.*\/admin\/support\/tickets/, '')
    if (req.method() === 'POST' && path === '') {
      if (opts.oldBack) return route.fulfill({ status: 405, json: { title: 'Method Not Allowed', status: 405 } })
      const body = req.postDataJSON() as Record<string, unknown>
      state.created.push(body)
      createdTicket = ticket('t9', {
        subject: body.subject, category: body.category, status: 'WAITING_USER',
        messages: [{ id: 'm1', authorType: 'ADMIN', content: body.message, createdAt: '2026-09-29T09:00:00Z', attachments: [] }],
      })
      return route.fulfill({ status: 201, json: createdTicket })
    }
    if (req.method() === 'GET' && path === '') {
      state.listQueries.push(url.searchParams)
      const others = ticket('t2', { userId: 'u2', userDisplayName: 'Awa Diallo', subject: 'Autre compte' })
      const own = [ticket('t1'), ...(createdTicket ? [createdTicket] : [])]
      if (opts.oldBack || !url.searchParams.get('userId')) return route.fulfill({ json: ticketsPage([...own, others]) })
      return route.fulfill({ json: ticketsPage(own) })
    }
    if (req.method() === 'GET' && path === '/t9' && createdTicket) return route.fulfill({ json: createdTicket })
    if (req.method() === 'GET' && path.startsWith('/t')) return route.fulfill({ json: ticket(path.slice(1), { messages: [] }) })
    return route.fulfill({ status: 404, json: { title: 'Not Found', status: 404 } })
  })
  return state
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript((u) => { (window as unknown as { __yadonyAuthSeed: typeof u }).__yadonyAuthSeed = u }, ADMIN)
})

test('fiche utilisateur : écrire à l’utilisateur ouvre le fil sur la page Support', async ({ page }) => {
  const state = await mockBackend(page)
  await page.goto('/users')
  await page.locator('[data-test="row-u1"]').click()

  // Section « Conversations support » : les tickets de ce compte, avec lien vers la liste filtrée.
  const section = page.locator('[data-test="user-support-section"]')
  await expect(section.locator('[data-test="user-support-row-t1"]')).toContainText('Sujet t1')
  await expect(section.locator('[data-test="user-support-all"]')).toHaveAttribute('href', /\/support\?userId=u1$/)

  await page.locator('[data-test="action-write-support"]').click()
  const dialog = page.locator('[data-test="start-dialog"]')
  await expect(dialog.locator('[data-test="start-recipient"]')).toContainText('Jean Dupont')
  await expect(dialog.locator('[data-test="start-notice"]')).toContainText('onglet Messages')
  await expect(dialog.locator('[data-test="start-submit"]')).toBeDisabled()

  await dialog.locator('[data-test="start-category"]').selectOption('PAYMENT')
  await dialog.locator('[data-test="start-subject"]').fill('Votre paiement du 28/09')
  await dialog.locator('[data-test="start-message"]').fill('Bonjour Jean, pouvez-vous nous confirmer la réception ?')
  await dialog.locator('[data-test="start-submit"]').click()

  await expect(page).toHaveURL(/\/support\?ticket=t9/)
  await expect(page.locator('aside h2')).toHaveText('Votre paiement du 28/09')
  await expect(page.locator('aside').filter({ hasText: 'Votre paiement du 28/09' }))
    .toContainText('Bonjour Jean, pouvez-vous nous confirmer la réception ?')
  // 201 : WAITING_USER, assigné à l'admin appelant, donc le fil s'ouvre directement en mode réponse.
  const thread = page.locator('aside').filter({ hasText: 'Votre paiement du 28/09' })
  await expect(thread.getByPlaceholder('Votre réponse…')).toBeVisible()
  await expect(thread.getByText('M\'assigner ce ticket')).toHaveCount(0)
  await expect(thread).toContainText('Attente utilisateur')
  expect(state.created).toEqual([{
    userId: 'u1', category: 'PAYMENT', subject: 'Votre paiement du 28/09',
    message: 'Bonjour Jean, pouvez-vous nous confirmer la réception ?', attachmentKeys: [],
  }])
})

test('page Support : nouvelle conversation avec recherche de l’utilisateur', async ({ page }) => {
  const state = await mockBackend(page)
  await page.goto('/support')
  await expect(page.getByText('Sujet t1')).toBeVisible()

  await page.locator('[data-test="support-new-conversation"]').click()
  const dialog = page.locator('[data-test="start-dialog"]')
  await dialog.locator('[data-test="broadcast-user-search"]').fill('Jean')
  await dialog.locator('[data-test="broadcast-user-result-u1"]').click()
  await expect(dialog.locator('[data-test="broadcast-user-selected"]')).toContainText('Jean Dupont')

  await dialog.locator('[data-test="start-subject"]').fill('Point sur votre colis')
  await dialog.locator('[data-test="start-message"]').fill('Bonjour, votre colis est bien arrivé.')
  await dialog.locator('[data-test="start-submit"]').click()

  await expect(page).toHaveURL(/\/support\?ticket=t9/)
  await expect(page.locator('aside h2')).toHaveText('Point sur votre colis')
  expect(state.created[0]).toMatchObject({ userId: 'u1', category: 'OTHER', subject: 'Point sur votre colis' })
})

test('page Support : filtre ?userId= avec bandeau et retrait du filtre', async ({ page }) => {
  const state = await mockBackend(page)
  await page.goto('/support?userId=u1')
  const banner = page.locator('[data-test="support-user-filter"]')
  await expect(banner).toContainText('Conversations de Jean Dupont')
  await expect(page.getByText('Sujet t1')).toBeVisible()
  await expect(page.getByText('Autre compte')).toHaveCount(0)
  await expect(page.locator('[data-test="support-user-filter-ignored"]')).toHaveCount(0)
  expect(state.listQueries.at(-1)?.get('userId')).toBe('u1')

  await page.locator('[data-test="support-user-filter-clear"]').click()
  await expect(banner).toHaveCount(0)
  await expect(page).not.toHaveURL(/userId=/)
  await expect(page.getByText('Autre compte')).toBeVisible()
})

test('ancien back : envoi indisponible et section de fiche masquée', async ({ page }) => {
  await mockBackend(page, { oldBack: true })
  await page.goto('/users')
  await page.locator('[data-test="row-u1"]').click()
  await expect(page.locator('aside').getByText('jean@x.fr')).toBeVisible()
  // ?userId= ignoré : la file entière revient, la section n'aurait aucun sens.
  await expect(page.locator('[data-test="user-support-section"]')).toHaveCount(0)

  await page.locator('[data-test="action-write-support"]').click()
  const dialog = page.locator('[data-test="start-dialog"]')
  await dialog.locator('[data-test="start-subject"]').fill('Test')
  await dialog.locator('[data-test="start-message"]').fill('Bonjour')
  await dialog.locator('[data-test="start-submit"]').click()
  await expect(dialog.locator('[data-test="start-error"]')).toHaveText('Cette fonction n’est pas encore disponible sur le serveur.')
  await expect(dialog.locator('[data-test="start-submit"]')).toBeDisabled()
  await expect(page).toHaveURL(/\/users/)
})

test('ancien back : filtre ?userId= appliqué côté client, avertissement affiché', async ({ page }) => {
  await mockBackend(page, { oldBack: true })
  await page.goto('/support?userId=u1')
  await expect(page.locator('[data-test="support-user-filter"]')).toContainText('Conversations de Jean Dupont')
  await expect(page.locator('[data-test="support-user-filter-ignored"]')).toBeVisible()
  await expect(page.getByText('Sujet t1')).toBeVisible()
  await expect(page.getByText('Autre compte')).toHaveCount(0)
})
