/**
 * Page /incidents : onglet actif porté par l'URL (?tab=disputes|noshows), liens profonds des
 * notifications DISPUTE_OPENED et NOSHOW_PENDING.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { reactive } from 'vue'
import { seedAuth } from '~/tests/helpers/auth'

vi.stubGlobal('definePageMeta', vi.fn())
const replaceMock = vi.fn()
vi.stubGlobal('useRouter', () => ({ replace: replaceMock }))
const route = reactive<{ meta: Record<string, unknown>; query: Record<string, string> }>({ meta: {}, query: {} })
vi.stubGlobal('useRoute', () => route)

const incidents = vi.hoisted(() => ({ listDisputes: vi.fn(), listCancellations: vi.fn(), getDispute: vi.fn(), confirmNoShow: vi.fn() }))
vi.mock('@/features/incidents/services/incidentsService', () => ({ incidentsService: incidents }))

const empty = { content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 }

// Une page d'un test précédent encore montée réagirait aux changements de la route partagée.
const mounted: VueWrapper[] = []
async function mountPage() {
  const mod = await import('@/pages/incidents/index.vue')
  const w = mount(mod.default, { global: { stubs: { DisputesTable: true, NoShowsTable: true, DisputeDetailPanel: true, PaginationControls: true } } })
  mounted.push(w)
  await flushPromises()
  return w
}
const pressed = (w: Awaited<ReturnType<typeof mountPage>>, t: string) => w.find(`[data-test="tab-${t}"]`).attributes('aria-pressed')

describe('/incidents : onglet dans l’URL', () => {
  afterEach(() => { mounted.splice(0).forEach((w) => w.unmount()) })
  beforeEach(() => {
    vi.clearAllMocks()
    seedAuth('ADMIN')
    route.query = {}
    incidents.listDisputes.mockResolvedValue(empty)
    incidents.listCancellations.mockResolvedValue(empty)
    replaceMock.mockResolvedValue(undefined)
  })

  it('sans paramètre : Litiges', async () => {
    const w = await mountPage()
    expect(pressed(w, 'disputes')).toBe('true')
    expect(incidents.listCancellations).not.toHaveBeenCalled()
  })

  it('?tab=noshows : onglet No-shows actif et chargé dès le montage', async () => {
    route.query = { tab: 'noshows' }
    const w = await mountPage()
    expect(pressed(w, 'noshows')).toBe('true')
    expect(incidents.listCancellations).toHaveBeenCalledTimes(1)
    expect(replaceMock).not.toHaveBeenCalled()
  })

  it('?tab=disputes et valeur inconnue : Litiges', async () => {
    route.query = { tab: 'disputes' }
    expect(pressed(await mountPage(), 'disputes')).toBe('true')
    route.query = { tab: 'nimporte' }
    expect(pressed(await mountPage(), 'disputes')).toBe('true')
  })

  it('navigation interne vers ?tab=noshows alors que la page est ouverte', async () => {
    const w = await mountPage()
    route.query = { tab: 'noshows' }
    await flushPromises()
    expect(pressed(w, 'noshows')).toBe('true')
    route.query = { tab: 'disputes' }
    await flushPromises()
    expect(pressed(w, 'disputes')).toBe('true')
  })

  it('un clic sur un onglet le reporte dans l’URL sans perdre les autres paramètres', async () => {
    route.query = { foo: 'bar' }
    const w = await mountPage()
    await w.find('[data-test="tab-noshows"]').trigger('click')
    await flushPromises()
    expect(replaceMock).toHaveBeenLastCalledWith({ query: { foo: 'bar', tab: 'noshows' } })
    route.query = { foo: 'bar', tab: 'noshows' }
    await w.find('[data-test="tab-disputes"]').trigger('click')
    await flushPromises()
    expect(replaceMock).toHaveBeenLastCalledWith({ query: { foo: 'bar' } })
  })
})
