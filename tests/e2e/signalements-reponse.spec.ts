import { test, expect, type Page, type Route } from '@playwright/test'

/**
 * Répondre au signalant d'un rapport de bug depuis la page Signalements : le back ouvre (ou
 * réutilise) la conversation support ; le signalement reste ouvert. Tout le back est mocké.
 */
const ADMIN = { id: 'a1', email: 'admin.1@yadony.com', role: 'ADMIN', status: 'ACTIVE', mustChangePassword: false, permissionOverrides: {} }

const bug = (over: Record<string, unknown> = {}) => ({
  id: 'r1', targetType: 'APP', targetId: '', targetLabel: null, reason: 'SCREEN_BUG',
  description: 'Le bouton Payer ne répond pas', reporterName: 'Awa Diallo', status: 'OPEN', actionTaken: null,
  resolutionNote: null, resolvedAt: null, createdAt: '2026-09-20T10:00:00Z', photoUrls: [], screenRoute: '/wallet',
  availableActions: ['RESOLVE', 'DISMISS'], canReply: true, ...over,
})
const reportsPage = (content: unknown[]) => ({ content, totalElements: content.length, totalPages: 1, number: 0, size: 20 })

const supportTicket = (over: Record<string, unknown> = {}) => ({
  id: 't9', category: 'OTHER', subject: 'Votre rapport de bug', status: 'WAITING_USER', priority: 'NORMAL', userId: 'u5',
  userDisplayName: 'Awa Diallo', assignedAdminId: 'a1', assignedAdminEmail: 'admin.1@yadony.com',
  createdAt: '2026-09-29T09:00:00Z', lastMessageAt: '2026-09-29T09:00:00Z', resolvedAt: null, sourceReportId: 'r1',
  messages: [{ id: 'm1', authorType: 'ADMIN', content: 'Merci Awa, corrigé.', createdAt: '2026-09-29T09:00:00Z', attachments: [] }],
  ...over,
})

type ReplyMode = 'ok' | 'not-app-bug' | 'reporter-unavailable' | 'old-back'

async function mockBackend(page: Page, report: ReturnType<typeof bug>, mode: ReplyMode = 'ok') {
  const replies: Record<string, unknown>[] = []
  await page.route('**/api/v1/admin/reports**', (route: Route) => {
    const req = route.request()
    const url = new URL(req.url())
    if (req.method() === 'POST' && url.pathname.endsWith('/reply')) {
      if (mode === 'old-back') return route.fulfill({ status: 404, json: { title: 'Not Found', status: 404, detail: 'No endpoint' } })
      if (mode === 'not-app-bug') {
        return route.fulfill({ status: 422, json: { title: 'Unprocessable', status: 422, code: 'report-not-app-bug' } })
      }
      if (mode === 'reporter-unavailable') {
        return route.fulfill({ status: 422, json: { title: 'Unprocessable', status: 422, code: 'reporter-unavailable' } })
      }
      replies.push(req.postDataJSON() as Record<string, unknown>)
      // 201 à la création de la conversation, 200 quand elle est réutilisée.
      const created = replies.length === 1 && !report.supportTicketId
      return route.fulfill({ status: created ? 201 : 200, json: { ticketId: 't9', created, ticket: supportTicket() } })
    }
    if (req.method() === 'GET' && url.pathname.endsWith('/admin/reports/r1')) return route.fulfill({ json: report })
    return route.fulfill({ json: reportsPage([report]) })
  })
  await page.route('**/api/v1/admin/support/tickets**', (route: Route) => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/tickets/t9')) return route.fulfill({ json: supportTicket() })
    return route.fulfill({ json: { content: [supportTicket({ messages: null })], totalElements: 1, totalPages: 1, number: 0, size: 20 } })
  })
  return replies
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript((u) => { (window as unknown as { __yadonyAuthSeed: typeof u }).__yadonyAuthSeed = u }, ADMIN)
})

test('rapport de bug : répondre, lien vers le fil, puis retour au signalement depuis le fil', async ({ page }) => {
  const replies = await mockBackend(page, bug())
  await page.goto('/signalements')
  const row = page.locator('[data-test="report-row-r1"]')
  await expect(row).toBeVisible()
  await expect(page.locator('[data-test="report-conversation-r1"]')).toHaveCount(0)

  await page.locator('[data-test="reply-r1"]').click()
  const dialog = page.locator('[data-test="reply-dialog"]')
  await expect(dialog.locator('[data-test="reply-recap"]')).toContainText('Le bouton Payer ne répond pas')
  await expect(dialog.locator('[data-test="reply-recap"]')).toContainText('/wallet')
  await expect(dialog.locator('[data-test="reply-submit"]')).toBeDisabled()
  await dialog.locator('[data-test="reply-message"]').fill('Merci Awa, corrigé.')
  await dialog.locator('[data-test="reply-submit"]').click()

  await expect(dialog).toHaveCount(0)
  await expect(page.locator('[data-test="reports-reply-sent"]')).toContainText('Réponse envoyée, conversation créée. Awa la verra dans Yadony Support.')
  expect(replies).toEqual([{ message: 'Merci Awa, corrigé.', attachmentKeys: [] }])
  // Le signalement reste ouvert, le traitement reste proposé, la conversation est signalée.
  await expect(row).toContainText('Ouvert')
  await expect(page.locator('[data-test="resolve-r1"]')).toBeVisible()
  await expect(page.locator('[data-test="report-conversation-r1"]')).toContainText('Conversation ouverte')
  await expect(page.locator('[data-test="reply-r1"]')).toHaveText('Répondre à nouveau')

  await page.locator('[data-test="reports-reply-open"]').click()
  await expect(page).toHaveURL(/\/support\?ticket=t9/)
  const source = page.locator('[data-test="ticket-source-report"]')
  await expect(source).toContainText('Issu du signalement')
  await source.locator('a').click()
  await expect(page).toHaveURL(/\/signalements\?open=r1/)
  await expect(page.locator('[data-test="reports-focus"]')).toBeVisible()
  await expect(page.locator('[data-test="report-row-r1"]')).toHaveAttribute('data-highlighted', 'true')
})

test('conversation existante : « Répondre à nouveau » ajoute au même fil', async ({ page }) => {
  const replies = await mockBackend(page, bug({ supportTicketId: 't9' }))
  await page.goto('/signalements')
  await expect(page.locator('[data-test="report-conversation-link-r1"]')).toHaveAttribute('href', /\/support\?ticket=t9$/)
  await page.locator('[data-test="reply-r1"]').click()
  const dialog = page.locator('[data-test="reply-dialog"]')
  await expect(dialog.locator('[data-test="reply-title"]')).toHaveText('Répondre à nouveau')
  await expect(dialog.locator('[data-test="reply-existing"]')).toContainText('conversation déjà ouverte')
  await dialog.locator('[data-test="reply-message"]').fill('Le correctif est en ligne.')
  await dialog.locator('[data-test="reply-submit"]').click()
  await expect(page.locator('[data-test="reports-reply-sent"]'))
    .toContainText('Réponse ajoutée à la conversation. Awa la verra dans Yadony Support.')
  await expect(page.locator('[data-test="reports-reply-open"]')).toHaveAttribute('href', /\/support\?ticket=t9$/)
  expect(replies).toHaveLength(1)
})

test('422 report-not-app-bug : l’erreur reste dans la fenêtre', async ({ page }) => {
  await mockBackend(page, bug(), 'not-app-bug')
  await page.goto('/signalements')
  await page.locator('[data-test="reply-r1"]').click()
  const dialog = page.locator('[data-test="reply-dialog"]')
  await dialog.locator('[data-test="reply-message"]').fill('Bonjour')
  await dialog.locator('[data-test="reply-submit"]').click()
  await expect(dialog.locator('[data-test="reply-error"]')).toContainText('rapports de bug')
  await expect(dialog.locator('[data-test="reply-message"]')).toHaveValue('Bonjour')
  await expect(page.locator('[data-test="reports-reply-sent"]')).toHaveCount(0)
})

test('signalement déjà traité : Répondre reste proposé ; signalant injoignable (422)', async ({ page }) => {
  await mockBackend(page, bug({ status: 'RESOLVED', actionTaken: 'RESOLVE', availableActions: [] }), 'reporter-unavailable')
  await page.goto('/signalements')
  await expect(page.locator('[data-test="resolve-r1"]')).toHaveCount(0)
  await page.locator('[data-test="reply-r1"]').click()
  const dialog = page.locator('[data-test="reply-dialog"]')
  await dialog.locator('[data-test="reply-message"]').fill('Bonjour')
  await dialog.locator('[data-test="reply-submit"]').click()
  await expect(dialog.locator('[data-test="reply-error"]')).toContainText('signalant')
})

test('ancien back : bouton sur la cible APP, envoi indisponible, aucun badge', async ({ page }) => {
  const legacy = bug()
  delete (legacy as Record<string, unknown>).canReply
  await mockBackend(page, legacy, 'old-back')
  await page.goto('/signalements')
  await expect(page.locator('[data-test="report-conversation-r1"]')).toHaveCount(0)
  await page.locator('[data-test="reply-r1"]').click()
  const dialog = page.locator('[data-test="reply-dialog"]')
  await dialog.locator('[data-test="reply-message"]').fill('Bonjour')
  await dialog.locator('[data-test="reply-submit"]').click()
  await expect(dialog.locator('[data-test="reply-error"]')).toHaveText('Cette fonction n’est pas encore disponible sur le serveur.')
  await expect(dialog.locator('[data-test="reply-submit"]')).toBeDisabled()
})
