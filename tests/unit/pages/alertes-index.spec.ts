/** Page Alertes : poste de traitement (file groupée, dossier, décision) et lien profond. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { reactive } from 'vue'
import { seedAuth } from '~/tests/helpers/auth'

vi.stubGlobal('definePageMeta', vi.fn())
const replaceMock = vi.fn()
vi.stubGlobal('useRouter', () => ({ replace: replaceMock }))
const route = reactive<{ path: string; query: Record<string, string> }>({ path: '/alertes', query: {} })
vi.stubGlobal('useRoute', () => route)

const svc = vi.hoisted(() => ({
  list: vi.fn(), resolve: vi.fn(), violations: vi.fn(), get: vi.fn(),
  getContext: vi.fn(), resolveBatch: vi.fn(), reopen: vi.fn(), snooze: vi.fn(), unsnooze: vi.fn(),
}))
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
const escrow = (id: string, createdAt: string, over: Record<string, unknown> = {}) => ({
  id, type: 'ESCROW_J48_TIMEOUT', severity: 'WARN', detail: `Paiement ${id} en séquestre`,
  payload: {}, resolved: false, resolvedAt: null, createdAt, ...over,
})
const row = escrow('a1', '2026-10-06T12:00:00')

let openRows: Record<string, unknown>[]
const pageOf = (content: unknown[]) => ({ content, totalElements: content.length, totalPages: 1, number: 0, size: 100 })

/** Lectures de la file (page de 100) : on ne compte pas celles du bandeau de synthèse. */
const queueReads = () => svc.list.mock.calls.filter(c => c[2] === 100 && c[0].resolved === 'OPEN')

// Une page d'un test précédent encore montée réagirait aux changements de la route partagée.
const mounted: VueWrapper[] = []
async function mountPage() {
  const mod = await import('@/pages/alertes/index.vue')
  const w = mount(mod.default, { attachTo: document.body, global: { stubs: { PaginationControls: true, NuxtLink: true } } })
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
    openRows = [row]
    svc.list.mockReset().mockImplementation(async (f: { resolved: string; severity: string | null }) => {
      if (f.resolved === 'RESOLVED') return pageOf([])
      return pageOf(openRows.filter(a => !f.severity || a.severity === f.severity))
    })
    svc.resolve.mockReset().mockImplementation(async (id: string) => {
      openRows = openRows.filter(a => a.id !== id)
      return { id, resolved: true }
    })
    svc.violations.mockReset()
    // Ancien back par défaut : pas de contexte, pas de résolution groupée ; chaque test le branche s'il en a besoin.
    const missing = () => Object.assign(new Error('Not Found'), { statusCode: 404 })
    svc.getContext.mockReset().mockRejectedValue(missing())
    svc.resolveBatch.mockReset().mockRejectedValue(missing())
    svc.reopen.mockReset()
    svc.snooze.mockReset()
    svc.unsnooze.mockReset()
  })

  it('ouvre d’emblée la première alerte de la file : dossier et décision à côté', async () => {
    const w = await mountPage()
    expect(w.get('[data-test="alert-detail-title"]').text()).toBe('Paiement en séquestre depuis plus de 48 h')
    expect(w.find('[data-test="alert-decision-panel"]').exists()).toBe(true)
    expect(replaceMock).not.toHaveBeenCalled()
  })

  it('bandeau de synthèse : compte les ouvertes par sévérité', async () => {
    openRows = [recon, row, escrow('a3', '2026-10-05T12:00:00')]
    const w = await mountPage()
    expect(w.get('[data-test="summary-CRITICAL"]').text()).toContain('1')
    expect(w.get('[data-test="summary-WARN"]').text()).toContain('2')
    expect(w.get('[data-test="summary-WARN"]').text()).toContain('en 1 groupe')
  })

  it('un compteur filtre la file par sévérité, et un second clic retire le filtre', async () => {
    openRows = [recon, row]
    const w = await mountPage()
    await w.get('[data-test="summary-CRITICAL"]').trigger('click')
    await flushPromises()
    expect(svc.list.mock.calls.at(-1)![0].severity).toBe('CRITICAL')
    expect(w.get('[data-test="summary-CRITICAL"]').attributes('aria-pressed')).toBe('true')
    await w.get('[data-test="summary-CRITICAL"]').trigger('click')
    await flushPromises()
    expect(svc.list.mock.calls.at(-1)![0].severity).toBeNull()
  })

  it('« Résolues cette semaine » ouvre l’onglet des résolues ; les onglets rechargent la file', async () => {
    const w = await mountPage()
    await w.get('[data-test="summary-RESOLVED"]').trigger('click')
    await flushPromises()
    expect(svc.list.mock.calls.at(-1)![0].resolved).toBe('RESOLVED')
    await w.get('[data-test="tab-ALL"]').trigger('click')
    await flushPromises()
    expect(svc.list.mock.calls.at(-1)![0].resolved).toBe('ALL')
  })

  it('compteurs en panne : le poste reste utilisable', async () => {
    svc.list.mockImplementation(async (f: { resolved: string }, _p: number, size: number) => {
      if (size === 200) throw new Error('boom')
      return f.resolved === 'OPEN' ? pageOf([row]) : pageOf([])
    })
    const w = await mountPage()
    expect(w.find('[data-test="alert-row-a1"]').exists()).toBe(true)
    expect(w.get('[data-test="summary-CRITICAL"]').text()).toContain('0')
  })

  it('regroupe les alertes de même type : ×2, déplié au clic, première alerte ouverte', async () => {
    openRows = [row, escrow('a3', '2026-10-01T12:00:00')]
    const w = await mountPage()
    // La plus ancienne (a3) est celle qu'on traite d'abord.
    expect(w.get('[data-test="alert-group-toggle-Paiement en séquestre depuis plus de 48 h"]').text()).toContain('×2')
    expect(w.get('[data-test="alert-row-a3"]').attributes('data-selected')).toBe('true')
    expect(w.find('[data-test="alert-row-a1"]').exists()).toBe(true)
  })

  it('recherche et catégorie réduisent la file sans recharger', async () => {
    openRows = [row, recon]
    const w = await mountPage()
    const calls = svc.list.mock.calls.length
    await w.get('[data-test="alert-search"]').setValue(P)
    expect(w.find('[data-test="alert-row-a2"]').exists()).toBe(true)
    expect(w.find('[data-test="alert-row-a1"]').exists()).toBe(false)
    await w.get('[data-test="alert-search"]').setValue('')
    await w.get('[data-test="category-Séquestre"]').trigger('click')
    expect(w.find('[data-test="alert-row-a1"]').exists()).toBe(true)
    expect(w.find('[data-test="alert-row-a2"]').exists()).toBe(false)
    await w.get('[data-test="category-Séquestre"]').trigger('click')
    expect(w.find('[data-test="alert-row-a2"]').exists()).toBe(true)
    expect(svc.list.mock.calls.length).toBe(calls)
  })

  it('une recherche qui exclut l’alerte ouverte ouvre la première restante, puis rien quand la file est vide', async () => {
    openRows = [row, recon]
    const w = await mountPage()
    await w.get('[data-test="alert-search"]').setValue('séquestre')
    expect(w.get('[data-test="alert-detail-title"]').text()).toBe('Paiement en séquestre depuis plus de 48 h')
    await w.get('[data-test="alert-search"]').setValue('introuvable-xyz')
    expect(w.find('[data-test="alert-case-empty"]').exists()).toBe(true)
  })

  it('résout l’alerte avec une note et passe à la suivante', async () => {
    openRows = [recon, row]
    const w = await mountPage()
    expect(w.get('[data-test="alert-row-a2"]').attributes('data-selected')).toBe('true')
    await w.get('[data-test="alert-note"]').setValue('Colis encore en route, rien à faire')
    await w.get('[data-test="alert-confirm"]').trigger('click')
    await flushPromises()
    expect(svc.resolve).toHaveBeenCalledWith('a2', 'Colis encore en route, rien à faire')
    expect(w.get('[data-test="alerts-done"]').text()).toBe('Alerte résolue.')
    expect(w.get('[data-test="alert-row-a1"]').attributes('data-selected')).toBe('true')
    expect(replaceMock).toHaveBeenLastCalledWith({ query: { open: 'a1' } })
  })

  it('faux positif : la note envoyée au back le dit', async () => {
    const w = await mountPage()
    await w.get('[data-test="alert-action-FALSE_POSITIVE"] input').setValue(true)
    await w.get('[data-test="alert-note"]').setValue('Règle trop sensible')
    await w.get('[data-test="alert-confirm"]').trigger('click')
    await flushPromises()
    expect(svc.resolve).toHaveBeenCalledWith('a1', 'Faux positif : Règle trop sensible')
  })

  it('dernière alerte résolue : le dossier se vide et ?open est retiré', async () => {
    route.query = { open: 'a1' }
    const w = await mountPage()
    await w.get('[data-test="alert-note"]').setValue('Corrigé à la main')
    await w.get('[data-test="alert-confirm"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="alert-case-empty"]').exists()).toBe(true)
    expect(replaceMock).toHaveBeenLastCalledWith({ query: {} })
  })

  it('refus du back : l’erreur se lit dans le panneau et la saisie reste', async () => {
    svc.resolve.mockRejectedValue(Object.assign(new Error('Forbidden'), { data: { detail: 'Permission requise' } }))
    const w = await mountPage()
    await w.get('[data-test="alert-note"]').setValue('Corrigé à la main')
    await w.get('[data-test="alert-confirm"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-test="alert-error"]').text()).toBeTruthy()
    expect((w.get('[data-test="alert-note"]').element as HTMLTextAreaElement).value).toBe('Corrigé à la main')
    expect(w.find('[data-test="alerts-done"]').exists()).toBe(false)
  })

  it('résout tout le groupe d’un coup avec une seule note', async () => {
    openRows = [row, escrow('a3', '2026-10-01T12:00:00'), escrow('a4', '2026-10-02T12:00:00'), recon]
    const w = await mountPage()
    // La critique passe en tête : on ouvre le groupe « séquestre ».
    await w.get('[data-test="alert-group-toggle-Paiement en séquestre depuis plus de 48 h"]').trigger('click')
    await flushPromises()
    await w.get('[data-test="scope-group"]').trigger('click')
    await w.get('[data-test="alert-note"]').setValue('Versement forcé')
    await w.get('[data-test="alert-acknowledge"]').setValue(true)
    await w.get('[data-test="alert-confirm"]').trigger('click')
    await flushPromises()
    expect(svc.resolve.mock.calls.map(c => c[0]).sort()).toEqual(['a1', 'a3', 'a4'])
    expect(svc.resolve.mock.calls.every(c => c[1] === 'Versement forcé')).toBe(true)
    expect(w.get('[data-test="alerts-done"]').text()).toBe('3 alertes résolues.')
    expect(w.get('[data-test="alert-row-a2"]').attributes('data-selected')).toBe('true')
  })

  it('résolution de groupe partielle : les refusées restent ouvertes et sont annoncées', async () => {
    openRows = [row, escrow('a3', '2026-10-01T12:00:00')]
    svc.resolve.mockImplementation(async (id: string) => {
      if (id === 'a1') throw new Error('403')
      openRows = openRows.filter(a => a.id !== id)
      return { id, resolved: true }
    })
    const w = await mountPage()
    await w.get('[data-test="scope-group"]').trigger('click')
    await w.get('[data-test="alert-note"]').setValue('Versement forcé')
    await w.get('[data-test="alert-acknowledge"]').setValue(true)
    await w.get('[data-test="alert-confirm"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-test="alert-error"]').text()).toContain('1 alerte n’a pas pu être résolue : elle reste ouverte.')
    expect(w.find('[data-test="alert-row-a1"]').exists()).toBe(true)
    expect(w.find('[data-test="alert-row-a3"]').exists()).toBe(false)
  })

  it('serveur à jour : le groupe part en une seule requête', async () => {
    openRows = [row, escrow('a3', '2026-10-01T12:00:00'), escrow('a4', '2026-10-02T12:00:00')]
    svc.resolveBatch.mockImplementation(async (ids: string[]) => {
      openRows = openRows.filter(a => !ids.includes(a.id as string))
      return { resolved: ids, alreadyResolved: [], notFound: [] }
    })
    const w = await mountPage()
    await w.get('[data-test="scope-group"]').trigger('click')
    await w.get('[data-test="alert-note"]').setValue('Versement forcé')
    await w.get('[data-test="alert-acknowledge"]').setValue(true)
    await w.get('[data-test="alert-confirm"]').trigger('click')
    await flushPromises()
    expect(svc.resolveBatch).toHaveBeenCalledTimes(1)
    expect([...svc.resolveBatch.mock.calls[0]![0]].sort()).toEqual(['a1', 'a3', 'a4'])
    expect(svc.resolve).not.toHaveBeenCalled()
    expect(w.get('[data-test="alerts-done"]').text()).toBe('3 alertes résolues.')
  })

  it('reporter : la note et la durée partent au back, l’alerte quitte la file ouverte', async () => {
    openRows = [recon, row]
    svc.snooze.mockImplementation(async (id: string) => {
      openRows = openRows.filter(a => a.id !== id)
      return { id }
    })
    const w = await mountPage()
    await w.get('[data-test="alert-action-SNOOZE"] input').setValue(true)
    await w.get('[data-test="snooze-72"]').trigger('click')
    await w.get('[data-test="alert-note"]').setValue('Colis encore en route')
    await w.get('[data-test="alert-confirm"]').trigger('click')
    await flushPromises()
    expect(svc.snooze).toHaveBeenCalledWith('a2', 72, 'Colis encore en route')
    expect(w.get('[data-test="alerts-done"]').text()).toContain('reportée')
    expect(w.get('[data-test="alert-row-a1"]').attributes('data-selected')).toBe('true')
  })

  it('reporter sur un ancien back : message clair, le geste disparaît de la décision', async () => {
    svc.snooze.mockRejectedValue(Object.assign(new Error('Not Found'), { statusCode: 404 }))
    const w = await mountPage()
    await w.get('[data-test="alert-action-SNOOZE"] input').setValue(true)
    await w.get('[data-test="alert-note"]').setValue('Colis encore en route')
    await w.get('[data-test="alert-confirm"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-test="alert-error"]').text()).toContain('Indisponible tant que le serveur n’est pas mis à jour')
    expect(w.find('[data-test="alert-action-SNOOZE"]').exists()).toBe(false)
  })

  it('l’onglet Reportées interroge le back et n’affiche que les alertes reportées', async () => {
    const snoozed = { ...recon, snoozedUntil: '2999-01-01T00:00:00Z' }
    svc.list.mockImplementation(async (f: { resolved: string }) => (f.resolved === 'SNOOZED' ? pageOf([snoozed, row]) : pageOf([])))
    const w = await mountPage()
    await w.get('[data-test="tab-SNOOZED"]').trigger('click')
    await flushPromises()
    expect(svc.list.mock.calls.at(-1)![0].resolved).toBe('SNOOZED')
    expect(w.find('[data-test="alert-row-a2"]').exists()).toBe(true)
    // Un ancien back rend aussi les non reportées : l'écran les écarte.
    expect(w.find('[data-test="alert-row-a1"]').exists()).toBe(false)
    expect(w.get('[data-test="alert-detail-snoozed"]').text()).toContain('Reportée jusqu’au')
    expect(w.find('[data-test="alert-action-UNSNOOZE"]').exists()).toBe(true)
  })

  it('un ancien back qui rend une alerte reportée dans « Ouvertes » : elle en est écartée', async () => {
    openRows = [{ ...recon, snoozedUntil: '2999-01-01T00:00:00Z' }, row]
    const w = await mountPage()
    expect(w.find('[data-test="alert-row-a2"]').exists()).toBe(false)
    expect(w.find('[data-test="alert-row-a1"]').exists()).toBe(true)
  })

  it('remettre dans la file : sans note', async () => {
    svc.list.mockImplementation(async (f: { resolved: string }) => (f.resolved === 'SNOOZED' ? pageOf([{ ...recon, snoozedUntil: '2999-01-01T00:00:00Z' }]) : pageOf([])))
    svc.unsnooze.mockResolvedValue({})
    const w = await mountPage()
    await w.get('[data-test="tab-SNOOZED"]').trigger('click')
    await flushPromises()
    await w.get('[data-test="alert-action-UNSNOOZE"] input').setValue(true)
    await w.get('[data-test="alert-confirm"]').trigger('click')
    await flushPromises()
    expect(svc.unsnooze).toHaveBeenCalledWith('a2')
    expect(w.get('[data-test="alerts-done"]').text()).toBe('Alerte remise dans la file.')
  })

  it('rouvrir une alerte résolue depuis l’onglet Résolues, puis son historique est relu', async () => {
    const done = { ...recon, resolved: true, resolvedAt: '2026-10-11T10:00:00Z' }
    svc.list.mockImplementation(async (f: { resolved: string }) => (f.resolved === 'RESOLVED' ? pageOf([done]) : pageOf([])))
    svc.reopen.mockResolvedValue({})
    const w = await mountPage()
    await w.get('[data-test="tab-RESOLVED"]').trigger('click')
    await flushPromises()
    svc.getContext.mockClear()
    await w.get('[data-test="alert-quick-L’anomalie est revenue"]').trigger('click')
    await w.get('[data-test="alert-confirm"]').trigger('click')
    await flushPromises()
    expect(svc.reopen).toHaveBeenCalledWith('a2', 'L’anomalie est revenue')
    expect(w.get('[data-test="alerts-done"]').text()).toBe('Alerte rouverte.')
    expect(svc.getContext).toHaveBeenCalledWith('a2')
  })

  it('contexte : autres alertes du même paiement et historique ; un clic ouvre l’autre alerte', async () => {
    openRows = [recon, row]
    svc.getContext.mockImplementation(async (id: string) => (id === 'a2'
      ? { related: [{ id: 'a1', type: 'ESCROW_J48_TIMEOUT', severity: 'WARN', resolved: false, createdAt: '2026-10-06T12:00:00' }],
          history: [{ action: 'ADMIN_ALERT_RESOLVED', at: '2026-10-12T10:00:00', actorEmail: 'moussa@yadony.com', note: 'ok' }] }
      : { related: [], history: [] }))
    const w = await mountPage()
    expect(w.get('[data-test="alert-related"]').text()).toContain('Paiement en séquestre depuis plus de 48 h')
    expect(w.get('[data-test="alert-history"]').text()).toContain('par moussa@yadony.com')
    await w.get('[data-test="alert-related-a1"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-test="alert-row-a1"]').attributes('data-selected')).toBe('true')
    expect(replaceMock).toHaveBeenLastCalledWith({ query: { open: 'a1' } })
  })

  it('autre alerte hors de la file : lue par identifiant', async () => {
    const A = '0a1b2c3d-1111-4222-8333-444455556666'
    openRows = [recon]
    svc.getContext.mockResolvedValue({ related: [{ id: A, type: 'ESCROW_J48_TIMEOUT', severity: 'WARN', resolved: true, createdAt: '2026-10-06T12:00:00' }], history: [] })
    svc.get.mockResolvedValue(escrow(A, '2026-10-06T12:00:00', { detail: 'Hors de la file', resolved: true, resolvedAt: '2026-10-07T12:00:00' }))
    const w = await mountPage()
    await w.get(`[data-test="alert-related-${A}"]`).trigger('click')
    await flushPromises()
    expect(svc.get).toHaveBeenCalledWith(A)
    expect(w.get('[data-test="alert-detail-summary"]').text()).toBe('Hors de la file')
    expect(replaceMock).toHaveBeenLastCalledWith({ query: { open: A } })
  })

  it('J / K parcourent la file, ⏎ confirme la décision, 2 choisit le faux positif', async () => {
    openRows = [recon, row]
    const w = await mountPage()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j' }))
    await flushPromises()
    expect(w.get('[data-test="alert-row-a1"]').attributes('data-selected')).toBe('true')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k' }))
    await flushPromises()
    expect(w.get('[data-test="alert-row-a2"]').attributes('data-selected')).toBe('true')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '2' }))
    await w.get('[data-test="alert-note"]').setValue('Règle trop sensible')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true }))
    await flushPromises()
    expect(svc.resolve).toHaveBeenCalledWith('a2', 'Faux positif : Règle trop sensible')
  })

  it('resynchronisation Stripe : l’alerte résolue par le back passe « Résolue » dans la liste et le dossier', async () => {
    seedAuth('SUPER_ADMIN')
    openRows = [row, recon]
    paySvc.get.mockReset().mockResolvedValue({ id: P, status: 'PENDING', method: 'STRIPE', amountCents: 6450, commissionCents: 774, currency: 'EUR' })
    paySvc.resyncStripe.mockReset().mockResolvedValue(resyncResult)
    const w = await mountPage()
    await flushPromises()
    await w.get('[data-test="resync-stripe"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-test="alert-row-a2"]').text()).toContain('Résolue')
    expect(w.get('[data-test="alert-row-a1"]').text()).not.toContain('Résolue')
    expect(w.get('[data-test="alert-detail-state"]').text()).toContain('Résolue le')
    expect(w.find('[data-test="alert-action-REOPEN"]').exists()).toBe(true)
    expect(queueReads()).toHaveLength(1)
  })

  it('versement forcé : la file est rechargée et le dossier garde ses données fraîches', async () => {
    seedAuth('SUPER_ADMIN')
    openRows = [recon]
    paySvc.get.mockReset().mockResolvedValue({ id: P, status: 'ESCROW', method: 'STRIPE', amountCents: 6450, commissionCents: 774, currency: 'EUR' })
    paySvc.forceRelease.mockReset().mockResolvedValue({ id: P, status: 'RELEASED', method: 'STRIPE', amountCents: 6450, commissionCents: 774, currency: 'EUR' })
    const w = await mountPage()
    await w.get('[data-test="alert-fix-release"]').trigger('click')
    openRows = [{ ...recon, detail: 'rafraîchie' }]
    await w.findAll('[data-test="confirm"]').at(-1)!.trigger('click')
    await flushPromises()
    expect(paySvc.forceRelease).toHaveBeenCalledWith(P)
    expect(queueReads()).toHaveLength(2)
    expect(w.get('[data-test="alert-detail-summary"]').text()).toBe('rafraîchie')
  })

  it('« Marquer comme résolue » du dossier met la main sur la décision', async () => {
    seedAuth('SUPER_ADMIN')
    openRows = [recon]
    paySvc.get.mockReset().mockResolvedValue({ id: P, status: 'PENDING', method: 'STRIPE', amountCents: 6450, commissionCents: 774, currency: 'EUR' })
    paySvc.resyncStripe.mockReset().mockResolvedValue({ ...resyncResult, resolvedAlertIds: [], alertResolvable: true })
    const w = await mountPage()
    await w.get('[data-test="resync-stripe"]').trigger('click')
    await flushPromises()
    await w.get('[data-test="alert-fix-resolve"]').trigger('click')
    await flushPromises()
    expect(document.activeElement?.id).toBe('alert-note')
  })

  describe('lien profond ?open=<alerte>', () => {
    const A = '0a1b2c3d-1111-4222-8333-444455556666'
    const far = escrow(A, '2026-10-06T12:00:00', { detail: 'Hors de la page', resolved: true, resolvedAt: '2026-10-07T12:00:00' })

    it('page sans ?open : aucune lecture par identifiant, URL intacte', async () => {
      await mountPage()
      expect(svc.get).not.toHaveBeenCalled()
      expect(replaceMock).not.toHaveBeenCalled()
    })

    it('?open=<id> de la liste : ouverte sans lecture supplémentaire', async () => {
      openRows = [row, recon]
      route.query = { open: 'a2' }
      const w = await mountPage()
      expect(svc.get).not.toHaveBeenCalled()
      expect(w.get('[data-test="alert-row-a2"]').attributes('data-selected')).toBe('true')
    })

    it('?open=<id> hors de la liste : lue via alertsService.get et gardée ouverte', async () => {
      svc.get.mockResolvedValue(far)
      route.query = { open: A }
      const w = await mountPage()
      expect(svc.get).toHaveBeenCalledWith(A)
      expect(w.get('[data-test="alert-detail-summary"]').text()).toBe('Hors de la page')
      expect(w.find('[data-test="alert-action-REOPEN"]').exists()).toBe(true)
    })

    it('404 : « Alerte introuvable », la file reste utilisable et ouvre la première alerte', async () => {
      svc.get.mockRejectedValue(Object.assign(new Error('Not Found'), { statusCode: 404 }))
      route.query = { open: A }
      const w = await mountPage()
      expect(w.get('[data-test="alert-open-error"]').text()).toContain('Alerte introuvable')
      expect(w.find('[data-test="alert-row-a1"]').exists()).toBe(true)
      expect(w.get('[data-test="alert-row-a1"]').attributes('data-selected')).toBe('true')
    })

    it('page déjà ouverte : un changement de query seul ouvre l’alerte', async () => {
      svc.get.mockResolvedValue(far)
      const w = await mountPage()
      route.query = { open: A }
      await flushPromises()
      expect(w.get('[data-test="alert-detail-summary"]').text()).toBe('Hors de la page')
    })

    it('lien introuvable puis retrait de ?open (retour arrière) : le message d’erreur disparaît', async () => {
      svc.get.mockRejectedValue(Object.assign(new Error('Not Found'), { statusCode: 404 }))
      route.query = { open: A }
      const w = await mountPage()
      expect(w.find('[data-test="alert-open-error"]').exists()).toBe(true)
      route.query = {}
      await flushPromises()
      expect(w.find('[data-test="alert-open-error"]').exists()).toBe(false)
    })

    it('page quittée : le ?open= de la page suivante (un paiement) n’est pas lu comme une alerte', async () => {
      await mountPage()
      route.path = '/transactions'
      route.query = { open: A }
      await flushPromises()
      expect(svc.get).not.toHaveBeenCalled()
      route.path = '/alertes'
    })

    it('choisir une alerte dans la file écrit ?open dans l’URL', async () => {
      openRows = [recon, row]
      const w = await mountPage()
      await w.get('[data-test="alert-open-a1"]').trigger('click')
      await flushPromises()
      expect(replaceMock).toHaveBeenLastCalledWith({ query: { open: 'a1' } })
      expect(svc.get).not.toHaveBeenCalled()
    })
  })
})
