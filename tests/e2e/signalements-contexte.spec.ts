import { test, expect, type Page } from '@playwright/test'

/**
 * Dossier enrichi : message dans sa conversation, fiches du signalant et de la personne visée,
 * autres signalements sur la cible, chronologie. Tolérance d'un back sans l'endpoint.
 */
const ADMIN = { id: 'a1', email: 'admin.1@yadony.com', role: 'ADMIN', status: 'ACTIVE', mustChangePassword: false, permissionOverrides: {} }
const U_REPORTER = '11111111-1111-4111-8111-111111111111'
const U_SUBJECT = '22222222-2222-4222-8222-222222222222'

const base = {
  targetType: 'MESSAGE', targetId: 't1', description: 'Il devient menaçant.', reporterName: 'Awa Diallo', status: 'OPEN',
  actionTaken: null, resolutionNote: null, resolvedAt: null, photoUrls: [], reason: 'HARASSMENT',
  availableActions: ['RESOLVE', 'WARN_AUTHOR', 'DISMISS'], targetAuthor: { userId: U_SUBJECT, name: 'Moussa B.' },
}
const A = { ...base, id: 'a', targetLabel: 'Message de Moussa', createdAt: '2026-10-26T10:55:00Z' }
const B = { ...base, id: 'b', targetLabel: 'Message de Fatou', createdAt: '2026-10-25T10:55:00Z' }

const CONTEXT_A = {
  reporter: { userId: U_REPORTER, displayName: 'Awa Diallo', memberSince: '2026-03-01T09:00:00', totalReports: 4, resolvedReports: 3, dismissedReports: 1 },
  subject: {
    userId: U_SUBJECT, displayName: 'Moussa Ba', memberSince: '2026-01-10T08:00:00', accountStatus: 'ACTIVE',
    identityVerified: true, reportsReceived: 3, openReportsReceived: 1, cancellationCount: 0,
  },
  messages: [
    { id: 'm1', senderName: 'Awa Diallo', body: 'Pas plus de 8 € le kilo.', sentAt: '2026-10-26T10:12:00Z', flagged: false, deleted: false, fromSubject: false },
    { id: 'm2', senderName: 'Moussa Ba', body: 'Réponds-moi ou je te retrouve.', sentAt: '2026-10-26T10:42:00Z', flagged: true, deleted: false, fromSubject: true },
  ],
  messagesRestricted: false,
  history: [{ action: 'REPORT_RESOLVED', detail: 'WARN_AUTHOR', at: '2026-10-20T09:00:00Z', actorEmail: 'sira@yadony.com', note: 'Premier avertissement' }],
  relatedReports: [{ id: 'b', reason: 'SCAM_ATTEMPT', status: 'OPEN', createdAt: '2026-10-25T10:55:00Z', reporterName: 'Fatou Kane' }],
}

type Ctx = { status: number; json: unknown }

async function mock(page: Page, contexts: Record<string, Ctx>, reports: { id: string }[] = [A, B]) {
  const contextCalls: string[] = []
  await page.route('**/api/v1/admin/reports**', (route) => {
    const url = route.request().url()
    const m = url.match(/\/admin\/reports\/([^/?]+)\/context/)
    if (m) {
      contextCalls.push(m[1]!)
      const c = contexts[m[1]!] ?? { status: 404, json: {} }
      return route.fulfill({ status: c.status, contentType: 'application/json', body: JSON.stringify(c.json) })
    }
    const single = url.match(/\/admin\/reports\/([^/?]+)$/)
    if (single) return route.fulfill({ json: reports.find((r) => r.id === single[1]) })
    return route.fulfill({ json: { content: reports, totalElements: reports.length, totalPages: 1, number: 0, size: 20 } })
  })
  return contextCalls
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript((u) => { (window as unknown as { __yadonyAuthSeed: typeof u }).__yadonyAuthSeed = u }, ADMIN)
})

test('le dossier montre le message en contexte, les deux fiches et la chronologie', async ({ page }) => {
  await mock(page, { a: { status: 200, json: CONTEXT_A } })
  await page.goto('/signalements')

  await expect(page.locator('[data-test="case-context-messages"]')).toBeVisible()
  await expect(page.locator('[data-test="context-message-m2"]')).toHaveAttribute('data-flagged', 'true')
  await expect(page.locator('[data-test="context-message-m1"]')).toContainText('Pas plus de 8 € le kilo.')

  await expect(page.locator('[data-test="case-subject"]')).toContainText('Moussa Ba')
  await expect(page.locator('[data-test="case-subject-identity"]')).toHaveText('Identité vérifiée')
  await expect(page.locator('[data-test="case-subject-received"]')).toHaveText('3 signalements reçus, dont 1 ouvert')
  await expect(page.locator('[data-test="case-subject-link"]')).toHaveAttribute('href', new RegExp(`/users/${U_SUBJECT}$`))

  await expect(page.locator('[data-test="case-reporter-trust"]')).toHaveText('Fiable')
  await expect(page.locator('[data-test="case-reporter-history"]')).toHaveText('4 signalements, 3 traités, 1 rejeté')

  const history = page.locator('[data-test="case-history"]')
  await expect(history).toContainText('Signalement reçu')
  await expect(history).toContainText('Auteur averti')
  await expect(history).toContainText('Premier avertissement')
})

test('un autre signalement sur la cible s’ouvre d’un clic, avec son propre contexte', async ({ page }) => {
  const calls = await mock(page, {
    a: { status: 200, json: CONTEXT_A },
    b: { status: 200, json: { messagesRestricted: false, history: [], relatedReports: [], subject: { ...CONTEXT_A.subject, displayName: 'Ibrahima S.', reportsReceived: 0, openReportsReceived: 0 } } },
  })
  await page.goto('/signalements')
  await expect(page.locator('[data-test="case-related"]')).toContainText('Tentative d’arnaque')

  await page.locator('[data-test="related-b"]').click()

  await expect(page.locator('[data-test="report-case"]')).toContainText('Message de Fatou')
  await expect(page.locator('[data-test="case-subject"]')).toContainText('Ibrahima S.')
  await expect(page.locator('[data-test="case-context-messages"]')).toHaveCount(0)
  expect(calls).toEqual(['a', 'b'])
})

test('J puis K : seul le contexte du dossier ouvert reste à l’écran', async ({ page }) => {
  await mock(page, {
    a: { status: 200, json: CONTEXT_A },
    b: { status: 200, json: { messagesRestricted: true, history: [], relatedReports: [] } },
  })
  await page.goto('/signalements')
  await expect(page.locator('[data-test="case-context-messages"]')).toBeVisible()
  await page.keyboard.press('j')
  await expect(page.locator('[data-test="context-messages-restricted"]')).toBeVisible()
  await expect(page.locator('[data-test="case-context-messages"]')).toHaveCount(0)
  await page.keyboard.press('k')
  await expect(page.locator('[data-test="case-context-messages"]')).toBeVisible()
  await expect(page.locator('[data-test="context-messages-restricted"]')).toHaveCount(0)
})

test('sans MODERATION_VIEW : une phrase à la place des messages, le reste du dossier est là', async ({ page }) => {
  await mock(page, { a: { status: 200, json: { ...CONTEXT_A, messages: undefined, messagesRestricted: true } } })
  await page.goto('/signalements')
  await expect(page.locator('[data-test="context-messages-restricted"]')).toContainText('pas visibles avec votre rôle')
  await expect(page.locator('[data-test="case-subject"]')).toContainText('Moussa Ba')
})

test('ancien back (404 sans code) : le dossier reste complet, sans message d’erreur', async ({ page }) => {
  await mock(page, { a: { status: 404, json: {} } })
  await page.goto('/signalements')
  await expect(page.locator('[data-test="report-case"]')).toContainText('Il devient menaçant.')
  await expect(page.locator('[data-test="context-error"]')).toHaveCount(0)
  await expect(page.locator('[data-test="case-history"]')).toHaveCount(0)
  await expect(page.locator('[data-test="resolve-confirm"]')).toBeVisible()
})

test('erreur 500 du contexte : une phrase discrète, la décision reste possible', async ({ page }) => {
  await mock(page, { a: { status: 500, json: { detail: 'boom' } } })
  await page.goto('/signalements')
  await expect(page.locator('[data-test="context-error"]')).toBeVisible()
  await expect(page.locator('[data-test="resolve-confirm"]')).toBeEnabled()
})
