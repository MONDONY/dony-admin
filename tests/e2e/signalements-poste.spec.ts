import { test, expect, type Page } from '@playwright/test'

/**
 * Poste de traitement : file d'attente, dossier et décision sur un seul écran, enchaînement
 * des dossiers et raccourcis clavier.
 */
const ADMIN = { id: 'a1', email: 'admin.1@yadony.com', role: 'ADMIN', status: 'ACTIVE', mustChangePassword: false, permissionOverrides: {} }

const base = {
  targetType: 'MESSAGE', targetId: 't1', description: null, reporterName: 'Awa', status: 'OPEN', actionTaken: null,
  resolutionNote: null, resolvedAt: null, photoUrls: [], reason: 'HARASSMENT',
  availableActions: ['RESOLVE', 'DELETE_MESSAGE', 'WARN_AUTHOR', 'SUSPEND_AUTHOR', 'DISMISS'],
  targetAuthor: { userId: 'u2', name: 'Moussa B.' },
}
const A = { ...base, id: 'a', targetLabel: 'Dossier A', createdAt: '2026-06-01T10:00:00Z' }
const B = { ...base, id: 'b', targetLabel: 'Dossier B', createdAt: '2026-06-02T10:00:00Z' }
const C = { ...base, id: 'c', targetLabel: 'Dossier C', createdAt: '2026-06-03T10:00:00Z' }

type Resolve = { action: string; note: string; targetMessage?: string; reporterMessage?: string }

async function mockReports(page: Page, reports: { id: string }[]) {
  const posted: { id: string; body: Resolve }[] = []
  await page.route('**/api/v1/admin/reports**', (route) => {
    const req = route.request()
    const m = req.url().match(/\/admin\/reports\/([^/?]+)\/resolve/)
    if (req.method() === 'POST' && m) {
      const body = req.postDataJSON() as Resolve
      posted.push({ id: m[1]!, body })
      const current = reports.find((x) => x.id === m[1])
      return route.fulfill({
        json: { ...current, status: body.action === 'DISMISS' ? 'DISMISSED' : 'RESOLVED', actionTaken: body.action, availableActions: [] },
      })
    }
    return route.fulfill({ json: { content: reports, totalElements: reports.length, totalPages: 1, number: 0, size: 20 } })
  })
  return posted
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript((u) => { (window as unknown as { __yadonyAuthSeed: typeof u }).__yadonyAuthSeed = u }, ADMIN)
})

const selected = (page: Page) => page.locator('[data-test^="report-row-"][data-selected="true"]')

test('le premier dossier à traiter est ouvert d’office, avec sa décision', async ({ page }) => {
  await mockReports(page, [A, B])
  await page.goto('/signalements')
  await expect(selected(page)).toHaveAttribute('data-test', 'report-row-a')
  await expect(page.locator('[data-test="report-case"]')).toContainText('Dossier A')
  await expect(page.locator('[data-test="decision-panel"]')).toBeVisible()
})

test('confirmer passe au dossier suivant, et le bandeau de résultat reste', async ({ page }) => {
  const posted = await mockReports(page, [A, B, C])
  await page.goto('/signalements')
  await expect(selected(page)).toHaveAttribute('data-test', 'report-row-a')
  await expect(page.locator('[data-test="resolve-confirm"]')).toContainText('Marquer comme traité et passer au suivant')
  await page.locator('[data-test="resolve-confirm"]').click()
  await expect(selected(page)).toHaveAttribute('data-test', 'report-row-b')
  await expect(page.locator('[data-test="report-case"]')).toContainText('Dossier B')
  await expect(page.locator('[data-test="reports-resolved"]')).toContainText('Signalement traité')
  expect(posted.map((p) => p.id)).toEqual(['a'])
  // Le dossier traité reste dans la liste, avec son statut.
  await expect(page.locator('[data-test="report-row-a"]')).toContainText('Résolu')
})

test('dernier dossier : plus de « passer au suivant », le dossier traité reste affiché', async ({ page }) => {
  await mockReports(page, [A])
  await page.goto('/signalements')
  const confirm = page.locator('[data-test="resolve-confirm"]')
  await expect(confirm).not.toContainText('passer au suivant')
  await confirm.click()
  await expect(selected(page)).toHaveAttribute('data-test', 'report-row-a')
  await expect(page.locator('[data-test="decision-closed"]')).toBeVisible()
})

test('clavier : J / K changent de dossier, 3 choisit l’action, ⌘⏎ confirme depuis la note', async ({ page }) => {
  const posted = await mockReports(page, [A, B])
  await page.goto('/signalements')
  await expect(selected(page)).toHaveAttribute('data-test', 'report-row-a')

  await page.keyboard.press('j')
  await expect(selected(page)).toHaveAttribute('data-test', 'report-row-b')
  await page.keyboard.press('k')
  await expect(selected(page)).toHaveAttribute('data-test', 'report-row-a')

  await page.keyboard.press('3') // Avertir l'auteur
  await expect(page.locator('[data-test="resolve-action-WARN_AUTHOR"] input')).toBeChecked()
  const note = page.locator('[data-test="resolve-note"]')
  await note.click()
  await note.fill('insultes répétées')
  // Dans un champ de saisie, J / K / chiffres restent du texte.
  await page.keyboard.type('jk1')
  await expect(note).toHaveValue('insultes répétéesjk1')
  await expect(selected(page)).toHaveAttribute('data-test', 'report-row-a')

  await page.keyboard.press('Meta+Enter')
  await expect.poll(() => posted.length).toBe(1)
  expect(posted[0]!.body).toMatchObject({ action: 'WARN_AUTHOR', note: 'insultes répétéesjk1' })
  await expect(selected(page)).toHaveAttribute('data-test', 'report-row-b')
})

test('clavier : ⏎ confirme depuis la page, sans champ actif', async ({ page }) => {
  const posted = await mockReports(page, [A, B])
  await page.goto('/signalements')
  await expect(selected(page)).toHaveAttribute('data-test', 'report-row-a')
  await page.locator('body').click({ position: { x: 5, y: 5 } })
  await page.keyboard.press('Enter')
  await expect.poll(() => posted.length).toBe(1)
  expect(posted[0]!.body.action).toBe('RESOLVE')
})

test('l’aperçu montre ce qui part, et la note interne n’y figure jamais', async ({ page }) => {
  const posted = await mockReports(page, [A])
  await page.goto('/signalements')
  await page.locator('[data-test="resolve-action-WARN_AUTHOR"]').click()
  await page.locator('[data-test="resolve-note"]').fill('signalé par Awa, sa voisine')
  await page.locator('[data-test="resolve-target-message"]').fill('Merci de rester courtois')
  await page.locator('[data-test="resolve-reporter-message"]').fill('Auteur averti.')
  const preview = page.locator('[data-test="resolve-preview"]')
  await expect(preview).toContainText('Moussa B.')
  await expect(preview).toContainText('Merci de rester courtois')
  await expect(preview).toContainText('Merci, votre signalement a été traité. Auteur averti.')
  await expect(preview).not.toContainText('sa voisine')
  await page.locator('[data-test="resolve-confirm"]').click()
  await expect.poll(() => posted.length).toBe(1)
  expect(posted[0]!.body).toEqual({
    action: 'WARN_AUTHOR', note: 'signalé par Awa, sa voisine',
    targetMessage: 'Merci de rester courtois', reporterMessage: 'Auteur averti.',
  })
})

test('trois colonnes côte à côte, même sur un écran étroit', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 800 })
  await mockReports(page, [A, B])
  await page.goto('/signalements')
  const queue = page.locator('[data-test="report-queue-panel"]')
  const kase = page.locator('[data-test="report-case"]')
  const decision = page.locator('[data-test="decision-panel"]')
  await expect(decision).toBeVisible()
  const [q, c, d] = await Promise.all([queue.boundingBox(), kase.boundingBox(), decision.boundingBox()])
  // Même ligne, de gauche à droite : la décision ne se replie jamais sous le dossier.
  expect(q!.x).toBeLessThan(c!.x)
  expect(c!.x).toBeLessThan(d!.x)
  expect(Math.abs(q!.y - d!.y)).toBeLessThan(40)
})
