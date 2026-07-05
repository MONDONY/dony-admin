import { test, expect } from '@playwright/test'

// Vérifie la connexion démo : sans seed ni Firebase, le bouton « Connexion démo »
// ouvre une session ADMIN qui passe à tous les coups et redirige vers l'accueil.
const OVERVIEW = {
  users: { total: 0, active: 0, suspended: 0, banned: 0, pendingDeletion: 0, kycVerified: 0, kycPending: 0, pro: 0, newLast7d: 0, newLast30d: 0 },
  announcements: { active: 0, full: 0, inProgress: 0, completed: 0, cancelled: 0 },
  bids: { pending: 0, accepted: 0, inTransit: 0, completed: 0, cancelled: 0, total: 0 },
  gmv: { escrowHeld: 0, released: 0, refunded: 0, commission: 0 },
  queues: { openDisputes: 0, pendingNoShows: 0, unresolvedAlerts: 0, pendingKyc: 0, escrowJ48: 0 },
}

// Depuis 580c4b2, le bouton démo fait un VRAI signIn Firebase — impossible à
// réussir en e2e (pas de Firebase). On vérifie le comportement dégradé : le
// clic reste sur /login et affiche l'erreur, sans crash.
test('demo login without Firebase stays on login with an error', async ({ page }) => {
  await page.route('**/api/v1/admin/metrics/overview**', (route) => route.fulfill({ json: OVERVIEW }))

  await page.goto('/login')
  // Attendre l'hydratation (bouton actif) avant de cliquer.
  await expect(page.locator('[data-test="demo-login"]')).toBeEnabled()
  await page.locator('[data-test="demo-login"]').click()

  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByText('Connexion démo échouée', { exact: false })).toBeVisible()
})

test('unauthenticated access still redirects to login', async ({ page }) => {
  await page.goto('/users')
  await expect(page).toHaveURL(/\/login$/)
})
