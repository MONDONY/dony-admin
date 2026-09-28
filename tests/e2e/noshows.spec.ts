import { test, expect, type Page, type Route } from '@playwright/test'

const admin = (role: 'ADMIN' | 'SUPPORT') => ({ id: 'a1', email: 'admin.1@yadony.com', role, status: 'ACTIVE', mustChangePassword: false, permissionOverrides: {} })
const EMPTY_DISPUTES = { content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 }
const REASON = 'Absent au rendez-vous, confirmé par téléphone'

const HANDOVER = {
  id: 'c1', bidId: '89125c9c-aaaa-bbbb-cccc-dddddddddddd', scope: 'HANDOVER', reason: 'SENDER_NO_SHOW', status: 'PENDING_CONFIRMATION',
  contestationDeadline: '2026-09-28T15:00:00Z', remainingMinutes: 300, createdAt: '2026-09-28T10:00:00Z',
  declarant: { userId: 't1', name: 'Awa D.', role: 'TRAVELER' }, accused: { userId: 's1', name: 'Moussa K.', role: 'SENDER' },
  trip: { departureCity: 'Bamako', arrivalCity: 'Abidjan', departureDate: '2026-09-15' },
  handoverAt: '2026-09-15T12:30:00Z', amount: 45, currency: 'EUR', paymentMethod: 'CASH', paymentStatus: 'PENDING', bidStatus: 'ACCEPTED',
  canConfirm: true, canReject: true,
}
const DELIVERY = {
  ...HANDOVER, id: 'c2', bidId: '7a1b2c3d-aaaa-bbbb-cccc-dddddddddddd', scope: 'DELIVERY', reason: 'RECIPIENT_NO_SHOW', remainingMinutes: 45,
  accused: { name: 'Fatou S.', role: 'RECIPIENT' }, paymentMethod: 'STRIPE',
}
const page = (content: unknown[]) => ({ content, totalElements: content.length, totalPages: 1, number: 0, size: 20 })

async function setup(p: Page, role: 'ADMIN' | 'SUPPORT', list: unknown[], onPost?: (_route: Route, _action: string, _id: string) => Promise<void> | void) {
  await p.addInitScript((u) => { (window as unknown as { __yadonyAuthSeed: typeof u }).__yadonyAuthSeed = u }, admin(role))
  await p.route('**/api/v1/admin/disputes**', (route) => route.fulfill({ json: EMPTY_DISPUTES }))
  await p.route('**/api/v1/admin/cancellations**', async (route) => {
    const req = route.request()
    if (req.method() === 'POST') {
      const m = /\/admin\/cancellations\/([^/]+)\/(confirm|reject)/.exec(req.url())
      if (m && onPost) return onPost(route, m[2]!, m[1]!)
      return route.fulfill({ status: 500, json: {} })
    }
    return route.fulfill({ json: page(list) })
  })
}

async function openRow(p: Page, id: string) {
  await p.goto('/incidents?tab=noshows')
  await p.locator(`[data-test="noshow-row-${id}"]`).click()
  await expect(p.locator('[data-test="noshow-panel"]')).toBeVisible()
}

test('liste lisible : phrases, portée, trajet, montant, temps restant, sans UUID ni statut brut', async ({ page: p }) => {
  await setup(p, 'ADMIN', [HANDOVER, DELIVERY])
  await p.goto('/incidents?tab=noshows')
  const row = p.locator('[data-test="noshow-row-c1"]')
  await expect(row).toContainText('Le voyageur Awa D. déclare l’expéditeur Moussa K. absent à la remise')
  await expect(row).toContainText('Départ')
  await expect(row).toContainText('Bamako → Abidjan, 15 sept.')
  await expect(row).toContainText('45,00 EUR · Espèces')
  await expect(row).toContainText('reste 5 h')
  await expect(p.locator('[data-test="noshow-row-c2"]')).toContainText('Le voyageur Awa D. déclare le destinataire Fatou S. absent à la livraison')
  await expect(p.locator('[data-test="noshow-remaining-c2"]')).toHaveClass(/text-danger/)
  const text = await p.locator('main').innerText()
  expect(text).not.toContain('PENDING_CONFIRMATION')
  expect(text).not.toContain('89125c9c-aaaa')
  expect(text).not.toContain('—')
})

test('les filtres statut et portée partent au back', async ({ page: p }) => {
  const queries: string[] = []
  await setup(p, 'ADMIN', [HANDOVER])
  p.on('request', (r) => { if (r.url().includes('/admin/cancellations') && r.method() === 'GET') queries.push(new URL(r.url()).search) })
  await p.goto('/incidents?tab=noshows')
  await expect(p.locator('[data-test="noshow-row-c1"]')).toBeVisible()
  await p.locator('[data-test="noshow-status-contested"]').click()
  await p.locator('[data-test="noshow-scope-DELIVERY"]').click()
  await p.locator('[data-test="noshow-status-decided"]').click()
  await p.locator('[data-test="noshow-decided-resolved"]').click()
  await expect.poll(() => queries.at(-1)).toContain('status=RESOLVED')
  expect(queries.some((q) => q.includes('status=CONTESTED'))).toBe(true)
  expect(queries.at(-1)).toContain('scope=DELIVERY')
})

test('confirmer au départ : effet expliqué, motif envoyé, message de succès', async ({ page: p }) => {
  let body: unknown = null
  await setup(p, 'ADMIN', [HANDOVER], (route, action) => {
    body = route.request().postDataJSON()
    expect(action).toBe('confirm')
    return route.fulfill({ json: { ...HANDOVER, status: 'CONFIRMED', canConfirm: false, canReject: false } })
  })
  await openRow(p, 'c1')
  await expect(p.locator('[data-test="noshow-declarant-link"]')).toHaveAttribute('href', /\/users\?open=t1$/)
  await expect(p.locator('[data-test="noshow-bid-link"]')).toHaveAttribute('href', /\/colis\?open=89125c9c-aaaa-bbbb-cccc-dddddddddddd$/)
  await p.locator('[data-test="noshow-confirm"]').click()
  const dialog = p.locator('[data-test="noshow-dialog"]')
  await expect(dialog).toContainText('Le colis est annulé et l’expéditeur remboursé.')
  await expect(dialog).toContainText('la commission est remboursée au voyageur')
  await expect(p.locator('[data-test="noshow-dialog-submit"]')).toBeDisabled()
  await p.locator('[data-test="noshow-dialog-reason"]').fill(REASON)
  await expect(p.locator('[data-test="noshow-dialog-count"]')).toHaveText(`${REASON.length} / 500`)
  await p.locator('[data-test="noshow-dialog-submit"]').click()
  await expect(p.locator('[data-test="noshow-success"]')).toContainText('Absence confirmée. Le colis est annulé')
  expect(body).toEqual({ reason: REASON })
  await expect(p.locator('[data-test="noshow-confirm"]')).toHaveCount(0)
  await expect(p.locator('[data-test="noshow-panel"]')).toContainText('Absence confirmée')
})

test('confirmer à l’arrivée : litige annoncé, puis lien vers le litige une fois créé', async ({ page: p }) => {
  let decided = false
  const after = { ...DELIVERY, status: 'CONFIRMED', adminDecision: 'CONFIRMED', decidedAt: '2026-09-28T10:05:00Z', decisionReason: 'Destinataire injoignable toute la journée', canConfirm: false, canReject: false, remainingMinutes: undefined }
  let gets = 0
  await setup(p, 'ADMIN', [], (route) => { decided = true; return route.fulfill({ json: { ...after, dispute: null } }) })
  await p.route('**/api/v1/admin/cancellations?**', (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    gets++
    // Le litige n'existe qu'au deuxième relu après la décision (créé après la réponse).
    const content = !decided ? [DELIVERY] : gets >= 3 ? [{ ...after, dispute: { id: 'd1', status: 'OPEN' } }] : [{ ...after, dispute: null }]
    return route.fulfill({ json: page(content) })
  })
  await openRow(p, 'c2')
  await p.locator('[data-test="noshow-confirm"]').click()
  await expect(p.locator('[data-test="noshow-dialog"]')).toContainText('Un litige est ouvert')
  await p.locator('[data-test="noshow-dialog-reason"]').fill('Destinataire injoignable toute la journée')
  await p.locator('[data-test="noshow-dialog-submit"]').click()
  await expect(p.locator('[data-test="noshow-success"]')).toContainText('Un litige va être ouvert')
  await expect(p.locator('[data-test="noshow-decision"]')).toContainText('Décision : Absence confirmée le 28 sept. à 12:05')
  await expect(p.locator('[data-test="noshow-dispute-link"]')).toHaveAttribute('href', /\/incidents\?tab=disputes&open=d1$/)
  await expect(p.locator('[data-test="noshow-dispute-pending"]')).toHaveCount(0)
})

test('déclaration rejetée : « Rejetée », décision datée et motif interne', async ({ page: p }) => {
  const REJECTED = { ...HANDOVER, status: 'RESOLVED', adminDecision: 'REJECTED', decidedAt: '2026-09-28T10:00:00Z', decisionReason: 'Remise bien faite, photo à l’appui', canConfirm: false, canReject: false, remainingMinutes: undefined }
  await setup(p, 'ADMIN', [REJECTED])
  await p.goto('/incidents?tab=noshows')
  await expect(p.locator('[data-test="noshow-row-c1"]')).toContainText('Rejetée')
  await p.locator('[data-test="noshow-row-c1"]').click()
  await expect(p.locator('[data-test="noshow-decision"]')).toContainText('Décision : Rejetée le 28 sept. à 12:00')
  await expect(p.locator('[data-test="noshow-decision-reason"]')).toHaveText('Remise bien faite, photo à l’appui')
})

test('espèces sans montant : « Espèces » et état de la commission', async ({ page: p }) => {
  await setup(p, 'ADMIN', [{ ...HANDOVER, amount: undefined, paymentStatus: 'CHARGED', commissionStatus: 'CHARGED' }])
  await p.goto('/incidents?tab=noshows')
  await expect(p.locator('[data-test="noshow-row-c1"]')).toContainText('Espèces · commission prélevée')
})

test('404 noshow-not-found : message dans le dialogue', async ({ page: p }) => {
  await setup(p, 'ADMIN', [HANDOVER], (route) => route.fulfill({ status: 404, contentType: 'application/problem+json', json: { status: 404, code: 'noshow-not-found', detail: 'Not found' } }))
  await openRow(p, 'c1')
  await p.locator('[data-test="noshow-confirm"]').click()
  await p.locator('[data-test="noshow-dialog-reason"]').fill(REASON)
  await p.locator('[data-test="noshow-dialog-submit"]').click()
  await expect(p.locator('[data-test="noshow-dialog-error"]')).toContainText('n’existe plus')
})

test('cloche : le lien NOSHOW_PENDING ouvre le détail du no-show', async ({ page: p }) => {
  await setup(p, 'ADMIN', [HANDOVER, DELIVERY])
  const item = { id: 'n1', type: 'NOSHOW_PENDING', title: 'No-show à arbitrer', summary: 'Absence déclarée à la livraison', severity: 'WARNING', createdAt: '2026-09-28T09:00:00Z', link: '/incidents?tab=noshows&open=c2' }
  await p.route('**/api/v1/admin/notifications/**', (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/counters')) return route.fulfill({ json: { counts: { incidents: 1 }, unreadCount: 1 } })
    if (path.endsWith('/feed')) return route.fulfill({ json: { items: [item], unreadCount: 1, lastSeenAt: null } })
    return route.fulfill({ status: 204, body: '' })
  })
  await p.goto('/incidents')
  // Compteurs reçus = page hydratée : un clic plus tôt n'ouvrirait pas le panneau.
  await expect(p.locator('[data-test="notif-bell"]')).toHaveAttribute('aria-label', 'Notifications, 1 non lue')
  await p.locator('[data-test="notif-bell"]').click()
  await p.locator('[data-test="notif-item"]').first().click()
  await expect(p).toHaveURL(/\/incidents\?tab=noshows&open=c2$/)
  await expect(p.locator('[data-test="noshow-panel"]')).toContainText('Fatou S.')
})

test('rejeter la déclaration', async ({ page: p }) => {
  let action = ''
  await setup(p, 'ADMIN', [HANDOVER], (route, a) => { action = a; return route.fulfill({ json: { ...HANDOVER, status: 'RESOLVED', canConfirm: false, canReject: false } }) })
  await openRow(p, 'c1')
  await p.locator('[data-test="noshow-reject"]').click()
  await expect(p.locator('[data-test="noshow-dialog"]')).toContainText('La déclaration est classée et le colis continue normalement.')
  await p.locator('[data-test="noshow-dialog-reason"]').fill('Remise bien faite, photo du colis à l’appui')
  await p.locator('[data-test="noshow-dialog-submit"]').click()
  await expect(p.locator('[data-test="noshow-success"]')).toContainText('Déclaration rejetée')
  expect(action).toBe('reject')
})

test('409 déjà tranché : erreur dans le dialogue et liste rechargée', async ({ page: p }) => {
  let gets = 0
  await setup(p, 'ADMIN', [HANDOVER], (route) => route.fulfill({ status: 409, contentType: 'application/problem+json', json: { status: 409, code: 'noshow-already-decided', detail: 'Déjà tranché' } }))
  p.on('request', (r) => { if (r.url().includes('/admin/cancellations?') && r.method() === 'GET') gets++ })
  await openRow(p, 'c1')
  await p.locator('[data-test="noshow-confirm"]').click()
  await p.locator('[data-test="noshow-dialog-reason"]').fill(REASON)
  await p.locator('[data-test="noshow-dialog-submit"]').click()
  await expect(p.locator('[data-test="noshow-dialog-error"]')).toContainText('déjà été tranchée')
  await expect.poll(() => gets).toBeGreaterThanOrEqual(2)
})

test('422 : message de validation affiché dans le dialogue', async ({ page: p }) => {
  await setup(p, 'ADMIN', [HANDOVER], (route) => route.fulfill({ status: 422, contentType: 'application/problem+json', json: { status: 422, code: 'validation-failed', violations: { reason: 'Le motif doit faire entre 10 et 500 caractères' } } }))
  await openRow(p, 'c1')
  await p.locator('[data-test="noshow-confirm"]').click()
  await p.locator('[data-test="noshow-dialog-reason"]').fill(REASON)
  await p.locator('[data-test="noshow-dialog-submit"]').click()
  await expect(p.locator('[data-test="noshow-dialog-error"]')).toHaveText('Le motif doit faire entre 10 et 500 caractères')
})

test('SUPPORT : consulte le détail, sans bouton de décision', async ({ page: p }) => {
  await setup(p, 'SUPPORT', [HANDOVER])
  await openRow(p, 'c1')
  await expect(p.locator('[data-test="noshow-panel"]')).toContainText('Moussa K.')
  await expect(p.locator('[data-test="noshow-confirm"]')).toHaveCount(0)
  await expect(p.locator('[data-test="noshow-reject"]')).toHaveCount(0)
})

test('lien profond ?open= ouvre directement le détail', async ({ page: p }) => {
  await setup(p, 'ADMIN', [HANDOVER, DELIVERY])
  await p.goto('/incidents?tab=noshows&open=c2')
  await expect(p.locator('[data-test="noshow-panel"]')).toContainText('Fatou S.')
})

test('ancien back : titre « Colis … », confirmation via l’ancien endpoint, pas de rejet, erreur affichée', async ({ page: p }) => {
  const LEGACY = { id: 'c9', bidId: 'b9f00000-aaaa-bbbb-cccc-dddddddddddd', cancelledBy: 'u9', reason: 'SENDER_NO_SHOW', noShowStatus: 'PENDING_CONFIRMATION', contestationDeadline: '2026-09-28T15:00:00Z', createdAt: '2026-09-28T10:00:00Z' }
  await setup(p, 'ADMIN', [LEGACY])
  let calls = 0
  await p.route('**/api/v1/cancellations/bids/*/confirm-noshow', (route) => {
    calls++
    return calls === 1
      ? route.fulfill({ status: 404, contentType: 'application/problem+json', json: { status: 404, code: 'cancellation-not-found', detail: 'Aucune annulation en attente pour ce bid' } })
      : route.fulfill({ status: 200, body: '' })
  })
  await p.goto('/incidents?tab=noshows')
  const row = p.locator('[data-test="noshow-row-c9"]')
  await expect(row).toContainText('Colis b9f00000…')
  await expect(row).toContainText('Le voyageur déclare l’expéditeur absent à la remise')
  expect(await row.innerText()).not.toContain('b9f00000-aaaa')
  await row.click()
  await expect(p.locator('[data-test="noshow-reject"]')).toHaveCount(0)
  await p.locator('[data-test="noshow-confirm"]').click()
  await expect(p.locator('[data-test="noshow-dialog-reason"]')).toHaveCount(0)
  await p.locator('[data-test="noshow-dialog-submit"]').click()
  await expect(p.locator('[data-test="noshow-dialog-error"]')).toHaveText('Aucune annulation en attente pour ce bid')
  await p.locator('[data-test="noshow-dialog-submit"]').click()
  await expect(p.locator('[data-test="noshow-success"]')).toHaveText('Absence confirmée.')
})
