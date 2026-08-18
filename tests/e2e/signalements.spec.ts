import { test, expect } from '@playwright/test'

const ADMIN = { id: 'a1', email: 'admin.1@yadony.com', role: 'ADMIN', status: 'ACTIVE', mustChangePassword: false, permissionOverrides: {} }

const REPORTS_PAGE = {
  content: [
    {
      id: 'r1', targetType: 'USER', targetId: 'u9', reason: 'FRAUD', description: 'faux profil',
      reporterName: 'Awa', status: 'OPEN', actionTaken: null, resolutionNote: null,
      resolvedAt: null, createdAt: '2026-06-01T10:00:00Z',
    },
  ],
  totalElements: 1, totalPages: 1, number: 0, size: 20,
}
const RESOLVED_REPORT = { ...REPORTS_PAGE.content[0], status: 'RESOLVED', actionTaken: 'WARN', resolvedAt: '2026-06-02T10:00:00Z' }

const RATINGS_PAGE = {
  content: [
    {
      id: 'rt1', bidId: 'b1', raterName: 'Awa', ratedName: 'Karim', score: 1,
      comment: 'arnaqueur', flagged: true, excluded: false, excludedReason: null,
      createdAt: '2026-06-01T10:00:00Z',
    },
  ],
  totalElements: 1, totalPages: 1, number: 0, size: 20,
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript((u) => { (window as unknown as { __yadonyAuthSeed: typeof u }).__yadonyAuthSeed = u }, ADMIN)

  await page.route('**/api/v1/admin/reports**', (route) => {
    const url = route.request().url()
    const method = route.request().method()
    if (method === 'POST' && url.includes('/resolve')) return route.fulfill({ json: RESOLVED_REPORT })
    return route.fulfill({ json: REPORTS_PAGE })
  })

  await page.route('**/api/v1/admin/ratings**', (route) => {
    const url = route.request().url()
    const method = route.request().method()
    if (method === 'POST' && url.includes('/exclude')) return route.fulfill({ json: { ...RATINGS_PAGE.content[0], excluded: true } })
    if (method === 'DELETE') return route.fulfill({ status: 204, body: '' })
    return route.fulfill({ json: RATINGS_PAGE })
  })
})

test('admin sees open reports', async ({ page }) => {
  await page.goto('/signalements')
  await expect(page.locator('h1').first()).toContainText('Signalements')
  await expect(page.locator('[data-test="report-row-r1"]')).toContainText('FRAUD')
  await expect(page.locator('[data-test="resolve-r1"]')).toBeVisible()
})

test('admin resolves a report with an action + note', async ({ page }) => {
  await page.goto('/signalements')
  await page.locator('[data-test="resolve-r1"]').click()
  await page.locator('[data-test="resolve-action"]').selectOption('SUSPEND_TARGET')
  await page.locator('[data-test="resolve-note"]').fill('compte frauduleux confirmé')
  await page.locator('[data-test="resolve-confirm"]').click()
  await expect(page.locator('[data-test="resolve-overlay"]')).toHaveCount(0)
})

test('admin switches to Avis tab and sees flagged rating', async ({ page }) => {
  await page.goto('/signalements')
  // Attendre le chargement client des signalements : garantit que l'app est
  // hydratée avant de cliquer un onglet rendu côté SSR (sinon clic perdu).
  await expect(page.locator('[data-test="report-row-r1"]')).toBeVisible()
  await page.locator('[data-test="tab-ratings"]').click()
  await expect(page.locator('[data-test="rating-row-rt1"]')).toContainText('arnaqueur')
  await expect(page.locator('[data-test="flagged-rt1"]')).toBeVisible()
})

test('admin excludes a rating with a reason', async ({ page }) => {
  await page.goto('/signalements')
  await expect(page.locator('[data-test="report-row-r1"]')).toBeVisible()
  await page.locator('[data-test="tab-ratings"]').click()
  await page.locator('[data-test="exclude-rt1"]').click()
  await page.locator('[data-test="reason"]').fill('avis diffamatoire')
  await page.locator('[data-test="confirm"]').click()
  await expect(page.locator('[data-test="reason"]')).toHaveCount(0)
})

test('admin removes a rating', async ({ page }) => {
  await page.goto('/signalements')
  await expect(page.locator('[data-test="report-row-r1"]')).toBeVisible()
  await page.locator('[data-test="tab-ratings"]').click()
  await page.locator('[data-test="remove-rt1"]').click()
  await page.locator('[data-test="confirm"]').click()
  await expect(page.locator('[data-test="overlay"]')).toHaveCount(0)
})
