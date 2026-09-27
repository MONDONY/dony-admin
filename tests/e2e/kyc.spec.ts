import { test, expect, type Page } from '@playwright/test'

const ADMIN = { id: 'a1', email: 'admin.1@yadony.com', role: 'ADMIN', status: 'ACTIVE', mustChangePassword: false, permissionOverrides: {} }
const SUPPORT = { ...ADMIN, id: 'a2', email: 'support@yadony.com', role: 'SUPPORT' }

const ROW = {
  userId: 'u1', userName: 'Awa Diop', userPhone: '+221 77 *** ** 12', provider: 'DIDIT', kycStatus: 'IN_REVIEW',
  recordStatus: 'PENDING', submittedAt: '2026-09-24T10:00:00Z', waitingHours: 60,
}
const VERIFIED_ROW = { ...ROW, userId: 'u2', userName: 'Moussa Sow', kycStatus: 'VERIFIED', waitingHours: 2 }
const DETAIL_PENDING = {
  userId: 'u1', kycStatus: 'PENDING', verificationStatus: 'PENDING', stripeSessionId: 'sess_1', stripeStatus: 'In Review',
  stripeUnavailable: false, provider: 'DIDIT', providerSessionUrl: 'https://business.didit.me/session/sess_1',
  history: [{ action: 'SESSION_STARTED', at: '2026-09-24T10:00:00Z', actorKind: 'USER' }],
}
const DETAIL_VERIFIED = { ...DETAIL_PENDING, userId: 'u2', kycStatus: 'VERIFIED', verificationStatus: 'VERIFIED' }
const APPROVED = {
  ...DETAIL_PENDING, kycStatus: 'VERIFIED', verificationStatus: 'VERIFIED', decisionKind: 'APPROVED',
  decidedAt: '2026-09-27T10:00:00Z', decidedByAdminEmail: 'admin.1@yadony.com', decisionReason: 'Pièces contrôlées chez Didit, conformes.',
}
const page1 = (content: unknown[]) => ({ content, totalElements: content.length, totalPages: 1, number: 0, size: 20 })
const problem = (status: number, code: string | null, detail: string) => ({
  status, contentType: 'application/problem+json',
  body: JSON.stringify({ type: 'about:blank', title: 'Erreur', status, detail, ...(code ? { code } : {}) }),
})

interface State { posts: { path: string; body: unknown }[]; decided: boolean }

async function mockBackend(
  page: Page,
  opts: { admin?: typeof ADMIN; queueMissing?: boolean; approveConflict?: boolean } = {},
): Promise<State> {
  const state: State = { posts: [], decided: false }
  await page.addInitScript((u) => {
    ;(window as unknown as { __yadonyAuthSeed: typeof u }).__yadonyAuthSeed = u
  }, opts.admin ?? ADMIN)
  await page.route('**/api/v1/admin/kyc/verifications**', (route) => {
    if (opts.queueMissing) return route.fulfill(problem(404, null, 'No endpoint matches this path'))
    const status = new URL(route.request().url()).searchParams.get('status')
    if (status === 'VERIFIED') return route.fulfill({ json: page1([VERIFIED_ROW]) })
    return route.fulfill({ json: page1(state.decided ? [] : [ROW]) })
  })
  await page.route('**/api/v1/admin/users/*/kyc**', (route) => {
    const req = route.request()
    const url = new URL(req.url())
    if (req.method() === 'POST') {
      const body = req.postDataJSON()
      state.posts.push({ path: url.pathname, body })
      if (url.pathname.endsWith('/u1/kyc/approve')) {
        if (opts.approveConflict) return route.fulfill(problem(409, 'kyc-already-verified', 'Cette identité est déjà vérifiée.'))
        state.decided = true
        return route.fulfill({ json: APPROVED })
      }
      if (url.pathname.endsWith('/u1/kyc/reject')) {
        state.decided = true
        return route.fulfill({ json: { ...DETAIL_PENDING, kycStatus: 'REJECTED', verificationStatus: 'REJECTED', rejectionCode: body.code, decisionKind: 'REJECTED', decidedByAdminEmail: 'admin.1@yadony.com', decidedAt: '2026-09-27T10:00:00Z', decisionReason: body.reason } })
      }
      if (url.pathname.endsWith('/u2/kyc/revoke')) {
        return route.fulfill({ json: { ...DETAIL_VERIFIED, kycStatus: 'REJECTED', verificationStatus: 'REJECTED', decisionKind: 'REVOKED', decidedByAdminEmail: 'admin.1@yadony.com', decidedAt: '2026-09-27T10:00:00Z', decisionReason: body.reason } })
      }
    }
    if (url.pathname.endsWith('/u2/kyc')) return route.fulfill({ json: DETAIL_VERIFIED })
    return route.fulfill({ json: DETAIL_PENDING })
  })
  return state
}

async function openRow(page: Page, id = 'u1') {
  await page.locator(`[data-test="kyc-row-${id}"]`).click()
  await expect(page.locator('[data-test="kyc-detail"]')).toBeVisible()
}

test('file puis détail puis validation de l’identité', async ({ page }) => {
  const state = await mockBackend(page)
  await page.goto('/kyc')
  await expect(page.locator('[data-test="kyc-tab-IN_REVIEW"]')).toHaveAttribute('aria-selected', 'true')
  const waiting = page.locator('[data-test="kyc-waiting-u1"]')
  await expect(waiting).toHaveText('2 j 12 h')
  await expect(waiting).toHaveAttribute('data-overdue', 'true')

  await openRow(page)
  const link = page.locator('[data-test="kyc-provider-link"]')
  await expect(link).toHaveAttribute('href', DETAIL_PENDING.providerSessionUrl)
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  await expect(page.locator('[data-test="kyc-revoke"]')).toHaveCount(0)

  await page.locator('[data-test="kyc-approve"]').click()
  await expect(page.locator('[data-test="kyc-approve-reminder"]')).toContainText('chez le fournisseur')
  await page.locator('[data-test="kyc-reason"]').fill('Pièces contrôlées chez Didit, conformes.')
  await expect(page.locator('[data-test="kyc-dialog-submit"]')).toBeDisabled()
  await page.locator('[data-test="kyc-checked"]').check()
  await page.locator('[data-test="kyc-dialog-submit"]').click()

  await expect(page.locator('[data-test="kyc-decision"]')).toContainText('Validée par un admin')
  await expect(page.locator('[data-test="kyc-decision-by"]')).toContainText('admin.1@yadony.com')
  await expect(page.locator('[data-test="kyc-revoke"]')).toBeVisible()
  expect(state.posts).toEqual([{ path: '/api/v1/admin/users/u1/kyc/approve', body: { reason: 'Pièces contrôlées chez Didit, conformes.' } }])
  // La file est relue : la ligne validée n'est plus « en attente ».
  await expect(page.locator('[data-test="kyc-row-u1"]')).toHaveCount(0)
})

test('refus avec un code du catalogue et motif interne', async ({ page }) => {
  const state = await mockBackend(page)
  await page.goto('/kyc')
  await openRow(page)
  await page.locator('[data-test="kyc-reject"]').click()
  await page.locator('[data-test="kyc-code"]').selectOption('document_expired')
  await expect(page.locator('[data-test="kyc-code-user-message"]')).toContainText('expirée')
  await page.locator('[data-test="kyc-reason"]').fill('Passeport expiré depuis 2024')
  await page.locator('[data-test="kyc-dialog-submit"]').click()
  await expect(page.locator('[data-test="kyc-decision"]')).toContainText('Refusée par un admin')
  await expect(page.locator('[data-test="kyc-detail-rejection"]')).toContainText('Document expiré')
  expect(state.posts[0]).toEqual({ path: '/api/v1/admin/users/u1/kyc/reject', body: { code: 'document_expired', reason: 'Passeport expiré depuis 2024' } })
})

test('révocation d’une identité validée avec ressaisie du nom', async ({ page }) => {
  const state = await mockBackend(page)
  await page.goto('/kyc')
  // Attendre la file chargée côté client : un clic avant l'hydratation serait perdu.
  await expect(page.locator('[data-test="kyc-row-u1"]')).toBeVisible()
  await page.locator('[data-test="kyc-tab-VERIFIED"]').click()
  await openRow(page, 'u2')
  await expect(page.locator('[data-test="kyc-approve"]')).toHaveCount(0)
  await page.locator('[data-test="kyc-revoke"]').click()
  await expect(page.locator('[data-test="kyc-revoke-warning"]')).toContainText('ne sont pas annulés')
  await page.locator('[data-test="kyc-code"]').selectOption('suspected_fraud')
  await page.locator('[data-test="kyc-reason"]').fill('Fraude confirmée par le fournisseur après contrôle.')
  await page.locator('[data-test="kyc-confirm-name"]').fill('Moussa')
  await expect(page.locator('[data-test="kyc-dialog-submit"]')).toBeDisabled()
  await page.locator('[data-test="kyc-confirm-name"]').fill('Moussa Sow')
  await page.locator('[data-test="kyc-dialog-submit"]').click()
  await expect(page.locator('[data-test="kyc-decision"]')).toContainText('Révoquée par un admin')
  expect(state.posts[0]).toEqual({
    path: '/api/v1/admin/users/u2/kyc/revoke',
    body: { code: 'suspected_fraud', reason: 'Fraude confirmée par le fournisseur après contrôle.' },
  })
})

test('un 409 du back reste affiché dans le dialogue', async ({ page }) => {
  await mockBackend(page, { approveConflict: true })
  await page.goto('/kyc')
  await openRow(page)
  await page.locator('[data-test="kyc-approve"]').click()
  await page.locator('[data-test="kyc-checked"]').check()
  await page.locator('[data-test="kyc-reason"]').fill('Pièces contrôlées chez Didit, conformes.')
  await page.locator('[data-test="kyc-dialog-submit"]').click()
  await expect(page.locator('[data-test="kyc-dialog-error"]')).toHaveText('Cette identité est déjà vérifiée.')
  await expect(page.locator('[data-test="kyc-dialog"]')).toBeVisible()
})

test('ancien back sans la file : mention discrète', async ({ page }) => {
  await mockBackend(page, { queueMissing: true })
  await page.goto('/kyc')
  await expect(page.locator('[data-test="kyc-unavailable"]')).toHaveText('File des vérifications indisponible pour le moment')
  await expect(page.locator('[data-test="kyc-error"]')).toHaveCount(0)
})

test('SUPPORT consulte la file sans aucun bouton de décision', async ({ page }) => {
  await mockBackend(page, { admin: SUPPORT })
  await page.goto('/kyc')
  await openRow(page)
  await expect(page.locator('[data-test="kyc-history"]')).toContainText('Vérification démarrée')
  await expect(page.locator('[data-test="action-reset-kyc"]')).toBeVisible()
  await expect(page.locator('[data-test="kyc-approve"]')).toHaveCount(0)
  await expect(page.locator('[data-test="kyc-reject"]')).toHaveCount(0)
  await expect(page.locator('[data-test="kyc-revoke"]')).toHaveCount(0)
})
