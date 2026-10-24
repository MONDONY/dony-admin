/**
 * Tiroir paiement et URL : `?open=<paiement>` et `?section=<onglet>` écrits à l'ouverture et au
 * changement d'onglet, retirés à la fermeture ; un `?open=` reçu (chargement ou query seule) ouvre.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent, h, reactive, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { paymentDrawerSection, usePaymentDrawerRoute } from '@/features/payments/composables/usePaymentDrawerRoute'
import type { AdminPaymentDetail } from '@/features/payments/types/index'

const P1 = 'aaaaaaaa-1111-4111-8111-111111111111'
const P2 = 'bbbbbbbb-2222-4222-8222-222222222222'

let route: { query: Record<string, unknown> }
const replace = vi.fn()
function setup(query: Record<string, unknown> = {}, apply?: (_q: Record<string, unknown>) => Record<string, unknown>) {
  route = reactive({ query })
  replace.mockReset().mockImplementation(async (to: { query: Record<string, unknown> }) => { route.query = to.query })
  vi.stubGlobal('useRoute', () => route)
  vi.stubGlobal('useRouter', () => ({ replace }))
  const payment = ref<AdminPaymentDetail | null>(null)
  const detail = {
    payment,
    open: vi.fn(async (id: string) => { payment.value = { id } as AdminPaymentDetail }),
    close: vi.fn(() => { payment.value = null }),
  }
  let api!: ReturnType<typeof usePaymentDrawerRoute>
  mount(defineComponent({ setup() { api = usePaymentDrawerRoute(detail, { apply }); return () => h('div') } }))
  return { api, detail }
}

describe('paymentDrawerSection', () => {
  it('onglets connus seulement ; Résumé et inconnu : null', () => {
    expect(paymentDrawerSection('incidents')).toBe('incidents')
    expect(paymentDrawerSection('references')).toBe('references')
    expect(paymentDrawerSection('summary')).toBeNull()
    expect(paymentDrawerSection('pirate')).toBeNull()
    expect(paymentDrawerSection(['money'])).toBeNull()
    expect(paymentDrawerSection(undefined)).toBeNull()
  })
})

describe('usePaymentDrawerRoute', () => {
  beforeEach(() => vi.unstubAllGlobals())

  it('ouvrir écrit ?open= (les autres paramètres restent), fermer retire open et section', async () => {
    const { api, detail } = setup({ view: 'ALL' })
    await api.openPayment(P1)
    expect(detail.open).toHaveBeenCalledWith(P1)
    expect(replace).toHaveBeenLastCalledWith({ query: { view: 'ALL', open: P1 } })
    api.setSection('incidents')
    expect(replace).toHaveBeenLastCalledWith({ query: { view: 'ALL', open: P1, section: 'incidents' } })
    api.closePayment()
    expect(detail.close).toHaveBeenCalled()
    expect(replace).toHaveBeenLastCalledWith({ query: { view: 'ALL' } })
    expect(api.section.value).toBeNull()
  })

  it('Résumé : pas de paramètre section', async () => {
    const { api } = setup()
    await api.openPayment(P1, 'money')
    expect(route.query).toEqual({ open: P1, section: 'money' })
    api.setSection('summary')
    expect(route.query).toEqual({ open: P1 })
  })

  it('un autre paiement ouvert repart sur Résumé', async () => {
    const { api } = setup()
    await api.openPayment(P1, 'timeline')
    await api.openPayment(P2)
    expect(api.section.value).toBeNull()
    expect(route.query).toEqual({ open: P2 })
  })

  it('les filtres de la page sont réécrits avec la query (apply)', async () => {
    const { api } = setup({}, q => ({ ...q, view: 'ATTENTION' }))
    await api.openPayment(P1)
    expect(replace).toHaveBeenLastCalledWith({ query: { open: P1, view: 'ATTENTION' } })
  })

  it('chargement avec ?open=&section= : ouvre la fiche sur l’onglet, sans réécrire l’URL', async () => {
    const { api, detail } = setup({ open: P1, section: 'incidents' })
    await api.restore()
    expect(detail.open).toHaveBeenCalledWith(P1)
    expect(api.section.value).toBe('incidents')
    expect(replace).not.toHaveBeenCalled()
  })

  it('?open= invalide ou d’un autre onglet : ignoré', async () => {
    const a = setup({ open: '../../x' })
    await a.api.restore()
    expect(a.detail.open).not.toHaveBeenCalled()
    const b = setup({ tab: 'chargebacks', open: P1 })
    await b.api.restore()
    expect(b.detail.open).not.toHaveBeenCalled()
    const c = setup({ tab: 'payments', open: P1 })
    await c.api.restore()
    expect(c.detail.open).toHaveBeenCalledWith(P1)
  })

  it('page ouverte : un ?open= arrivé ensuite ouvre la fiche, une seule fois', async () => {
    const { detail } = setup()
    route.query = { open: P1, section: 'references' }
    await flushPromises()
    expect(detail.open).toHaveBeenCalledTimes(1)
    expect(detail.open).toHaveBeenCalledWith(P1)
  })

  it('le même lien recliqué après la fermeture rouvre la fiche', async () => {
    const { api, detail } = setup({ open: P1 })
    await api.restore()
    api.closePayment()
    await flushPromises()
    expect(route.query).toEqual({})
    route.query = { open: P1 }
    await flushPromises()
    expect(detail.open).toHaveBeenCalledTimes(2)
  })

  it('ouverture depuis la liste : le changement de query qu’elle provoque ne relit pas la fiche', async () => {
    const { api, detail } = setup()
    await api.openPayment(P1)
    await flushPromises()
    expect(detail.open).toHaveBeenCalledTimes(1)
  })

  it('identifiant ouvert depuis la liste qui n’est pas un UUID (ancien jeu de données) : la fiche reste ouverte', async () => {
    const { api, detail } = setup()
    await api.openPayment('p1')
    await flushPromises()
    expect(route.query).toEqual({ open: 'p1' })
    expect(detail.close).not.toHaveBeenCalled()
    api.setSection('money')
    await flushPromises()
    expect(api.section.value).toBe('money')
    expect(detail.close).not.toHaveBeenCalled()
  })

  it('section changée par un lien sur la fiche déjà ouverte : l’onglet suit', async () => {
    const { api, detail } = setup()
    await api.openPayment(P1)
    route.query = { open: P1, section: 'incidents' }
    await flushPromises()
    expect(api.section.value).toBe('incidents')
    expect(detail.open).toHaveBeenCalledTimes(1)
  })

  it('?open= retiré de l’URL par ailleurs (changement d’onglet) : tiroir fermé, sans réécriture', async () => {
    const { api, detail } = setup()
    await api.openPayment(P1)
    replace.mockClear()
    route.query = { tab: 'wallets' }
    await flushPromises()
    expect(detail.close).toHaveBeenCalled()
    expect(api.openId.value).toBeNull()
    expect(replace).not.toHaveBeenCalled()
  })

  it('tabQuery : quitter Paiements retire open et section', async () => {
    const { api } = setup()
    await api.openPayment(P1, 'money')
    expect(api.tabQuery('wallets')).toEqual({ tab: 'wallets' })
    expect(api.tabQuery('payments')).toEqual({ open: P1, section: 'money' })
  })
  it('?section= inconnu au chargement : la fiche s’ouvre sur Résumé et le paramètre est retiré de l’URL', async () => {
    const { api, detail } = setup({ open: P1, section: 'pirate', view: 'ALL' })
    await api.restore()
    expect(detail.open).toHaveBeenCalledWith(P1)
    expect(api.section.value).toBeNull()
    expect(route.query).toEqual({ open: P1, view: 'ALL' })
  })

  it('?section= inconnu arrivé sur la fiche ouverte : retiré de l’URL, Résumé', async () => {
    const { api, detail } = setup()
    await api.openPayment(P1, 'money')
    route.query = { open: P1, section: 'pirate' }
    await flushPromises()
    expect(api.section.value).toBeNull()
    expect(route.query).toEqual({ open: P1 })
    expect(detail.open).toHaveBeenCalledTimes(1)
  })
})
