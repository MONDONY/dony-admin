/** Page Alertes : filtre de sévérité et fiche détaillée d'une alerte. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { reactive } from 'vue'
import { seedAuth } from '~/tests/helpers/auth'

vi.stubGlobal('definePageMeta', vi.fn())
const replaceMock = vi.fn()
vi.stubGlobal('useRouter', () => ({ replace: replaceMock }))
const route = reactive<{ path: string; query: Record<string, string> }>({ path: '/alertes', query: {} })
vi.stubGlobal('useRoute', () => route)

const svc = vi.hoisted(() => ({ list: vi.fn(), resolve: vi.fn(), violations: vi.fn(), get: vi.fn() }))
vi.mock('@/features/alerts/services/alertsService', () => ({ alertsService: svc }))
const paySvc = vi.hoisted(() => ({ get: vi.fn(), resyncStripe: vi.fn(), forceRelease: vi.fn() }))
vi.mock('@/features/payments/services/paymentsService', () => ({ paymentsService: paySvc }))

const P = '11111111-2222-3333-4444-555555555555'
const recon = {
  id: 'a2', type: `RECON_STRIPE_${P}`, severity: 'CRITICAL', detail: 'Écart', paymentId: P,
  payload: { reference: P, ecart: 'AUTORISE_NON_ENREGISTRE' }, resolved: false, resolvedAt: null, createdAt: '2026-10-10T04:30:00',
}
const resyncResult = {
  paymentId: P, paymentIntentId: 'pi_1', action: 'ESCROW_ACTIVATED', changed: true,
  before: { status: 'PENDING', capturedAt: null, stripeStatus: 'requires_capture', amountCapturable: 6450 },
  after: { status: 'ESCROW', capturedAt: '2026-10-10T08:00:00Z', stripeStatus: 'succeeded', amountCapturable: 0 },
  message: 'ok', resolvedAlertIds: ['a2'], openAlertIds: [], alertResolvable: false,
}

const row = {
  id: 'a1', type: 'ESCROW_J48_TIMEOUT', severity: 'WARN', detail: 'Paiement p1 en séquestre',
  payload: {}, resolved: false, resolvedAt: null, createdAt: '2026-10-06T12:00:00',
}

// Une page d'un test précédent encore montée réagirait aux changements de la route partagée.
const mounted: VueWrapper[] = []
async function mountPage() {
  const mod = await import('@/pages/alertes/index.vue')
  const w = mount(mod.default, { global: { stubs: { PaginationControls: true, NuxtLink: true } } })
  mounted.push(w)
  await flushPromises()
  return w
}

describe('pages/alertes', () => {
  afterEach(() => { mounted.splice(0).forEach(w => w.unmount()) })
  beforeEach(() => {
    route.path = '/alertes'
    route.query = {}
    replaceMock.mockReset().mockImplementation(({ query }: { query: Record<string, string> }) => { route.query = query; return Promise.resolve() })
    svc.get.mockReset()
    seedAuth('ADMIN')
    svc.list.mockReset().mockResolvedValue({ content: [row], totalElements: 1, totalPages: 1, number: 0, size: 20 })
    svc.resolve.mockReset().mockResolvedValue({ ...row, resolved: true })
  })

  it('filtre par sévérité', async () => {
    const w = await mountPage()
    await w.find('[data-test="severity-CRITICAL"]').trigger('click')
    await flushPromises()
    expect(svc.list.mock.calls.at(-1)![0].severity).toBe('CRITICAL')
  })

  it('ouvre la fiche puis résout l’alerte depuis la fiche', async () => {
    const w = await mountPage()
    await w.find('[data-test="details-a1"]').trigger('click')
    expect(w.find('[data-test="alert-detail"]').exists()).toBe(true)
    await w.find('[data-test="alert-detail-resolve"]').trigger('click')
    expect(w.text()).toContain('Marquer « Paiement en séquestre depuis plus de 48 h » comme résolue')
    const reason = w.find('[data-test="reason"]')
    await reason.setValue('Colis encore en route, rien à faire')
    await w.find('[data-test="confirm"]').trigger('click')
    await flushPromises()
    expect(svc.resolve).toHaveBeenCalledWith('a1', 'Colis encore en route, rien à faire')
    expect(w.find('[data-test="alert-detail"]').exists()).toBe(false)
  })

  it('resynchronisation Stripe : l’alerte résolue par le back passe « Résolue » dans la liste et la fiche', async () => {
    seedAuth('SUPER_ADMIN')
    svc.list.mockResolvedValue({ content: [row, recon], totalElements: 2, totalPages: 1, number: 0, size: 20 })
    paySvc.get.mockReset().mockResolvedValue({ id: P, status: 'PENDING', method: 'STRIPE', amountCents: 6450, commissionCents: 774, currency: 'EUR' })
    paySvc.resyncStripe.mockReset().mockResolvedValue(resyncResult)
    const w = await mountPage()
    await w.find('[data-test="details-a2"]').trigger('click')
    await flushPromises()
    await w.find('[data-test="resync-stripe"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="alert-row-a2"]').text()).toContain('Résolue')
    expect(w.find('[data-test="alert-row-a1"]').text()).toContain('Ouverte')
    expect(w.find('[data-test="alert-detail"]').text()).toContain('Résolue le')
    expect(w.find('[data-test="alert-detail-resolve"]').exists()).toBe(false)
    expect(svc.list).toHaveBeenCalledTimes(1)
  })

  it('versement forcé depuis la fiche : la liste est rechargée', async () => {
    seedAuth('SUPER_ADMIN')
    svc.list.mockResolvedValue({ content: [recon], totalElements: 1, totalPages: 1, number: 0, size: 20 })
    paySvc.get.mockReset().mockResolvedValue({ id: P, status: 'ESCROW', method: 'STRIPE', amountCents: 6450, commissionCents: 774, currency: 'EUR' })
    paySvc.forceRelease.mockReset().mockResolvedValue({ id: P, status: 'RELEASED', method: 'STRIPE', amountCents: 6450, commissionCents: 774, currency: 'EUR' })
    const w = await mountPage()
    await w.find('[data-test="details-a2"]').trigger('click')
    await flushPromises()
    await w.find('[data-test="alert-fix-release"]').trigger('click')
    svc.list.mockResolvedValue({ content: [{ ...recon, detail: 'rafraîchie' }], totalElements: 1, totalPages: 1, number: 0, size: 20 })
    const confirm = w.findAll('[data-test="confirm"]').at(-1)!
    await confirm.trigger('click')
    await flushPromises()
    expect(paySvc.forceRelease).toHaveBeenCalledWith(P)
    expect(svc.list).toHaveBeenCalledTimes(2)
    expect(w.find('[data-test="alert-detail-summary"]').text()).toBe('rafraîchie')
  })

  describe('lien profond ?open=<alerte>', () => {
    const A = '0a1b2c3d-1111-4222-8333-444455556666'
    const far = { ...row, id: A, type: 'ESCROW_J48_TIMEOUT', detail: 'Hors de la page' }

    it('page sans ?open : liste seule, aucune lecture par identifiant, URL intacte', async () => {
      const w = await mountPage()
      expect(w.find('[data-test="alert-detail"]').exists()).toBe(false)
      expect(svc.get).not.toHaveBeenCalled()
      expect(replaceMock).not.toHaveBeenCalled()
    })

    it('?open=<id> hors de la liste : lue via alertsService.get et ouverte dans le panneau', async () => {
      svc.get.mockResolvedValue(far)
      route.query = { open: A }
      const w = await mountPage()
      expect(svc.get).toHaveBeenCalledWith(A)
      expect(w.get('[data-test="alert-detail-summary"]').text()).toBe('Hors de la page')
    })

    it('404 : « Alerte introuvable », la liste reste utilisable', async () => {
      svc.get.mockRejectedValue(Object.assign(new Error('Not Found'), { statusCode: 404 }))
      route.query = { open: A }
      const w = await mountPage()
      expect(w.get('[data-test="alert-open-error"]').text()).toContain('Alerte introuvable')
      expect(w.find('[data-test="alert-detail"]').exists()).toBe(false)
      expect(w.find('[data-test="alert-row-a1"]').exists()).toBe(true)
    })

    it('fermer le panneau retire ?open de l’URL', async () => {
      svc.get.mockResolvedValue(far)
      route.query = { open: A, x: 'y' }
      const w = await mountPage()
      await w.get('[data-test="alert-detail"]').trigger('click')
      await flushPromises()
      expect(w.find('[data-test="alert-detail"]').exists()).toBe(false)
      expect(replaceMock).toHaveBeenLastCalledWith({ query: { x: 'y' } })
    })

    it('page déjà ouverte : un changement de query seul ouvre l’alerte, son retrait la ferme', async () => {
      svc.get.mockResolvedValue(far)
      const w = await mountPage()
      route.query = { open: A }
      await flushPromises()
      expect(w.find('[data-test="alert-detail"]').exists()).toBe(true)
      route.query = {}
      await flushPromises()
      expect(w.find('[data-test="alert-detail"]').exists()).toBe(false)
    })

    it('page quittée : le ?open= de la page suivante (un paiement) n’est pas lu comme une alerte', async () => {
      await mountPage()
      route.path = '/transactions'
      route.query = { open: A }
      await flushPromises()
      expect(svc.get).not.toHaveBeenCalled()
      route.path = '/alertes'
    })

    it('ouvrir une alerte de la liste écrit ?open dans l’URL', async () => {
      const w = await mountPage()
      await w.get('[data-test="details-a1"]').trigger('click')
      await flushPromises()
      expect(replaceMock).toHaveBeenLastCalledWith({ query: { open: 'a1' } })
      expect(svc.get).not.toHaveBeenCalled()
    })
  })
})
