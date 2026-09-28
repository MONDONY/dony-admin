/**
 * Page /kyc : file des vérifications, fiche latérale, décisions et tolérance de l'ancien back.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { reactive } from 'vue'
import { seedAuth } from '~/tests/helpers/auth'

vi.stubGlobal('definePageMeta', vi.fn())
const replaceMock = vi.fn()
vi.stubGlobal('useRouter', () => ({ replace: replaceMock }))
let query: Record<string, string> = {}
vi.stubGlobal('useRoute', () => ({ meta: {}, query }))

const kyc = vi.hoisted(() => ({ listVerifications: vi.fn() }))
vi.mock('@/features/kyc/services/kycService', () => ({ kycService: kyc }))
const users = vi.hoisted(() => ({ getKyc: vi.fn(), resetKyc: vi.fn(), approveKyc: vi.fn(), rejectKyc: vi.fn(), revokeKyc: vi.fn() }))
vi.mock('@/features/users/services/usersService', () => ({ usersService: users }))

const ROW = {
  userId: 'u1', userName: 'Awa Diop', userPhone: '+221 77 *** ** 12', provider: 'DIDIT', kycStatus: 'IN_REVIEW',
  submittedAt: '2026-09-25T10:00:00Z', waitingHours: 50,
}
const DETAIL = {
  userId: 'u1', kycStatus: 'PENDING', verificationStatus: 'PENDING', stripeSessionId: 'sess_1', stripeUnavailable: false,
  provider: 'DIDIT', history: [],
}
const PAGE = { content: [ROW], totalElements: 1, totalPages: 1, number: 0, size: 20 }

async function mountPage() {
  const mod = await import('@/pages/kyc/index.vue')
  const w = mount(mod.default, { global: { stubs: { NuxtLink: { props: ['to'], template: '<a><slot /></a>' } } } })
  await flushPromises()
  return w
}

describe('/kyc', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    seedAuth('ADMIN')
    query = {}
    kyc.listVerifications.mockResolvedValue(PAGE)
    users.getKyc.mockResolvedValue(DETAIL)
  })

  it('charge la file « En attente de décision » et ouvre la fiche au clic', async () => {
    const w = await mountPage()
    expect(kyc.listVerifications.mock.calls[0][0].status).toBe('IN_REVIEW')
    expect(w.find('[data-test="kyc-total"]').text()).toContain('1')
    await w.find('[data-test="kyc-row-u1"]').trigger('click')
    await flushPromises()
    expect(users.getKyc).toHaveBeenCalledWith('u1')
    expect(w.find('[data-test="kyc-detail"]').exists()).toBe(true)
    expect(replaceMock).toHaveBeenLastCalledWith({ query: { open: 'u1' } })
    await w.find('[data-test="kyc-detail-close"]').trigger('click')
    expect(w.find('[data-test="kyc-detail"]').exists()).toBe(false)
    expect(replaceMock).toHaveBeenLastCalledWith({ query: {} })
  })

  it('navigation interne vers ?open= (clic sur une notification) alors que la page est ouverte', async () => {
    const route = reactive({ meta: {}, query: {} as Record<string, string> })
    vi.stubGlobal('useRoute', () => route)
    try {
      const w = await mountPage()
      expect(users.getKyc).not.toHaveBeenCalled()
      route.query = { status: 'IN_REVIEW', open: 'u1' }
      await flushPromises()
      expect(users.getKyc).toHaveBeenCalledWith('u1')
      expect(w.find('[data-test="kyc-detail"]').exists()).toBe(true)
      // l'URL réécrite par la page elle-même (même id) ne recharge rien
      route.query = { open: 'u1' }
      await flushPromises()
      expect(users.getKyc).toHaveBeenCalledTimes(1)
    } finally {
      vi.stubGlobal('useRoute', () => ({ meta: {}, query }))
    }
  })

  it('lien profond ?status=REJECTED&open=u1', async () => {
    query = { status: 'REJECTED', open: 'u1' }
    const w = await mountPage()
    expect(kyc.listVerifications.mock.calls[0][0].status).toBe('REJECTED')
    expect(users.getKyc).toHaveBeenCalledWith('u1')
    expect(w.find('[data-test="kyc-detail"]').exists()).toBe(true)
  })

  it('un statut inconnu dans l’URL retombe sur la file par défaut', async () => {
    query = { status: 'N_IMPORTE' }
    await mountPage()
    expect(kyc.listVerifications.mock.calls[0][0].status).toBe('IN_REVIEW')
  })

  it('après une décision, la fiche est mise à jour et la file relue', async () => {
    users.approveKyc.mockResolvedValue({ ...DETAIL, kycStatus: 'VERIFIED', verificationStatus: 'VERIFIED', decisionKind: 'APPROVED' })
    const w = await mountPage()
    await w.find('[data-test="kyc-row-u1"]').trigger('click')
    await flushPromises()
    await w.find('[data-test="kyc-approve"]').trigger('click')
    await w.find('[data-test="kyc-checked"]').setValue(true)
    await w.find('[data-test="kyc-reason"]').setValue('Pièces contrôlées chez Didit, conformes.')
    await w.find('[data-test="kyc-dialog-submit"]').trigger('click')
    await flushPromises()
    expect(kyc.listVerifications).toHaveBeenCalledTimes(2)
    expect(w.find('[data-test="kyc-decision"]').text()).toContain('Validée par un admin')
    expect(w.find('[data-test="kyc-revoke"]').exists()).toBe(true)
  })

  it('un conflit relit la fiche sans la vider', async () => {
    users.rejectKyc.mockRejectedValue({ statusCode: 409, data: { code: 'kyc-already-verified', detail: 'Déjà vérifiée.' } })
    const w = await mountPage()
    await w.find('[data-test="kyc-row-u1"]').trigger('click')
    await flushPromises()
    users.getKyc.mockResolvedValue({ ...DETAIL, kycStatus: 'VERIFIED', verificationStatus: 'VERIFIED' })
    await w.find('[data-test="kyc-reject"]').trigger('click')
    await w.find('[data-test="kyc-code"]').setValue('other')
    await w.find('[data-test="kyc-reason"]').setValue('Motif suffisamment long')
    await w.find('[data-test="kyc-dialog-submit"]').trigger('click')
    await flushPromises()
    expect(users.getKyc).toHaveBeenCalledTimes(2)
    expect(w.find('[data-test="kyc-dialog-error"]').text()).toBe('Déjà vérifiée.')
    expect(kyc.listVerifications).toHaveBeenCalledTimes(2)
  })

  it('réinitialiser relit la file', async () => {
    users.resetKyc.mockResolvedValue({ ...DETAIL, kycStatus: 'NOT_STARTED' })
    const w = await mountPage()
    await w.find('[data-test="kyc-row-u1"]').trigger('click')
    await flushPromises()
    await w.find('[data-test="action-reset-kyc"]').trigger('click')
    await w.find('[data-test="reason"]').setValue('Document illisible')
    await w.find('[data-test="confirm"]').trigger('click')
    await flushPromises()
    expect(users.resetKyc).toHaveBeenCalledWith('u1', 'Document illisible')
    expect(kyc.listVerifications).toHaveBeenCalledTimes(2)
  })

  it('filtre et pagination', async () => {
    kyc.listVerifications.mockResolvedValue({ ...PAGE, totalPages: 3 })
    const w = await mountPage()
    await w.find('[data-test="kyc-tab-VERIFIED"]').trigger('click')
    await flushPromises()
    expect(kyc.listVerifications.mock.calls[1][0].status).toBe('VERIFIED')
    await w.find('[data-test="next"]').trigger('click')
    await flushPromises()
    expect(kyc.listVerifications.mock.calls[2][1]).toBe(1)
  })

  it('ancien back : file indisponible', async () => {
    kyc.listVerifications.mockRejectedValue({ statusCode: 404, data: { detail: 'No endpoint matches this path' } })
    const w = await mountPage()
    expect(w.find('[data-test="kyc-unavailable"]').text()).toBe('File des vérifications indisponible pour le moment')
    expect(w.find('[data-test="kyc-error"]').exists()).toBe(false)
  })

  it('erreur de la file affichée', async () => {
    kyc.listVerifications.mockRejectedValue({ statusCode: 500, data: { detail: 'Base indisponible' } })
    const w = await mountPage()
    expect(w.find('[data-test="kyc-error"]').text()).toBe('Base indisponible')
  })

  it('SUPPORT consulte la fiche sans bouton de décision', async () => {
    seedAuth('SUPPORT')
    const w = await mountPage()
    await w.find('[data-test="kyc-row-u1"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="kyc-detail"]').exists()).toBe(true)
    expect(w.find('[data-test="kyc-approve"]').exists()).toBe(false)
    expect(w.find('[data-test="kyc-reject"]').exists()).toBe(false)
  })
})
