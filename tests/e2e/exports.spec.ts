import { test, expect } from '@playwright/test'

const ADMIN = { id: 'a1', email: 'admin.1@yadony.com', role: 'ADMIN', status: 'ACTIVE', mustChangePassword: false, permissionOverrides: {} }

test.beforeEach(async ({ page }) => {
  await page.addInitScript((u) => { (window as unknown as { __yadonyAuthSeed: typeof u }).__yadonyAuthSeed = u }, ADMIN)
  await page.route('**/api/v1/admin/exports/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/csv',
      headers: { 'content-disposition': 'attachment; filename="export.csv"' },
      body: 'id,amount\n1,1200\n2,3400\n',
    }),
  )
})

test('admin sees the export form', async ({ page }) => {
  await page.goto('/exports')
  await expect(page.locator('h1').first()).toContainText('Exports')
  await expect(page.locator('[data-test="export-type"]')).toBeVisible()
  await expect(page.locator('[data-test="export-run"]')).toBeVisible()
})

test('admin downloads a transactions CSV', async ({ page }) => {
  await page.goto('/exports')
  // Le bouton n'est actif qu'une fois la page hydratée : garantit que les
  // interactions de formulaire (v-model) sont bien capturées.
  await expect(page.locator('[data-test="export-run"]')).toBeEnabled()
  await page.locator('[data-test="export-type"]').selectOption('transactions')
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('[data-test="export-run"]').click(),
  ])
  expect(download.suggestedFilename()).toContain('transactions')
  expect(download.suggestedFilename()).toMatch(/\.csv$/)
})

test('admin downloads a users CSV with a date range', async ({ page }) => {
  const urls: string[] = []
  await page.route('**/api/v1/admin/exports/users**', (route) => {
    urls.push(route.request().url())
    return route.fulfill({ status: 200, contentType: 'text/csv', body: 'id\n1\n' })
  })
  await page.goto('/exports')
  await expect(page.locator('[data-test="export-run"]')).toBeEnabled()
  await page.locator('[data-test="export-type"]').selectOption('users')
  await page.locator('[data-test="export-from"]').fill('2026-06-01')
  await page.locator('[data-test="export-to"]').fill('2026-06-30')
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('[data-test="export-run"]').click(),
  ])
  expect(download.suggestedFilename()).toContain('users')
  await expect.poll(() => urls.some((u) => u.includes('from=2026-06-01') && u.includes('to=2026-06-30'))).toBe(true)
})
