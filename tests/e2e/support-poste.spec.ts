import { test, expect, type Page, type Route } from '@playwright/test'

/** Poste de traitement du support : file groupée, conversation, contexte, réponse et résolution. Tout le back est mocké. */
const ADMIN = { id: 'a1', email: 'admin.1@yadony.com', role: 'ADMIN', status: 'ACTIVE', mustChangePassword: false, permissionOverrides: {} }
const U1 = '11111111-1111-4111-8111-111111111111'
const ago = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString()

const base = { priority: 'NORMAL', userId: U1, userDisplayName: 'user D', assignedAdminId: null as string | null, assignedAdminEmail: null as string | null, resolvedAt: null as string | null, messages: null as unknown }
const mkTicket = (over: Record<string, unknown>) => ({ ...base, category: 'PACKAGE', status: 'NEW', createdAt: ago(200), lastMessageAt: ago(200), ...over })

let tickets: Record<string, unknown>[]
let notes: Record<string, unknown>[] = []
let templates: Record<string, unknown>[] = []
const priorities: unknown[] = []
const noteBodies: unknown[] = []
let newBack = false
const sent: unknown[] = []
const resolved: string[] = []
const assigned: string[] = []

async function setup(page: Page, opts: { newBack?: boolean } = {}) {
  newBack = opts.newBack ?? false
  sent.length = 0; resolved.length = 0; assigned.length = 0; priorities.length = 0; noteBodies.length = 0
  notes = [{ id: 'n1', adminEmail: 'sira@yadony.com', content: 'Appel passé, sans réponse', createdAt: '2026-10-25T10:00:00' }]
  templates = [{ id: 'x1', label: 'Merci', content: 'Merci de votre patience.', sortOrder: 10 }, { id: 'x2', label: 'Clôture', content: 'Demande traitée.', sortOrder: 20 }]
  tickets = [
    mkTicket({ id: 't1', subject: 'Où est mon colis ?', category: 'PACKAGE', lastMessageAt: ago(200), priority: 'HIGH' }),
    mkTicket({ id: 't2', subject: 'Remboursement', category: 'PAYMENT', status: 'WAITING_SUPPORT', assignedAdminId: 'a1', assignedAdminEmail: 'admin.1@yadony.com', lastMessageAt: ago(5), userId: '22222222-2222-4222-8222-222222222222', userDisplayName: 'Fatou B.' }),
    mkTicket({ id: 't3', subject: 'Comment proposer un trajet ?', status: 'WAITING_USER', assignedAdminId: 'x', assignedAdminEmail: 'x@yadony.com', lastMessageAt: ago(30) }),
  ]
  await page.addInitScript((u) => { (window as unknown as { __yadonyAuthSeed: typeof u }).__yadonyAuthSeed = u }, ADMIN)
  await page.route('**/api/v1/admin/users/**', (route) => route.fulfill({ json: { id: U1, firstName: 'Awa', lastName: 'Diallo', status: 'ACTIVE', kycStatus: 'VERIFIED', createdAt: '2026-08-12T10:00:00Z' } }))
  await page.route('**/api/v1/admin/support/reply-templates**', (route: Route) => {
    const req = route.request()
    if (!newBack) return route.fulfill({ status: 404, json: { title: 'Not Found', status: 404 } })
    if (req.method() === 'POST') {
      const body = req.postDataJSON() as Record<string, unknown>
      templates.push({ id: `x${templates.length + 1}`, sortOrder: 99, ...body })
      return route.fulfill({ status: 201, json: templates.at(-1) })
    }
    return route.fulfill({ json: templates })
  })
  await page.route('**/api/v1/admin/support/tickets**', (route: Route) => {
    const req = route.request()
    const url = new URL(req.url())
    const path = url.pathname.replace(/.*\/admin\/support\/tickets/, '')
    if (path.endsWith('/context')) return newBack ? route.fulfill({ json: { history: [{ action: 'SUPPORT_TICKET_ASSIGNED', at: '2026-10-25T09:00:00', actorEmail: 'sira@yadony.com' }], notes } }) : route.fulfill({ status: 404, json: { title: 'Not Found', status: 404 } })
    if (req.method() === 'POST' && path.endsWith('/priority')) {
      const body = req.postDataJSON() as { priority: string }
      priorities.push(body.priority)
      const t = tickets.find((x) => x.id === path.split('/')[1])!
      t.priority = body.priority
      return route.fulfill({ json: t })
    }
    if (req.method() === 'POST' && path.endsWith('/notes')) {
      const body = req.postDataJSON() as { content: string }
      noteBodies.push(body)
      notes = [{ id: `n${notes.length + 1}`, adminEmail: 'admin.1@yadony.com', content: body.content, createdAt: '2026-10-26T10:00:00' }, ...notes]
      return route.fulfill({ status: 201, json: notes[0] })
    }
    if (req.method() === 'POST' && path.endsWith('/messages')) { sent.push(req.postDataJSON()); return route.fulfill({ json: { id: 'm9' } }) }
    if (req.method() === 'POST' && path.endsWith('/assign')) {
      assigned.push(path)
      const t = tickets.find((x) => x.id === path.split('/')[1])!
      Object.assign(t, { assignedAdminId: 'a1', assignedAdminEmail: 'admin.1@yadony.com', status: 'ASSIGNED' })
      return route.fulfill({ json: t })
    }
    if (req.method() === 'POST' && path.endsWith('/resolve')) {
      const t = tickets.find((x) => x.id === path.split('/')[1])!
      resolved.push(t.id as string)
      Object.assign(t, { status: 'RESOLVED', resolvedAt: new Date().toISOString() })
      return route.fulfill({ json: t })
    }
    if (req.method() === 'GET' && path === '') {
      const userId = url.searchParams.get('userId')
      const content = userId ? tickets.filter((t) => t.userId === userId) : tickets
      return route.fulfill({ json: { content, totalElements: content.length, totalPages: 1, number: 0, size: 100 } })
    }
    const id = path.slice(1)
    const t = tickets.find((x) => x.id === id)
    if (req.method() === 'GET' && t) {
      return route.fulfill({ json: { ...t, messages: [{ id: `m-${id}`, authorType: 'USER', content: `Message de ${id}`, createdAt: ago(40), attachments: [] }] } })
    }
    return route.fulfill({ status: 404, json: { title: 'Not Found', status: 404 } })
  })
}

async function openPage(page: Page) {
  const loaded = page.waitForResponse((r) => /\/admin\/support\/tickets\?/.test(r.url()))
  await page.goto('/support')
  // Page hydratée une fois la file lue : un clic plus tôt serait perdu.
  await loaded
}

test('file groupée et synthèse : à répondre, non assignés, ancienneté, première conversation ouverte', async ({ page }) => {
  await setup(page)
  await openPage(page)
  await expect(page.locator('[data-test="summary-to-answer"]')).toHaveText('2')
  await expect(page.locator('[data-test="summary-unassigned"]')).toHaveText('1')
  await expect(page.locator('[data-test="summary-oldest"]')).toHaveText('8 j')
  await expect(page.locator('[data-test="support-row-t1"]')).toContainText('Priorité haute')
  await expect(page.locator('[data-test="support-subject"]')).toHaveText('Où est mon colis ?')
  await expect(page.locator('[data-test="support-silence"]')).toContainText('Sans réponse depuis 8 j')
  await page.locator('[data-test="scope-all"]').click()
  await expect(page.locator('[data-test="support-group-TO_ANSWER"]')).toContainText('À répondre')
  await expect(page.locator('[data-test="support-group-WAITING_USER"]')).toContainText('En attente de l’utilisateur')
})

test('contexte : fiche de la personne et liens', async ({ page }) => {
  await setup(page)
  await openPage(page)
  await expect(page.locator('[data-test="support-user-facts"]')).toContainText('Identité vérifiée')
  await expect(page.locator('[data-test="support-user-link"]')).toHaveAttribute('href', new RegExp(`/users/${U1}$`))
  await expect(page.locator('[data-test="support-related-t3"]')).toContainText('Comment proposer un trajet ?')
})

test('s’assigner puis répondre avec une réponse type, brouillon conservé entre deux tickets', async ({ page }) => {
  await setup(page)
  await openPage(page)
  await page.locator('[data-test="support-assign"]').click()
  await expect(page.locator('[data-test="support-composer"]')).toBeVisible()
  expect(assigned).toHaveLength(1)
  await page.locator('[data-test="support-quick-4"]').click()
  await expect(page.locator('[data-test="support-reply"]')).toHaveValue(/nous nous en occupons/)
  await page.locator('[data-test="scope-mine"]').click()
  await page.locator('[data-test="support-open-t2"]').click()
  await expect(page.locator('[data-test="support-reply"]')).toHaveValue('')
  await page.locator('[data-test="support-open-t1"]').click()
  await expect(page.locator('[data-test="support-reply"]')).toHaveValue(/nous nous en occupons/)
  await page.locator('[data-test="support-send"]').click()
  await expect.poll(() => sent).toHaveLength(1)
  expect(sent[0]).toMatchObject({ content: expect.stringContaining('nous nous en occupons'), attachmentKeys: [] })
})

test('résoudre : deux temps, puis le ticket suivant s’ouvre', async ({ page }) => {
  await setup(page)
  await openPage(page)
  await page.locator('[data-test="scope-mine"]').click()
  await page.locator('[data-test="support-open-t2"]').click()
  await page.locator('[data-test="support-action-resolve"]').click()
  expect(resolved).toHaveLength(0)
  await expect(page.locator('[data-test="support-action-resolve"]')).toHaveText('Confirmer : résoudre ce ticket')
  await page.locator('[data-test="support-action-resolve"]').click()
  await expect.poll(() => resolved).toEqual(['t2'])
  await expect(page.locator('[data-test="summary-resolved"]')).toHaveText('1')
})

test('recherche et navigation au clavier', async ({ page }) => {
  await setup(page)
  await openPage(page)
  await page.locator('[data-test="scope-all"]').click()
  await page.locator('[data-test="support-search"]').fill('fatou')
  await expect(page.locator('[data-test="support-row-t1"]')).toHaveCount(0)
  await expect(page.locator('[data-test="support-subject"]')).toHaveText('Remboursement')
  await page.locator('[data-test="support-search"]').fill('')
  await page.locator('[data-test="support-queue-panel"]').click({ position: { x: 5, y: 5 } })
  await page.keyboard.press('j')
  await expect(page.locator('[data-test="support-subject"]')).not.toHaveText('Remboursement')
})

test('SUPPORT sans gestion : consulte, ne peut ni assigner ni répondre', async ({ page }) => {
  await setup(page)
  await page.addInitScript((u) => { (window as unknown as { __yadonyAuthSeed: typeof u }).__yadonyAuthSeed = u }, { ...ADMIN, role: 'SUPPORT', permissionOverrides: { SUPPORT_TICKET_MANAGE: false } })
  await openPage(page)
  await expect(page.locator('[data-test="support-subject"]')).toHaveText('Où est mon colis ?')
  await expect(page.locator('[data-test="support-assign"]')).toHaveCount(0)
  await expect(page.locator('[data-test="support-composer"]')).toHaveCount(0)
  await expect(page.locator('[data-test="support-new-conversation"]')).toHaveCount(0)
})

test('serveur à jour : aperçu, priorité, notes internes et historique de l’audit', async ({ page }) => {
  await setup(page, { newBack: true })
  tickets[0] = { ...tickets[0], lastMessagePreview: 'Bonjour, mon colis n’est pas arrivé', lastMessageAuthor: 'USER' }
  await openPage(page)
  await expect(page.locator('[data-test="support-preview-t1"]')).toContainText('user D : Bonjour, mon colis n’est pas arrivé')
  await expect(page.locator('[data-test="report-timeline"]')).toContainText('Ticket assigné')
  await expect(page.locator('[data-test="support-note-n1"]')).toContainText('Appel passé, sans réponse')
  await page.locator('[data-test="support-priority-URGENT"]').click()
  await expect.poll(() => priorities).toEqual(['URGENT'])
  await expect(page.locator('[data-test="support-priority-URGENT"]')).toHaveAttribute('aria-pressed', 'true')
  await page.locator('[data-test="support-note-input"]').fill('À rappeler demain matin')
  await page.locator('[data-test="support-note-add"]').click()
  await expect(page.locator('[data-test="support-note-n2"]')).toContainText('À rappeler demain matin')
  expect(noteBodies).toEqual([{ content: 'À rappeler demain matin' }])
  await expect(page.locator('[data-test="support-note-input"]')).toHaveValue('')
})

test('réponses types du serveur : proposées au clavier, gérées dans une fenêtre', async ({ page }) => {
  await setup(page, { newBack: true })
  await openPage(page)
  await page.locator('[data-test="support-assign"]').click()
  await expect(page.locator('[data-test="support-composer"]')).toBeVisible()
  await expect(page.locator('[data-test="support-quick-2"]')).toContainText('Clôture')
  await page.locator('[data-test="support-quick-2"]').click()
  await expect(page.locator('[data-test="support-reply"]')).toHaveValue('Demande traitée.')
  await page.locator('[data-test="support-manage-templates"]').click()
  await page.locator('[data-test="template-new"]').click()
  await page.locator('[data-test="template-label"]').fill('Excuses')
  await page.locator('[data-test="template-content"]').fill('Nous vous présentons nos excuses.')
  await page.locator('[data-test="template-save"]').click()
  await expect(page.locator('[data-test="templates-list"]')).toContainText('Excuses')
  await page.locator('[data-test="templates-close"]').click()
  await expect(page.locator('[data-test="support-quick-3"]')).toContainText('Excuses')
})

test('ancien back : pas de priorité, de notes ni de gestion, réponses types fixes', async ({ page }) => {
  await setup(page)
  await openPage(page)
  await expect(page.locator('[data-test="support-subject"]')).toHaveText('Où est mon colis ?')
  await expect(page.locator('[data-test="support-priority"]')).toHaveCount(0)
  await expect(page.locator('[data-test="support-notes"]')).toHaveCount(0)
  await page.locator('[data-test="support-assign"]').click()
  await expect(page.locator('[data-test="support-composer"]')).toBeVisible()
  await expect(page.locator('button[data-test^="support-quick-"]')).toHaveCount(5)
  await expect(page.locator('[data-test="support-manage-templates"]')).toHaveCount(0)
})
