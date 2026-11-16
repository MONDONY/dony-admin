import { test, expect } from '@playwright/test'

const SUPPORT = { id: 'a1', email: 'support.1@yadony.com', role: 'SUPPORT', status: 'ACTIVE', mustChangePassword: false, permissionOverrides: {} }

const COLIS = {
  id: 'voir-colis-en-cours', title: 'Voir les colis en cours de transport', category: 'activite',
  summary: 'La vue En cours de la page Colis.', permission: 'BID_VIEW', accessible: true,
  routes: [{ path: '/colis?view=ACTIVE', label: 'Ouvrir les colis en cours' }],
}
const ADMINS = {
  id: 'administrateurs', title: 'Administrateurs', category: 'systeme', summary: 'Gérer les comptes.',
  permission: 'ADMIN_MANAGE', accessible: false, routes: [],
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript((u) => { (window as unknown as { __yadonyAuthSeed: typeof u }).__yadonyAuthSeed = u }, SUPPORT)
  await page.route('**/api/v1/admin/help/articles', route => route.fulfill({ json: {
    categories: [{ id: 'activite', label: 'Activité' }, { id: 'systeme', label: 'Système' }],
    articles: [COLIS, ADMINS], assistantEnabled: true,
  } }))
  await page.route('**/api/v1/admin/help/articles/voir-colis-en-cours', route => route.fulfill({ json: {
    ...COLIS, categoryLabel: 'Activité', related: [ADMINS],
    body: '## Étapes\n1. Ouvrez **Colis**.\n2. Cliquez sur **En cours**.\n\n> **Attention :** vérifiez le statut.',
  } }))
  await page.route('**/api/v1/admin/help/search**', route => route.fulfill({ json: {
    query: 'colis en cours', results: [{ ...COLIS, snippet: 'Cliquez sur En cours pour voir les colis partis.' }],
  } }))
  await page.route('**/api/v1/admin/help/ask', route => route.fulfill({ json: {
    answer: 'Ouvrez **Colis**, vue **En cours**.', answered: true,
    actions: [{ path: '/colis?view=ACTIVE', label: 'Ouvrir les colis en cours' }],
    sources: [{ id: 'voir-colis-en-cours', title: 'Voir les colis en cours de transport' }], provider: 'groq', remaining: 59,
  } }))
})

test('le support parcourt les rubriques et voit les fiches réservées', async ({ page }) => {
  await page.goto('/aide')
  await expect(page.locator('[data-test="help-section-activite"]')).toContainText('Voir les colis en cours de transport')
  await expect(page.locator('[data-test="help-section-systeme"]')).toContainText('Administrateurs')
})

test('rechercher un sujet puis ouvrir la fiche et sa page', async ({ page }) => {
  await page.goto('/aide')
  // Rubriques affichées : la page est hydratée, la frappe est bien captée.
  await expect(page.locator('[data-test="help-sections"]')).toBeVisible()
  await page.locator('[data-test="help-search-input"]').fill('colis en cours')
  await page.locator('[data-test="help-result-voir-colis-en-cours"]').click()
  await expect(page.locator('[data-test="help-article-title"]')).toHaveText('Voir les colis en cours de transport')
  await expect(page.locator('[data-test="help-callout-warning"]')).toBeVisible()
  await expect(page.locator('[data-test="help-route-0"]')).toHaveAttribute('href', /\/colis\?view=ACTIVE$/)
})

test('poser une question à l’assistant et obtenir le lien', async ({ page }) => {
  await page.goto('/aide')
  await expect(page.locator('[data-test="help-sections"]')).toBeVisible()
  await page.locator('[data-test="help-assistant-trigger"]').click()
  await page.locator('[data-test="help-assistant-input"]').fill('comment je fais pour regarder les colis en cours')
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-test="help-assistant-answer"]')).toContainText('En cours')
  await expect(page.locator('[data-test="help-assistant-action"]')).toHaveAttribute('href', /\/colis\?view=ACTIVE$/)
  await expect(page.locator('[data-test="help-assistant-source"]')).toHaveAttribute('href', /\/aide\/voir-colis-en-cours$/)
})
