import { test, expect, type Page, type Route } from '@playwright/test'

/** Poste de modération : file (signalées d'abord), conversation, décision. Tout le back est mocké. */
const ADMIN = { id: 'a1', email: 'admin.1@yadony.com', role: 'ADMIN', status: 'ACTIVE', mustChangePassword: false, permissionOverrides: {} }
const ago = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString()
const R1 = '33333333-3333-4333-8333-333333333333'
const SENDER = '11111111-1111-4111-8111-111111111111'
const AUTHOR = '22222222-2222-4222-8222-222222222222'

const conv = (id: string, a: string, b: string, over: Record<string, unknown> = {}) => ({
  id, bidId: null, participantA: a, participantB: b, lastMessageAt: ago(30), messageCount: 0, flagged: false, createdAt: '2026-10-12T10:00:00Z',
  conversationId: `int-${id}`, participantAId: AUTHOR, participantBId: SENDER, openReportCount: 0, lastMessagePreview: null, ...over,
})
const page1 = (content: unknown[]) => ({ content, totalElements: content.length, totalPages: 1, number: 0, size: 100 })
const msg = (id: string, over: Record<string, unknown> = {}) => ({
  id, conversationId: 'c1', senderName: 'Aïcha', content: 'Bonjour', flagged: false, deleted: false, createdAt: '2026-10-20T16:02:00Z', ...over,
})

let conversations: Record<string, unknown>[]
let threads: Record<string, Record<string, unknown>[]>
let reports: Record<string, unknown>[]
let reportsFail = false
let contextMissing = false
let notes: Record<string, unknown>[] = []
let history: Record<string, unknown>[] = []
const noteBodies: unknown[] = []
const deletes: string[] = []
const listQueries: string[] = []

async function setup(p: Page) {
  deletes.length = 0
  noteBodies.length = 0
  listQueries.length = 0
  reportsFail = false
  contextMissing = false
  notes = []
  history = []
  conversations = [
    conv('c1', 'Aïcha', 'Moussa', { openReportCount: 1, lastMessagePreview: 'Gagnez 500 € vite' }),
    conv('c2', 'Mariam', 'Ousmane', { lastMessageAt: ago(1) }),
  ]
  threads = {
    c1: [msg('m1'), msg('m2', { senderName: 'Moussa', content: 'Gagnez 500 € vite', createdAt: '2026-10-23T09:40:00Z' })],
    c2: [msg('m3', { conversationId: 'c2', senderName: 'Mariam', content: 'Merci, bien reçu !' })],
    old: [msg('m9', { conversationId: 'old', senderName: 'Awa', content: 'Ancienne conversation' })],
  }
  reports = [{
    id: R1, targetType: 'MESSAGE', targetId: 'int-c1', targetLabel: 'Aïcha ↔ Moussa', reason: 'SPAM', description: null, reporterName: 'Aïcha', status: 'OPEN',
    actionTaken: null, resolutionNote: null, resolvedAt: null, createdAt: ago(100), photoUrls: [],
  }]
  await p.addInitScript((u) => { (window as unknown as { __yadonyAuthSeed: typeof u }).__yadonyAuthSeed = u }, ADMIN)
  await p.route('**/api/v1/admin/reports**', (route: Route) => {
    const url = route.request().url()
    if (reportsFail) return route.fulfill({ status: 500, json: { title: 'Erreur', status: 500 } })
    if (url.includes('/context')) {
      return route.fulfill({ json: {
        reporter: { userId: SENDER, displayName: 'Aïcha', totalReports: 1, resolvedReports: 0, dismissedReports: 0 },
        subject: { userId: AUTHOR, displayName: 'Moussa', accountStatus: 'ACTIVE', identityVerified: true, reportsReceived: 1, openReportsReceived: 1, cancellationCount: 0 },
        messages: [{ id: 'm1', body: 'Bonjour', flagged: false, deleted: false, fromSubject: false }, { id: 'm2', body: 'Gagnez 500 € vite', flagged: true, deleted: false, fromSubject: true }],
      } })
    }
    return route.fulfill({ json: page1(reports) })
  })
  await p.route('**/api/v1/admin/conversations**', (route: Route) => {
    const req = route.request()
    const ctx = /\/admin\/conversations\/([^/?]+)\/(context|notes)/.exec(req.url())
    if (ctx) {
      if (contextMissing) return route.fulfill({ status: 404, json: { title: 'Not Found', status: 404 } })
      if (ctx[2] === 'notes' && req.method() === 'POST') {
        const body = req.postDataJSON() as { content: string }
        noteBodies.push(body)
        notes = [{ id: `n${notes.length + 1}`, adminEmail: 'admin.1@yadony.com', content: body.content, createdAt: '2026-10-27T10:00:00' }, ...notes]
        return route.fulfill({ status: 201, json: notes[0] })
      }
      return route.fulfill({ json: { history, notes, reports: [], participants: [] } })
    }
    const m = /\/admin\/conversations\/([^/?]+)\/messages(?:\/([^/?]+))?/.exec(req.url())
    if (m) {
      if (req.method() === 'DELETE') {
        deletes.push(req.url())
        const list = threads[m[1]!]!
        const target = list.find((x) => x.id === m[2])!
        target.deleted = true
        target.deletedAt = '2026-10-27T10:00:00Z'
        target.deletedByAdmin = true
        history = [{ action: 'MESSAGE_ADMIN_DELETED', at: '2026-10-27T10:00:00', actorEmail: 'admin.1@yadony.com', note: new URL(req.url()).searchParams.get('reason') }, ...history]
        return route.fulfill({ status: 204, body: '' })
      }
      return route.fulfill({ json: threads[m[1]!] ?? [] })
    }
    const url = new URL(req.url())
    listQueries.push(url.search)
    const flagged = url.searchParams.get('flagged') === 'true'
    const q = url.searchParams.get('q')?.toLowerCase()
    return route.fulfill({ json: page1(conversations.filter((c) => (!flagged || (c.openReportCount as number) > 0)
      && (!q || String(c.participantA).toLowerCase().includes(q)))) })
  })
}

test.beforeEach(async ({ page }) => { await setup(page) })

test('la file met la conversation signalée en tête, ouverte avec son message encadré', async ({ page }) => {
  await page.goto('/moderation')
  await expect(page.locator('h1').first()).toContainText('Modération')
  await expect(page.locator('[data-test="moderation-group-REPORTED"] [data-test="conv-row-c1"]')).toContainText('Aïcha ↔ Moussa')
  await expect(page.locator('[data-test="conv-flagged-c1"]')).toHaveText('Spam')
  await expect(page.locator('[data-test="conv-preview-c1"]')).toHaveText('Gagnez 500 € vite')
  await expect(page.locator('[data-test="summary-open"]')).toHaveText('1')
  // La conversation signalée s'ouvre d'office ; le message visé est encadré.
  await expect(page.locator('[data-test="thread-title"]')).toHaveText('Aïcha ↔ Moussa')
  await expect(page.locator('[data-test="message-m2"]')).toHaveAttribute('data-flagged', 'true')
  await expect(page.locator('[data-test="decision-flagged-quote"]')).toContainText('Gagnez 500 € vite')
  await expect(page.locator(`[data-test="decision-report-link-${R1}"]`)).toHaveAttribute('href', new RegExp(`/signalements\\?open=${R1}$`))
  await expect(page.locator('[data-test="decision-person-link-b"]')).toHaveAttribute('href', new RegExp(`/users/${SENDER}$`))
  await expect(page.locator('[data-test="decision-person-link-a"]')).toHaveAttribute('href', new RegExp(`/users/${AUTHOR}$`))
})

test('« Toutes » ajoute l’activité récente, la recherche ignore les accents', async ({ page }) => {
  await page.goto('/moderation')
  await expect(page.locator('[data-test="scope-reported"]')).toContainText('1')
  await expect(page.locator('[data-test="conv-row-c2"]')).toHaveCount(0)
  await page.locator('[data-test="scope-all"]').click()
  await expect(page.locator('[data-test="moderation-group-RECENT"] [data-test="conv-row-c2"]')).toBeVisible()
  await page.locator('[data-test="moderation-search"]').fill('OUSMANE')
  await expect(page.locator('[data-test="conv-row-c1"]')).toHaveCount(0)
  await page.locator('[data-test="open-c2"]').click()
  await expect(page.locator('[data-test="thread-title"]')).toHaveText('Mariam ↔ Ousmane')
  await expect(page.locator('[data-test="decision-no-report"]')).toBeVisible()
})

test('supprimer le message signalé avec un motif', async ({ page }) => {
  await page.goto('/moderation')
  await expect(page.locator('[data-test="decision-delete"]')).toBeVisible()
  await page.locator('[data-test="decision-delete"]').click()
  await page.locator('[data-test="reason"]').fill('spam avéré')
  await page.locator('[data-test="confirm"]').click()
  await expect.poll(() => deletes.length).toBe(1)
  expect(deletes[0]).toContain('/messages/m2')
  expect(deletes[0]).toContain('reason=spam')
  await expect(page.locator('[data-test="msg-deleted-by-admin-m2"]')).toContainText('Supprimé par un admin le')
  // L'historique du contexte relu porte le geste et son motif.
  await expect(page.locator('[data-test="decision-history"]')).toContainText('Message supprimé')
  await expect(page.locator('[data-test="decision-history"]')).toContainText('spam avéré')
  await expect(page.locator('[data-test="decision-flagged-deleted"]')).toBeVisible()
  await expect(page.locator('[data-test="restore-msg-m2"]')).toHaveText('Annuler la suppression')
})

test('notes internes : ajout, puis la note s’affiche avec son auteur', async ({ page }) => {
  await page.goto('/moderation')
  await expect(page.locator('[data-test="decision-notes-empty"]')).toBeVisible()
  await page.locator('[data-test="decision-note-input"]').fill('Même lien repéré dans 2 autres conversations')
  await page.locator('[data-test="decision-note-add"]').click()
  await expect.poll(() => noteBodies).toEqual([{ content: 'Même lien repéré dans 2 autres conversations' }])
  await expect(page.locator('[data-test="decision-note-n1"]')).toContainText('admin.1@yadony.com')
  await expect(page.locator('[data-test="decision-note-input"]')).toHaveValue('')
})

test('ancien back : sans contexte, ni notes ni historique, la conversation reste lisible', async ({ page }) => {
  contextMissing = true
  await page.goto('/moderation')
  await expect(page.locator('[data-test="thread-title"]')).toHaveText('Aïcha ↔ Moussa')
  await expect(page.locator('[data-test="decision-notes"]')).toHaveCount(0)
  await expect(page.locator('[data-test="decision-history"]')).toHaveCount(0)
})

test('conversation signalée ancienne, hors de la page récente : elle est dans la file grâce à la liste des signalées', async ({ page }) => {
  conversations = [conv('c2', 'Mariam', 'Ousmane'), conv('old', 'Awa', 'Cheikh', { openReportCount: 1, createdAt: '2026-01-02T10:00:00Z', lastMessageAt: '2026-01-02T10:00:00Z' })]
  // La page récente ne contient pas `old` : le serveur la rend seulement avec ?flagged=true.
  await page.route('**/api/v1/admin/conversations?*', async (route) => {
    const url = new URL(route.request().url())
    const flagged = url.searchParams.get('flagged') === 'true'
    return route.fulfill({ json: page1(flagged ? [conversations[1]!] : [conversations[0]!]) })
  })
  await page.goto('/moderation')
  await expect(page.locator('[data-test="moderation-group-REPORTED"] [data-test="conv-row-old"]')).toContainText('Awa ↔ Cheikh')
  await expect(page.locator('[data-test="thread-title"]')).toHaveText('Awa ↔ Cheikh')
})

test('la recherche par nom interroge le serveur', async ({ page }) => {
  await page.goto('/moderation')
  await expect(page.locator('[data-test="conv-row-c1"]')).toBeVisible()
  await page.locator('[data-test="scope-all"]').click()
  await page.locator('[data-test="moderation-search"]').fill('mariam')
  await expect.poll(() => listQueries.some((q) => q.includes('q=mariam'))).toBe(true)
  await expect(page.locator('[data-test="conv-row-c2"]')).toBeVisible()
  await expect(page.locator('[data-test="conv-row-c1"]')).toHaveCount(0)
})

test('ancien back qui ne rapproche pas les signalements : la file le dit', async ({ page }) => {
  conversations = conversations.map((c) => ({ ...c, conversationId: undefined }))
  await page.goto('/moderation')
  await expect(page.locator('[data-test="moderation-flags-unsupported"]')).toBeVisible()
  await expect(page.locator('[data-test="conv-row-c1"]')).toBeVisible()
})

test('lien profond vers une conversation hors de la page chargée', async ({ page }) => {
  await page.goto('/moderation?open=old')
  await expect(page.locator('[data-test="message-m9"]')).toContainText('Ancienne conversation')
  await expect(page.locator('[data-test="decision-no-report"]')).toBeVisible()
})

test('lien profond vers une conversation calme bascule sur « Toutes »', async ({ page }) => {
  await page.goto('/moderation?open=c2')
  await expect(page.locator('[data-test="thread-title"]')).toHaveText('Mariam ↔ Ousmane')
  await expect(page.locator('[data-test="scope-all"]')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('[data-test="conv-row-c2"]')).toHaveAttribute('data-selected', 'true')
})

test('signalements en panne : la file reste utilisable, avec une note', async ({ page }) => {
  reportsFail = true
  await page.goto('/moderation')
  await expect(page.locator('[data-test="moderation-reports-unavailable"]')).toBeVisible()
  // Aucune conversation signalée : la file montre toute l'activité.
  await expect(page.locator('[data-test="conv-row-c1"]')).toBeVisible()
  await expect(page.locator('[data-test="thread-title"]')).toBeVisible()
})

test('J et K parcourent la file', async ({ page }) => {
  await page.goto('/moderation')
  await expect(page.locator('[data-test="conv-row-c1"]')).toBeVisible()
  await page.locator('[data-test="scope-all"]').click()
  await expect(page.locator('[data-test="conv-row-c2"]')).toBeVisible()
  await page.locator('[data-test="moderation-queue-panel"]').click({ position: { x: 5, y: 5 } })
  await expect(page.locator('[data-test="thread-title"]')).toHaveText('Aïcha ↔ Moussa')
  await page.keyboard.press('j')
  await expect(page.locator('[data-test="thread-title"]')).toHaveText('Mariam ↔ Ousmane')
  await page.keyboard.press('k')
  await expect(page.locator('[data-test="thread-title"]')).toHaveText('Aïcha ↔ Moussa')
})

test('une photo du fil s’affiche et s’agrandit', async ({ page }) => {
  threads.c1 = [msg('p1', { type: 'IMAGE', content: '', imageUrl: 'https://cdn.example/p1.jpg', thumbUrl: 'https://cdn.example/p1-t.jpg' })]
  await page.route('https://cdn.example/**', (route) => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"/>' }))
  await page.goto('/moderation')
  await expect(page.locator('[data-test="thread-image-p1"] img')).toHaveAttribute('src', 'https://cdn.example/p1-t.jpg')
  await page.locator('[data-test="thread-image-p1"]').click()
  await expect(page.getByRole('dialog')).toBeVisible()
})
