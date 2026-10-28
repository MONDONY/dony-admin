import { test, expect, type Page } from '@playwright/test'

const ADMIN = { id: 'a1', email: 'admin.1@yadony.com', role: 'ADMIN', status: 'ACTIVE', mustChangePassword: false, permissionOverrides: {} }
const SUPPORT = { ...ADMIN, id: '7a2e4b1c-0000-4a00-8000-0000000000a2', email: 'support@yadony.com', role: 'SUPPORT' }

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()
const A1 = { applicationId: 'a1', userId: 'u1', displayName: 'Moussa Traoré', source: 'SIGNUP', travelFrequency: 'WEEKLY', documentCount: 1, createdAt: daysAgo(5) }
const A2 = { applicationId: '7a2e4b1c-0000-4a00-8000-0000000000a2', userId: 'u2', displayName: 'Fatou Ndiaye', source: 'PROFILE', travelFrequency: 'MONTHLY', documentCount: 0, createdAt: daysAgo(2) }
const R1 = { userId: 'r1', displayName: 'Cheikh Ba', detectedAt: daysAgo(6), flags: [{ flagId: 'f1', reason: 'OPEN_DISPUTE' }, { flagId: 'f2', reason: 'LOW_RATING' }] }
const R2 = { userId: '7a2e4b1c-0000-4a00-8000-0000000000b2', displayName: 'Mariam Sow', detectedAt: daysAgo(2), flags: [{ flagId: 'f3', reason: 'INACTIVE' }] }
const detail = (id: string, extra: Record<string, unknown> = {}) => ({
  applicationId: id, userId: id === 'a1' ? 'u1' : 'u2', displayName: id === 'a1' ? 'Moussa Traoré' : 'Fatou Ndiaye', status: 'PENDING',
  source: 'SIGNUP', travelFrequency: 'WEEKLY', commercialName: 'Traoré Express', createdAt: daysAgo(5), kycStatus: 'VERIFIED',
  publishedTrips: 9, tripsLast56Days: 6, completedDeliveries: 14, averageRating: 4.8, lastFiveRatings: [5, 5, 4, 5, 5],
  openDisputes: 0, openReports: 0, memberSince: '2026-06-02T00:00:00Z',
  documents: id === 'a1' ? [{ id: 'd1', type: 'BUSINESS_REGISTRATION', url: 'https://7a2e4b1c-0000-4a00-8000-0000000000b2.example/presigned?x=1' }] : [], ...extra,
})
const page = (content: unknown[]) => ({ content, totalElements: content.length, totalPages: 1, number: 0, size: 20 })
const problem = (status: number, code: string | null, detail: string) => ({
  status, contentType: 'application/problem+json',
  body: JSON.stringify({ type: 'about:blank', title: 'Erreur', status, detail, ...(code ? { code } : {}) }),
})

interface State { posts: { path: string; body: unknown }[]; decided: Set<string>; dismissed: Set<string> }

async function mockBackend(
  page_: Page,
  opts: { admin?: typeof ADMIN; unverified?: boolean; applicationsMissing?: boolean } = {},
): Promise<State> {
  const state: State = { posts: [], decided: new Set(), dismissed: new Set() }
  await page_.addInitScript((u) => {
    ;(window as unknown as { __yadonyAuthSeed: typeof u }).__yadonyAuthSeed = u
  }, opts.admin ?? ADMIN)
  await page_.route('**/api/v1/admin/gp-pro/applications**', (route) => {
    const req = route.request()
    const url = new URL(req.url())
    if (opts.applicationsMissing) return route.fulfill(problem(404, null, 'No endpoint matches this path'))
    if (req.method() === 'POST') {
      state.posts.push({ path: url.pathname, body: req.postDataJSON() })
      state.decided.add(url.pathname.split('/')[6])
      return route.fulfill({ status: 204, body: '' })
    }
    const single = url.pathname.match(/applications\/([^/]+)$/)
    if (single) {
      const id = single[1]
      return route.fulfill({ json: detail(id, {
        ...(opts.unverified && id === 'a1' ? { kycStatus: 'REJECTED', openDisputes: 1 } : {}),
        ...(state.decided.has(id) ? { status: 'APPROVED' } : {}),
      }) })
    }
    return route.fulfill({ json: page([A1, A2].filter((a) => !state.decided.has(a.applicationId))) })
  })
  await page_.route('**/api/v1/admin/gp-pro/review**', (route) =>
    route.fulfill({ json: page([R1, R2].map((r) => ({ ...r, flags: r.flags.filter((f) => !state.dismissed.has(f.flagId)) })).filter((r) => r.flags.length)) }))
  await page_.route('**/api/v1/admin/gp-pro/review-flags/*/dismiss', (route) => {
    const flagId = route.request().url().split('/').at(-2)!
    state.posts.push({ path: new URL(route.request().url()).pathname, body: null })
    state.dismissed.add(flagId)
    return route.fulfill({ status: 204, body: '' })
  })
  return state
}

test('la demande la plus ancienne s’ouvre seule, avec son profil et ses justificatifs', async ({ page }) => {
  await mockBackend(page)
  await page.goto('/gp-pro')
  await expect(page.locator('[data-test="gp-pro-case-title"]')).toHaveText('Moussa Traoré')
  await expect(page.locator('[data-test="gp-pro-attention-none"]')).toBeVisible()
  await expect(page.locator('[data-test="summary-oldest"]')).toHaveText('5 j')
  await expect(page.locator('[data-test="gp-pro-tab-revue"]')).toContainText('2')
  const doc = page.locator('[data-test="gp-pro-doc-d1"]')
  await expect(doc).toHaveAttribute('href', 'https://7a2e4b1c-0000-4a00-8000-0000000000b2.example/presigned?x=1')
  await expect(doc).toHaveAttribute('rel', 'noopener noreferrer')
})

test('accepter une demande : la file se relit, le dossier reste avec son statut', async ({ page }) => {
  const state = await mockBackend(page)
  await page.goto('/gp-pro')
  await expect(page.locator('[data-test="gp-pro-approve"]')).toBeEnabled()
  await page.locator('[data-test="gp-pro-approve"]').click()
  await page.locator('[data-test="gp-pro-dialog-submit"]').click()
  await expect(page.locator('[data-test="gp-pro-detail-status"]')).toContainText('Acceptée')
  await expect(page.locator('[data-test="gp-pro-row-a1"]')).toHaveCount(0)
  await expect(page.locator('[data-test="gp-pro-actions"]')).toHaveCount(0)
  expect(state.posts).toEqual([{ path: '/api/v1/admin/gp-pro/applications/a1/approve', body: null }])
})

test('refuser avec un motif au clavier : R ouvre, le motif part au back', async ({ page }) => {
  const state = await mockBackend(page)
  await page.goto('/gp-pro')
  await expect(page.locator('[data-test="gp-pro-reject"]')).toBeEnabled()
  await page.keyboard.press('r')
  await expect(page.locator('[data-test="gp-pro-dialog"]')).toBeVisible()
  await page.locator('[data-test="gp-pro-text"]').fill('Activité trop récente pour le badge.')
  await page.locator('[data-test="gp-pro-dialog-submit"]').click()
  await expect(page.locator('[data-test="gp-pro-row-a1"]')).toHaveCount(0)
  expect(state.posts[0]).toEqual({
    path: '/api/v1/admin/gp-pro/applications/a1/reject', body: { reason: 'Activité trop récente pour le badge.' },
  })
})

test('identité plus vérifiée : points d’attention, acceptation verrouillée', async ({ page }) => {
  await mockBackend(page, { unverified: true })
  await page.goto('/gp-pro')
  await expect(page.locator('[data-test="gp-pro-attention-kyc"]')).toBeVisible()
  await expect(page.locator('[data-test="gp-pro-attention-disputes"]')).toBeVisible()
  await expect(page.locator('[data-test="gp-pro-approve"]')).toBeDisabled()
  await expect(page.locator('[data-test="gp-pro-reject"]')).toBeEnabled()
  await page.keyboard.press('a')
  await expect(page.locator('[data-test="gp-pro-dialog"]')).toHaveCount(0)
})

test('J passe à la demande suivante et l’écrit dans l’URL', async ({ page }) => {
  await mockBackend(page)
  await page.goto('/gp-pro')
  await expect(page.locator('[data-test="gp-pro-approve"]')).toBeEnabled()
  await page.keyboard.press('j')
  await expect(page.locator('[data-test="gp-pro-case-title"]')).toHaveText('Fatou Ndiaye')
  await expect(page).toHaveURL(/open=7a2e4b1c-0000-4a00-8000-0000000000a2/)
})

test('titulaires à revoir : écarter les alertes une à une, puis passage au suivant', async ({ page }) => {
  const state = await mockBackend(page)
  await page.goto('/gp-pro')
  await expect(page.locator('[data-test="gp-pro-approve"]')).toBeEnabled()
  await page.locator('[data-test="gp-pro-tab-revue"]').click()
  await expect(page.locator('[data-test="gp-pro-review-title"]')).toHaveText('Cheikh Ba')
  await expect(page).toHaveURL(/tab=revue/)
  await expect(page.locator('[data-test="gp-pro-review-remove-link"]')).toHaveAttribute('href', /\/users\?open=r1/)
  await page.locator('[data-test="gp-pro-dismiss-f1"]').click()
  await expect(page.locator('[data-test="gp-pro-review-count"]')).toHaveText('1 alerte')
  await page.locator('[data-test="gp-pro-dismiss-f2"]').click()
  await expect(page.locator('[data-test="gp-pro-review-title"]')).toHaveText('Mariam Sow')
  expect(state.posts.map((p) => p.path)).toEqual([
    '/api/v1/admin/gp-pro/review-flags/f1/dismiss', '/api/v1/admin/gp-pro/review-flags/f2/dismiss',
  ])
})

test('ancien back sans les demandes : mention discrète, l’autre file reste accessible', async ({ page }) => {
  await mockBackend(page, { applicationsMissing: true })
  await page.goto('/gp-pro')
  await expect(page.locator('[data-test="gp-pro-unavailable"]')).toContainText('indisponible')
  await page.locator('[data-test="gp-pro-tab-revue"]').click()
  await expect(page.locator('[data-test="gp-pro-review-title"]')).toHaveText('Cheikh Ba')
})

test('SUPPORT n’a pas le droit GP_PRO_REVIEW : accès refusé', async ({ page }) => {
  await mockBackend(page, { admin: SUPPORT })
  await page.goto('/gp-pro')
  await expect(page).toHaveURL(/denied/)
  await expect(page.locator('[data-test="gp-pro-workbench"]')).toHaveCount(0)
})
