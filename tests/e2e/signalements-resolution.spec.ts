import { test, expect, type Page } from '@playwright/test'

/**
 * Traitement d'un signalement selon sa cible (dony-back feature/signalements-resolution-actions) :
 * `availableActions` calculé par le back, `targetAuthor` pour les actions sur l'auteur, et
 * tolérance d'un ancien back qui ne renvoie ni l'un ni l'autre.
 */
const ADMIN = { id: 'a1', email: 'admin.1@yadony.com', role: 'ADMIN', status: 'ACTIVE', mustChangePassword: false, permissionOverrides: {} }

const base = {
  targetId: 't1', description: null, reporterName: 'Awa', status: 'OPEN', actionTaken: null,
  resolutionNote: null, resolvedAt: null, createdAt: '2026-06-01T10:00:00Z', photoUrls: [],
}
const APP_BUG = { ...base, id: 'app1', targetType: 'APP', targetId: null, targetLabel: null, reason: 'SCREEN_BUG', screenRoute: '/home', availableActions: ['DISMISS', 'RESOLVE'] }
const MESSAGE = {
  ...base, id: 'msg1', targetType: 'MESSAGE', targetLabel: 'Message de Moussa', reason: 'HARASSMENT',
  availableActions: ['RESOLVE', 'DELETE_MESSAGE', 'WARN_AUTHOR', 'SUSPEND_AUTHOR', 'DISMISS'],
  targetAuthor: { userId: 'u2', name: 'Moussa B.' },
}
const RATING = {
  ...base, id: 'rat1', targetType: 'RATING', targetLabel: 'Avis 1 étoile', reason: 'INAPPROPRIATE_CONTENT',
  availableActions: ['RESOLVE', 'EXCLUDE_RATING', 'DELETE_RATING', 'WARN_AUTHOR', 'SUSPEND_AUTHOR', 'DISMISS'],
  targetAuthor: { userId: 'u3', name: 'Awa D.' },
}

type Resolve = { action: string; note: string }

async function mockReports(page: Page, reports: unknown[], onResolve?: (_id: string, _body: Resolve) => { status: number; json: unknown } | null) {
  const bodies: Resolve[] = []
  await page.route('**/api/v1/admin/reports**', (route) => {
    const req = route.request()
    const m = req.url().match(/\/admin\/reports\/([^/?]+)\/resolve/)
    if (req.method() === 'POST' && m) {
      const body = req.postDataJSON() as Resolve
      bodies.push(body)
      const custom = onResolve?.(m[1]!, body)
      if (custom) {
        return route.fulfill({ status: custom.status, contentType: 'application/problem+json', body: JSON.stringify(custom.json) })
      }
      const current = (reports as { id: string }[]).find((x) => x.id === m[1])
      return route.fulfill({
        json: { ...current, status: body.action === 'DISMISS' ? 'DISMISSED' : 'RESOLVED', actionTaken: body.action, resolutionNote: body.note, availableActions: [] },
      })
    }
    return route.fulfill({ json: { content: reports, totalElements: reports.length, totalPages: 1, number: 0, size: 20 } })
  })
  return bodies
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript((u) => { (window as unknown as { __yadonyAuthSeed: typeof u }).__yadonyAuthSeed = u }, ADMIN)
})

test('bug de l’application : Marquer comme traité, sans note, ligne mise à jour', async ({ page }) => {
  const bodies = await mockReports(page, [APP_BUG])
  await page.goto('/signalements')
  await page.locator('[data-test="resolve-app1"]').click()
  const labels = await page.locator('[data-test="resolve-action-label"]').allTextContents()
  expect(labels).toEqual(['Marquer comme traité', 'Rejeter le signalement'])
  await expect(page.locator('[data-test="resolve-action-RESOLVE"]')).toContainText('Bug corrigé ou pris en compte')
  await expect(page.locator('[data-test="resolve-reporter-notice"]')).toHaveText('Le signalant sera prévenu que son signalement a été traité, sans détail.')
  await page.locator('[data-test="resolve-confirm"]').click()
  await expect(page.locator('[data-test="resolve-overlay"]')).toHaveCount(0)
  expect(bodies).toEqual([{ action: 'RESOLVE', note: '' }])
  const row = page.locator('[data-test="report-row-app1"]')
  await expect(row).toContainText('Résolu')
  await expect(page.locator('[data-test="report-action-taken-app1"]')).toHaveText('Marqué comme traité')
  await expect(page.locator('[data-test="resolve-app1"]')).toHaveCount(0)
  await expect(page.locator('[data-test="reports-resolved"]')).toHaveText('Signalement traité : Marqué comme traité.')
})

test('message : Supprimer le message exige une note et la confirmation', async ({ page }) => {
  const bodies = await mockReports(page, [MESSAGE])
  await page.goto('/signalements')
  await page.locator('[data-test="resolve-msg1"]').click()
  await page.locator('[data-test="resolve-action-DELETE_MESSAGE"]').click()
  const confirm = page.locator('[data-test="resolve-confirm"]')
  await expect(confirm).toBeDisabled()
  await expect(page.locator('[data-test="resolve-consequence"]')).toContainText('Le message sera supprimé de la conversation')
  await page.locator('[data-test="resolve-note"]').fill('insultes')
  await expect(confirm).toBeDisabled()
  await page.locator('[data-test="resolve-acknowledge"]').check()
  await expect(confirm).toHaveText('Supprimer le message')
  await confirm.click()
  await expect(page.locator('[data-test="report-action-taken-msg1"]')).toHaveText('Message supprimé')
  expect(bodies).toEqual([{ action: 'DELETE_MESSAGE', note: 'insultes' }])
})

test('avis : Exclure l’avis de la note, note obligatoire, pas de confirmation renforcée', async ({ page }) => {
  const bodies = await mockReports(page, [RATING])
  await page.goto('/signalements')
  await page.locator('[data-test="resolve-rat1"]').click()
  await page.locator('[data-test="resolve-action-EXCLUDE_RATING"]').click()
  await expect(page.locator('[data-test="resolve-consequence"]')).toHaveCount(0)
  await expect(page.locator('[data-test="resolve-confirm"]')).toBeDisabled()
  await page.locator('[data-test="resolve-note"]').fill('avis diffamatoire')
  await page.locator('[data-test="resolve-confirm"]').click()
  await expect(page.locator('[data-test="report-action-taken-rat1"]')).toHaveText('Avis exclu de la note')
  expect(bodies).toEqual([{ action: 'EXCLUDE_RATING', note: 'avis diffamatoire' }])
})

test('auteur : Suspendre Awa D. avec la conséquence explicite', async ({ page }) => {
  const bodies = await mockReports(page, [RATING])
  await page.goto('/signalements')
  await page.locator('[data-test="resolve-rat1"]').click()
  await expect(page.locator('[data-test="resolve-action-WARN_AUTHOR"]')).toContainText('Avertir Awa D.')
  await page.locator('[data-test="resolve-action-SUSPEND_AUTHOR"]').click()
  await expect(page.locator('[data-test="resolve-consequence"]')).toContainText('Le compte de Awa D. sera suspendu')
  await page.locator('[data-test="resolve-note"]').fill('récidive')
  await page.locator('[data-test="resolve-acknowledge"]').check()
  await expect(page.locator('[data-test="resolve-confirm"]')).toHaveText('Suspendre Awa D.')
  await page.locator('[data-test="resolve-confirm"]').click()
  await expect(page.locator('[data-test="report-action-taken-rat1"]')).toHaveText('Auteur suspendu')
  expect(bodies).toEqual([{ action: 'SUSPEND_AUTHOR', note: 'récidive' }])
})

test('422 report-target-unresolvable : le detail s’affiche, le dialogue reste ouvert', async ({ page }) => {
  await mockReports(page, [MESSAGE], () => ({
    status: 422,
    json: { status: 422, code: 'report-target-unresolvable', detail: 'Le message signalé n’existe plus.' },
  }))
  await page.goto('/signalements')
  await page.locator('[data-test="resolve-msg1"]').click()
  await page.locator('[data-test="resolve-action-DELETE_MESSAGE"]').click()
  await page.locator('[data-test="resolve-note"]').fill('insultes')
  await page.locator('[data-test="resolve-acknowledge"]').check()
  await page.locator('[data-test="resolve-confirm"]').click()
  await expect(page.locator('[data-test="resolve-error"]')).toHaveText('Le message signalé n’existe plus.')
  await expect(page.locator('[data-test="resolve-overlay"]')).toBeVisible()
  await expect(page.locator('[data-test="report-row-msg1"]')).toContainText('Ouvert')
})

test('ancien back : repli local avec Marquer comme traité, son refus s’affiche sans planter', async ({ page }) => {
  const legacy = { ...APP_BUG, availableActions: undefined }
  await mockReports(page, [legacy], (_id, body) => (body.action === 'RESOLVE'
    ? { status: 400, json: { status: 400, detail: 'Corps de requête illisible' } }
    : null))
  await page.goto('/signalements')
  await page.locator('[data-test="resolve-app1"]').click()
  const labels = await page.locator('[data-test="resolve-action-label"]').allTextContents()
  expect(labels).toEqual(['Marquer comme traité', 'Rejeter le signalement'])
  await page.locator('[data-test="resolve-confirm"]').click()
  await expect(page.locator('[data-test="resolve-error"]')).toHaveText('Corps de requête illisible')
  // Le rejet, lui, passe encore sur l'ancien back.
  await page.locator('[data-test="resolve-action-DISMISS"]').click()
  await page.locator('[data-test="resolve-confirm"]').click()
  await expect(page.locator('[data-test="resolve-overlay"]')).toHaveCount(0)
  await expect(page.locator('[data-test="report-row-app1"]')).toContainText('Rejeté')
  await expect(page.locator('[data-test="reports-resolved"]')).toHaveText('Signalement rejeté.')
})

test('409 report-already-closed : dialogue fermé, avis affiché, liste relue', async ({ page }) => {
  let closed = false
  const reports = [MESSAGE]
  await page.route('**/api/v1/admin/reports**', (route) => {
    const req = route.request()
    if (req.method() === 'POST' && req.url().includes('/resolve')) {
      closed = true
      return route.fulfill({ status: 409, contentType: 'application/problem+json', body: JSON.stringify({ status: 409, code: 'report-already-closed', detail: 'Ce signalement est déjà traité' }) })
    }
    const content = closed ? [{ ...MESSAGE, status: 'RESOLVED', actionTaken: 'WARN_AUTHOR', availableActions: [] }] : reports
    return route.fulfill({ json: { content, totalElements: 1, totalPages: 1, number: 0, size: 20 } })
  })
  await page.goto('/signalements')
  await page.locator('[data-test="resolve-msg1"]').click()
  await page.locator('[data-test="resolve-confirm"]').click()
  await expect(page.locator('[data-test="resolve-overlay"]')).toHaveCount(0)
  await expect(page.locator('[data-test="reports-already-closed"]')).toHaveText('Ce signalement est déjà traité')
  await expect(page.locator('[data-test="report-action-taken-msg1"]')).toHaveText('Auteur averti')
  await expect(page.locator('[data-test="resolve-msg1"]')).toHaveCount(0)
})

test('403 authority-required : message clair dans le dialogue', async ({ page }) => {
  await mockReports(page, [RATING], () => ({
    status: 403,
    json: { status: 403, code: 'authority-required', detail: 'Permission RATING_DELETE requise pour cette action' },
  }))
  await page.goto('/signalements')
  await page.locator('[data-test="resolve-rat1"]').click()
  await page.locator('[data-test="resolve-action-DELETE_RATING"]').click()
  await page.locator('[data-test="resolve-note"]').fill('propos injurieux')
  await page.locator('[data-test="resolve-acknowledge"]').check()
  await page.locator('[data-test="resolve-confirm"]').click()
  await expect(page.locator('[data-test="resolve-error"]'))
    .toHaveText('Votre compte n’a pas la permission requise pour cette action (RATING_DELETE). Demandez-la à un super administrateur.')
})

test('bug APP sans auteur et message sans messageId : traiter ou rejeter, sans nom fantôme', async ({ page }) => {
  const orphan = { ...base, id: 'msg0', targetType: 'MESSAGE', targetId: null, targetLabel: null, reason: 'HARASSMENT', availableActions: ['RESOLVE', 'DISMISS'], targetAuthor: null }
  await mockReports(page, [{ ...APP_BUG, targetAuthor: null }, orphan])
  await page.goto('/signalements')
  await expect(page.locator('[data-test="report-row-msg0"]')).toContainText('Cible inconnue')
  await page.locator('[data-test="resolve-msg0"]').click()
  expect(await page.locator('[data-test="resolve-action-label"]').allTextContents()).toEqual(['Marquer comme traité', 'Rejeter le signalement'])
  await page.locator('[data-test="resolve-cancel"]').click()
  await page.locator('[data-test="resolve-app1"]').click()
  expect(await page.locator('[data-test="resolve-action-label"]').allTextContents()).toEqual(['Marquer comme traité', 'Rejeter le signalement'])
  await expect(page.locator('[data-test="resolve-overlay"]')).not.toContainText('null')
})
