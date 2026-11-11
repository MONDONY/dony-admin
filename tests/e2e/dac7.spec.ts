import { test, expect, type Page } from '@playwright/test'

const ADMIN = { id: 'a1', email: 'admin.1@yadony.com', role: 'ADMIN', status: 'ACTIVE', mustChangePassword: false, permissionOverrides: {} }
const SUPPORT = { ...ADMIN, id: 'a2', email: 'support@yadony.com', role: 'SUPPORT' }

const U1 = '7a2e4b1c-0000-4a00-8000-0000000000a1'
const OVERVIEW = {
  year: new Date().getFullYear(), enabled: false, remindersEnabled: false, declarableSellers: 5, withTaxInfo: 3, missingTaxInfo: 2,
  identityReview: 0, unknownResidence: 0, nonDeclarable: 1, refundsToReconcile: 0, pendingSplits: 0, anomalies: 0,
  invalidPartnerJurisdictions: [], totals: { operations: 10, netEur: 500, commissionEur: 60 },
  eurComplete: true, commissionComplete: true, exportReady: false, blockers: ['TAX_INFO_MISSING'],
}
const SELLER = {
  userId: U1, displayName: 'Awa Diop', residenceCountry: 'FR', residencyStatus: 'DECLARABLE', taxInfoProvided: false,
  identityStatus: 'COMPLETE', solicitation: 'SOLLICITER', remindersSent: 0, operations: 3, netEur: 200, commissionEur: 24,
  eurComplete: true, commissionComplete: true,
}
const problem404 = { status: 404, contentType: 'application/problem+json', body: JSON.stringify({ type: 'about:blank', title: 'Not Found', status: 404, detail: 'No endpoint matches this path' }) }

async function seed(page: Page, user: typeof ADMIN) {
  await page.addInitScript((u) => { (window as unknown as { __yadonyAuthSeed: typeof u }).__yadonyAuthSeed = u }, user)
}

test('admin : la synthèse, les blocages et le tableau des voyageurs', async ({ page }) => {
  await seed(page, ADMIN)
  await page.route('**/api/v1/admin/dac7/overview**', (route) => route.fulfill({ json: OVERVIEW }))
  await page.route('**/api/v1/admin/dac7/sellers**', (route) => route.fulfill({ json: [SELLER] }))
  await page.goto('/dac7')
  await expect(page.locator('h1').first()).toContainText('Déclaration DAC7')
  await expect(page.locator('[data-test="dac7-card-declarableSellers"]')).toContainText('5')
  await expect(page.locator('[data-test="dac7-badge-collecte"]')).toHaveText('Collecte éteinte')
  await expect(page.locator('[data-test="dac7-blocker-TAX_INFO_MISSING"]')).toContainText('Numéro fiscal manquant')
  await expect(page.locator(`[data-test="dac7-seller-row-${U1}"]`)).toContainText('Awa Diop')
})

test('SUPPORT : renvoyé sur /denied, sans l’entrée du menu', async ({ page }) => {
  await seed(page, SUPPORT)
  await page.route('**/api/v1/admin/**', (route) => route.abort())
  await page.goto('/dac7')
  await expect(page).toHaveURL(/\/denied$/)
})

test('ancien back : « Non disponible sur cette version du serveur », sans erreur', async ({ page }) => {
  await seed(page, ADMIN)
  await page.route('**/api/v1/admin/dac7/**', (route) => route.fulfill(problem404))
  await page.goto('/dac7')
  await expect(page.locator('[data-test="dac7-page-unavailable"]')).toContainText('Non disponible sur cette version du serveur')
})
