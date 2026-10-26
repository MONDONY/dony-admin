import { test, expect, type Page, type Route } from '@playwright/test'

const admin = (role: 'ADMIN' | 'SUPPORT') => ({ id: 'a1', email: 'admin.1@yadony.com', role, status: 'ACTIVE', mustChangePassword: false, permissionOverrides: {} })
const REASON = 'Absent au rendez-vous, confirmé par téléphone'
const SENDER = '11111111-1111-4111-8111-111111111111'
const TRAVELER = '22222222-2222-4222-8222-222222222222'
const BID = '89125c9c-aaaa-4bbb-8ccc-dddddddddddd'

const DISPUTE = { id: 'd1', bidId: BID, type: 'TRAVELER_DELIVERY_NO_SHOW', status: 'OPEN', senderName: 'Koro DIAKITE', travelerName: 'Ibra DIANE', refundFrozen: true, createdAt: '2026-06-01T10:00:00' }
const DISPUTE_DETAIL = { ...DISPUTE, resolution: null, resolvedAt: null, resolutionNote: null, beneficiaryUserId: null, senderId: SENDER, travelerId: TRAVELER, bidCurrency: 'EUR' }
const DISPUTE_RESOLVED = { ...DISPUTE_DETAIL, status: 'RESOLVED', resolution: 'GUARANTEE_PAID', beneficiaryUserId: SENDER, guaranteeAmountCents: 15000, guaranteeCurrency: 'EUR' }

const HANDOVER = {
  id: 'c1', bidId: BID, scope: 'HANDOVER', reason: 'SENDER_NO_SHOW', status: 'PENDING_CONFIRMATION',
  contestationDeadline: '2099-09-28T15:00:00Z', remainingMinutes: 300, createdAt: '2026-09-28T10:00:00Z',
  declarant: { userId: SENDER, name: 'Awa D.', role: 'TRAVELER' }, accused: { userId: TRAVELER, name: 'Moussa K.', role: 'SENDER' },
  trip: { departureCity: 'Bamako', arrivalCity: 'Abidjan', departureDate: '2026-09-15' },
  handoverAt: '2026-09-15T12:30:00Z', amount: 45, currency: 'EUR', paymentMethod: 'CASH', paymentStatus: 'PENDING', bidStatus: 'ACCEPTED',
  canConfirm: true, canReject: true,
}
const DELIVERY = {
  ...HANDOVER, id: 'c2', bidId: '7a1b2c3d-aaaa-4bbb-8ccc-dddddddddddd', scope: 'DELIVERY', reason: 'RECIPIENT_NO_SHOW', remainingMinutes: 45,
  // LocalDateTime du back : UTC sans fuseau, microsecondes Java.
  handoverAt: '2026-09-15T16:00:00.123456',
  accused: { name: 'Fatou S.', role: 'RECIPIENT' }, paymentMethod: 'STRIPE',
}
const page = (content: unknown[]) => ({ content, totalElements: content.length, totalPages: 1, number: 0, size: 100 })
const noShowRow = (id: string) => `[data-test="incident-row-noshow:${id}"]`

interface Mocks { disputes?: unknown[]; noshows?: unknown[]; context?: unknown; onNoShowPost?: (_route: Route, _action: string, _id: string) => Promise<void> | void }
async function setup(p: Page, role: 'ADMIN' | 'SUPPORT', { disputes = [], noshows = [], context, onNoShowPost }: Mocks = {}) {
  await p.addInitScript((u) => { (window as unknown as { __yadonyAuthSeed: typeof u }).__yadonyAuthSeed = u }, admin(role))
  await p.route('**/api/v1/admin/disputes**', (route) => {
    const url = route.request().url(); const m = route.request().method()
    if (m === 'POST' && url.includes('/guarantee-fund')) return route.fulfill({ json: DISPUTE_RESOLVED })
    if (m === 'POST' && url.includes('/resolve')) return route.fulfill({ json: DISPUTE_RESOLVED })
    if (url.includes('/split-options')) return route.fulfill({ status: 404, json: {} })
    // Ancien back par défaut : pas de contexte.
    if (url.endsWith('/context')) return context ? route.fulfill({ json: context }) : route.fulfill({ status: 404, json: {} })
    if (url.includes('/admin/disputes/d1')) return route.fulfill({ json: DISPUTE_DETAIL })
    return route.fulfill({ json: page(new URL(url).searchParams.get('status') === 'RESOLVED' ? [] : disputes) })
  })
  await p.route('**/api/v1/admin/cancellations**', async (route) => {
    const req = route.request()
    if (req.method() === 'POST') {
      const m = /\/admin\/cancellations\/([^/]+)\/(confirm|reject)/.exec(req.url())
      if (m && onNoShowPost) return onNoShowPost(route, m[2]!, m[1]!)
      return route.fulfill({ status: 500, json: {} })
    }
    return route.fulfill({ json: page(noshows) })
  })
}

test('file fusionnée : litiges et absences lisibles, sans code technique ni UUID', async ({ page: p }) => {
  await setup(p, 'ADMIN', { disputes: [DISPUTE], noshows: [HANDOVER, DELIVERY] })
  await p.goto('/incidents')
  await expect(p.locator('h1').first()).toContainText('Incidents')
  const dispute = p.locator('[data-test="incident-row-dispute:d1"]')
  await expect(dispute).toContainText('Voyageur absent à la livraison')
  await expect(dispute).toContainText('Koro DIAKITE → Ibra DIANE')
  await expect(p.locator(noShowRow('c1'))).toContainText('Le voyageur Awa D. déclare l’expéditeur Moussa K. absent à la remise')
  await expect(p.locator(noShowRow('c1'))).toContainText('Bamako → Abidjan, 15 sept. · 45,00 EUR · Espèces')
  await expect(p.locator(noShowRow('c1'))).toContainText('reste 5 h')
  await expect(p.locator(noShowRow('c2')).locator('.text-danger')).toHaveText('reste 45 min')
  const text = await p.locator('main').innerText()
  expect(text).not.toContain('TRAVELER_DELIVERY_NO_SHOW')
  expect(text).not.toContain('PENDING_CONFIRMATION')
  expect(text).not.toContain('89125c9c-aaaa')
  await expect(p.locator('[data-test="summary-todo"]')).toHaveText('3')
})

test('un litige s’ouvre dans le dossier : parties, colis, liens, devise', async ({ page: p }) => {
  await setup(p, 'ADMIN', { disputes: [DISPUTE] })
  await p.goto('/incidents')
  await expect(p.locator('[data-test="incident-title"]')).toHaveText('Voyageur absent à la livraison')
  await expect(p.locator('[data-test="incident-party-link-sender"]')).toHaveAttribute('href', new RegExp(`/users/${SENDER}$`))
  await expect(p.locator('[data-test="incident-fact-currency"]')).toContainText('EUR')
  await expect(p.locator('[data-test="incident-payment-link"]')).toHaveAttribute('href', new RegExp(`/transactions\\?bidId=${BID}&view=ALL$`))
})

test('trancher un litige : note obligatoire, message, litige sorti de la file', async ({ page: p }) => {
  let sent: Record<string, unknown> | null = null
  let resolved = false
  await setup(p, 'ADMIN', { disputes: [DISPUTE] })
  await p.route('**/api/v1/admin/disputes/d1/resolve', (route) => { sent = route.request().postDataJSON(); resolved = true; return route.fulfill({ json: { ...DISPUTE_DETAIL, status: 'RESOLVED', resolution: 'RESOLVED_FOR_SENDER' } }) })
  await p.route('**/api/v1/admin/disputes?**', (route) => route.fulfill({ json: page(resolved ? [] : [DISPUTE]) }))
  await p.goto('/incidents')
  await expect(p.locator('[data-test="incident-confirm"]')).toBeDisabled()
  await p.locator('[data-test="incident-note"]').fill('Preuves examinées')
  await p.locator('[data-test="incident-confirm"]').click()
  await expect(p.locator('[data-test="incidents-done"]')).toHaveText('Litige résolu.')
  expect(sent).toEqual({ resolution: 'RESOLVED_FOR_SENDER', note: 'Preuves examinées' })
  await expect(p.locator('[data-test="incident-row-dispute:d1"]')).toHaveCount(0)
})

test('fonds de garantie (≤200 €) dans la devise du colis, à une partie désignée', async ({ page: p }) => {
  let sentBody: Record<string, unknown> | null = null
  await setup(p, 'ADMIN', { disputes: [DISPUTE] })
  await p.route('**/api/v1/admin/disputes/d1/guarantee-fund', (route) => { sentBody = route.request().postDataJSON(); return route.fulfill({ json: DISPUTE_RESOLVED }) })
  await p.goto('/incidents')
  await p.locator('[data-test="incident-action-GUARANTEE"]').click()
  await expect(p.locator('[data-test="gf-currency"]')).toHaveText('EUR')
  await p.locator('[data-test="gf-amount"]').fill('250')
  await p.locator('[data-test="gf-reason"]').fill('colis perdu')
  await p.locator('[data-test="gf-beneficiary-sender"]').check()
  await expect(p.locator('[data-test="gf-submit"]')).toBeDisabled()
  await p.locator('[data-test="gf-amount"]').fill('150')
  await expect(p.locator('[data-test="gf-submit"]')).toBeEnabled()
  await p.locator('[data-test="gf-submit"]').click()
  await expect.poll(() => sentBody).toMatchObject({ amountCents: 15000, beneficiaryUserId: SENDER, currency: 'EUR' })
  await expect(p.locator('[data-test="incidents-done"]')).toHaveText('Fonds de garantie versé.')
})

test('recherche et nature : la file se filtre', async ({ page: p }) => {
  await setup(p, 'ADMIN', { disputes: [DISPUTE], noshows: [HANDOVER, DELIVERY] })
  await p.goto('/incidents')
  await expect(p.locator('[data-test="incident-row-dispute:d1"]')).toBeVisible()
  await p.locator('[data-test="kind-NOSHOW"]').click()
  await expect(p.locator('[data-test="incident-row-dispute:d1"]')).toHaveCount(0)
  await expect(p.locator(noShowRow('c1'))).toBeVisible()
  await p.locator('[data-test="kind-ALL"]').click()
  await p.locator('[data-test="incident-search"]').fill('fatou')
  await expect(p.locator(noShowRow('c2'))).toBeVisible()
  await expect(p.locator(noShowRow('c1'))).toHaveCount(0)
})

test('Traités : les litiges résolus sont relus avec status=RESOLVED', async ({ page: p }) => {
  const statuses: (string | null)[] = []
  await setup(p, 'ADMIN', { disputes: [DISPUTE] })
  p.on('request', (r) => { if (/\/admin\/disputes\?/.test(r.url())) statuses.push(new URL(r.url()).searchParams.get('status')) })
  await p.goto('/incidents')
  await expect(p.locator('[data-test="incident-row-dispute:d1"]')).toBeVisible()
  await p.locator('[data-test="tab-DONE"]').click()
  await expect.poll(() => statuses).toContain('RESOLVED')
  await expect(p.locator('[data-test="incident-row-dispute:d1"]')).toHaveCount(0)
})

test('liste lisible : portée, remise à l’heure de Paris, sans statut brut', async ({ page: p }) => {
  await setup(p, 'ADMIN', { noshows: [HANDOVER, DELIVERY] })
  await p.goto('/incidents?tab=noshows&open=c2')
  await expect(p.locator('[data-test="incident-sentence"]')).toContainText('Le voyageur Awa D. déclare le destinataire Fatou S. absent à la livraison')
  await expect(p.locator('[data-test="incident-fact-handover"]')).toContainText('15 sept. à 18:00')
  await expect(p.locator('[data-test="incident-fact-answer"]')).toContainText('reste 45 min')
})

test('confirmer au départ : effet expliqué, motif envoyé, message de succès', async ({ page: p }) => {
  let body: unknown = null
  let done = false
  await setup(p, 'ADMIN', {
    noshows: [HANDOVER],
    onNoShowPost: (route, action) => {
      body = route.request().postDataJSON()
      expect(action).toBe('confirm')
      done = true
      return route.fulfill({ json: { ...HANDOVER, status: 'CONFIRMED', canConfirm: false, canReject: false } })
    },
  })
  await p.route('**/api/v1/admin/cancellations?**', (route) => (route.request().method() !== 'GET' ? route.fallback() : route.fulfill({ json: page(done ? [] : [HANDOVER]) })))
  await p.goto('/incidents?tab=noshows&open=c1')
  await expect(p.locator('[data-test="incident-party-link-declarant"]')).toHaveAttribute('href', new RegExp(`/users/${SENDER}$`))
  await expect(p.locator('[data-test="incident-bid-link"]')).toHaveAttribute('href', new RegExp(`/colis\\?open=${BID}$`))
  const preview = p.locator('[data-test="incident-preview"]')
  await expect(preview).toContainText('Le colis est annulé et l’expéditeur remboursé.')
  await expect(preview).toContainText('la commission est remboursée au voyageur')
  await expect(p.locator('[data-test="incident-confirm"]')).toBeDisabled()
  await p.locator('[data-test="incident-note"]').fill(REASON)
  await p.locator('[data-test="incident-confirm"]').click()
  await expect(p.locator('[data-test="incidents-done"]')).toContainText('Absence confirmée. Le colis est annulé')
  expect(body).toEqual({ reason: REASON })
})

test('confirmer à l’arrivée : litige annoncé, puis lien vers le litige une fois créé', async ({ page: p }) => {
  let decided = false
  let gets = 0
  const after = { ...DELIVERY, status: 'CONFIRMED', adminDecision: 'CONFIRMED', decidedAt: '2026-09-28T10:05:00Z', decisionReason: 'Destinataire injoignable toute la journée', canConfirm: false, canReject: false, remainingMinutes: undefined }
  await setup(p, 'ADMIN', { noshows: [], onNoShowPost: (route) => { decided = true; return route.fulfill({ json: { ...after, dispute: null } }) } })
  await p.route('**/api/v1/admin/cancellations?**', (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    gets++
    // Le litige n'existe qu'à la relecture qui suit la décision (créé après la réponse).
    const content = !decided ? [DELIVERY] : gets >= 3 ? [{ ...after, dispute: { id: 'd1', status: 'OPEN' } }] : [{ ...after, dispute: null }]
    return route.fulfill({ json: page(content) })
  })
  await p.goto('/incidents?tab=noshows&open=c2')
  await expect(p.locator('[data-test="incident-preview"]')).toContainText('Un litige est ouvert')
  await p.locator('[data-test="incident-note"]').fill('Destinataire injoignable toute la journée')
  await p.locator('[data-test="incident-confirm"]').click()
  await expect(p.locator('[data-test="incidents-done"]')).toContainText('Un litige va être ouvert')
  await p.locator('[data-test="tab-ALL"]').click()
  await p.locator('[data-test="incident-open-noshow:c2"]').click()
  await expect(p.locator('[data-test="noshow-decision"]')).toContainText('Décision : Absence confirmée le 28 sept. à 12:05')
  await expect(p.locator('[data-test="incident-dispute-link"]')).toContainText('Litige ouvert')
})

test('déclaration rejetée : « Rejetée », décision datée et motif interne, dans les Traités', async ({ page: p }) => {
  const REJECTED = { ...HANDOVER, status: 'RESOLVED', adminDecision: 'REJECTED', decidedAt: '2026-09-28T10:00:00Z', decisionReason: 'Remise bien faite, photo à l’appui', canConfirm: false, canReject: false, remainingMinutes: undefined }
  await setup(p, 'ADMIN', { noshows: [REJECTED] })
  const loaded = p.waitForResponse((r) => r.url().includes('/admin/cancellations'))
  await p.goto('/incidents')
  // Page hydratée une fois la file lue : un clic plus tôt serait perdu.
  await loaded
  await p.locator('[data-test="tab-DONE"]').click()
  await expect(p.locator(noShowRow('c1'))).toContainText('Rejetée')
  await expect(p.locator('[data-test="noshow-decision"]')).toContainText('Décision : Rejetée le 28 sept. à 12:00')
  await expect(p.locator('[data-test="noshow-decision-reason"]')).toHaveText('Remise bien faite, photo à l’appui')
})

test('espèces sans montant : « Espèces » et état de la commission', async ({ page: p }) => {
  await setup(p, 'ADMIN', { noshows: [{ ...HANDOVER, amount: undefined, paymentStatus: 'CHARGED', commissionStatus: 'CHARGED' }] })
  await p.goto('/incidents')
  await expect(p.locator(noShowRow('c1'))).toContainText('Espèces · commission prélevée')
})

test('404 noshow-not-found : message sous le bouton', async ({ page: p }) => {
  await setup(p, 'ADMIN', { noshows: [HANDOVER], onNoShowPost: (route) => route.fulfill({ status: 404, contentType: 'application/problem+json', json: { status: 404, code: 'noshow-not-found', detail: 'Not found' } }) })
  await p.goto('/incidents?tab=noshows&open=c1')
  await p.locator('[data-test="incident-note"]').fill(REASON)
  await p.locator('[data-test="incident-confirm"]').click()
  await expect(p.locator('[data-test="incident-error"]')).toContainText('n’existe plus')
})

test('cloche : le lien NOSHOW_PENDING ouvre le dossier du no-show', async ({ page: p }) => {
  await setup(p, 'ADMIN', { noshows: [HANDOVER, DELIVERY] })
  const item = { id: 'n1', type: 'NOSHOW_PENDING', title: 'No-show à arbitrer', summary: 'Absence déclarée à la livraison', severity: 'WARNING', createdAt: '2026-09-28T09:00:00Z', link: '/incidents?tab=noshows&open=c2' }
  await p.route('**/api/v1/admin/notifications/**', (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/counters')) return route.fulfill({ json: { counts: { incidents: 1 }, unreadCount: 1 } })
    if (path.endsWith('/feed')) return route.fulfill({ json: { items: [item], unreadCount: 1, lastSeenAt: null } })
    return route.fulfill({ status: 204, body: '' })
  })
  await p.goto('/incidents')
  // Compteurs reçus = page hydratée : un clic plus tôt n'ouvrirait pas le dossier.
  await expect(p.locator('[data-test="notif-bell"]')).toHaveAttribute('aria-label', 'Notifications, 1 non lue')
  await p.locator('[data-test="notif-bell"]').click()
  await p.locator('[data-test="notif-item"]').first().click()
  await expect(p).toHaveURL(/\/incidents\?tab=noshows&open=c2$/)
  await expect(p.locator('[data-test="incident-sentence"]')).toContainText('Fatou S.')
})

test('rejeter la déclaration', async ({ page: p }) => {
  let action = ''
  await setup(p, 'ADMIN', { noshows: [HANDOVER], onNoShowPost: (route, a) => { action = a; return route.fulfill({ json: { ...HANDOVER, status: 'RESOLVED', canConfirm: false, canReject: false } }) } })
  await p.goto('/incidents?tab=noshows&open=c1')
  await p.locator('[data-test="incident-action-NOSHOW_REJECT"]').click()
  await expect(p.locator('[data-test="incident-preview"]')).toContainText('La déclaration est classée et le colis continue normalement.')
  await p.locator('[data-test="incident-note"]').fill('Remise bien faite, photo du colis à l’appui')
  await p.locator('[data-test="incident-confirm"]').click()
  await expect(p.locator('[data-test="incidents-done"]')).toContainText('Déclaration rejetée')
  expect(action).toBe('reject')
})

test('409 déjà tranché : erreur sous le bouton et liste rechargée', async ({ page: p }) => {
  let gets = 0
  await setup(p, 'ADMIN', { noshows: [HANDOVER], onNoShowPost: (route) => route.fulfill({ status: 409, contentType: 'application/problem+json', json: { status: 409, code: 'noshow-already-decided', detail: 'Déjà tranché' } }) })
  p.on('request', (r) => { if (r.url().includes('/admin/cancellations?') && r.method() === 'GET') gets++ })
  await p.goto('/incidents?tab=noshows&open=c1')
  await p.locator('[data-test="incident-note"]').fill(REASON)
  await p.locator('[data-test="incident-confirm"]').click()
  await expect(p.locator('[data-test="incident-error"]')).toContainText('déjà été tranchée')
  await expect.poll(() => gets).toBeGreaterThanOrEqual(2)
})

test('422 : message de validation affiché sous le bouton', async ({ page: p }) => {
  await setup(p, 'ADMIN', { noshows: [HANDOVER], onNoShowPost: (route) => route.fulfill({ status: 422, contentType: 'application/problem+json', json: { status: 422, code: 'validation-failed', violations: { reason: 'Le motif doit faire entre 10 et 500 caractères' } } }) })
  await p.goto('/incidents?tab=noshows&open=c1')
  await p.locator('[data-test="incident-note"]').fill(REASON)
  await p.locator('[data-test="incident-confirm"]').click()
  await expect(p.locator('[data-test="incident-error"]')).toHaveText('Le motif doit faire entre 10 et 500 caractères')
})

test('SUPPORT : consulte le dossier, sans bouton de décision', async ({ page: p }) => {
  await setup(p, 'SUPPORT', { noshows: [HANDOVER] })
  await p.goto('/incidents?tab=noshows&open=c1')
  await expect(p.locator('[data-test="incident-case"]')).toContainText('Moussa K.')
  await expect(p.locator('[data-test="incident-confirm"]')).toHaveCount(0)
  await expect(p.locator('[data-test="incident-no-action"]')).toBeVisible()
})

test('ancien back : titre « Colis … », confirmation via l’ancien endpoint, pas de rejet, erreur affichée', async ({ page: p }) => {
  const LEGACY = { id: 'c9', bidId: 'b9f00000-aaaa-4bbb-8ccc-dddddddddddd', cancelledBy: 'u9', reason: 'SENDER_NO_SHOW', noShowStatus: 'PENDING_CONFIRMATION', contestationDeadline: '2099-09-28T15:00:00Z', createdAt: '2026-09-28T10:00:00Z' }
  await setup(p, 'ADMIN', { noshows: [LEGACY] })
  let calls = 0
  await p.route('**/api/v1/cancellations/bids/*/confirm-noshow', (route) => {
    calls++
    return calls === 1
      ? route.fulfill({ status: 404, contentType: 'application/problem+json', json: { status: 404, code: 'cancellation-not-found', detail: 'Aucune annulation en attente pour ce bid' } })
      : route.fulfill({ status: 200, body: '' })
  })
  await p.goto('/incidents?tab=noshows')
  const row = p.locator(noShowRow('c9'))
  await expect(row).toContainText('Colis b9f00000…')
  expect(await row.innerText()).not.toContain('b9f00000-aaaa')
  await expect(p.locator('[data-test="noshow-legacy-note"]')).toBeVisible()
  await expect(p.locator('[data-test="incident-action-NOSHOW_REJECT"]')).toHaveCount(0)
  await expect(p.locator('[data-test="incident-note"]')).toHaveCount(0)
  await p.locator('[data-test="incident-confirm"]').click()
  await expect(p.locator('[data-test="incident-error"]')).toHaveText('Aucune annulation en attente pour ce bid')
  await p.locator('[data-test="incident-confirm"]').click()
  await expect(p.locator('[data-test="incidents-done"]')).toHaveText('Absence confirmée.')
})

test('contexte : autres incidents des deux parties, historique de l’audit et argent gelé', async ({ page: p }) => {
  const priced = { ...DISPUTE, amount: 38, currency: 'EUR' }
  const context = {
    related: [{ kind: 'NOSHOW', id: 'c1', type: 'SENDER_NO_SHOW', scope: 'HANDOVER', open: true, createdAt: '2026-09-28T10:00:00' }],
    history: [{ action: 'SPLIT_RETRY', at: '2026-10-25T09:00:00', actorEmail: 'sira@yadony.com', note: null }],
  }
  await setup(p, 'ADMIN', { disputes: [priced], noshows: [HANDOVER], context })
  await p.goto('/incidents')
  await expect(p.locator('[data-test="summary-frozen-amounts"]')).toContainText('38,00 EUR')
  await expect(p.locator('[data-test="incident-row-dispute:d1"]')).toContainText('38,00 EUR · Remboursement gelé')
  await expect(p.locator('[data-test="incident-related"]')).toContainText('Déclaration d’absence à la remise')
  await expect(p.locator('[data-test="report-timeline"]')).toContainText('Partage du séquestre repris')
  await expect(p.locator('[data-test="report-timeline"]')).toContainText('par sira@yadony.com')
  await p.locator('[data-test="incident-related-noshow:c1"]').click()
  await expect(p.locator('[data-test="incident-title"]')).toHaveText('Déclaration d’absence à la remise')
  await expect(p).toHaveURL(/\/incidents\?tab=noshows&open=c1$/)
})

test('ancien back : pas de contexte, ni section ni message', async ({ page: p }) => {
  await setup(p, 'ADMIN', { disputes: [DISPUTE] })
  await p.goto('/incidents')
  await expect(p.locator('[data-test="incident-title"]')).toHaveText('Voyageur absent à la livraison')
  await expect(p.locator('[data-test="incident-related"]')).toHaveCount(0)
  await expect(p.locator('[data-test="incident-context-error"]')).toHaveCount(0)
  await expect(p.locator('[data-test="summary-frozen-amounts"]')).toHaveCount(0)
})
