import { test, expect, type Page } from '@playwright/test'

/**
 * Onglet Avis en poste de traitement : file, dossier avec contexte, décision avec effet sur la
 * moyenne, enchaînement, filtres, signalement lié, tolérance d'un back sans le contexte.
 */
const ADMIN = { id: 'a1', email: 'admin.1@yadony.com', role: 'ADMIN', status: 'ACTIVE', mustChangePassword: false, permissionOverrides: {} }
const U_RATER = '11111111-1111-4111-8111-111111111111'
const U_RATED = '22222222-2222-4222-8222-222222222222'

const rating = (id: string, extra: Record<string, unknown> = {}) => ({
  id, bidId: '33333333-3333-4333-8333-333333333333', raterName: 'Awa Diallo', ratedName: 'Karim Sy', score: 1,
  comment: `Commentaire ${id}`, flagged: true, excluded: false, excludedReason: null,
  createdAt: '2026-10-20T10:00:00Z', ...extra,
})
const A = rating('a')
const B = rating('b', { score: 2 })

const CONTEXT = {
  rater: { userId: U_RATER, displayName: 'Awa Diallo', memberSince: '2026-03-01T09:00:00', ratingsGiven: 12, averageGiven: 1.8, lowRatingsGiven: 10 },
  rated: { userId: U_RATED, displayName: 'Karim Sy', memberSince: '2026-01-10T08:00:00', averageRating: 4.0, ratingCount: 5, excludedCount: 1, distribution: { '5': 3, '4': 1, '1': 1 } },
  sameRelationCount: 3,
  reports: [{ id: 'rep1', reason: 'INAPPROPRIATE_CONTENT', status: 'OPEN', createdAt: '2026-10-21T08:00:00Z', reporterName: 'Fatou Kane' }],
  openReports: 1,
  reportsRestricted: false,
  history: [],
}

type Call = { method: string; url: string; body: unknown }

async function mockRatings(page: Page, ratings: unknown[], contexts: Record<string, { status: number; json: unknown }> = {}) {
  const calls: Call[] = []
  await page.route('**/api/v1/admin/ratings**', (route) => {
    const req = route.request()
    const url = req.url()
    const m = url.match(/\/admin\/ratings\/([^/?]+)\/context/)
    if (m) {
      const c = contexts[m[1]!] ?? { status: 404, json: {} }
      return route.fulfill({ status: c.status, contentType: 'application/json', body: JSON.stringify(c.json) })
    }
    if (req.method() !== 'GET') {
      calls.push({ method: req.method(), url, body: req.method() === 'POST' ? req.postDataJSON() : null })
      return req.method() === 'DELETE' ? route.fulfill({ status: 204, body: '' }) : route.fulfill({ json: { ...(ratings[0] as object), excluded: true } })
    }
    calls.push({ method: 'GET', url, body: null })
    return route.fulfill({ json: { content: ratings, totalElements: ratings.length, totalPages: 1, number: 0, size: 20 } })
  })
  return calls
}

async function mockReports(page: Page) {
  const rep = {
    id: 'rep1', targetType: 'RATING', targetId: 'a', targetLabel: null, reason: 'INAPPROPRIATE_CONTENT', description: 'Avis injurieux',
    reporterName: 'Fatou Kane', status: 'OPEN', actionTaken: null, resolutionNote: null, resolvedAt: null, photoUrls: [],
    createdAt: '2026-10-21T08:00:00Z', availableActions: ['RESOLVE', 'DISMISS'],
  }
  await page.route('**/api/v1/admin/reports**', (route) => {
    const single = route.request().url().match(/\/admin\/reports\/([^/?]+)$/)
    if (single) return route.fulfill({ json: rep })
    return route.fulfill({ json: { content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 } })
  })
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript((u) => { (window as unknown as { __yadonyAuthSeed: typeof u }).__yadonyAuthSeed = u }, ADMIN)
  await mockReports(page)
})

async function openRatings(page: Page) {
  await page.goto('/signalements')
  await page.locator('[data-test="tab-ratings"]').click()
}
const selected = (page: Page) => page.locator('[data-test^="rating-row-"][data-selected="true"]')

test('le premier avis signalé est ouvert d’office, avec son contexte et sa décision', async ({ page }) => {
  await mockRatings(page, [rating('x', { flagged: false }), A, B], { a: { status: 200, json: CONTEXT } })
  await openRatings(page)

  await expect(selected(page)).toHaveAttribute('data-test', 'rating-row-a')
  await expect(page.locator('[data-test="rating-case-comment"]')).toContainText('Commentaire a')
  await expect(page.locator('[data-test="rating-rater-given"]')).toHaveText('12 avis donnés, moyenne 1,8')
  await expect(page.locator('[data-test="rating-rater-habit"]')).toHaveText('Note presque toujours bas')
  await expect(page.locator('[data-test="rating-same-relation"]')).toHaveText('3 notes de Awa Diallo à Karim Sy')
  await expect(page.locator('[data-test="rating-rated-average"]')).toContainText('4,0')
  await expect(page.locator('[data-test="rating-reports-open"]')).toContainText('1 ouvert')
  await expect(page.locator('[data-test="rating-rater-link"]')).toHaveAttribute('href', new RegExp(`/users/${U_RATER}$`))
})

test('exclure montre l’effet sur la moyenne, puis passe à l’avis suivant', async ({ page }) => {
  const calls = await mockRatings(page, [A, B], { a: { status: 200, json: CONTEXT }, b: { status: 200, json: { ...CONTEXT, sameRelationCount: 1 } } })
  await openRatings(page)
  await expect(page.locator('[data-test="rating-effect"]')).toHaveText('Moyenne de Karim Sy : 4,0 → 4,8 (4 avis)')
  await expect(page.locator('[data-test="rating-confirm"]')).toContainText('Exclure de la moyenne et passer au suivant')

  await page.locator('[data-test="rating-quick-Représailles"]').click()
  await page.locator('[data-test="rating-confirm"]').click()

  await expect(page.locator('[data-test="ratings-done"]')).toHaveText('Avis exclu de la moyenne.')
  await expect(selected(page)).toHaveAttribute('data-test', 'rating-row-b')
  await expect(page.locator('[data-test="rating-case-comment"]')).toContainText('Commentaire b')
  const post = calls.find((c) => c.method === 'POST')!
  expect(post.url).toContain('/admin/ratings/a/exclude')
  expect(post.body).toEqual({ excluded: true, reason: 'Représailles' })
})

test('réintégrer un avis exclu : motif facultatif, drapeau excluded=false', async ({ page }) => {
  const excluded = rating('a', { excluded: true, excludedReason: 'doute' })
  const calls = await mockRatings(page, [excluded], { a: { status: 200, json: CONTEXT } })
  await openRatings(page)
  await expect(page.locator('[data-test="rating-case-excluded-reason"]')).toHaveText('Exclu : doute')
  await expect(page.locator('[data-test="rating-action-REINTEGRATE"]')).toBeVisible()
  await expect(page.locator('[data-test="rating-confirm"]')).toBeEnabled()
  await page.locator('[data-test="rating-confirm"]').click()
  await expect(page.locator('[data-test="ratings-done"]')).toHaveText('Avis réintégré dans la moyenne.')
  expect(calls.find((c) => c.method === 'POST')!.body).toEqual({ excluded: false, reason: '' })
})

test('clavier : J / K, 2 choisit la suppression, ⌘⏎ confirme depuis le motif', async ({ page }) => {
  const calls = await mockRatings(page, [A, B], {})
  await openRatings(page)
  await expect(selected(page)).toHaveAttribute('data-test', 'rating-row-a')

  await page.keyboard.press('j')
  await expect(selected(page)).toHaveAttribute('data-test', 'rating-row-b')
  await page.keyboard.press('k')
  await expect(selected(page)).toHaveAttribute('data-test', 'rating-row-a')

  await page.keyboard.press('2')
  await expect(page.locator('[data-test="rating-action-DELETE"] input')).toBeChecked()
  await page.locator('[data-test="rating-reason"]').fill('contenu illicite')
  await page.locator('[data-test="rating-acknowledge"]').check()
  await page.keyboard.press('Meta+Enter')

  await expect(page.locator('[data-test="ratings-done"]')).toHaveText('Avis supprimé.')
  expect(calls.find((c) => c.method === 'DELETE')!.url).toMatch(/reason=contenu(\+|%20)illicite/)
})

test('les raccourcis de l’onglet Signalements ne répondent pas depuis l’onglet Avis, et inversement', async ({ page }) => {
  await mockRatings(page, [A, B], {})
  await page.goto('/signalements')
  await page.locator('[data-test="tab-ratings"]').click()
  await expect(selected(page)).toHaveAttribute('data-test', 'rating-row-a')
  await page.locator('[data-test="tab-reports"]').click()
  await page.keyboard.press('j')
  await expect(selected(page)).toHaveAttribute('data-test', 'rating-row-a')
})

test('filtres : Signalés et Notes basses interrogent le back, Supprimés vide le dossier si rien', async ({ page }) => {
  const calls = await mockRatings(page, [A], {})
  await openRatings(page)
  await expect(page.locator('[data-test="rating-row-a"]')).toBeVisible()

  await page.locator('[data-test="flagged-only"]').click()
  await expect.poll(() => calls.some((c) => c.url.includes('flaggedOnly=true'))).toBe(true)
  await expect(page.locator('[data-test="flagged-only"]')).toHaveAttribute('aria-pressed', 'true')

  await page.locator('[data-test="low-only"]').click()
  await expect.poll(() => calls.some((c) => c.url.includes('maxScore=2'))).toBe(true)

  await page.locator('[data-test="ratings-deleted-only"]').click()
  await expect.poll(() => calls.some((c) => c.url.includes('deleted=true'))).toBe(true)
})

test('un signalement qui vise l’avis s’ouvre dans l’onglet Signalements', async ({ page }) => {
  await mockRatings(page, [A], { a: { status: 200, json: CONTEXT } })
  await openRatings(page)
  await page.locator('[data-test="rating-reports"] [data-test="related-rep1"]').click()
  await expect(page.locator('[data-test="report-case"]')).toContainText('Avis injurieux')
  await expect(page.locator('[data-test="tab-reports"]')).toHaveAttribute('aria-pressed', 'true')
})

test('sans REPORT_VIEW : une phrase à la place des signalements, le reste du dossier est là', async ({ page }) => {
  await mockRatings(page, [A], { a: { status: 200, json: { ...CONTEXT, reports: [], openReports: 0, reportsRestricted: true } } })
  await openRatings(page)
  await expect(page.locator('[data-test="rating-reports-restricted"]')).toContainText('pas visibles avec votre rôle')
  await expect(page.locator('[data-test="rating-reports"]')).toHaveCount(0)
  await expect(page.locator('[data-test="rating-rated-average"]')).toBeVisible()
})

test('ancien back (404 sans code) : le dossier reste complet, la décision possible', async ({ page }) => {
  await mockRatings(page, [A], { a: { status: 404, json: {} } })
  await openRatings(page)
  await expect(page.locator('[data-test="rating-case-comment"]')).toContainText('Commentaire a')
  await expect(page.locator('[data-test="rating-context-error"]')).toHaveCount(0)
  await expect(page.locator('[data-test="rating-history"]')).toHaveCount(0)
  await expect(page.locator('[data-test="rating-action-EXCLUDE"]')).toBeVisible()
})

test('erreur 500 du contexte : une phrase discrète, l’avis reste modérable', async ({ page }) => {
  await mockRatings(page, [A], { a: { status: 500, json: { detail: 'boom' } } })
  await openRatings(page)
  await expect(page.locator('[data-test="rating-context-error"]')).toBeVisible()
  await expect(page.locator('[data-test="rating-action-EXCLUDE"]')).toBeVisible()
})

test('trois colonnes côte à côte, même sur un écran étroit', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 800 })
  await mockRatings(page, [A, B], { a: { status: 200, json: CONTEXT } })
  await openRatings(page)
  const queue = page.locator('[data-test="rating-queue-panel"]')
  const kase = page.locator('[data-test="rating-case"]')
  const decision = page.locator('[data-test="rating-decision-panel"]')
  await expect(decision).toBeVisible()
  const [q, c, d] = await Promise.all([queue.boundingBox(), kase.boundingBox(), decision.boundingBox()])
  expect(q!.x).toBeLessThan(c!.x)
  expect(c!.x).toBeLessThan(d!.x)
  expect(Math.abs(q!.y - d!.y)).toBeLessThan(40)
})
