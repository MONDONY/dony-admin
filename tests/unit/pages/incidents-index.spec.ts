/**
 * Page /incidents : poste de traitement (file fusionnée, dossier, décision). L'incident ouvert et la
 * nature filtrée vivent dans l'URL (?open=<id>, ?tab=disputes|noshows) : liens des notifications,
 * des colis et des paiements.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { reactive } from 'vue'
import { seedAuth } from '~/tests/helpers/auth'
import { dispute, disputeDetail, noShow } from '../features/incidents/noShowFixtures'

vi.stubGlobal('definePageMeta', vi.fn())
const replaceMock = vi.fn()
vi.stubGlobal('useRouter', () => ({ replace: replaceMock }))
const route = reactive<{ path: string; meta: Record<string, unknown>; query: Record<string, string> }>({ path: '/incidents', meta: {}, query: {} })
vi.stubGlobal('useRoute', () => route)

const svc = vi.hoisted(() => ({
  listDisputes: vi.fn(), listNoShows: vi.fn(), getDispute: vi.fn(), getSplitOptions: vi.fn(),
  resolveDispute: vi.fn(), resolveDisputeWithSplit: vi.fn(), retrySplit: vi.fn(), payGuaranteeFund: vi.fn(),
  confirmNoShow: vi.fn(), rejectNoShow: vi.fn(), confirmLegacyNoShow: vi.fn(),
  getDisputeContext: vi.fn(), getNoShowContext: vi.fn(),
}))
vi.mock('@/features/incidents/services/incidentsService', () => ({ incidentsService: svc }))

const NOW = Date.parse('2026-10-26T12:00:00Z')
const page = (content: unknown[], total = content.length) => ({ content, totalElements: total, totalPages: 1, number: 0, size: 100 })
const httpError = (status: number, data: Record<string, unknown> = {}) => Object.assign(new Error(`${status}`), { statusCode: status, data })
const splitOptions = { splittable: true, reasonCode: null, currency: 'EUR', amount: 38, commission: 4, refunded: 0, netAvailable: 34, rail: 'STRIPE', paymentStatus: 'ESCROW' }

let openDisputes: ReturnType<typeof dispute>[]
let resolvedDisputes: ReturnType<typeof dispute>[]
let noshows: ReturnType<typeof noShow>[]
const d1 = dispute({ id: 'd1' })
const d2 = dispute({ id: 'd2', type: 'ADMIN_PARCEL_LOST', senderName: 'Fatou BA', travelerName: 'Omar SY', createdAt: '2026-10-25T10:00:00', refundFrozen: false })
const n1 = noShow({ id: 'n1', remainingMinutes: 300 })

// Une page d'un test précédent encore montée réagirait aux changements de la route partagée.
const mounted: VueWrapper[] = []
async function mountPage() {
  const mod = await import('@/pages/incidents/index.vue')
  const w = mount(mod.default, { attachTo: document.body, global: { stubs: { NuxtLink: true } } })
  mounted.push(w)
  await flushPromises()
  return w
}
const title = (w: VueWrapper) => w.get('[data-test="incident-title"]').text()
const keys = (w: VueWrapper) => w.findAll('[data-test^="incident-row-"]').map((r) => r.attributes('data-test')!.replace('incident-row-', ''))
const reads = (status: string) => svc.listDisputes.mock.calls.filter((c) => c[0] === status)

describe('pages/incidents', () => {
  afterEach(() => { mounted.splice(0).forEach((w) => w.unmount()); vi.useRealTimers() })
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
    route.path = '/incidents'
    route.query = {}
    replaceMock.mockReset().mockImplementation(({ query }: { query: Record<string, string> }) => { route.query = query; return Promise.resolve() })
    seedAuth('ADMIN')
    openDisputes = [d1, d2]
    resolvedDisputes = []
    noshows = [n1]
    svc.listDisputes.mockReset().mockImplementation(async (status: string) => page(status === 'OPEN' ? openDisputes : resolvedDisputes))
    svc.listNoShows.mockReset().mockImplementation(async () => page(noshows))
    svc.getDispute.mockReset().mockImplementation(async (id: string) => disputeDetail({ ...[d1, d2, ...resolvedDisputes].find((d) => d.id === id)! }))
    svc.getSplitOptions.mockReset().mockResolvedValue(splitOptions)
    svc.resolveDispute.mockReset().mockImplementation(async (id: string, resolution: string) => {
      openDisputes = openDisputes.filter((d) => d.id !== id)
      return disputeDetail({ id, status: 'RESOLVED', resolution: resolution as never })
    })
    svc.resolveDisputeWithSplit.mockReset().mockImplementation(async (id: string) => {
      openDisputes = openDisputes.filter((d) => d.id !== id)
      return disputeDetail({ id, status: 'RESOLVED', resolution: 'SPLIT' })
    })
    svc.payGuaranteeFund.mockReset().mockImplementation(async (id: string) => {
      openDisputes = openDisputes.filter((d) => d.id !== id)
      return disputeDetail({ id, status: 'RESOLVED', resolution: 'GUARANTEE_PAID' })
    })
    svc.retrySplit.mockReset()
    svc.confirmNoShow.mockReset().mockImplementation(async (id: string) => {
      noshows = noshows.filter((r) => r.id !== id)
      return noShow({ id, status: 'CONFIRMED', adminDecision: 'CONFIRMED', canConfirm: false, canReject: false })
    })
    svc.rejectNoShow.mockReset()
    svc.confirmLegacyNoShow.mockReset()
    // Ancien back par défaut : pas de contexte ; chaque test le branche s'il en a besoin.
    const missing = () => Object.assign(new Error('Not Found'), { statusCode: 404 })
    svc.getDisputeContext.mockReset().mockRejectedValue(missing())
    svc.getNoShowContext.mockReset().mockRejectedValue(missing())
  })

  it('ouvre d’emblée l’incident le plus pressant : dossier et décision à côté', async () => {
    const w = await mountPage()
    expect(title(w)).toBe('Voyageur absent à la livraison')
    expect(w.get('[data-test="incident-sentence"]').text()).toMatch(/à la livraison/)
    expect(w.find('[data-test="incident-decision-panel"]').exists()).toBe(true)
    expect(keys(w)).toEqual(['dispute:d1', 'noshow:n1', 'dispute:d2'])
    expect(replaceMock).not.toHaveBeenCalled()
    expect(svc.getDispute).toHaveBeenCalledWith('d1')
  })

  it('bandeau de synthèse : à traiter, en retard et remboursements gelés', async () => {
    const w = await mountPage()
    expect(w.get('[data-test="summary-todo"]').text()).toBe('3')
    expect(w.get('[data-test="incident-summary"]').text()).toContain('2 litiges · 1 absence')
    expect(w.get('[data-test="summary-late"]').text()).toBe('1')
    expect(w.get('[data-test="summary-frozen"]').text()).toBe('1')
    expect(w.get('[data-test="summary-urgent"]').text()).toBe('0')
  })

  it('un clic sur une absence l’ouvre et l’écrit dans l’URL avec tab=noshows', async () => {
    const w = await mountPage()
    await w.get('[data-test="incident-open-noshow:n1"]').trigger('click')
    expect(w.get('[data-test="incident-title"]').text()).toBe('Déclaration d’absence à la remise')
    expect(replaceMock).toHaveBeenLastCalledWith({ query: { tab: 'noshows', open: 'n1' } })
    await w.get('[data-test="incident-open-dispute:d2"]').trigger('click')
    expect(title(w)).toBe('Colis perdu')
    expect(route.query).toEqual({ open: 'd2' })
  })

  it('un clic sur l’incident déjà ouvert ne fait rien', async () => {
    const w = await mountPage()
    await w.get('[data-test="incident-open-dispute:d1"]').trigger('click')
    expect(replaceMock).not.toHaveBeenCalled()
  })

  describe('liens profonds', () => {
    it('?open=<litige> de la file : sélectionné', async () => {
      route.query = { open: 'd2' }
      const w = await mountPage()
      expect(title(w)).toBe('Colis perdu')
      expect(svc.getDispute).toHaveBeenCalledWith('d2')
    })

    it('?open=<litige> hors file (résolu) : lu par identifiant et gardé à l’écran', async () => {
      const old = dispute({ id: 'd7', status: 'RESOLVED', type: 'ADMIN_OTHER' })
      resolvedDisputes = [old]
      svc.getDispute.mockImplementation(async (id: string) => disputeDetail({ ...(id === 'd7' ? old : d1) }))
      route.query = { open: 'd7' }
      const w = await mountPage()
      expect(title(w)).toBe('Autre motif')
      expect(w.get('[data-test="incident-decision-done"]').exists()).toBe(true)
      expect(keys(w)).not.toContain('dispute:d7')
      expect(svc.getDispute).toHaveBeenCalledTimes(1)
    })

    it('?open=<litige inconnu> : message, et la file reste utilisable', async () => {
      svc.getDispute.mockRejectedValue(httpError(404, { detail: 'Litige introuvable' }))
      route.query = { open: 'zzz' }
      const w = await mountPage()
      expect(w.get('[data-test="incident-open-error"]').text()).toBe('Litige introuvable')
      expect(title(w)).toBe('Voyageur absent à la livraison')
    })

    it('?open=<litige inconnu> sans détail : message par défaut', async () => {
      svc.getDispute.mockRejectedValue({})
      route.query = { open: 'zzz' }
      const w = await mountPage()
      expect(w.get('[data-test="incident-open-error"]').text()).toBe('Impossible de charger le litige')
    })

    it('?tab=noshows&open=<absence> : file filtrée sur les absences et absence ouverte', async () => {
      route.query = { tab: 'noshows', open: 'n1' }
      const w = await mountPage()
      expect(title(w)).toBe('Déclaration d’absence à la remise')
      expect(w.get('[data-test="kind-NOSHOW"]').attributes('aria-pressed')).toBe('true')
      expect(keys(w)).toEqual(['noshow:n1'])
    })

    it('?tab=noshows&open=<absence tranchée> hors onglet : trouvée parmi les absences chargées', async () => {
      noshows = [n1, noShow({ id: 'n9', status: 'RESOLVED', adminDecision: 'REJECTED', canConfirm: false, canReject: false })]
      route.query = { tab: 'noshows', open: 'n9' }
      const w = await mountPage()
      expect(w.get('[data-test="incident-decision-done"]').text()).toContain('Rejetée')
    })

    it('?tab=noshows&open=<absence inconnue> : message clair', async () => {
      route.query = { tab: 'noshows', open: 'nope' }
      const w = await mountPage()
      expect(w.get('[data-test="incident-open-error"]').text()).toMatch(/Déclaration introuvable/)
    })

    it('?tab=disputes : file filtrée sur les litiges', async () => {
      route.query = { tab: 'disputes' }
      const w = await mountPage()
      expect(w.get('[data-test="kind-DISPUTE"]').attributes('aria-pressed')).toBe('true')
      expect(keys(w)).toEqual(['dispute:d1', 'dispute:d2'])
    })

    it('valeur de tab inconnue : toutes natures', async () => {
      route.query = { tab: 'nimporte' }
      const w = await mountPage()
      expect(w.get('[data-test="kind-ALL"]').attributes('aria-pressed')).toBe('true')
    })

    it('page déjà ouverte : un nouveau lien (notification, colis) change l’incident ouvert', async () => {
      const w = await mountPage()
      route.query = { open: 'd2' }
      await flushPromises()
      expect(title(w)).toBe('Colis perdu')
      route.query = { tab: 'noshows', open: 'n1' }
      await flushPromises()
      expect(title(w)).toBe('Déclaration d’absence à la remise')
      expect(w.get('[data-test="kind-NOSHOW"]').attributes('aria-pressed')).toBe('true')
    })

    it('retrait de ?open= : efface le message d’un lien introuvable', async () => {
      svc.getDispute.mockRejectedValue({})
      route.query = { open: 'zzz' }
      const w = await mountPage()
      expect(w.find('[data-test="incident-open-error"]').exists()).toBe(true)
      route.query = {}
      await flushPromises()
      expect(w.find('[data-test="incident-open-error"]').exists()).toBe(false)
    })

    it('page quittée : la query d’une autre page n’ouvre rien', async () => {
      const w = await mountPage()
      route.path = '/colis'
      route.query = { open: 'd2' }
      await flushPromises()
      expect(title(w)).toBe('Voyageur absent à la livraison')
    })
  })

  describe('filtres', () => {
    it('Traités : relit les litiges résolus, les absences déjà tranchées s’y trouvent', async () => {
      resolvedDisputes = [dispute({ id: 'd8', status: 'RESOLVED', type: 'ADMIN_OTHER' })]
      noshows = [n1, noShow({ id: 'n8', status: 'CONFIRMED', adminDecision: 'CONFIRMED', canConfirm: false, canReject: false })]
      const w = await mountPage()
      expect(reads('RESOLVED')).toHaveLength(0)
      await w.get('[data-test="tab-DONE"]').trigger('click')
      await flushPromises()
      expect(reads('RESOLVED')).toHaveLength(1)
      expect(keys(w).sort()).toEqual(['dispute:d8', 'noshow:n8'])
      expect(w.get('[data-test="tab-DONE"]').attributes('aria-pressed')).toBe('true')
    })

    it('la recherche filtre la file et rouvre le premier incident visible', async () => {
      const w = await mountPage()
      await w.get('[data-test="incident-search"]').setValue('omar')
      expect(keys(w)).toEqual(['dispute:d2'])
      expect(title(w)).toBe('Colis perdu')
      await w.get('[data-test="incident-search"]').setValue('introuvable')
      expect(w.text()).toContain('Aucun incident')
    })

    it('la nature filtrée se reporte dans l’URL, l’incident ouvert aussi', async () => {
      const w = await mountPage()
      await w.get('[data-test="kind-DISPUTE"]').trigger('click')
      expect(replaceMock).toHaveBeenLastCalledWith({ query: { tab: 'disputes', open: 'd1' } })
      await w.get('[data-test="kind-ALL"]').trigger('click')
      expect(route.query).toEqual({ open: 'd1' })
      expect(keys(w)).toHaveLength(3)
    })

    it('autres paramètres de l’URL conservés', async () => {
      route.query = { foo: 'bar' }
      const w = await mountPage()
      await w.get('[data-test="incident-open-dispute:d2"]').trigger('click')
      expect(route.query).toEqual({ foo: 'bar', open: 'd2' })
    })

    it('regroupe les incidents de même nature et déplie le groupe à la demande', async () => {
      openDisputes = [d1, dispute({ id: 'd3' })]
      noshows = []
      const w = await mountPage()
      expect(w.find('[data-test="incident-group-toggle-DISPUTE:Voyageur absent à la livraison"]').exists()).toBe(true)
      expect(w.get('[data-test="incident-group-toggle-DISPUTE:Voyageur absent à la livraison"]').text()).toContain('×2')
      await w.get('[data-test="incident-group-toggle-DISPUTE:Voyageur absent à la livraison"]').trigger('click')
      await w.get('[data-test="incident-group-toggle-DISPUTE:Voyageur absent à la livraison"]').trigger('click')
      expect(w.get('[data-test="incident-group-toggle-DISPUTE:Voyageur absent à la livraison"]').attributes('aria-expanded')).toBe('true')
    })
  })

  describe('clavier', () => {
    const press = async (key: string) => { window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })); await flushPromises() }

    it('J et K parcourent la file', async () => {
      const w = await mountPage()
      await press('j')
      expect(title(w)).toBe('Déclaration d’absence à la remise')
      await press('j')
      expect(title(w)).toBe('Colis perdu')
      await press('k')
      expect(title(w)).toBe('Déclaration d’absence à la remise')
    })

    it('un chiffre choisit le geste, ⌘⏎ confirme', async () => {
      const w = await mountPage()
      await press('2')
      await w.get('[data-test="incident-note"]').setValue('Preuves examinées')
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true }))
      await flushPromises()
      expect(svc.resolveDispute).toHaveBeenCalledWith('d1', 'RESOLVED_FOR_TRAVELER', 'Preuves examinées')
    })
  })

  describe('décisions sur un litige', () => {
    it('trancher : appel, file relue, message, et le suivant s’ouvre', async () => {
      const w = await mountPage()
      await w.get('[data-test="incident-note"]').setValue('Preuves examinées')
      await w.get('[data-test="incident-confirm"]').trigger('click')
      await flushPromises()
      expect(svc.resolveDispute).toHaveBeenCalledWith('d1', 'RESOLVED_FOR_SENDER', 'Preuves examinées')
      expect(reads('OPEN')).toHaveLength(2)
      expect(w.get('[data-test="incidents-done"]').text()).toBe('Litige résolu.')
      expect(keys(w)).toEqual(['noshow:n1', 'dispute:d2'])
      expect(title(w)).toBe('Déclaration d’absence à la remise')
      expect(replaceMock).toHaveBeenLastCalledWith({ query: { tab: 'noshows', open: 'n1' } })
      expect(w.get('[data-test="summary-todo"]').text()).toBe('2')
    })

    it('dernier incident traité : plus de dossier, invitation à la place', async () => {
      openDisputes = [d1]
      noshows = []
      const w = await mountPage()
      await w.get('[data-test="incident-note"]').setValue('Preuves examinées')
      await w.get('[data-test="incident-confirm"]').trigger('click')
      await flushPromises()
      expect(w.get('[data-test="incident-case-empty"]').exists()).toBe(true)
      expect(w.get('[data-test="incident-decision-empty"]').exists()).toBe(true)
      expect(route.query).toEqual({})
    })

    it('refus du back : l’erreur reste sous le bouton, rien ne bouge', async () => {
      svc.resolveDispute.mockRejectedValue(httpError(409, { detail: 'Litige déjà résolu.' }))
      const w = await mountPage()
      await w.get('[data-test="incident-note"]').setValue('Preuves examinées')
      await w.get('[data-test="incident-confirm"]').trigger('click')
      await flushPromises()
      expect(w.get('[data-test="incident-error"]').text()).toBe('Litige déjà résolu.')
      expect(w.find('[data-test="incidents-done"]').exists()).toBe(false)
      expect(reads('OPEN')).toHaveLength(1)
      expect((w.get('[data-test="incident-note"]').element as HTMLTextAreaElement).value).toBe('Preuves examinées')
    })

    it('partager : formulaire, résolution avec partage', async () => {
      const w = await mountPage()
      await w.get('[data-test="incident-action-SPLIT"] input').setValue(true)
      await w.get('[data-test="split-sender"]').setValue(20)
      await w.get('[data-test="split-traveler"]').setValue(14)
      await w.get('[data-test="split-note"]').setValue('Partage convenu')
      await w.get('[data-test="split-submit"]').trigger('click')
      await flushPromises()
      expect(svc.resolveDisputeWithSplit).toHaveBeenCalledWith('d1', 20, 14, 'Partage convenu')
      expect(w.get('[data-test="incidents-done"]').text()).toBe('Litige résolu : séquestre partagé.')
    })

    it('fonds de garantie : versé dans la devise du colis', async () => {
      const w = await mountPage()
      await w.get('[data-test="incident-action-GUARANTEE"] input').setValue(true)
      await w.get('[data-test="gf-amount"]').setValue('10')
      await w.get('[data-test="gf-beneficiary-traveler"]').setValue(true)
      await w.get('[data-test="gf-reason"]').setValue('Colis perdu')
      await w.get('[data-test="gf-submit"]').trigger('click')
      await flushPromises()
      expect(svc.payGuaranteeFund).toHaveBeenCalledWith('d1', 1000, '22222222-2222-4222-8222-222222222222', 'Colis perdu', 'EUR')
      expect(w.get('[data-test="incidents-done"]').text()).toBe('Fonds de garantie versé.')
    })

    it('reprise d’un partage interrompu : message de reprise', async () => {
      const split = { id: 's1', senderRefundAmount: 50, travelerPayoutAmount: 30, currency: 'EUR', mode: 'REFUND_TRANSFER', status: 'SENDER_REFUNDED', attempts: 2, lastError: 'x', stripeRefundId: 'r', stripeTransferId: null, completedAt: null }
      const stuck = dispute({ id: 'd5', status: 'RESOLVED', type: 'ADMIN_OTHER' })
      resolvedDisputes = [stuck]
      svc.getDispute.mockImplementation(async () => disputeDetail({ ...stuck, resolution: 'SPLIT', split } as never))
      route.query = { open: 'd5' }
      const w = await mountPage()
      svc.retrySplit.mockResolvedValueOnce(disputeDetail({ ...stuck, resolution: 'SPLIT', split: { ...split, status: 'COMPLETED' } } as never))
      await w.get('[data-test="split-retry"]').trigger('click')
      await flushPromises()
      expect(svc.retrySplit).toHaveBeenCalledWith('d5')
      expect(w.get('[data-test="incidents-done"]').text()).toBe('Partage repris.')
    })

    it('reprise du partage refusée : l’erreur s’affiche', async () => {
      const split = { id: 's1', senderRefundAmount: 50, travelerPayoutAmount: 30, currency: 'EUR', mode: 'REFUND_TRANSFER', status: 'SENDER_REFUNDED', attempts: 2, lastError: 'x', stripeRefundId: 'r', stripeTransferId: null, completedAt: null }
      const stuck = dispute({ id: 'd5', status: 'RESOLVED', type: 'ADMIN_OTHER' })
      resolvedDisputes = [stuck]
      svc.getDispute.mockImplementation(async () => disputeDetail({ ...stuck, resolution: 'SPLIT', split } as never))
      svc.retrySplit.mockRejectedValue(httpError(409, { detail: 'Stripe indisponible' }))
      route.query = { open: 'd5' }
      const w = await mountPage()
      await w.get('[data-test="split-retry"]').trigger('click')
      await flushPromises()
      expect(w.get('[data-test="incident-error"]').text()).toBe('Stripe indisponible')
    })
  })

  describe('décisions sur une absence', () => {
    it('confirmer : motif envoyé, message, absence sortie de la file', async () => {
      const w = await mountPage()
      await w.get('[data-test="incident-open-noshow:n1"]').trigger('click')
      await w.get('[data-test="incident-note"]').setValue('Appel au voyageur sans réponse')
      await w.get('[data-test="incident-confirm"]').trigger('click')
      await flushPromises()
      expect(svc.confirmNoShow).toHaveBeenCalledWith('n1', 'Appel au voyageur sans réponse')
      expect(w.get('[data-test="incidents-done"]').text()).toMatch(/Absence confirmée/)
      expect(keys(w)).not.toContain('noshow:n1')
    })

    it('déjà tranchée ailleurs : le message du conflit', async () => {
      svc.confirmNoShow.mockRejectedValue(httpError(409, { code: 'noshow-already-decided' }))
      const w = await mountPage()
      await w.get('[data-test="incident-open-noshow:n1"]').trigger('click')
      await w.get('[data-test="incident-note"]').setValue('Appel au voyageur sans réponse')
      await w.get('[data-test="incident-confirm"]').trigger('click')
      await flushPromises()
      expect(w.get('[data-test="incident-error"]').text()).toMatch(/déjà été tranchée/)
    })

    it('litige lié : ouvert depuis le dossier de l’absence, dans la file ou hors file', async () => {
      noshows = [noShow({ id: 'n1', scope: 'DELIVERY', status: 'CONFIRMED', adminDecision: 'CONFIRMED', canConfirm: false, canReject: false, dispute: { id: 'd2', status: 'OPEN' } })]
      route.query = { tab: 'noshows', open: 'n1' }
      const w = await mountPage()
      await w.get('[data-test="incident-dispute-link"]').trigger('click')
      await flushPromises()
      expect(title(w)).toBe('Colis perdu')
    })

    it('litige lié hors file : lu par identifiant', async () => {
      const far = dispute({ id: 'd6', status: 'RESOLVED', type: 'ADMIN_OTHER' })
      svc.getDispute.mockImplementation(async (id: string) => disputeDetail({ ...(id === 'd6' ? far : d1) }))
      noshows = [noShow({ id: 'n1', scope: 'DELIVERY', status: 'CONFIRMED', adminDecision: 'CONFIRMED', canConfirm: false, canReject: false, dispute: { id: 'd6', status: 'RESOLVED' } })]
      route.query = { tab: 'noshows', open: 'n1' }
      const w = await mountPage()
      await w.get('[data-test="incident-dispute-link"]').trigger('click')
      await flushPromises()
      expect(title(w)).toBe('Autre motif')
    })
  })

  describe('états dégradés', () => {
    it('une source en panne : la file reste, avec un avertissement', async () => {
      svc.listNoShows.mockRejectedValue(httpError(500, { detail: 'Absences en panne' }))
      const w = await mountPage()
      expect(keys(w)).toEqual(['dispute:d1', 'dispute:d2'])
      expect(w.get('[data-test="incidents-warning"]').text()).toContain('Absences en panne')
    })

    it('toutes en panne : erreur et « Réessayer » relit', async () => {
      svc.listDisputes.mockRejectedValue(httpError(500, { detail: 'Litiges en panne' }))
      svc.listNoShows.mockRejectedValue(httpError(500, { detail: 'Absences en panne' }))
      const w = await mountPage()
      expect(w.get('[data-test="state-error"]').text()).toContain('Litiges en panne')
      expect(w.find('[data-test="incident-title"]').exists()).toBe(false)
      svc.listDisputes.mockImplementation(async () => page(openDisputes))
      svc.listNoShows.mockImplementation(async () => page(noshows))
      await w.get('[data-test="state-error"] button').trigger('click')
      await flushPromises()
      expect(keys(w)).toHaveLength(3)
    })

    it('liste tronquée : la file le dit', async () => {
      svc.listDisputes.mockImplementation(async () => page(openDisputes, 250))
      const w = await mountPage()
      expect(w.get('[data-test="incidents-truncated"]').text()).toContain('100 plus récents')
    })

    it('rien à traiter : file vide, dossier et décision invitent', async () => {
      openDisputes = []
      noshows = []
      const w = await mountPage()
      expect(w.text()).toContain('Aucun incident')
      expect(w.get('[data-test="summary-todo"]').text()).toBe('0')
      expect(w.get('[data-test="incident-case-empty"]').exists()).toBe(true)
    })
  })

  describe('contexte (back #658)', () => {
    const related = [
      { kind: 'NOSHOW', id: 'n1', type: 'SENDER_NO_SHOW', scope: 'HANDOVER', open: true, createdAt: '2026-09-28T10:00:00' },
      { kind: 'DISPUTE', id: 'd9', type: 'ADMIN_PARCEL_LOST', open: false, createdAt: '2026-09-02T10:00:00' },
    ]
    const history = [{ action: 'RESOLVE', at: '2026-10-24T16:22:00', actorEmail: 'sira@yadony.com', note: 'Preuves' }]

    it('lit le contexte du litige ouvert et montre les autres incidents des parties', async () => {
      svc.getDisputeContext.mockResolvedValue({ related, history: [] })
      const w = await mountPage()
      expect(svc.getDisputeContext).toHaveBeenCalledWith('d1')
      expect(w.get('[data-test="incident-related"]').text()).toContain('Colis perdu')
    })

    it('ouvre un autre incident de la file, puis lit celui qui n’y est pas', async () => {
      svc.getDisputeContext.mockResolvedValue({ related, history: [] })
      svc.getNoShowContext.mockResolvedValue({ related: [], history: [] })
      const far = dispute({ id: 'd9', status: 'RESOLVED', type: 'ADMIN_PARCEL_LOST', senderName: 'Sali', travelerName: 'Omar SY' })
      svc.getDispute.mockImplementation(async (id: string) => disputeDetail({ ...(id === 'd9' ? far : d1) }))
      const w = await mountPage()
      await w.get('[data-test="incident-related-noshow:n1"]').trigger('click')
      expect(title(w)).toBe('Déclaration d’absence à la remise')
      expect(svc.getNoShowContext).toHaveBeenCalledWith('n1')
      expect(replaceMock).toHaveBeenLastCalledWith({ query: { tab: 'noshows', open: 'n1' } })
    })

    it('un autre incident hors file (litige traité) : lu par identifiant et gardé à l’écran', async () => {
      svc.getDisputeContext.mockResolvedValue({ related, history: [] })
      const far = dispute({ id: 'd9', status: 'RESOLVED', type: 'ADMIN_PARCEL_LOST' })
      svc.getDispute.mockImplementation(async (id: string) => disputeDetail({ ...(id === 'd9' ? far : d1) }))
      const w = await mountPage()
      await w.get('[data-test="incident-related-dispute:d9"]').trigger('click')
      await flushPromises()
      expect(title(w)).toBe('Colis perdu')
      expect(w.get('[data-test="incident-decision-done"]').exists()).toBe(true)
      expect(route.query).toEqual({ open: 'd9' })
    })

    it('un autre incident introuvable : message, rien ne change', async () => {
      svc.getDisputeContext.mockResolvedValue({ related: [{ ...related[1], id: 'zz' }], history: [] })
      svc.getDispute.mockImplementation(async (id: string) => { if (id === 'zz') throw httpError(404, { detail: 'Litige introuvable' }); return disputeDetail({ ...d1 }) })
      const w = await mountPage()
      await w.get('[data-test="incident-related-dispute:zz"]').trigger('click')
      await flushPromises()
      expect(w.get('[data-test="incident-open-error"]').text()).toBe('Litige introuvable')
      expect(w.find('[data-test="incident-detail-error"]').exists()).toBe(false)
      expect(title(w)).toBe('Voyageur absent à la livraison')
    })

    it('l’historique vient de l’audit', async () => {
      svc.getDisputeContext.mockResolvedValue({ related: [], history })
      const w = await mountPage()
      expect(w.get('[data-test="report-timeline"]').text()).toContain('par sira@yadony.com')
    })

    it('ancien back : pas de section ni de message d’erreur', async () => {
      const w = await mountPage()
      expect(w.find('[data-test="incident-related"]').exists()).toBe(false)
      expect(w.find('[data-test="incident-context-error"]').exists()).toBe(false)
      expect(w.get('[data-test="incident-title"]').exists()).toBe(true)
    })

    it('panne du contexte : une phrase, le dossier reste lisible', async () => {
      svc.getDisputeContext.mockRejectedValue(httpError(500, { detail: 'Contexte en panne' }))
      const w = await mountPage()
      expect(w.get('[data-test="incident-context-error"]').text()).toBe('Contexte en panne')
    })

    it('le contexte est relu après la reprise d’un partage, pour que l’historique montre le geste', async () => {
      const split = { id: 's1', senderRefundAmount: 50, travelerPayoutAmount: 30, currency: 'EUR', mode: 'REFUND_TRANSFER', status: 'SENDER_REFUNDED', attempts: 2, lastError: 'x', stripeRefundId: 'r', stripeTransferId: null, completedAt: null }
      const stuck = dispute({ id: 'd5', status: 'RESOLVED', type: 'ADMIN_OTHER' })
      resolvedDisputes = [stuck]
      svc.getDispute.mockImplementation(async () => disputeDetail({ ...stuck, resolution: 'SPLIT', split } as never))
      svc.getDisputeContext.mockResolvedValue({ related: [], history: [] })
      svc.retrySplit.mockResolvedValue(disputeDetail({ ...stuck, resolution: 'SPLIT', split: { ...split, status: 'COMPLETED' } } as never))
      route.query = { open: 'd5' }
      const w = await mountPage()
      const before = svc.getDisputeContext.mock.calls.length
      await w.get('[data-test="split-retry"]').trigger('click')
      await flushPromises()
      expect(svc.getDisputeContext.mock.calls.length).toBe(before + 1)
    })

    it('le contexte du dossier suit la décision : relu quand le même dossier reste ouvert', async () => {
      svc.getDisputeContext.mockResolvedValue({ related: [], history: [] })
      svc.getNoShowContext.mockResolvedValue({ related: [], history: [] })
      svc.confirmNoShow.mockImplementation(async () => noShow({ id: 'n1', status: 'CONFIRMED', adminDecision: 'CONFIRMED', canConfirm: false, canReject: false }))
      openDisputes = []
      const w = await mountPage()
      const before = svc.getNoShowContext.mock.calls.length
      await w.get('[data-test="incident-note"]').setValue('Appel au voyageur sans réponse')
      await w.get('[data-test="incident-confirm"]').trigger('click')
      await flushPromises()
      expect(svc.getNoShowContext.mock.calls.length).toBeGreaterThan(before - 1)
    })
  })

  describe('argent gelé', () => {
    it('la tuile cumule le montant des litiges gelés, par devise', async () => {
      openDisputes = [dispute({ id: 'd1', amount: 38, currency: 'EUR' }), dispute({ id: 'd2', type: 'ADMIN_PARCEL_LOST', amount: 12, currency: 'EUR' }), dispute({ id: 'd3', type: 'ADMIN_OTHER', amount: 25000, currency: 'XOF' })]
      noshows = []
      const w = await mountPage()
      expect(w.get('[data-test="summary-frozen"]').text()).toBe('3')
      const amounts = w.get('[data-test="summary-frozen-amounts"]').text()
      expect(amounts).toContain('50,00 EUR')
      expect(amounts).toMatch(/25\s?000/)
    })

    it('sans montant du back : le compte seul', async () => {
      const w = await mountPage()
      expect(w.find('[data-test="summary-frozen-amounts"]').exists()).toBe(false)
    })

    it('la ligne de la file montre le montant du colis', async () => {
      openDisputes = [dispute({ id: 'd1', amount: 38, currency: 'EUR' })]
      noshows = []
      const w = await mountPage()
      expect(w.get('[data-test="incident-row-dispute:d1"]').text()).toContain('38,00 EUR · Remboursement gelé')
    })
  })

  it('SUPPORT : consulte tout, ne peut rien trancher', async () => {
    seedAuth('SUPPORT')
    const w = await mountPage()
    expect(title(w)).toBe('Voyageur absent à la livraison')
    expect(w.find('[data-test="incident-no-action"]').exists()).toBe(true)
    expect(w.find('[data-test="incident-confirm"]').exists()).toBe(false)
  })
})
