/** Page Audit : `?entityType=&entityId=` préremplissent et appliquent les filtres ; l'état des filtres vit dans l'URL. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { reactive } from 'vue'
import { seedAuth } from '~/tests/helpers/auth'

vi.stubGlobal('definePageMeta', vi.fn())
const replaceMock = vi.fn()
vi.stubGlobal('useRouter', () => ({ replace: replaceMock }))
const route = reactive<{ path: string; query: Record<string, string> }>({ path: '/audit', query: {} })
vi.stubGlobal('useRoute', () => route)

const svc = vi.hoisted(() => ({ list: vi.fn() }))
vi.mock('@/features/audit/services/auditService', () => ({ auditService: svc }))

const P = '0a1b2c3d-1111-4222-8333-444455556666'
const empty = { content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 }

const mounted: VueWrapper[] = []
async function mountPage() {
  const mod = await import('@/pages/audit/index.vue')
  const w = mount(mod.default, { global: { stubs: { PaginationControls: true, AuditTable: true } } })
  mounted.push(w)
  await flushPromises()
  return w
}
const lastFilters = () => svc.list.mock.calls.at(-1)![0]
const value = (w: VueWrapper, t: string) => (w.get(`[data-test="${t}"]`).element as HTMLInputElement).value

describe('pages/audit', () => {
  afterEach(() => { mounted.splice(0).forEach(w => w.unmount()) })
  beforeEach(() => {
    seedAuth('ADMIN')
    route.path = '/audit'
    route.query = {}
    svc.list.mockReset().mockResolvedValue(empty)
    replaceMock.mockReset().mockImplementation(({ query }: { query: Record<string, string> }) => { route.query = query; return Promise.resolve() })
  })

  it('sans paramètre : chargement sans filtre, URL intacte', async () => {
    await mountPage()
    expect(svc.list).toHaveBeenCalledTimes(1)
    expect(lastFilters()).toMatchObject({ action: null, entityType: null, entityId: null })
    expect(replaceMock).not.toHaveBeenCalled()
  })

  it('?entityType=PAYMENT&entityId=<uuid> : champs préremplis et filtres envoyés dès le premier chargement', async () => {
    route.query = { entityType: 'PAYMENT', entityId: P }
    const w = await mountPage()
    expect(value(w, 'filter-entity')).toBe('PAYMENT')
    expect(value(w, 'filter-entity-id')).toBe(P)
    expect(svc.list).toHaveBeenCalledTimes(1)
    expect(lastFilters()).toMatchObject({ entityType: 'PAYMENT', entityId: P })
  })

  it('entityId mal formé : ignoré (non envoyé, champ vide)', async () => {
    route.query = { entityType: 'PAYMENT', entityId: 'nimporte' }
    const w = await mountPage()
    expect(value(w, 'filter-entity-id')).toBe('')
    expect(lastFilters().entityId).toBeNull()
    expect(lastFilters().entityType).toBe('PAYMENT')
  })

  it('Filtrer écrit les filtres dans l’URL (router.replace) ; Réinitialiser les retire', async () => {
    route.query = { other: 'x' }
    const w = await mountPage()
    await w.get('[data-test="filter-entity"]').setValue('PAYMENT')
    await w.get('[data-test="filter-entity-id"]').setValue(P)
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(replaceMock).toHaveBeenLastCalledWith({ query: { other: 'x', entityType: 'PAYMENT', entityId: P } })
    expect(lastFilters()).toMatchObject({ entityType: 'PAYMENT', entityId: P })
    const calls = svc.list.mock.calls.length
    await w.get('[data-test="reset-filters"]').trigger('click')
    await flushPromises()
    expect(replaceMock).toHaveBeenLastCalledWith({ query: { other: 'x' } })
    expect(value(w, 'filter-entity-id')).toBe('')
    expect(lastFilters()).toMatchObject({ entityType: null, entityId: null })
    // Un seul chargement par geste : l'écriture de l'URL ne recharge pas une seconde fois.
    expect(svc.list.mock.calls.length).toBe(calls + 1)
  })

  it('page quittée : la query de la page suivante n’est pas lue comme des filtres', async () => {
    await mountPage()
    route.path = '/transactions'
    route.query = { entityType: 'PAYMENT', entityId: P }
    await flushPromises()
    expect(svc.list).toHaveBeenCalledTimes(1)
  })

  it('page déjà ouverte : un nouveau lien (query seule) applique ses filtres', async () => {
    await mountPage()
    route.query = { entityType: 'PAYMENT', entityId: P }
    await flushPromises()
    expect(lastFilters()).toMatchObject({ entityType: 'PAYMENT', entityId: P })
    expect(svc.list).toHaveBeenCalledTimes(2)
  })
})
