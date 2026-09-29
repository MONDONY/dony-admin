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
const users = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/features/users/services/usersService', () => ({ usersService: users }))

const ticket = (id: string) => ({
  id, category: 'PAIEMENT', subject: `Sujet ${id}`, status: 'ASSIGNED', priority: 'NORMAL', userId: 'u1', userDisplayName: 'Awa',
  assignedAdminId: 'x', assignedAdminEmail: 'x@yadony.com', createdAt: '2026-09-28T10:00:00Z', lastMessageAt: '2026-09-28T10:00:00Z',
  resolvedAt: null, messages: [],
})
const page = (content: unknown[]) => ({ content, totalElements: content.length, totalPages: 1, number: 0, size: 20 })

const DialogStub = {
  name: 'StartSupportConversationDialog', props: ['open', 'recipient'], emits: ['close', 'sent'],
  template: '<div v-if="open" data-test="start-dialog-stub">{{ recipient ? recipient.name + \'|\' + recipient.id : \'aucun\' }}<button data-test="stub-sent" @click="$emit(\'sent\', { id: \'t42\' })" /><button data-test="stub-close" @click="$emit(\'close\')" /></div>',
}
const ThreadStub = { name: 'SupportTicketThread', props: ['ticket'], emits: ['close'], template: '<div data-test="thread">{{ ticket.id }}<button data-test="thread-close" @click="$emit(\'close\')" /></div>' }

// Une page d'un test précédent encore montée réagirait aux changements de la route partagée.
const mounted: VueWrapper[] = []
async function mountPage() {
  const mod = await import('@/pages/support/index.vue')
  const w = mount(mod.default, { global: { stubs: { SupportTicketThread: ThreadStub, PaginationControls: true, SupportTicketsTable: true, StartSupportConversationDialog: DialogStub } } })
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

describe('/support : nouvelle conversation et filtre ?userId=', () => {
  afterEach(() => { mounted.splice(0).forEach((w) => w.unmount()) })
  beforeEach(() => {
    vi.clearAllMocks()
    seedAuth('ADMIN')
    route.query = {}
    support.list.mockResolvedValue(page([ticket('t1')]))
    support.get.mockImplementation((id: string) => Promise.resolve(ticket(id)))
    users.get.mockResolvedValue({ id: 'u1', firstName: 'Awa', lastName: 'Diallo', email: null, phoneNumber: '+221' })
    replaceMock.mockResolvedValue(undefined)
  })

  it('« Nouvelle conversation » ouvre la fenêtre sans destinataire imposé', async () => {
    const w = await mountPage()
    expect(w.find('[data-test="start-dialog-stub"]').exists()).toBe(false)
    await w.find('[data-test="support-new-conversation"]').trigger('click')
    expect(w.find('[data-test="start-dialog-stub"]').text()).toContain('aucun')
    await w.find('[data-test="stub-close"]').trigger('click')
    expect(w.find('[data-test="start-dialog-stub"]').exists()).toBe(false)
  })

  it('conversation créée : la liste est rechargée', async () => {
    const w = await mountPage()
    await w.find('[data-test="support-new-conversation"]').trigger('click')
    await w.find('[data-test="stub-sent"]').trigger('click')
    await flushPromises()
    expect(support.list).toHaveBeenCalledTimes(2)
    expect(w.find('[data-test="start-dialog-stub"]').exists()).toBe(false)
  })

  it('sans SUPPORT_TICKET_MANAGE : pas de bouton', async () => {
    seedAuth('ADMIN', { SUPPORT_TICKET_MANAGE: false })
    const w = await mountPage()
    expect(w.find('[data-test="support-new-conversation"]').exists()).toBe(false)
  })

  it('?userId= : liste filtrée sur « Tous », bandeau avec le nom', async () => {
    route.query = { userId: 'u1' }
    const w = await mountPage()
    expect(support.list).toHaveBeenCalledTimes(1)
    expect(support.list.mock.calls[0]).toEqual(['all', 'TOUS', 0, 20, 'u1'])
    expect(w.find('[data-test="support-user-filter"]').text()).toContain('Conversations de Awa')
    expect(users.get).not.toHaveBeenCalled()
  })

  it('?userId= : onglets de périmètre masqués (le back renvoie tout l’historique)', async () => {
    route.query = { userId: 'u1' }
    const w = await mountPage()
    expect(w.find('[data-test="support-scopes"]').exists()).toBe(false)
    expect(w.find('select[aria-label="Filtrer par statut"]').exists()).toBe(true)
  })

  it('sans filtre : onglets de périmètre visibles', async () => {
    const w = await mountPage()
    expect(w.find('[data-test="support-scopes"]').exists()).toBe(true)
  })

  it('?userId= sans ticket : nom lu sur la fiche utilisateur', async () => {
    support.list.mockResolvedValue(page([]))
    route.query = { userId: 'u1' }
    const w = await mountPage()
    expect(users.get).toHaveBeenCalledWith('u1')
    expect(w.find('[data-test="support-user-filter"]').text()).toContain('Conversations de Awa Diallo')
  })

  it('?userId= sans ticket ni droit USER_VIEW : identifiant court', async () => {
    seedAuth('ADMIN', { USER_VIEW: false })
    support.list.mockResolvedValue(page([]))
    route.query = { userId: 'abcdef12-3456-7890-abcd-ef1234567890' }
    const w = await mountPage()
    expect(users.get).not.toHaveBeenCalled()
    expect(w.find('[data-test="support-user-filter"]').text()).toContain('Conversations de abcdef12')
  })

  it('?userId= et fiche illisible : identifiant court', async () => {
    users.get.mockRejectedValue(new Error('404'))
    support.list.mockResolvedValue(page([]))
    route.query = { userId: 'abcdef12-3456-7890-abcd-ef1234567890' }
    const w = await mountPage()
    expect(w.find('[data-test="support-user-filter"]').text()).toContain('Conversations de abcdef12')
  })

  it('ancien back qui ignore ?userId= : lignes écartées et avertissement', async () => {
    support.list.mockResolvedValue(page([ticket('t1'), { ...ticket('t2'), userId: 'u2' }]))
    route.query = { userId: 'u1' }
    const w = await mountPage()
    expect(w.find('[data-test="support-user-filter-ignored"]').exists()).toBe(true)
  })

  it('« Retirer le filtre » enlève userId de l’URL et recharge sans filtre', async () => {
    route.query = { userId: 'u1', foo: 'bar' }
    const w = await mountPage()
    await w.find('[data-test="support-user-filter-clear"]').trigger('click')
    expect(replaceMock).toHaveBeenCalledWith({ query: { foo: 'bar' } })
    route.query = { foo: 'bar' }
    await flushPromises()
    expect(w.find('[data-test="support-user-filter"]').exists()).toBe(false)
    expect(support.list.mock.calls.at(-1)).toEqual(['all', 'TOUS', 0, 20])
  })

  it('filtre actif : « Nouvelle conversation » vise cet utilisateur', async () => {
    route.query = { userId: 'u1' }
    const w = await mountPage()
    await w.find('[data-test="support-new-conversation"]').trigger('click')
    expect(w.find('[data-test="start-dialog-stub"]').text()).toContain('Awa|u1')
  })

  it('filtre posé par une navigation interne', async () => {
    const w = await mountPage()
    route.query = { userId: 'u1' }
    await flushPromises()
    expect(support.list.mock.calls.at(-1)).toEqual(['all', 'TOUS', 0, 20, 'u1'])
    expect(w.find('[data-test="support-user-filter"]').exists()).toBe(true)
  })
})
