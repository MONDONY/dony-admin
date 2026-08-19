import { test, expect } from '@playwright/test'

const ADMIN = { id: 'a1', email: 'admin.1@yadony.com', role: 'ADMIN', status: 'ACTIVE', mustChangePassword: false, permissionOverrides: {} }
const SUPPORT = { id: 's1', email: 'support.1@yadony.com', role: 'SUPPORT', status: 'ACTIVE', mustChangePassword: false, permissionOverrides: {} }

const SETTINGS = [
  { key: 'commission_rate', value: '0.12', type: 'DECIMAL', updatedAt: null, updatedByEmail: null },
  { key: 'urgency_threshold_days', value: '2', type: 'INTEGER', updatedAt: null, updatedByEmail: null },
  { key: 'reimbursement_cap_eur', value: '500', type: 'DECIMAL', updatedAt: null, updatedByEmail: null },
  { key: 'sms_enabled', value: 'true', type: 'BOOLEAN', updatedAt: null, updatedByEmail: null },
]

async function seed(page: import('@playwright/test').Page, user: typeof ADMIN | typeof SUPPORT) {
  await page.addInitScript((u) => { (window as unknown as { __yadonyAuthSeed: typeof u }).__yadonyAuthSeed = u }, user)
}

test('admin modifie la commission avec une confirmation simple', async ({ page }) => {
  await seed(page, ADMIN)
  let settings = SETTINGS
  const putCalls: { key: string; value: string }[] = []

  await page.route('**/api/v1/admin/settings**', (route) => {
    const req = route.request()
    const url = req.url()
    const method = req.method()
    if (method === 'PUT') {
      const key = url.split('/admin/settings/')[1]
      const body = req.postDataJSON() as { value: string }
      putCalls.push({ key, value: body.value })
      const updated = { key, value: body.value, type: 'DECIMAL', updatedAt: '2026-08-19T10:00:00Z', updatedByEmail: 'admin.1@yadony.com' }
      settings = settings.map((s) => (s.key === key ? updated : s))
      return route.fulfill({ json: updated })
    }
    return route.fulfill({ json: settings })
  })

  await page.goto('/parametres')
  await expect(page.locator('[data-test="setting-row-commission_rate"]')).toBeVisible()

  await page.locator('[data-test="setting-value-commission_rate"]').fill('15')
  await page.locator('[data-test="setting-save-commission_rate"]').click()

  // Confirmation simple : pas de saisie de contrôle, le bouton est utilisable directement.
  await expect(page.locator('[data-test="confirm"]')).toBeEnabled()
  await page.locator('[data-test="confirm"]').click()

  await expect.poll(() => putCalls.length).toBe(1)
  expect(putCalls[0]).toEqual({ key: 'commission_rate', value: '0.15' })
  await expect(page.locator('[data-test="setting-meta-commission_rate"]')).toContainText('admin.1@yadony.com')
})

test('la désactivation des SMS reste bloquée tant que la phrase de contrôle est incorrecte', async ({ page }) => {
  await seed(page, ADMIN)
  const putCalls: { key: string; value: string }[] = []

  await page.route('**/api/v1/admin/settings**', (route) => {
    const req = route.request()
    const url = req.url()
    const method = req.method()
    if (method === 'PUT') {
      const key = url.split('/admin/settings/')[1]
      const body = req.postDataJSON() as { value: string }
      putCalls.push({ key, value: body.value })
      return route.fulfill({ json: { key, value: body.value, type: 'BOOLEAN', updatedAt: '2026-08-19T10:00:00Z', updatedByEmail: 'admin.1@yadony.com' } })
    }
    return route.fulfill({ json: SETTINGS })
  })

  await page.goto('/parametres')
  await expect(page.locator('[data-test="setting-row-sms_enabled"]')).toBeVisible()

  await page.locator('[data-test="setting-value-sms_enabled"]').selectOption('false')
  await page.locator('[data-test="setting-save-sms_enabled"]').click()

  // La confirmation exige la phrase exacte « DESACTIVER SMS » avant d'être utilisable.
  await expect(page.locator('[data-test="confirm"]')).toBeDisabled()
  await page.locator('[data-test="confirmation-input"]').fill('DESACTIVER')
  await expect(page.locator('[data-test="confirm"]')).toBeDisabled()
  await page.locator('[data-test="confirmation-input"]').fill('desactiver sms')
  await expect(page.locator('[data-test="confirm"]')).toBeDisabled()

  expect(putCalls.length).toBe(0)

  await page.locator('[data-test="confirmation-input"]').fill('DESACTIVER SMS')
  await expect(page.locator('[data-test="confirm"]')).toBeEnabled()
  await page.locator('[data-test="confirm"]').click()

  await expect.poll(() => putCalls.length).toBe(1)
  expect(putCalls[0]).toEqual({ key: 'sms_enabled', value: 'false' })
})

test('un compte sans CONFIG_MANAGE ne voit pas Paramètres et est redirigé s’il force l’URL', async ({ page }) => {
  await seed(page, SUPPORT)
  await page.route('**/api/v1/admin/**', (route) => route.abort())

  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Paramètres' })).toHaveCount(0)

  await page.goto('/parametres')
  await expect(page).toHaveURL(/\/denied$/)
})
