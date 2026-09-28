import { test, expect, type Page } from '@playwright/test'

const ADMIN = { id: 'a1', email: 'admin.1@yadony.com', role: 'ADMIN', status: 'ACTIVE', mustChangePassword: false, permissionOverrides: {} }

const REPORT = {
  id: 'n1', type: 'REPORT_CREATED', title: 'Nouveau signalement', summary: 'Annonce signalée pour contenu trompeur',
  severity: 'WARNING', createdAt: '2026-09-28T11:55:00Z', link: '/signalements',
}
const KYC = {
  id: 'n0', type: 'KYC_IN_REVIEW', title: 'Identité à vérifier', summary: 'Awa Diop attend une décision',
  severity: 'INFO', createdAt: '2026-09-28T09:00:00Z', link: '/kyc?status=IN_REVIEW&open=u1',
}
const problem = (status: number, code: string | null, detail: string) => ({
  status, contentType: 'application/problem+json',
  body: JSON.stringify({ type: 'about:blank', title: 'Erreur', status, detail, ...(code ? { code } : {}) }),
})

interface Backend {
  counters: { counts: Record<string, number>; unreadCount: number; unreadCapped?: boolean }
  feed: { items: unknown[]; unreadCount: number; lastSeenAt: string | null }
  missing: boolean
  countersCalls: number
  markSeen: unknown[]
}

async function mockBackend(page: Page, init: Partial<Backend> = {}): Promise<Backend> {
  const state: Backend = {
    counters: { counts: {}, unreadCount: 0 },
    feed: { items: [], unreadCount: 0, lastSeenAt: null },
    missing: false,
    countersCalls: 0,
    markSeen: [],
    ...init,
  }
  await page.clock.install({ time: new Date('2026-09-28T12:00:00Z') })
  await page.addInitScript((u) => {
    ;(window as unknown as { __yadonyAuthSeed: typeof u }).__yadonyAuthSeed = u
  }, ADMIN)
  // Le reste de l'admin n'est pas l'objet de ces tests : aucun appel ne part vers un vrai back.
  await page.route('**/api/v1/admin/**', (route) => route.abort())
  await page.route('**/api/v1/admin/notifications/**', (route) => {
    const req = route.request()
    const path = new URL(req.url()).pathname
    if (path.endsWith('/counters')) state.countersCalls++
    if (state.missing) return route.fulfill(problem(404, null, 'No endpoint matches this path'))
    if (path.endsWith('/counters')) return route.fulfill({ json: state.counters })
    if (path.endsWith('/feed')) return route.fulfill({ json: state.feed })
    if (path.endsWith('/mark-seen') && req.method() === 'POST') {
      state.markSeen.push(req.postDataJSON())
      state.counters = { ...state.counters, unreadCount: 0 }
      return route.fulfill({ status: 204, body: '' })
    }
    return route.fulfill(problem(404, null, 'No endpoint'))
  })
  return state
}

const bell = (page: Page) => page.locator('[data-test="notif-bell"]')
const bellBadge = (page: Page) => page.locator('[data-test="notif-badge"]')
const navBadge = (page: Page, href: string) => page.locator(`nav a[href$="${href}"] [data-test="badge"]`)

test('un nouvel élément arrive : pastille, titre d’onglet, ouverture, clic vers la page', async ({ page }) => {
  const state = await mockBackend(page)
  await page.goto('/audit')
  await expect(bell(page)).toHaveAttribute('aria-label', 'Notifications')
  await expect.poll(() => state.countersCalls).toBe(1)
  await expect(bellBadge(page)).toHaveCount(0)

  // Nouvelle donne côté back : les compteurs d'abord, le fil ensuite.
  state.counters = { counts: { reports: 1 }, unreadCount: 1 }
  state.feed = { items: [REPORT, KYC], unreadCount: 1, lastSeenAt: '2026-09-28T10:00:00Z' }
  await page.clock.fastForward(30_000)

  await expect(bellBadge(page)).toHaveText('1')
  await expect(bell(page)).toHaveAttribute('aria-label', 'Notifications, 1 non lue')
  await expect(page).toHaveTitle(/^\(1\) /)
  await expect(navBadge(page, '/signalements')).toContainText('1')

  await bell(page).click()
  const panel = page.locator('[data-test="notif-panel"]')
  await expect(panel).toBeVisible()
  const rows = panel.locator('[data-test="notif-item"]')
  await expect(rows).toHaveCount(2)
  await expect(rows.first()).toContainText('Nouveau signalement')
  await expect(rows.first()).toContainText(/il y a 5\smin/)
  await expect(rows.first()).toHaveAttribute('data-unread', 'true')
  await expect(rows.nth(1)).toHaveAttribute('data-unread', 'false')

  await rows.first().click()
  await expect(page).toHaveURL(/\/signalements$/)
  await expect(panel).toHaveCount(0)
})

test('« Tout marquer comme lu » retire la pastille et le préfixe du titre', async ({ page }) => {
  const state = await mockBackend(page, {
    counters: { counts: {}, unreadCount: 2 },
    feed: { items: [REPORT, KYC], unreadCount: 2, lastSeenAt: null },
  })
  await page.goto('/audit')
  await expect(bellBadge(page)).toHaveText('2')
  await expect(page).toHaveTitle(/^\(2\) /)

  await bell(page).click()
  await page.locator('[data-test="notif-mark-all"]').click()
  await expect(bellBadge(page)).toHaveCount(0)
  await expect(page).not.toHaveTitle(/^\(/)
  expect(state.markSeen).toEqual([{ upTo: REPORT.createdAt }])
})

test('le panneau ouvert 2 s marque les nouveautés comme lues ; Échap ferme et rend le focus', async ({ page }) => {
  const state = await mockBackend(page, {
    counters: { counts: {}, unreadCount: 1 },
    feed: { items: [REPORT], unreadCount: 1, lastSeenAt: null },
  })
  await page.goto('/audit')
  await expect(bellBadge(page)).toHaveText('1')
  await bell(page).click()
  await expect(page.locator('[data-test="notif-item"]')).toHaveCount(1)
  await page.clock.fastForward(2_000)
  await expect(bellBadge(page)).toHaveCount(0)
  expect(state.markSeen).toEqual([{ upTo: REPORT.createdAt }])
  // l'élément reste mis en évidence le temps de la lecture
  await expect(page.locator('[data-test="notif-item"]').first()).toHaveAttribute('data-unread', 'true')

  await page.keyboard.press('Escape')
  await expect(page.locator('[data-test="notif-panel"]')).toHaveCount(0)
  await expect(bell(page)).toBeFocused()
})

test('compteurs du menu : badges, 99+, couleurs, masqués sans clé', async ({ page }) => {
  await mockBackend(page, {
    counters: { counts: { reports: 3, kyc: 240, alerts: 2, heldPayouts: 1, walletRefunds: 1, incidents: 0 }, unreadCount: 0 },
  })
  await page.goto('/audit')
  await expect(navBadge(page, '/signalements')).toContainText('3')
  await expect(navBadge(page, '/signalements')).toHaveAttribute('data-tone', 'neutral')
  await expect(navBadge(page, '/kyc')).toContainText('99+')
  await expect(navBadge(page, '/alertes')).toHaveAttribute('data-tone', 'danger')
  await expect(navBadge(page, '/transactions')).toContainText('2')
  await expect(navBadge(page, '/transactions')).toHaveAttribute('data-tone', 'danger')
  await expect(navBadge(page, '/incidents')).toHaveCount(0) // à 0
  await expect(navBadge(page, '/support')).toHaveCount(0) // clé absente
})

test('ancien back : cloche sans pastille, panneau indisponible, plus de polling', async ({ page }) => {
  const state = await mockBackend(page, { missing: true })
  await page.goto('/audit')
  await expect.poll(() => state.countersCalls).toBe(1) // application hydratée, 404 reçu
  await expect(bellBadge(page)).toHaveCount(0)

  await bell(page).click()
  await expect(page.locator('[data-test="notif-unavailable"]')).toContainText('Notifications indisponibles pour le moment')

  const calls = state.countersCalls
  await page.clock.fastForward(5 * 60_000)
  await page.waitForTimeout(300)
  expect(state.countersCalls).toBe(calls)
  await expect(page).not.toHaveTitle(/^\(/)
})

const SUPPORT_NOTIF = {
  id: 'n5', type: 'SUPPORT_MESSAGE_RECEIVED', title: 'Nouveau message support', summary: 'Awa a répondu sur son ticket',
  severity: 'INFO', createdAt: '2026-09-28T11:55:00.123456Z', link: '/support?ticket=t9',
}
const NOSHOW_NOTIF = {
  id: 'n6', type: 'NOSHOW_PENDING', title: 'No-show à confirmer', summary: 'Le voyageur signale une absence',
  severity: 'WARNING', createdAt: '2026-09-28T11:50:00.5Z', link: '/incidents?tab=noshows',
}
const TICKET = {
  id: 't9', category: 'PAIEMENT', subject: 'Remboursement non reçu', status: 'ASSIGNED', priority: 'NORMAL', userId: 'u1',
  userDisplayName: 'Awa Diop', assignedAdminId: 'a2', assignedAdminEmail: 'collegue@yadony.com',
  createdAt: '2026-09-27T10:00:00Z', lastMessageAt: '2026-09-28T11:55:00Z', resolvedAt: null,
  messages: [{ id: 'm1', authorType: 'USER', content: 'Bonjour, je n’ai rien reçu.', createdAt: '2026-09-28T11:55:00Z' }],
}
const pageOf = (content: unknown[]) => ({ content, totalElements: content.length, totalPages: 1, number: 0, size: 20 })

test('notification support : clic vers le fil du ticket ouvert, périmètre « Tous » s’il n’est pas dans la file', async ({ page }) => {
  await mockBackend(page, {
    counters: { counts: { support: 1 }, unreadCount: 1 },
    feed: { items: [SUPPORT_NOTIF], unreadCount: 1, lastSeenAt: '2026-09-21T12:00:00Z' },
  })
  const scopes: string[] = []
  await page.route('**/api/v1/admin/support/tickets**', (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/tickets/t9')) return route.fulfill({ json: TICKET })
    const scope = url.searchParams.get('scope') ?? ''
    scopes.push(scope)
    return route.fulfill({ json: pageOf(scope === 'all' ? [{ ...TICKET, messages: null }] : []) })
  })
  await page.goto('/audit')
  await expect(bellBadge(page)).toHaveText('1')
  await bell(page).click()
  const row = page.locator('[data-test="notif-item"]').first()
  await expect(row).toContainText(/il y a [45]\smin/) // microsecondes acceptées
  await row.click()
  await expect(page).toHaveURL(/\/support\?ticket=t9$/)
  await expect(page.locator('aside').getByText('Bonjour, je n’ai rien reçu.')).toBeVisible()
  await expect.poll(() => scopes.at(-1)).toBe('all')
})

test('notification no-show : clic vers l’onglet No-shows, y compris depuis la page Incidents déjà ouverte', async ({ page }) => {
  await mockBackend(page, {
    counters: { counts: { incidents: 1 }, unreadCount: 1 },
    feed: { items: [NOSHOW_NOTIF], unreadCount: 1, lastSeenAt: '2026-09-21T12:00:00Z' },
  })
  await page.route('**/api/v1/admin/disputes**', (route) => route.fulfill({ json: pageOf([]) }))
  await page.route('**/api/v1/admin/cancellations**', (route) => route.fulfill({ json: pageOf([
    { id: 'c1', bidId: 'b9', cancelledBy: 'TRAVELER', reason: 'SENDER_NO_SHOW', noShowStatus: 'PENDING_CONFIRMATION', contestationDeadline: '2026-09-30T10:00:00Z', createdAt: '2026-09-28T11:50:00Z' },
  ]) }))
  await page.goto('/incidents')
  await expect(page.locator('[data-test="tab-disputes"]')).toHaveAttribute('aria-pressed', 'true')
  await expect(bellBadge(page)).toHaveText('1')
  await bell(page).click()
  await page.locator('[data-test="notif-item"]').first().click()
  await expect(page).toHaveURL(/\/incidents\?tab=noshows$/)
  await expect(page.locator('[data-test="tab-noshows"]')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('[data-test="noshow-row-c1"]')).toBeVisible()
})

test('lien profond ?tab=wallet-refunds combiné à ?held=true : onglet ouvert au chargement', async ({ page }) => {
  await mockBackend(page)
  await page.route('**/api/v1/admin/payments**', (route) => route.fulfill({ json: pageOf([]) }))
  await page.route('**/api/v1/admin/wallet-refund-requests**', (route) => route.fulfill({ json: pageOf([]) }))
  await page.goto('/transactions?held=true&tab=wallet-refunds')
  await expect(page.locator('[data-test="tab-wallet-refunds"]')).toHaveAttribute('aria-pressed', 'true')
  await page.locator('[data-test="tab-payments"]').click()
  await expect(page).toHaveURL(/\/transactions\?held=true$/)
})
