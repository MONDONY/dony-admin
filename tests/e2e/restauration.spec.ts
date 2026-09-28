import { test, expect, type Page } from '@playwright/test'

/**
 * Restauration des éléments supprimés (signalements, avis, messages), annulation d'une
 * suppression de compte et notification ciblée depuis la fiche utilisateur. Back mocké sur
 * le contrat de dony-back feature/admin-restauration-notif-ciblee.
 */
const ADMIN = { id: 'a1', email: 'admin.1@yadony.com', role: 'ADMIN', status: 'ACTIVE', mustChangePassword: false, permissionOverrides: {} }
const page1 = (content: unknown[]) => ({ content, totalElements: content.length, totalPages: 1, number: 0, size: 20 })
const REASON = 'supprimé par erreur, contenu légitime'

const report = (id: string, deleted: boolean) => ({
  id, targetType: 'USER', targetId: 'u9', targetLabel: `Cible ${id}`, reason: 'SCAM_ATTEMPT', description: null,
  reporterName: 'Awa', status: 'OPEN', actionTaken: null, resolutionNote: null, resolvedAt: null,
  createdAt: '2026-06-01T10:00:00Z', photoUrls: [],
  ...(deleted ? { deletedAt: '2026-09-20T10:00:00Z', deletedByAdminEmail: 'mod@yadony.com' } : {}),
})

test.beforeEach(async ({ page }) => {
  await page.addInitScript((u) => { (window as unknown as { __yadonyAuthSeed: typeof u }).__yadonyAuthSeed = u }, ADMIN)
})

async function mockReports(page: Page, calls: { url: string; body: unknown }[]) {
  let deletedRows = [report('r1', true), report('r2', true), report('r3', true)]
  await page.route('**/api/v1/admin/reports**', (route) => {
    const req = route.request()
    const url = req.url()
    if (req.method() === 'POST' && url.includes('/bulk-restore')) {
      const body = req.postDataJSON() as { ids: string[] }
      calls.push({ url, body })
      deletedRows = deletedRows.filter((r) => !body.ids.includes(r.id))
      return route.fulfill({ json: { restored: body.ids.length - 1, skipped: 1 } })
    }
    if (req.method() === 'POST' && url.includes('/restore')) {
      calls.push({ url, body: req.postDataJSON() })
      deletedRows = deletedRows.filter((r) => !url.includes(`/reports/${r.id}/`))
      return route.fulfill({ json: report('r1', false) })
    }
    if (url.includes('deleted=true')) return route.fulfill({ json: page1(deletedRows) })
    return route.fulfill({ json: page1([report('r9', false)]) })
  })
}

test('restaurer un signalement supprimé avec un motif', async ({ page }) => {
  const calls: { url: string; body: unknown }[] = []
  await mockReports(page, calls)
  await page.goto('/signalements')
  await expect(page.locator('[data-test="report-row-r9"]')).toBeVisible()
  await page.locator('[data-test="report-filter-deleted"]').click()
  await expect(page.locator('[data-test="report-deleted-info-r1"]')).toContainText('mod@yadony.com')
  await page.locator('[data-test="restore-r1"]').click()
  await expect(page.locator('[data-test="restore-confirm"]')).toBeDisabled()
  await page.locator('[data-test="restore-reason"]').fill(REASON)
  await page.locator('[data-test="restore-confirm"]').click()
  await expect(page.locator('[data-test="reports-restored"]')).toContainText('1 signalement restauré')
  await expect(page.locator('[data-test="report-row-r1"]')).toHaveCount(0)
  expect(calls[0].url).toContain('/admin/reports/r1/restore')
  expect(calls[0].body).toEqual({ reason: REASON })
})

test('restauration groupée : affiche restaurés et ignorés', async ({ page }) => {
  const calls: { url: string; body: unknown }[] = []
  await mockReports(page, calls)
  await page.goto('/signalements')
  await expect(page.locator('[data-test="report-row-r9"]')).toBeVisible()
  await page.locator('[data-test="report-filter-deleted"]').click()
  await expect(page.locator('[data-test="report-row-r2"]')).toBeVisible()
  await page.locator('[data-test="select-page"]').check()
  await expect(page.locator('[data-test="bulk-delete"]')).toHaveCount(0)
  await page.locator('[data-test="bulk-restore"]').click()
  await page.locator('[data-test="confirm"]').click()
  await expect(page.locator('[data-test="reports-restored"]')).toContainText('2 signalements restaurés, 1 ignoré')
  expect(calls[0].body).toEqual({ ids: ['r1', 'r2', 'r3'] })
})

test('ancien back : le filtre Supprimés vide la liste et le dit', async ({ page }) => {
  await page.route('**/api/v1/admin/reports**', (route) => route.fulfill({ json: page1([report('r9', false)]) }))
  await page.goto('/signalements')
  await expect(page.locator('[data-test="report-row-r9"]')).toBeVisible()
  await page.locator('[data-test="report-filter-deleted"]').click()
  await expect(page.locator('[data-test="reports-deleted-filter-unsupported"]')).toContainText('Filtre disponible après mise à jour')
  await expect(page.locator('[data-test="report-row-r9"]')).toHaveCount(0)
})

test('restaurer un avis supprimé : la note moyenne sera recalculée', async ({ page }) => {
  const restoreCalls: { url: string; body: unknown }[] = []
  const rating = {
    id: 'rt1', bidId: 'b1', raterName: 'Awa', ratedName: 'Karim', score: 4, comment: 'très bien',
    flagged: false, excluded: false, excludedReason: null, createdAt: '2026-06-01T10:00:00Z',
  }
  let restored = false
  await page.route('**/api/v1/admin/reports**', (route) => route.fulfill({ json: page1([report('r9', false)]) }))
  await page.route('**/api/v1/admin/ratings**', (route) => {
    const req = route.request()
    if (req.method() === 'POST' && req.url().includes('/restore')) {
      restoreCalls.push({ url: req.url(), body: req.postDataJSON() })
      restored = true
      return route.fulfill({ json: rating })
    }
    if (req.url().includes('deleted=true')) {
      return route.fulfill({ json: page1(restored ? [] : [{ ...rating, deletedAt: '2026-09-20T10:00:00Z', deletedByAdminEmail: 'mod@yadony.com', deleteReason: 'insulte supposée' }]) })
    }
    return route.fulfill({ json: page1([]) })
  })
  await page.goto('/signalements')
  await expect(page.locator('[data-test="report-row-r9"]')).toBeVisible()
  await page.locator('[data-test="tab-ratings"]').click()
  await page.locator('[data-test="ratings-deleted-only"]').check()
  await expect(page.locator('[data-test="rating-deleted-info-rt1"]')).toContainText('insulte supposée')
  await page.locator('[data-test="restore-rating-rt1"]').click()
  await expect(page.locator('[data-test="restore-notice"]')).toContainText('note moyenne')
  await page.locator('[data-test="restore-reason"]').fill(REASON)
  await page.locator('[data-test="restore-confirm"]').click()
  await expect(page.locator('[data-test="ratings-restored"]')).toBeVisible()
  expect(restoreCalls[0].url).toContain('/admin/ratings/rt1/restore')
  expect(restoreCalls[0].body).toEqual({ reason: REASON })
})

test('restaurer un message supprimé par un admin', async ({ page }) => {
  const restoreCalls: unknown[] = []
  let restored = false
  const conv = { id: 'c1', bidId: 'b1', participantA: 'Awa', participantB: 'Karim', lastMessageAt: '2026-06-02T10:00:00Z', messageCount: 1, flagged: false, createdAt: '2026-06-01T10:00:00Z' }
  const message = { id: 'm1', conversationId: 'c1', senderName: 'Karim', content: 'propos litigieux', flagged: false, createdAt: '2026-06-01T10:05:00Z' }
  await page.route('**/api/v1/admin/conversations**', (route) => {
    const req = route.request()
    if (req.method() === 'POST' && req.url().includes('/messages/m1/restore')) {
      restoreCalls.push(req.postDataJSON())
      restored = true
      // Contrat back : 204 sans corps, le fil se relit ensuite.
      return route.fulfill({ status: 204, body: '' })
    }
    if (req.url().includes('/messages')) {
      return route.fulfill({ json: [restored ? { ...message, deleted: false } : { ...message, deleted: true, deletedByAdmin: true, deletedAt: '2026-09-20T10:00:00Z' }] })
    }
    return route.fulfill({ json: page1([conv]) })
  })
  await page.goto('/moderation')
  await expect(page.locator('[data-test="conv-row-c1"]')).toBeVisible()
  await page.locator('[data-test="open-c1"]').click()
  await expect(page.locator('[data-test="msg-deleted-by-admin-m1"]')).toContainText('Supprimé par un admin le')
  await page.locator('[data-test="restore-msg-m1"]').click()
  await page.locator('[data-test="restore-reason"]').fill(REASON)
  await page.locator('[data-test="restore-confirm"]').click()
  await expect(page.locator('[data-test="delete-msg-m1"]')).toBeVisible()
  expect(restoreCalls).toEqual([{ reason: REASON }])
})

test('message : endpoint absent, bouton masqué et mention discrète', async ({ page }) => {
  const conv = { id: 'c1', bidId: 'b1', participantA: 'Awa', participantB: 'Karim', lastMessageAt: '2026-06-02T10:00:00Z', messageCount: 1, flagged: false, createdAt: '2026-06-01T10:00:00Z' }
  await page.route('**/api/v1/admin/conversations**', (route) => {
    const req = route.request()
    if (req.method() === 'POST') return route.fulfill({ status: 404, json: { title: 'Not Found', status: 404 } })
    if (req.url().includes('/messages')) {
      return route.fulfill({ json: [{ id: 'm1', conversationId: 'c1', senderName: 'Karim', content: '', flagged: false, deleted: true, deletedByAdmin: true, deletedAt: '2026-09-20T10:00:00Z', createdAt: '2026-06-01T10:05:00Z' }] })
    }
    return route.fulfill({ json: page1([conv]) })
  })
  await page.goto('/moderation')
  await expect(page.locator('[data-test="conv-row-c1"]')).toBeVisible()
  await page.locator('[data-test="open-c1"]').click()
  await page.locator('[data-test="restore-msg-m1"]').click()
  await page.locator('[data-test="restore-reason"]').fill(REASON)
  await page.locator('[data-test="restore-confirm"]').click()
  await expect(page.locator('[data-test="msg-restore-unavailable-m1"]')).toHaveText('Restauration indisponible pour ce message')
  await expect(page.locator('[data-test="restore-msg-m1"]')).toHaveCount(0)
})

const USER_ID = '3f2b8c1e-4a5d-4e6f-8a9b-0c1d2e3f4a5b'
const userDetail = {
  id: USER_ID, firstName: 'Awa', lastName: 'Diop', email: 'awa@x.fr', phoneNumber: '+221770000000',
  city: 'Dakar', country: 'SN', status: 'PENDING_DELETION', kycStatus: 'VERIFIED', isProAccount: false,
  averageRating: 4.5, totalTrips: 3, totalShipments: 2, createdAt: '2026-01-01T00:00:00Z',
  roles: ['SENDER'], commissionRateOverride: null, publishingSuspended: false, kiloPro: false,
  cancellationCount: 0, noShowCount: 0, refusedCount: 0, senderHandoverIncidentCount: 0, ratingCount: 2,
  deletionRequestedAt: '2026-09-01T10:00:00Z', deletionScheduledFor: '2026-10-01T10:00:00Z', messagingMutedUntil: null,
}

test('annuler une suppression de compte demandée', async ({ page }) => {
  let cancelBody: unknown = null
  let current: Record<string, unknown> = userDetail
  const listUrls: string[] = []
  await page.route('**/api/v1/admin/users**', (route) => {
    const req = route.request()
    const url = req.url()
    if (req.method() === 'POST' && url.includes(`/${USER_ID}/cancel-deletion`)) {
      cancelBody = req.postDataJSON()
      current = { ...userDetail, status: 'ACTIVE', deletionRequestedAt: null, deletionScheduledFor: undefined }
      return route.fulfill({ json: current })
    }
    if (req.method() === 'GET' && url.includes(`/users/${USER_ID}`)) return route.fulfill({ json: current })
    listUrls.push(url)
    return route.fulfill({ json: page1([current]) })
  })
  await page.goto('/users')
  await expect(page.locator(`[data-test="row-${USER_ID}"]`)).toBeVisible()
  await page.locator('[data-test="chip-PENDING_DELETION"]').click()
  await expect.poll(() => listUrls.some((u) => u.includes('status=PENDING_DELETION'))).toBe(true)
  await page.locator(`[data-test="row-${USER_ID}"]`).click()
  await expect(page.locator('[data-test="user-pending-deletion"]')).toContainText('Suppression prévue le 01/10/2026')
  await page.locator('[data-test="action-cancel-deletion"]').click()
  await expect(page.locator('[data-test="restore-notice"]')).toContainText('prévenu')
  await page.locator('[data-test="restore-reason"]').fill('demande retirée par téléphone au support')
  await page.locator('[data-test="restore-confirm"]').click()
  await expect(page.locator('[data-test="user-pending-deletion"]')).toHaveCount(0)
  expect(cancelBody).toEqual({ reason: 'demande retirée par téléphone au support' })
})

test('fiche utilisateur → Envoyer une notification → composer pré-rempli → preview → envoi', async ({ page }) => {
  const previewBodies: unknown[] = []
  const sendBodies: unknown[] = []
  const active = { ...userDetail, status: 'ACTIVE', deletionRequestedAt: null, deletionScheduledFor: undefined }
  await page.route('**/api/v1/admin/users**', (route) => {
    const req = route.request()
    if (req.method() === 'GET' && req.url().includes(`/users/${USER_ID}`)) return route.fulfill({ json: active })
    return route.fulfill({ json: page1([active]) })
  })
  await page.route('**/api/v1/admin/notifications/**', (route) => {
    const req = route.request()
    const url = req.url()
    if (req.method() === 'POST' && url.includes('/broadcast/preview')) {
      previewBodies.push(req.postDataJSON())
      return route.fulfill({ json: { recipientCount: 1, targetUserName: 'Awa Diop' } })
    }
    if (req.method() === 'GET' && url.includes('/broadcasts')) return route.fulfill({ json: page1([]) })
    if (req.method() === 'POST' && url.includes('/broadcast')) {
      sendBodies.push(req.postDataJSON())
      return route.fulfill({ status: 202, json: { id: 'br1', title: 'Votre colis', body: 'x', targetType: 'USER', targetOrigin: null, targetDestination: null, targetUserId: USER_ID, recipientCount: 1, adminId: 'a1', createdAt: '2026-09-28T10:00:00Z' } })
    }
    return route.fulfill({ json: {} })
  })

  await page.goto('/users')
  await page.locator(`[data-test="row-${USER_ID}"]`).click()
  await page.locator('[data-test="action-notify"]').click()
  await expect(page).toHaveURL(new RegExp(`/communications\\?target=USER&userId=${USER_ID}`))
  await expect(page.locator('[data-test="broadcast-target"]')).toHaveValue('USER')
  await expect(page.locator('[data-test="broadcast-user-selected"]')).toContainText('Awa Diop')

  await page.locator('[data-test="broadcast-title"]').fill('Votre colis')
  await page.locator('[data-test="broadcast-body"]').fill('Merci de confirmer votre adresse de remise.')
  await page.locator('[data-test="broadcast-preview"]').click()
  await expect(page.locator('[data-test="broadcast-target-user-name"]')).toHaveText('Destinataire : Awa Diop')
  await page.locator('[data-test="broadcast-send"]').click()
  await page.locator('[data-test="confirm"]').click()
  await expect.poll(() => sendBodies.length).toBe(1)
  expect(previewBodies[0]).toEqual({ type: 'USER', userId: USER_ID })
  expect(sendBodies[0]).toEqual({ title: 'Votre colis', body: 'Merci de confirmer votre adresse de remise.', target: { type: 'USER', userId: USER_ID } })
})

test('composer : recherche d’un utilisateur par nom, puis 422 non joignable', async ({ page }) => {
  const active = { ...userDetail, status: 'ACTIVE' }
  await page.route('**/api/v1/admin/users**', (route) => route.fulfill({ json: page1([active]) }))
  await page.route('**/api/v1/admin/notifications/**', (route) => {
    const req = route.request()
    if (req.method() === 'POST' && req.url().includes('/broadcast/preview')) {
      return route.fulfill({ status: 422, contentType: 'application/problem+json', body: JSON.stringify({ status: 422, code: 'broadcast-user-not-reachable', detail: 'Cet utilisateur n’a aucun appareil joignable.' }) })
    }
    return route.fulfill({ json: page1([{ id: 'br0', title: 'Ancienne', body: 'x', targetType: 'ALL', targetOrigin: null, targetDestination: null, targetUserId: null, recipientCount: 5, adminId: 'a1', createdAt: '2026-08-01T09:00:00Z' }]) })
  })
  await page.goto('/communications')
  await expect(page.locator('[data-test="broadcast-row-br0"]')).toBeVisible()
  await page.locator('[data-test="broadcast-target"]').selectOption('USER')
  await page.locator('[data-test="broadcast-user-search"]').fill('awa')
  await page.locator(`[data-test="broadcast-user-result-${USER_ID}"]`).click()
  await expect(page.locator('[data-test="broadcast-user-selected"]')).toContainText('Awa Diop')
  await page.locator('[data-test="broadcast-preview"]').click()
  await expect(page.locator('[data-test="broadcast-error"]')).toHaveText('Cet utilisateur n’a aucun appareil joignable.')
  await expect(page.locator('[data-test="broadcast-send"]')).toBeDisabled()
})

test('motif refusé par le back (422 violations) : refus dans le dialogue, saisie conservée', async ({ page }) => {
  await page.route('**/api/v1/admin/reports**', (route) => {
    const req = route.request()
    if (req.method() === 'POST' && req.url().includes('/restore')) {
      return route.fulfill({
        status: 422, contentType: 'application/problem+json',
        body: JSON.stringify({ status: 422, title: 'Bad Request', detail: 'Validation failed', violations: [{ field: 'reason', message: 'la taille doit être comprise entre 10 et 500' }] }),
      })
    }
    if (req.url().includes('deleted=true')) return route.fulfill({ json: page1([report('r1', true)]) })
    return route.fulfill({ json: page1([report('r9', false)]) })
  })
  await page.goto('/signalements')
  await expect(page.locator('[data-test="report-row-r9"]')).toBeVisible()
  await page.locator('[data-test="report-filter-deleted"]').click()
  await expect(page.locator('[data-test="report-search"]')).toHaveAttribute('placeholder', 'Rechercher (texte, écran, motif)')
  await page.locator('[data-test="restore-r1"]').click()
  await page.locator('[data-test="restore-reason"]').fill(REASON)
  await page.locator('[data-test="restore-confirm"]').click()
  await expect(page.locator('[data-test="restore-error"]')).toHaveText('la taille doit être comprise entre 10 et 500')
  await expect(page.locator('[data-test="restore-reason"]')).toHaveValue(REASON)
})

test('avis supplanté (409 rating-superseded) : message clair, plus de bouton', async ({ page }) => {
  const rating = {
    id: 'rt1', bidId: 'b1', raterName: 'Awa', ratedName: 'Karim', score: 2, comment: 'bof', flagged: false,
    excluded: false, excludedReason: null, createdAt: '2026-06-01T10:00:00Z', deletedAt: '2026-09-20T10:00:00Z',
  }
  await page.route('**/api/v1/admin/reports**', (route) => route.fulfill({ json: page1([report('r9', false)]) }))
  await page.route('**/api/v1/admin/ratings**', (route) => {
    const req = route.request()
    if (req.method() === 'POST') {
      return route.fulfill({ status: 409, contentType: 'application/problem+json', body: JSON.stringify({ status: 409, code: 'rating-superseded', detail: 'Rating superseded' }) })
    }
    return route.fulfill({ json: page1(req.url().includes('deleted=true') ? [rating] : []) })
  })
  await page.goto('/signalements')
  await expect(page.locator('[data-test="report-row-r9"]')).toBeVisible()
  await page.locator('[data-test="tab-ratings"]').click()
  await page.locator('[data-test="ratings-deleted-only"]').check()
  await page.locator('[data-test="restore-rating-rt1"]').click()
  await page.locator('[data-test="restore-reason"]').fill(REASON)
  await page.locator('[data-test="restore-confirm"]').click()
  await expect(page.locator('[data-test="ratings-error"]')).toContainText('ne peut plus être restauré')
  await expect(page.locator('[data-test="restore-rating-rt1"]')).toHaveCount(0)
})

test('SUPPORT consulte les corbeilles sans pouvoir restaurer avis ni signalements', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __yadonyAuthSeed: unknown }).__yadonyAuthSeed = { id: 's1', email: 'support@yadony.com', role: 'SUPPORT', status: 'ACTIVE', mustChangePassword: false, permissionOverrides: {} }
  })
  await page.route('**/api/v1/admin/reports**', (route) =>
    route.fulfill({ json: page1([route.request().url().includes('deleted=true') ? report('r1', true) : report('r9', false)]) }))
  await page.route('**/api/v1/admin/ratings**', (route) =>
    route.fulfill({ json: page1(route.request().url().includes('deleted=true')
      ? [{ id: 'rt1', bidId: 'b1', raterName: 'Awa', ratedName: 'Karim', score: 2, comment: 'bof', flagged: false, excluded: false, excludedReason: null, createdAt: '2026-06-01T10:00:00Z', deletedAt: '2026-09-20T10:00:00Z' }]
      : []) }))
  await page.goto('/signalements')
  await expect(page.locator('[data-test="report-row-r9"]')).toBeVisible()
  await page.locator('[data-test="report-filter-deleted"]').click()
  await expect(page.locator('[data-test="report-deleted-info-r1"]')).toBeVisible()
  await expect(page.locator('[data-test="restore-r1"]')).toHaveCount(0)
  await page.locator('[data-test="tab-ratings"]').click()
  await page.locator('[data-test="ratings-deleted-only"]').check()
  await expect(page.locator('[data-test="rating-deleted-info-rt1"]')).toBeVisible()
  await expect(page.locator('[data-test="restore-rating-rt1"]')).toHaveCount(0)
})

test('preview : compte non joignable, avertissement et envoi bloqué', async ({ page }) => {
  await page.route('**/api/v1/admin/users**', (route) => route.fulfill({ json: { ...userDetail } }))
  await page.route('**/api/v1/admin/notifications/**', (route) => {
    const req = route.request()
    if (req.method() === 'POST' && req.url().includes('/broadcast/preview')) {
      return route.fulfill({ json: { recipientCount: 0, targetUserName: 'Awa Diop', targetUserReachable: false } })
    }
    return route.fulfill({ json: page1([{ id: 'br0', title: 'Ancienne', body: 'x', targetType: 'ALL', targetOrigin: null, targetDestination: null, targetUserId: null, recipientCount: 5, adminId: 'a1', createdAt: '2026-08-01T09:00:00Z' }]) })
  })
  await page.goto(`/communications?target=USER&userId=${USER_ID}`)
  await expect(page.locator('[data-test="broadcast-row-br0"]')).toBeVisible()
  await expect(page.locator('[data-test="broadcast-user-selected"]')).toContainText('Awa Diop')
  await page.locator('[data-test="broadcast-title"]').fill('Titre')
  await page.locator('[data-test="broadcast-body"]').fill('Corps du message')
  await page.locator('[data-test="broadcast-preview"]').click()
  await expect(page.locator('[data-test="broadcast-user-unreachable"]')).toHaveText('Ce compte ne recevra pas la notification.')
  await expect(page.locator('[data-test="broadcast-send"]')).toBeDisabled()
})
