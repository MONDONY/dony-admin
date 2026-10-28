/**
 * Page /kyc : poste de traitement (file, dossier, décision), raccourcis, liens profonds et tolérance de l'ancien back.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { reactive } from 'vue'
import { seedAuth } from '~/tests/helpers/auth'

vi.stubGlobal('definePageMeta', vi.fn())
const replaceMock = vi.fn()
vi.stubGlobal('useRouter', () => ({ replace: replaceMock }))
let query: Record<string, string> = {}
vi.stubGlobal('useRoute', () => ({ meta: {}, query }))

const kyc = vi.hoisted(() => ({ listVerifications: vi.fn(), listRejectionCodes: vi.fn() }))
vi.mock('@/features/kyc/services/kycService', () => ({ kycService: kyc }))
const users = vi.hoisted(() => ({ getKyc: vi.fn(), resetKyc: vi.fn(), approveKyc: vi.fn(), rejectKyc: vi.fn(), revokeKyc: vi.fn() }))
vi.mock('@/features/users/services/usersService', () => ({ usersService: users }))

const ROW = {
  userId: 'u1', userName: 'Awa Diop', userPhone: '+221 77 *** ** 12', provider: 'DIDIT', kycStatus: 'IN_REVIEW',
  submittedAt: '2026-09-25T10:00:00Z', waitingHours: 50,
}
const ROW2 = { ...ROW, userId: '7a2e4b1c-0000-4a00-8000-0000000000a2', userName: 'Moussa Traoré', waitingHours: 3 }
const DETAIL = {
  userId: 'u1', kycStatus: 'PENDING', verificationStatus: 'PENDING', stripeSessionId: 'sess_1', stripeUnavailable: false,
  provider: 'DIDIT', history: [],
}
const PAGE = { content: [ROW], totalElements: 1, totalPages: 1, number: 0, size: 20 }
const PAGE2 = { content: [ROW2, ROW], totalElements: 2, totalPages: 1, number: 0, size: 20 }

const mounted: { unmount: () => void }[] = []
async function mountPage() {
  const mod = await import('@/pages/kyc/index.vue')
  const w = mount(mod.default, { global: { stubs: { NuxtLink: { props: ['to'], template: '<a :data-to="to"><slot /></a>' } } } })
  mounted.push(w)
  await flushPromises()
  return w
}
const press = (key: string) => window.dispatchEvent(new KeyboardEvent('keydown', { key }))

describe('/kyc', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    seedAuth('ADMIN')
    query = {}
    kyc.listVerifications.mockResolvedValue(PAGE)
    kyc.listRejectionCodes.mockResolvedValue(['document_expired', 'other'])
    users.getKyc.mockImplementation((id: string) => Promise.resolve({ ...DETAIL, userId: id }))
  })
  // Le poste écoute le clavier : un montage oublié répondrait aux touches des tests suivants.
  afterEach(() => { while (mounted.length) mounted.pop()!.unmount() })

  it('charge la file « À décider » et ouvre tout de suite le premier dossier, sans toucher à l’URL', async () => {
    const w = await mountPage()
    expect(kyc.listVerifications.mock.calls[0][0].status).toBe('IN_REVIEW')
    expect(w.find('[data-test="kyc-total"]').text()).toContain('1')
    expect(users.getKyc).toHaveBeenCalledWith('u1')
    expect(w.find('[data-test="kyc-case-title"]').text()).toBe('Awa Diop')
    expect(w.find('[data-test="kyc-row-u1"]').attributes('data-selected')).toBe('true')
    expect(replaceMock).not.toHaveBeenCalled()
  })

  it('un clic sur un autre dossier l’ouvre et l’écrit dans l’URL', async () => {
    kyc.listVerifications.mockResolvedValue(PAGE2)
    const w = await mountPage()
    // en retard d'abord : u1 (50 h) avant 7a2e4b1c-0000-4a00-8000-0000000000a2 (3 h)
    expect(w.find('[data-test="kyc-case-title"]').text()).toBe('Awa Diop')
    await w.find('[data-test="open-7a2e4b1c-0000-4a00-8000-0000000000a2"]').trigger('click')
    await flushPromises()
    expect(users.getKyc).toHaveBeenLastCalledWith('7a2e4b1c-0000-4a00-8000-0000000000a2')
    expect(w.find('[data-test="kyc-case-title"]').text()).toBe('Moussa Traoré')
    expect(replaceMock).toHaveBeenLastCalledWith({ query: { open: '7a2e4b1c-0000-4a00-8000-0000000000a2' } })
    // recliquer le dossier ouvert ne recharge rien
    const calls = users.getKyc.mock.calls.length
    await w.find('[data-test="open-7a2e4b1c-0000-4a00-8000-0000000000a2"]').trigger('click')
    expect(users.getKyc.mock.calls.length).toBe(calls)
  })

  it('synthèse : total, retards et plus longue attente ; masquée hors de « À décider »', async () => {
    kyc.listVerifications.mockResolvedValue(PAGE2)
    const w = await mountPage()
    expect(w.find('[data-test="summary-total"]').text()).toBe('2')
    expect(w.find('[data-test="summary-overdue"]').text()).toBe('1')
    expect(w.find('[data-test="summary-longest"]').text()).toBe('2 j 2 h')
    await w.find('[data-test="kyc-tab-VERIFIED"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="kyc-summary"]').exists()).toBe(false)
  })

  it('J et K parcourent la file, V ouvre la validation', async () => {
    kyc.listVerifications.mockResolvedValue(PAGE2)
    const w = await mountPage()
    press('j')
    await flushPromises()
    expect(users.getKyc).toHaveBeenLastCalledWith('7a2e4b1c-0000-4a00-8000-0000000000a2')
    press('k')
    await flushPromises()
    expect(users.getKyc).toHaveBeenLastCalledWith('u1')
    press('v')
    await flushPromises()
    expect(w.find('[data-test="kyc-reason"]').exists()).toBe(true)
    expect(w.find('[data-test="kyc-dialog-submit"]').text()).toContain('Valider')
  })

  it('R ouvre le refus ; fenêtre ouverte, J ne change plus de dossier', async () => {
    kyc.listVerifications.mockResolvedValue(PAGE2)
    const w = await mountPage()
    press('r')
    await flushPromises()
    expect(w.find('[data-test="kyc-code"]').exists()).toBe(true)
    const calls = users.getKyc.mock.calls.length
    press('j')
    await flushPromises()
    expect(users.getKyc.mock.calls.length).toBe(calls)
  })

  it('V sans pouvoir décider (SUPPORT) ne fait rien', async () => {
    seedAuth('SUPPORT')
    const w = await mountPage()
    press('v')
    await flushPromises()
    expect(w.find('[data-test="kyc-reason"]').exists()).toBe(false)
  })

  it('un ?open= qui n’est pas un UUID est ignoré : le premier dossier s’ouvre, aucun appel sur ce segment', async () => {
    query = { open: '../../admin/users/x' }
    const w = await mountPage()
    expect(users.getKyc).toHaveBeenCalledTimes(1)
    expect(users.getKyc).toHaveBeenCalledWith('u1')
    expect(w.find('[data-test="kyc-case-title"]').text()).toBe('Awa Diop')
  })

  it('une réponse tardive d’un autre dossier n’écrase pas celui qui est ouvert, ni ne le rend décidable', async () => {
    kyc.listVerifications.mockResolvedValue(PAGE2)
    const w = await mountPage()
    // eslint-disable-next-line no-unused-vars -- paramètre d'un type de fonction, pas une variable
    let releaseSlow: (v: unknown) => void = () => {}
    users.getKyc.mockImplementationOnce(() => new Promise((r) => { releaseSlow = r }))
    await w.find('[data-test="open-7a2e4b1c-0000-4a00-8000-0000000000a2"]').trigger('click')
    // l'admin revient au premier dossier avant la fin de la lecture lente
    await w.find('[data-test="open-u1"]').trigger('click')
    await flushPromises()
    releaseSlow({ ...DETAIL, userId: '7a2e4b1c-0000-4a00-8000-0000000000a2' })
    await flushPromises()
    expect(w.find('[data-test="kyc-case-title"]').text()).toBe('Awa Diop')
    users.approveKyc.mockResolvedValue({ ...DETAIL, kycStatus: 'VERIFIED', verificationStatus: 'VERIFIED' })
    await w.find('[data-test="kyc-approve"]').trigger('click')
    await w.find('[data-test="kyc-checked"]').setValue(true)
    await w.find('[data-test="kyc-reason"]').setValue('Pièces contrôlées chez Didit, conformes.')
    await w.find('[data-test="kyc-dialog-submit"]').trigger('click')
    await flushPromises()
    expect(users.approveKyc).toHaveBeenCalledWith('u1', expect.any(String))
  })

  it('navigation interne vers ?open= (clic sur une notification) alors que la page est ouverte', async () => {
    kyc.listVerifications.mockResolvedValue(PAGE2)
    const route = reactive({ meta: {}, query: {} as Record<string, string> })
    vi.stubGlobal('useRoute', () => route)
    try {
      await mountPage()
      expect(users.getKyc).toHaveBeenCalledTimes(1)
      route.query = { status: 'IN_REVIEW', open: '7a2e4b1c-0000-4a00-8000-0000000000a2' }
      await flushPromises()
      expect(users.getKyc).toHaveBeenLastCalledWith('7a2e4b1c-0000-4a00-8000-0000000000a2')
      expect(users.getKyc).toHaveBeenCalledTimes(2)
      // même id : rien à recharger
      route.query = { open: '7a2e4b1c-0000-4a00-8000-0000000000a2' }
      await flushPromises()
      expect(users.getKyc).toHaveBeenCalledTimes(2)
    } finally {
      vi.stubGlobal('useRoute', () => ({ meta: {}, query }))
    }
  })

  it('lien profond ?status=REJECTED&open=7a2e4b1c-0000-4a00-8000-0000000000c9 : ouvre ce dossier, pas le premier de la file', async () => {
    query = { status: 'REJECTED', open: '7a2e4b1c-0000-4a00-8000-0000000000c9' }
    const w = await mountPage()
    expect(kyc.listVerifications.mock.calls[0][0].status).toBe('REJECTED')
    expect(users.getKyc).toHaveBeenCalledTimes(1)
    expect(users.getKyc).toHaveBeenCalledWith('7a2e4b1c-0000-4a00-8000-0000000000c9')
    expect(w.find('[data-test="kyc-case"]').exists()).toBe(true)
  })

  it('un statut inconnu dans l’URL retombe sur la file par défaut', async () => {
    query = { status: 'N_IMPORTE' }
    await mountPage()
    expect(kyc.listVerifications.mock.calls[0][0].status).toBe('IN_REVIEW')
  })

  it('changer d’onglet ouvre le premier dossier de la nouvelle file et écrit le statut', async () => {
    kyc.listVerifications.mockResolvedValueOnce(PAGE).mockResolvedValue({ ...PAGE, content: [ROW2] })
    const w = await mountPage()
    await w.find('[data-test="kyc-tab-REJECTED"]').trigger('click')
    await flushPromises()
    expect(kyc.listVerifications.mock.calls[1][0].status).toBe('REJECTED')
    expect(users.getKyc).toHaveBeenLastCalledWith('7a2e4b1c-0000-4a00-8000-0000000000a2')
    expect(replaceMock).toHaveBeenLastCalledWith({ query: { status: 'REJECTED', open: '7a2e4b1c-0000-4a00-8000-0000000000a2' } })
  })

  it('onglet sans dossier : rien ne reste ouvert', async () => {
    kyc.listVerifications.mockResolvedValueOnce(PAGE).mockResolvedValue({ ...PAGE, content: [], totalElements: 0 })
    const w = await mountPage()
    await w.find('[data-test="kyc-tab-VERIFIED"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="kyc-case-empty"]').exists()).toBe(true)
    expect(w.find('[data-test="kyc-actions"]').exists()).toBe(false)
    expect(replaceMock).toHaveBeenLastCalledWith({ query: { status: 'VERIFIED' } })
  })

  it('après une décision, le dossier est mis à jour, reste affiché et la file relue', async () => {
    users.approveKyc.mockResolvedValue({ ...DETAIL, kycStatus: 'VERIFIED', verificationStatus: 'VERIFIED', decisionKind: 'APPROVED' })
    const w = await mountPage()
    await w.find('[data-test="kyc-approve"]').trigger('click')
    await w.find('[data-test="kyc-checked"]').setValue(true)
    await w.find('[data-test="kyc-reason"]').setValue('Pièces contrôlées chez Didit, conformes.')
    await w.find('[data-test="kyc-dialog-submit"]').trigger('click')
    await flushPromises()
    expect(kyc.listVerifications).toHaveBeenCalledTimes(2)
    expect(w.find('[data-test="kyc-decision"]').text()).toContain('Validée par un admin')
    expect(w.find('[data-test="kyc-revoke"]').exists()).toBe(true)
    expect(w.find('[data-test="kyc-case-title"]').text()).toBe('Awa Diop')
    // le statut du dossier suit la décision, pas l'instantané de la file
    expect(w.find('[data-test="kyc-detail-status"]').text()).toContain('Validée')
  })

  it('un conflit relit le dossier sans le vider', async () => {
    users.rejectKyc.mockRejectedValue({ statusCode: 409, data: { code: 'kyc-already-verified', detail: 'Déjà vérifiée.' } })
    const w = await mountPage()
    users.getKyc.mockImplementation((id: string) => Promise.resolve({ ...DETAIL, userId: id, kycStatus: 'VERIFIED', verificationStatus: 'VERIFIED' }))
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
    await w.find('[data-test="action-reset-kyc"]').trigger('click')
    await w.find('[data-test="reason"]').setValue('Document illisible')
    await w.find('[data-test="confirm"]').trigger('click')
    await flushPromises()
    expect(users.resetKyc).toHaveBeenCalledWith('u1', 'Document illisible')
    expect(kyc.listVerifications).toHaveBeenCalledTimes(2)
  })

  it('une réinitialisation refusée s’affiche à côté des boutons, dossier conservé', async () => {
    users.resetKyc.mockRejectedValue({ statusCode: 422, data: { detail: 'Réinitialisation impossible' } })
    const w = await mountPage()
    await w.find('[data-test="action-reset-kyc"]').trigger('click')
    await w.find('[data-test="reason"]').setValue('Document illisible')
    await w.find('[data-test="confirm"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="kyc-reset-error"]').text()).toBe('Réinitialisation impossible')
    expect(w.find('[data-test="kyc-case"]').exists()).toBe(true)
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
    expect(w.find('[data-test="state-error"]').exists()).toBe(false)
  })

  it('erreur de la file affichée dans la file, avec Réessayer', async () => {
    kyc.listVerifications.mockRejectedValue({ statusCode: 500, data: { detail: 'Base indisponible' } })
    const w = await mountPage()
    expect(w.find('[data-test="state-error"]').text()).toContain('Base indisponible')
    kyc.listVerifications.mockResolvedValue(PAGE)
    await w.find('[data-test="state-retry"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="kyc-row-u1"]').exists()).toBe(true)
  })

  it('lien vers la fiche utilisateur', async () => {
    const w = await mountPage()
    expect(w.find('[data-test="kyc-user-link"]').attributes('data-to')).toBe('/users?open=u1')
  })

  it('SUPPORT consulte le dossier sans bouton de décision', async () => {
    seedAuth('SUPPORT')
    const w = await mountPage()
    expect(w.find('[data-test="kyc-case"]').exists()).toBe(true)
    expect(w.find('[data-test="kyc-approve"]').exists()).toBe(false)
    expect(w.find('[data-test="kyc-reject"]').exists()).toBe(false)
  })
})
