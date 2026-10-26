import { test, expect } from '@playwright/test'

const ADMIN = { id: 'a1', email: 'admin.1@yadony.com', role: 'ADMIN', status: 'ACTIVE', mustChangePassword: false, permissionOverrides: {} }
const OPEN_PAGE = {
  content: [
    { id: 'al1', type: 'RETURN_DEADLINE_EXPIRED', severity: 'CRITICAL', payload: { bidId: 'b1' }, resolved: false, resolvedAt: null, createdAt: '2026-06-01T10:00:00Z' },
  ],
  totalElements: 1, totalPages: 1, number: 0, size: 20,
}
const INVARIANT_ALERT = {
  id: 'al2', type: 'MONEY_INVARIANT_INV-06', severity: 'WARN',
  detail: 'Incohérence d’argent INV-06 (HAUTE) : Colis livré depuis plus de 2 h bien payé au voyageur — 1 ligne(s) en faute',
  payload: { invariant: 'INV-06', regle: 'Colis livré depuis plus de 2 h bien payé au voyageur', gravite: 'HAUTE', lignesEnFaute: 1, passagePrecedent: 0 },
  resolved: false, resolvedAt: null, createdAt: '2026-10-06T12:00:00',
}
const VIOLATIONS = {
  invariant: 'INV-06', title: 'Colis livré depuis plus de 2 h bien payé au voyageur', severity: 'HAUTE', total: 1,
  rows: [{ payment_id: '11111111-2222-3333-4444-555555555555', rail: 'STRIPE', amount: 42, currency: 'EUR', disputed: false, payout_held_at: null, bid_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', delivered_at: '2026-10-06 08:00:00.0' }],
}
const RESOLVED_ALERT = { ...OPEN_PAGE.content[0], resolved: true, resolvedAt: '2026-06-03T10:00:00Z' }

const ESCROW = (id: string, createdAt: string) => ({
  id, type: 'ESCROW_J48_TIMEOUT', severity: 'WARN', detail: `Paiement ${id} en séquestre depuis plus de 48 h`,
  payload: {}, resolved: false, resolvedAt: null, createdAt,
})

test.beforeEach(async ({ page }) => {
  await page.addInitScript((u) => { (window as unknown as { __yadonyAuthSeed: typeof u }).__yadonyAuthSeed = u }, ADMIN)
  let open = [OPEN_PAGE.content[0]!, INVARIANT_ALERT, ESCROW('al4', '2026-10-01T10:00:00'), ESCROW('al5', '2026-10-02T10:00:00')]
  let snoozed: typeof open = []
  let resolved: Record<string, unknown>[] = [{ ...ESCROW('al6', '2026-09-20T10:00:00'), resolved: true, resolvedAt: '2026-09-21T10:00:00Z' }]
  await page.route('**/api/v1/admin/alerts**', (route) => {
    const url = route.request().url()
    const method = route.request().method()
    const idOf = () => url.split('/alerts/')[1]!.split('/')[0]!
    if (method === 'POST' && url.endsWith('/resolve-batch')) {
      const ids: string[] = route.request().postDataJSON().ids
      open = open.filter(a => !ids.includes(a.id))
      return route.fulfill({ json: { resolved: ids, alreadyResolved: [], notFound: [] } })
    }
    if (method === 'POST' && url.endsWith('/resolve')) {
      open = open.filter(a => a.id !== idOf())
      return route.fulfill({ json: RESOLVED_ALERT })
    }
    if (method === 'POST' && url.endsWith('/snooze')) {
      const hit = open.find(a => a.id === idOf())!
      open = open.filter(a => a.id !== hit.id)
      snoozed = [...snoozed, hit]
      return route.fulfill({ json: { ...hit, snoozedUntil: '2999-01-01T00:00:00Z' } })
    }
    if (method === 'POST' && url.endsWith('/reopen')) {
      const hit = resolved.find(a => a.id === idOf())!
      resolved = resolved.filter(a => a.id !== hit.id)
      open = [...open, { ...hit, resolved: false, resolvedAt: null } as (typeof open)[number]]
      return route.fulfill({ json: hit })
    }
    if (url.includes('/al2/violations')) return route.fulfill({ json: VIOLATIONS })
    if (url.includes('/context')) {
      const related = idOf() === 'al2'
        ? [{ id: 'al4', type: 'ESCROW_J48_TIMEOUT', severity: 'WARN', resolved: false, createdAt: '2026-10-01T10:00:00' }] : []
      const history = idOf() === 'al6'
        ? [{ action: 'ADMIN_ALERT_RESOLVED', at: '2026-09-21T10:00:00', actorEmail: 'moussa@yadony.com', note: 'Versement forcé' }] : []
      return route.fulfill({ json: { related, history } })
    }
    const params = new URL(url).searchParams
    const content = params.get('resolved') === 'true' ? resolved : params.get('snoozed') === 'true' ? snoozed.map(a => ({ ...a, snoozedUntil: '2999-01-01T00:00:00Z' })) : open
    return route.fulfill({ json: { ...OPEN_PAGE, content, totalElements: content.length } })
  })
})

test('l’admin voit les alertes groupées par type, la plus grave d’abord, et la première est ouverte', async ({ page }) => {
  await page.goto('/alertes')
  await expect(page.locator('h1').first()).toContainText('Alertes')
  await expect(page.locator('[data-test="summary-CRITICAL"]')).toContainText('1')
  await expect(page.locator('[data-test="summary-WARN"]')).toContainText('3')
  await expect(page.locator('[data-test^="alert-group-toggle-"]')).toContainText('×2')
  // Critique d'abord : son dossier est déjà ouvert à côté de la décision.
  await expect(page.locator('[data-test="alert-row-al1"]')).toHaveAttribute('data-selected', 'true')
  await expect(page.locator('[data-test="alert-decision-panel"]')).toBeVisible()
})

test('l’admin résout une alerte avec une note et passe à la suivante', async ({ page }) => {
  await page.goto('/alertes')
  const posted = page.waitForRequest(r => r.method() === 'POST' && r.url().includes('/al1/resolve'))
  await page.locator('[data-test="alert-quick-Corrigé manuellement"]').click()
  await page.locator('[data-test="alert-confirm"]').click()
  const req = await posted
  expect(req.postDataJSON()).toEqual({ note: 'Corrigé manuellement' })
  await expect(page.locator('[data-test="alerts-done"]')).toHaveText('Alerte résolue.')
  await expect(page.locator('[data-test="alert-row-al1"]')).toHaveCount(0)
})

test('J et K parcourent la file, 2 puis ⌘⏎ résolvent en faux positif', async ({ page }) => {
  await page.goto('/alertes')
  await expect(page.locator('[data-test="alert-row-al1"]')).toHaveAttribute('data-selected', 'true')
  // Ordre de la file : al1, puis le groupe « séquestre » (al4, al5), puis al2.
  for (let i = 0; i < 3; i++) await page.keyboard.press('j')
  await expect(page.locator('[data-test="alert-detail-title"]')).toHaveText('Colis livré mais voyageur pas encore payé')
  const posted = page.waitForRequest(r => r.method() === 'POST' && r.url().includes('/al2/resolve'))
  await page.keyboard.press('2')
  await page.locator('[data-test="alert-note"]').fill('Règle trop sensible')
  await page.keyboard.press('Control+Enter')
  expect((await posted).postDataJSON()).toEqual({ note: 'Faux positif : Règle trop sensible' })
})

test('l’admin résout les deux alertes d’un groupe d’un coup', async ({ page }) => {
  await page.goto('/alertes')
  await page.locator('[data-test^="alert-group-toggle-"]').click()
  await page.locator('[data-test="scope-group"]').click()
  await page.locator('[data-test="alert-note"]').fill('Versement forcé')
  await page.locator('[data-test="alert-acknowledge"]').check()
  const posted = page.waitForRequest(r => r.method() === 'POST' && r.url().endsWith('/resolve-batch'))
  await page.locator('[data-test="alert-confirm"]').click()
  const body = (await posted).postDataJSON()
  expect([...body.ids].sort()).toEqual(['al4', 'al5'])
  expect(body.note).toBe('Versement forcé')
  await expect(page.locator('[data-test="alerts-done"]')).toHaveText('2 alertes résolues.')
})

test('l’admin reporte une alerte : elle quitte la file et se retrouve dans « Reportées »', async ({ page }) => {
  await page.goto('/alertes')
  await expect(page.locator('[data-test="alert-row-al1"]')).toHaveAttribute('data-selected', 'true')
  await page.locator('[data-test="alert-action-SNOOZE"]').click()
  await page.locator('[data-test="snooze-72"]').click()
  await page.locator('[data-test="alert-note"]').fill('Colis encore en route')
  const posted = page.waitForRequest(r => r.method() === 'POST' && r.url().endsWith('/al1/snooze'))
  await page.locator('[data-test="alert-confirm"]').click()
  expect((await posted).postDataJSON()).toEqual({ hours: 72, note: 'Colis encore en route' })
  await expect(page.locator('[data-test="alert-row-al1"]')).toHaveCount(0)
  await page.locator('[data-test="tab-SNOOZED"]').click()
  await expect(page.locator('[data-test="alert-row-al1"]')).toBeVisible()
  await expect(page.locator('[data-test="alert-detail-snoozed"]')).toContainText('Reportée jusqu’au')
  await expect(page.locator('[data-test="alert-action-UNSNOOZE"]')).toBeVisible()
})

test('l’admin rouvre une alerte résolue et lit son historique', async ({ page }) => {
  await page.goto('/alertes')
  await expect(page.locator('[data-test="alert-row-al1"]')).toHaveAttribute('data-selected', 'true')
  await page.locator('[data-test="tab-RESOLVED"]').click()
  await expect(page.locator('[data-test="alert-history"]')).toContainText('par moussa@yadony.com')
  const posted = page.waitForRequest(r => r.method() === 'POST' && r.url().endsWith('/al6/reopen'))
  await page.locator('[data-test="alert-quick-L’anomalie est revenue"]').click()
  await page.locator('[data-test="alert-confirm"]').click()
  expect((await posted).postDataJSON()).toEqual({ note: 'L’anomalie est revenue' })
  await expect(page.locator('[data-test="alerts-done"]')).toHaveText('Alerte rouverte.')
})

test('le dossier montre les autres alertes du même paiement, ouvrables d’un clic', async ({ page }) => {
  await page.goto('/alertes')
  await page.locator('[data-test="alert-open-al2"]').click()
  await expect(page.locator('[data-test="alert-related"]')).toContainText('Paiement en séquestre depuis plus de 48 h')
  await page.locator('[data-test="alert-related-al4"]').click()
  await expect(page.locator('[data-test="alert-row-al4"]')).toHaveAttribute('data-selected', 'true')
})

test('la recherche réduit la file', async ({ page }) => {
  await page.goto('/alertes')
  // La page est hydratée quand la première alerte est ouverte : avant, le champ ne filtre pas encore.
  await expect(page.locator('[data-test="alert-row-al1"]')).toHaveAttribute('data-selected', 'true')
  await page.locator('[data-test="alert-search"]').fill('INV-06')
  await expect(page.locator('[data-test="alert-row-al2"]')).toBeVisible()
  await expect(page.locator('[data-test="alert-row-al1"]')).toHaveCount(0)
})

test('l’admin ouvre une alerte et voit quoi faire et les lignes en faute', async ({ page }) => {
  await page.goto('/alertes')
  await page.locator('[data-test="alert-open-al2"]').click()
  await expect(page.locator('[data-test="alert-detail-title"]')).toHaveText('Colis livré mais voyageur pas encore payé')
  await expect(page.locator('[data-test="alert-detail-actions"]')).toContainText('Débloquer (force-release)')
  await expect(page.locator('[data-test="alert-violations-total"]')).toContainText('1 ligne(s) en faute')
  await expect(page.locator('[data-test="alert-rows"] a').first()).toHaveAttribute('href', /\/transactions\?open=11111111-2222-3333-4444-555555555555$/)
  if (process.env.ALERT_SCREENSHOT) await page.screenshot({ path: process.env.ALERT_SCREENSHOT, fullPage: true })
})

const PAY = '11111111-2222-3333-4444-555555555555'
const RECON_ALERT = {
  id: 'al3', type: `RECON_STRIPE_${PAY}`, severity: 'CRITICAL', detail: 'Écart Stripe SEQUESTRE_NON_CAPTURE', paymentId: PAY,
  payload: { prestataire: 'STRIPE', reference: PAY, ecart: 'SEQUESTRE_NON_CAPTURE', detail: 'base : ESCROW' },
  resolved: false, resolvedAt: null, createdAt: '2026-10-10T04:30:00',
}
const PAYMENT = {
  id: PAY, bidId: null, status: 'ESCROW', method: 'STRIPE', amountCents: 6450, commissionCents: 774, currency: 'EUR',
  createdAt: '2026-10-07T10:00:00', refundedCents: 0, stripePaymentIntentId: 'pi_1', escrowReleasedAt: null, disputed: false, capturedAt: null,
}
const RESYNC = {
  paymentId: PAY, paymentIntentId: 'pi_1', action: 'ESCROW_CAPTURED', changed: true,
  before: { status: 'ESCROW', capturedAt: null, stripeStatus: 'requires_capture', amountCapturable: 6450 },
  after: { status: 'ESCROW', capturedAt: '2026-10-10T08:00:00Z', stripeStatus: 'succeeded', amountCapturable: 0 },
  message: 'Séquestre capturé sur le solde plateforme', resolvedAlertIds: ['al3'], openAlertIds: [], alertResolvable: false,
}

test.describe('section « Corriger » (super-admin)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((u) => { (window as unknown as { __yadonyAuthSeed: typeof u }).__yadonyAuthSeed = u }, { ...ADMIN, role: 'SUPER_ADMIN' })
    await page.route('**/api/v1/admin/alerts**', route => route.fulfill({ json: { ...OPEN_PAGE, content: [RECON_ALERT] } }))
  })

  test('resynchronise un écart Stripe et marque l’alerte résolue', async ({ page }) => {
    let calls = 0
    await page.route(`**/api/v1/admin/payments/${PAY}/resync-stripe`, (route) => { calls++; return route.fulfill({ json: RESYNC }) })
    await page.route(`**/api/v1/admin/payments/${PAY}`, route => route.fulfill({ json: PAYMENT }))
    await page.goto('/alertes')
    await expect(page.locator('[data-test="alert-detail-title"]')).toHaveText('Écart de rapprochement Stripe')
    await expect(page.locator('[data-test="alert-detail-actions"] li').first()).toContainText('Resynchroniser avec Stripe')
    await page.locator('[data-test="resync-stripe"]').click()
    await expect(page.locator('[data-test="resync-action"]')).toHaveText('Séquestre encaissé : le voyageur pourra être payé')
    await expect(page.locator('[data-test="alert-fix-auto-resolved"]')).toBeVisible()
    await expect(page.locator('[data-test="alert-row-al3"]')).toContainText('Résolue')
    await expect(page.locator('[data-test="alert-fix-release"]')).toBeVisible()
    expect(calls).toBe(1)
  })

  test('ancien back (404) : action indisponible sur cet environnement', async ({ page }) => {
    await page.route(`**/api/v1/admin/payments/${PAY}/resync-stripe`, route => route.fulfill({ status: 404, json: { status: 404, detail: 'No endpoint' } }))
    await page.route(`**/api/v1/admin/payments/${PAY}`, route => route.fulfill({ json: PAYMENT }))
    await page.goto('/alertes')
    await page.locator('[data-test="resync-stripe"]').click()
    await expect(page.locator('[data-test="resync-unavailable"]')).toContainText('Action indisponible sur cet environnement')
    await expect(page.locator('[data-test="resync-stripe"]')).toHaveCount(0)
  })
})
