/**
 * Page /gp-pro : poste de traitement (demandes à examiner, titulaires à revoir), raccourcis,
 * liens profonds et tolérance de l'ancien back.
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

const svc = vi.hoisted(() => ({
  listApplications: vi.fn(), getApplication: vi.fn(), approve: vi.fn(), reject: vi.fn(), listReview: vi.fn(), dismissFlag: vi.fn(),
}))
vi.mock('@/features/gp-pro/services/gpProService', () => ({ gpProService: svc }))

const day = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()
const A1 = { applicationId: 'a1', userId: 'u1', displayName: 'Awa Diop', source: 'SIGNUP', travelFrequency: 'WEEKLY', documentCount: 0, createdAt: day(5) }
const A2 = { applicationId: '7a2e4b1c-0000-4a00-8000-0000000000a2', userId: 'u2', displayName: 'Moussa Ba', source: 'PROFILE', travelFrequency: 'MONTHLY', documentCount: 1, createdAt: day(1) }
const R1 = { userId: 'r1', displayName: 'Cheikh Sow', detectedAt: day(6), flags: [{ flagId: 'f1', reason: 'OPEN_DISPUTE' }, { flagId: 'f2', reason: 'LOW_RATING' }] }
const R2 = { userId: '7a2e4b1c-0000-4a00-8000-0000000000b2', displayName: 'Mariam Kane', detectedAt: day(2), flags: [{ flagId: 'f3', reason: 'INACTIVE' }] }
const page = (content: unknown[], totalPages = 1) => ({ content, totalElements: content.length, totalPages, number: 0, size: 20 })
const detailFor = (id: string, extra: Record<string, unknown> = {}) => ({
  applicationId: id, userId: id === 'a1' ? 'u1' : 'u2', displayName: id === 'a1' ? 'Awa Diop' : 'Moussa Ba', status: 'PENDING', source: 'SIGNUP',
  travelFrequency: 'WEEKLY', createdAt: day(5), kycStatus: 'VERIFIED', publishedTrips: 3, completedDeliveries: 2, averageRating: 4.7,
  openDisputes: 0, openReports: 0, documents: [], ...extra,
})

const mounted: { unmount: () => void }[] = []
async function mountPage() {
  const mod = await import('@/pages/gp-pro/index.vue')
  const w = mount(mod.default, { global: { stubs: { NuxtLink: { props: ['to'], template: '<a :data-to="to"><slot /></a>' } } } })
  mounted.push(w)
  await flushPromises()
  return w
}
const press = (key: string) => window.dispatchEvent(new KeyboardEvent('keydown', { key }))

describe('/gp-pro', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    seedAuth('ADMIN')
    query = {}
    svc.listApplications.mockResolvedValue(page([A2, A1]))
    svc.listReview.mockResolvedValue(page([R2, R1]))
    svc.getApplication.mockImplementation((id: string) => Promise.resolve(detailFor(id)))
  })
  // Le poste écoute le clavier : un montage oublié répondrait aux touches des tests suivants.
  afterEach(() => { while (mounted.length) mounted.pop()!.unmount() })

  it('lit les deux files, trie les plus anciennes d’abord et ouvre la première demande sans toucher à l’URL', async () => {
    const w = await mountPage()
    expect(svc.listApplications).toHaveBeenCalledTimes(1)
    expect(svc.listReview).toHaveBeenCalledTimes(1)
    expect(svc.getApplication).toHaveBeenCalledWith('a1')
    expect(w.find('[data-test="gp-pro-case-title"]').text()).toBe('Awa Diop')
    expect(w.find('[data-test="gp-pro-row-a1"]').attributes('data-selected')).toBe('true')
    expect(w.findAll('[data-test^="gp-pro-row-"]').map((r) => r.attributes('data-test'))).toEqual(['gp-pro-row-a1', 'gp-pro-row-7a2e4b1c-0000-4a00-8000-0000000000a2'])
    expect(replaceMock).not.toHaveBeenCalled()
  })

  it('synthèse et compteurs d’onglets viennent des deux files', async () => {
    const w = await mountPage()
    expect(w.find('[data-test="summary-applications"]').text()).toBe('2')
    expect(w.find('[data-test="summary-oldest"]').text()).toBe('5 j')
    expect(w.find('[data-test="summary-review"]').text()).toBe('2')
    expect(w.find('[data-test="gp-pro-tab-demandes"]').text()).toContain('2')
    expect(w.find('[data-test="gp-pro-tab-revue"]').text()).toContain('2')
  })

  it('un clic sur une autre demande l’ouvre et l’écrit dans l’URL', async () => {
    const w = await mountPage()
    await w.find('[data-test="open-7a2e4b1c-0000-4a00-8000-0000000000a2"]').trigger('click')
    await flushPromises()
    expect(svc.getApplication).toHaveBeenLastCalledWith('7a2e4b1c-0000-4a00-8000-0000000000a2')
    expect(w.find('[data-test="gp-pro-case-title"]').text()).toBe('Moussa Ba')
    expect(replaceMock).toHaveBeenLastCalledWith({ query: { open: '7a2e4b1c-0000-4a00-8000-0000000000a2' } })
    const calls = svc.getApplication.mock.calls.length
    await w.find('[data-test="open-7a2e4b1c-0000-4a00-8000-0000000000a2"]').trigger('click')
    expect(svc.getApplication.mock.calls.length).toBe(calls)
  })

  it('J et K parcourent la file, A ouvre l’acceptation, R le refus', async () => {
    const w = await mountPage()
    press('j')
    await flushPromises()
    expect(svc.getApplication).toHaveBeenLastCalledWith('7a2e4b1c-0000-4a00-8000-0000000000a2')
    press('k')
    await flushPromises()
    expect(svc.getApplication).toHaveBeenLastCalledWith('a1')
    press('a')
    await flushPromises()
    expect(w.find('[data-test="gp-pro-dialog-submit"]').text()).toBe('Accepter')
    const calls = svc.getApplication.mock.calls.length
    press('j')
    await flushPromises()
    expect(svc.getApplication.mock.calls.length).toBe(calls)
    await w.find('[data-test="gp-pro-dialog-cancel"]').trigger('click')
    press('r')
    await flushPromises()
    expect(w.find('[data-test="gp-pro-dialog-submit"]').text()).toBe('Refuser')
  })

  it('A sans identité vérifiée ne fait rien ; sans droit non plus', async () => {
    svc.getApplication.mockResolvedValue(detailFor('a1', { kycStatus: 'REJECTED' }))
    const w = await mountPage()
    press('a')
    await flushPromises()
    expect(w.find('[data-test="gp-pro-dialog"]').exists()).toBe(false)
    expect(w.find('[data-test="gp-pro-attention-kyc"]').exists()).toBe(true)
    seedAuth('SUPPORT')
    const w2 = await mountPage()
    press('a')
    await flushPromises()
    expect(w2.find('[data-test="gp-pro-dialog"]').exists()).toBe(false)
  })

  it('accepter : la demande est relue (statut accepté) et la file aussi, le dossier reste affiché', async () => {
    svc.approve.mockResolvedValue(undefined)
    const w = await mountPage()
    svc.getApplication.mockResolvedValue(detailFor('a1', { status: 'APPROVED' }))
    svc.listApplications.mockResolvedValue(page([A2]))
    await w.find('[data-test="gp-pro-approve"]').trigger('click')
    await w.find('[data-test="gp-pro-dialog-submit"]').trigger('click')
    await flushPromises()
    expect(svc.approve).toHaveBeenCalledWith('a1')
    expect(svc.listApplications).toHaveBeenCalledTimes(2)
    expect(w.find('[data-test="gp-pro-detail-status"]').text()).toContain('Acceptée')
    expect(w.find('[data-test="gp-pro-actions"]').exists()).toBe(false)
    expect(w.find('[data-test="gp-pro-case-title"]').text()).toBe('Awa Diop')
    expect(w.find('[data-test="gp-pro-row-a1"]').exists()).toBe(false)
  })

  it('un conflit à la décision relit la demande sans la vider', async () => {
    svc.reject.mockRejectedValue({ statusCode: 409, data: { code: 'gp-pro-application-not-pending' } })
    const w = await mountPage()
    await w.find('[data-test="gp-pro-reject"]').trigger('click')
    await w.find('[data-test="gp-pro-text"]').setValue('Plusieurs litiges récents')
    await w.find('[data-test="gp-pro-dialog-submit"]').trigger('click')
    await flushPromises()
    expect(svc.getApplication).toHaveBeenCalledTimes(2)
    expect(w.find('[data-test="gp-pro-dialog-error"]').text()).toContain('déjà été décidée')
    expect(w.find('[data-test="gp-pro-case"]').exists()).toBe(true)
  })

  it('onglet « À revoir » : relit la file, ouvre le premier titulaire, écrit tab dans l’URL', async () => {
    const w = await mountPage()
    await w.find('[data-test="gp-pro-tab-revue"]').trigger('click')
    await flushPromises()
    expect(svc.listReview).toHaveBeenCalledTimes(2)
    expect(w.find('[data-test="gp-pro-review-title"]').text()).toBe('Cheikh Sow')
    expect(w.find('[data-test="gp-pro-review-count"]').text()).toBe('2 alertes')
    expect(replaceMock).toHaveBeenLastCalledWith({ query: { tab: 'revue', open: 'r1' } })
    expect(w.find('[data-test="gp-pro-actions"]').exists()).toBe(false)
    expect(w.find('[data-test="gp-pro-review-remove-link"]').attributes('data-to')).toBe('/users?open=r1')
    // retour aux demandes
    await w.find('[data-test="gp-pro-tab-demandes"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="gp-pro-case-title"]').text()).toBe('Awa Diop')
    expect(replaceMock).toHaveBeenLastCalledWith({ query: { open: 'a1' } })
    // recliquer l'onglet actif ne recharge rien
    const calls = svc.listApplications.mock.calls.length
    await w.find('[data-test="gp-pro-tab-demandes"]').trigger('click')
    expect(svc.listApplications.mock.calls.length).toBe(calls)
  })

  it('A et R sont sans effet dans l’onglet « À revoir » ; J / K parcourent les titulaires', async () => {
    query = { tab: 'revue' }
    const w = await mountPage()
    expect(w.find('[data-test="gp-pro-review-title"]').text()).toBe('Cheikh Sow')
    press('a')
    press('r')
    await flushPromises()
    expect(w.find('[data-test="gp-pro-dialog"]').exists()).toBe(false)
    press('j')
    await flushPromises()
    expect(w.find('[data-test="gp-pro-review-title"]').text()).toBe('Mariam Kane')
    expect(svc.getApplication).not.toHaveBeenCalled()
  })

  it('écarter une alerte relit la file ; la dernière alerte passe au titulaire suivant', async () => {
    query = { tab: 'revue' }
    svc.dismissFlag.mockResolvedValue(undefined)
    const w = await mountPage()
    svc.listReview.mockResolvedValue(page([R2, { ...R1, flags: [R1.flags[1]] }]))
    await w.find('[data-test="gp-pro-dismiss-f1"]').trigger('click')
    await flushPromises()
    expect(svc.dismissFlag).toHaveBeenCalledWith('f1')
    expect(svc.listReview).toHaveBeenCalledTimes(2)
    expect(w.find('[data-test="gp-pro-review-count"]').text()).toBe('1 alerte')
    // dernière alerte : le titulaire quitte la file, le suivant s'ouvre
    svc.listReview.mockResolvedValue(page([R2]))
    await w.find('[data-test="gp-pro-dismiss-f2"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="gp-pro-review-title"]').text()).toBe('Mariam Kane')
  })

  it('dernière alerte de la dernière personne : plus rien d’ouvert', async () => {
    query = { tab: 'revue' }
    svc.listReview.mockResolvedValue(page([R2]))
    svc.dismissFlag.mockResolvedValue(undefined)
    const w = await mountPage()
    svc.listReview.mockResolvedValue(page([]))
    await w.find('[data-test="gp-pro-dismiss-f3"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="gp-pro-case-empty"]').exists()).toBe(true)
    expect(w.find('[data-test="gp-pro-review-empty"]').exists()).toBe(true)
  })

  it('alerte déjà close : message du back et file relue', async () => {
    query = { tab: 'revue' }
    svc.dismissFlag.mockRejectedValue({ statusCode: 409, data: { code: 'gp-pro-flag-resolved' } })
    const w = await mountPage()
    await w.find('[data-test="gp-pro-dismiss-f1"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="gp-pro-review-error"]').text()).toContain('déjà close')
    expect(svc.listReview).toHaveBeenCalledTimes(2)
  })

  it('lien profond ?open=7a2e4b1c-0000-4a00-8000-0000000000a2 : ouvre cette demande, pas la première', async () => {
    query = { open: '7a2e4b1c-0000-4a00-8000-0000000000a2' }
    const w = await mountPage()
    expect(svc.getApplication).toHaveBeenCalledTimes(1)
    expect(svc.getApplication).toHaveBeenCalledWith('7a2e4b1c-0000-4a00-8000-0000000000a2')
    expect(w.find('[data-test="gp-pro-case-title"]').text()).toBe('Moussa Ba')
  })

  it('lien profond vers un titulaire absent de la page : message, sans appel de demande', async () => {
    query = { tab: 'revue', open: '11111111-2222-4333-8444-555555555555' }
    const w = await mountPage()
    expect(w.find('[data-test="gp-pro-review-gone"]').exists()).toBe(true)
    expect(svc.getApplication).not.toHaveBeenCalled()
  })

  it('un ?open= qui n’est pas un UUID est ignoré : la première demande s’ouvre, aucun appel sur ce segment', async () => {
    query = { open: '../../admin/users/x' }
    const w = await mountPage()
    expect(svc.getApplication).toHaveBeenCalledTimes(1)
    expect(svc.getApplication).toHaveBeenCalledWith('a1')
    expect(w.find('[data-test="gp-pro-case-title"]').text()).toBe('Awa Diop')
  })

  it('une réponse tardive d’une autre demande n’écrase pas celle qui est ouverte, ni ne la rend décidable', async () => {
    const w = await mountPage()
    // eslint-disable-next-line no-unused-vars -- paramètre d'un type de fonction, pas une variable
    let releaseSlow: (v: unknown) => void = () => {}
    svc.getApplication.mockImplementationOnce(() => new Promise((r) => { releaseSlow = r }))
    await w.find('[data-test="open-7a2e4b1c-0000-4a00-8000-0000000000a2"]').trigger('click')
    // l'admin change d'avis avant la fin de la lecture lente
    svc.getApplication.mockImplementationOnce((id: string) => Promise.resolve(detailFor(id)))
    await w.find('[data-test="open-a1"]').trigger('click')
    await flushPromises()
    releaseSlow(detailFor('7a2e4b1c-0000-4a00-8000-0000000000a2'))
    await flushPromises()
    expect(w.find('[data-test="gp-pro-case-title"]').text()).toBe('Awa Diop')
    svc.approve.mockResolvedValue(undefined)
    await w.find('[data-test="gp-pro-approve"]').trigger('click')
    await w.find('[data-test="gp-pro-dialog-submit"]').trigger('click')
    await flushPromises()
    expect(svc.approve).toHaveBeenCalledWith('a1')
  })

  it('navigation interne vers ?open= et ?tab= alors que la page est ouverte', async () => {
    const route = reactive({ meta: {}, query: {} as Record<string, string> })
    vi.stubGlobal('useRoute', () => route)
    try {
      const w = await mountPage()
      expect(svc.getApplication).toHaveBeenCalledTimes(1)
      route.query = { open: '7a2e4b1c-0000-4a00-8000-0000000000a2' }
      await flushPromises()
      expect(svc.getApplication).toHaveBeenLastCalledWith('7a2e4b1c-0000-4a00-8000-0000000000a2')
      // même id : rien à recharger
      route.query = { open: '7a2e4b1c-0000-4a00-8000-0000000000a2' }
      await flushPromises()
      expect(svc.getApplication).toHaveBeenCalledTimes(2)
      route.query = { tab: 'revue', open: '7a2e4b1c-0000-4a00-8000-0000000000b2' }
      await flushPromises()
      expect(w.find('[data-test="gp-pro-review-title"]').text()).toBe('Mariam Kane')
      route.query = { tab: 'revue' }
      await flushPromises()
      route.query = {}
      await flushPromises()
      expect(w.find('[data-test="gp-pro-case-title"]').text()).toBe('Awa Diop')
    } finally {
      vi.stubGlobal('useRoute', () => ({ meta: {}, query }))
    }
  })

  it('pagination : la page suivante ouvre son premier dossier', async () => {
    svc.listApplications.mockResolvedValue(page([A2, A1], 3))
    const w = await mountPage()
    svc.listApplications.mockResolvedValue({ ...page([{ ...A2, applicationId: 'a9', displayName: 'Page deux' }], 3), number: 1 })
    await w.find('[data-test="next"]').trigger('click')
    await flushPromises()
    expect(svc.listApplications.mock.calls.at(-1)![0]).toBe(1)
    expect(svc.getApplication).toHaveBeenLastCalledWith('a9')
  })

  it('files vides : rien d’ouvert', async () => {
    svc.listApplications.mockResolvedValue(page([]))
    const w = await mountPage()
    expect(w.find('[data-test="gp-pro-empty"]').exists()).toBe(true)
    expect(w.find('[data-test="gp-pro-case-empty"]').exists()).toBe(true)
    expect(w.find('[data-test="summary-oldest"]').text()).toBe('0')
    expect(svc.getApplication).not.toHaveBeenCalled()
  })

  it('erreur de la file affichée dans la file, avec Réessayer', async () => {
    svc.listApplications.mockRejectedValue({ statusCode: 500, data: { detail: 'Base indisponible' } })
    const w = await mountPage()
    expect(w.find('[data-test="state-error"]').text()).toContain('Base indisponible')
    svc.listApplications.mockResolvedValue(page([A1]))
    await w.find('[data-test="state-retry"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="gp-pro-row-a1"]').exists()).toBe(true)
  })

  it('erreur de chargement de la demande : message dans le dossier', async () => {
    svc.getApplication.mockRejectedValue({ statusCode: 404, data: { detail: 'Demande introuvable' } })
    const w = await mountPage()
    expect(w.find('[data-test="gp-pro-detail-error"]').text()).toBe('Demande introuvable')
  })

  it('ancien back : file des demandes puis file à revoir indisponibles', async () => {
    svc.listApplications.mockRejectedValue({ statusCode: 404, data: { detail: 'No endpoint matches this path' } })
    svc.listReview.mockRejectedValue({ statusCode: 404, data: { detail: 'No endpoint matches this path' } })
    const w = await mountPage()
    expect(w.find('[data-test="gp-pro-unavailable"]').text()).toContain('indisponible')
    await w.find('[data-test="gp-pro-tab-revue"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="gp-pro-review-unavailable"]').exists()).toBe(true)
  })

  it('SUPPORT consulte sans bouton de décision ni d’écartement', async () => {
    seedAuth('SUPPORT')
    const w = await mountPage()
    expect(w.find('[data-test="gp-pro-case"]').exists()).toBe(true)
    expect(w.find('[data-test="gp-pro-approve"]').exists()).toBe(false)
    await w.find('[data-test="gp-pro-tab-revue"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="gp-pro-dismiss-f1"]').exists()).toBe(false)
  })
})
