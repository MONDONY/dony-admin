/**
 * Page /support : lien profond ?ticket=<id> (notifications SUPPORT_*) qui ouvre le fil du ticket,
 * au montage comme à une navigation interne quand la page est déjà ouverte.
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

const support = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn() }))
vi.mock('@/features/support/services/supportService', () => ({ supportService: support }))

const ticket = (id: string) => ({
  id, category: 'PAIEMENT', subject: `Sujet ${id}`, status: 'ASSIGNED', priority: 'NORMAL', userId: 'u1', userDisplayName: 'Awa',
  assignedAdminId: 'x', assignedAdminEmail: 'x@yadony.com', createdAt: '2026-09-28T10:00:00Z', lastMessageAt: '2026-09-28T10:00:00Z',
  resolvedAt: null, messages: [],
})
const page = (content: unknown[]) => ({ content, totalElements: content.length, totalPages: 1, number: 0, size: 20 })

const ThreadStub = { name: 'SupportTicketThread', props: ['ticket'], emits: ['close'], template: '<div data-test="thread">{{ ticket.id }}<button data-test="thread-close" @click="$emit(\'close\')" /></div>' }

// Une page d'un test précédent encore montée réagirait aux changements de la route partagée.
const mounted: VueWrapper[] = []
async function mountPage() {
  const mod = await import('@/pages/support/index.vue')
  const w = mount(mod.default, { global: { stubs: { SupportTicketThread: ThreadStub, PaginationControls: true, SupportTicketsTable: true } } })
  mounted.push(w)
  await flushPromises()
  return w
}

describe('/support : lien profond ?ticket=', () => {
  afterEach(() => { mounted.splice(0).forEach((w) => w.unmount()) })
  beforeEach(() => {
    vi.clearAllMocks()
    seedAuth('ADMIN')
    route.query = {}
    support.list.mockResolvedValue(page([ticket('t1')]))
    support.get.mockImplementation((id: string) => Promise.resolve(ticket(id)))
    replaceMock.mockResolvedValue(undefined)
  })

  it('sans paramètre : aucun fil ouvert, périmètre « Non assignés »', async () => {
    const w = await mountPage()
    expect(support.get).not.toHaveBeenCalled()
    expect(w.find('[data-test="thread"]').exists()).toBe(false)
    expect(support.list.mock.calls[0]![0]).toBe('unassigned')
  })

  it('?ticket= d’un ticket de la file : fil ouvert, périmètre inchangé', async () => {
    route.query = { ticket: 't1' }
    const w = await mountPage()
    expect(support.get).toHaveBeenCalledWith('t1')
    expect(w.find('[data-test="thread"]').text()).toContain('t1')
    expect(support.list).toHaveBeenCalledTimes(1)
  })

  it('?ticket= hors du périmètre courant : bascule sur « Tous » pour le retrouver dans la liste', async () => {
    route.query = { ticket: 't9' }
    const w = await mountPage()
    expect(w.find('[data-test="thread"]').text()).toContain('t9')
    expect(support.list.mock.calls.at(-1)![0]).toBe('all')
  })

  it('ticket introuvable : pas de bascule de périmètre', async () => {
    support.get.mockRejectedValue(Object.assign(new Error('404'), { statusCode: 404, data: { code: 'ticket-not-found', detail: 'Ticket introuvable.' } }))
    route.query = { ticket: 'zz' }
    await mountPage()
    expect(support.list).toHaveBeenCalledTimes(1)
  })

  it('navigation interne vers ?ticket= alors que la page est déjà ouverte', async () => {
    const w = await mountPage()
    route.query = { ticket: 't1' }
    await flushPromises()
    expect(support.get).toHaveBeenCalledWith('t1')
    expect(w.find('[data-test="thread"]').exists()).toBe(true)
  })

  it('fermer le fil retire ?ticket= de l’URL en gardant les autres paramètres', async () => {
    route.query = { ticket: 't1', foo: 'bar' }
    const w = await mountPage()
    await w.find('[data-test="thread-close"]').trigger('click')
    expect(w.find('[data-test="thread"]').exists()).toBe(false)
    expect(replaceMock).toHaveBeenCalledWith({ query: { foo: 'bar' } })
  })

  it('fermer un fil ouvert à la main ne touche pas l’URL', async () => {
    const w = await mountPage()
    route.query = { ticket: 't1' }
    await flushPromises()
    route.query = {}
    await flushPromises()
    await w.find('[data-test="thread-close"]').trigger('click')
    expect(replaceMock).not.toHaveBeenCalled()
  })
})
