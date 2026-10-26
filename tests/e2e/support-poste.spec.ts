import { test, expect, type Page, type Route } from '@playwright/test'

/** Poste de traitement du support : file groupée, conversation, contexte, réponse et résolution. Tout le back est mocké. */
const ADMIN = { id: 'a1', email: 'admin.1@yadony.com', role: 'ADMIN', status: 'ACTIVE', mustChangePassword: false, permissionOverrides: {} }
const U1 = '11111111-1111-4111-8111-111111111111'
const ago = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString()

const base = { priority: 'NORMAL', userId: U1, userDisplayName: 'user D', assignedAdminId: null as string | null, assignedAdminEmail: null as string | null, resolvedAt: null as string | null, messages: null as unknown }
const mkTicket = (over: Record<string, unknown>) => ({ ...base, category: 'PACKAGE', status: 'NEW', createdAt: ago(200), lastMessageAt: ago(200), ...over })

let tickets: Record<string, unknown>[]
const sent: unknown[] = []
const resolved: string[] = []
const assigned: string[] = []

async function setup(page: Page) {
  sent.length = 0; resolved.length = 0; assigned.length = 0
  tickets = [
    mkTicket({ id: 't1', subject: 'Où est mon colis ?', category: 'PACKAGE', lastMessageAt: ago(200), priority: 'HIGH' }),
    mkTicket({ id: 't2', subject: 'Remboursement', category: 'PAYMENT', status: 'WAITING_SUPPORT', assignedAdminId: 'a1', assignedAdminEmail: 'admin.1@yadony.com', lastMessageAt: ago(5), userId: '22222222-2222-4222-8222-222222222222', userDisplayName: 'Fatou B.' }),
    mkTicket({ id: 't3', subject: 'Comment proposer un trajet ?', status: 'WAITING_USER', assignedAdminId: 'x', assignedAdminEmail: 'x@yadony.com', lastMessageAt: ago(30) }),
  ]
  await page.addInitScript((u) => { (window as unknown as { __yadonyAuthSeed: typeof u }).__yadonyAuthSeed = u }, ADMIN)
  await page.route('**/api/v1/admin/users/**', (route) => route.fulfill({ json: { id: U1, firstName: 'Awa', lastName: 'Diallo', status: 'ACTIVE', kycStatus: 'VERIFIED', createdAt: '2026-08-12T10:00:00Z' } }))
  await page.route('**/api/v1/admin/support/tickets**', (route: Route) => {
    const req = route.request()
    const url = new URL(req.url())
    const path = url.pathname.replace(/.*\/admin\/support\/tickets/, '')
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
