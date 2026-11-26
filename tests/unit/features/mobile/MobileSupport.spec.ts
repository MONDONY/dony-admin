import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises, renderToString } from '@vue/test-utils'
import { readdirSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'

vi.stubGlobal('definePageMeta', vi.fn())
const U = '3f2a9c1e-1111-4222-8333-444455556666'
const routeState: { params: Record<string, unknown> } = { params: { id: U } }
vi.stubGlobal('useRoute', () => routeState)

const svc = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn(), reply: vi.fn(), assign: vi.fn() }))
vi.mock('@/features/mobile/services/mobileSupportService', () => ({ mobileSupportService: svc }))

import ListPage from '@/pages/m/support/index.vue'
import DetailPage from '@/pages/m/support/[id].vue'
import { feedItemRoute } from '@/features/mobile/lib/mobileAlerts'
import { seedAuth } from '../../../helpers/auth'

const NuxtLink = { name: 'NuxtLink', props: ['to'], template: '<a :href="to" v-bind="$attrs"><slot /></a>' }
const ticket = (id: string, over: Record<string, unknown> = {}) => ({
  id, category: 'ACCOUNT', subject: 'Sujet ' + id, status: 'ASSIGNED', priority: 'NORMAL', userId: 'u9',
  userDisplayName: 'Mariam Traoré', assignedAdminId: 'u1', assignedAdminEmail: 'a@b.fr',
  createdAt: '2026-11-20T08:00:00', lastMessageAt: '2026-11-25T08:00:00', resolvedAt: null, messages: null,
  lastMessagePreview: 'Bonjour, j’ai un souci', lastMessageAuthor: 'USER', ...over,
})
const page = (content: unknown[]) => ({ content, totalElements: content.length, totalPages: 1, number: 0, size: 100 })
const msgs = [
  { id: 'm1', authorType: 'USER', content: 'Bonjour', createdAt: '2026-11-25T08:00:00' },
  { id: 'm2', authorType: 'ADMIN', content: 'Bonjour, je regarde', createdAt: '2026-11-25T09:00:00' },
]
const withMsgs = (over: Record<string, unknown> = {}) => ticket(U, { messages: msgs, ...over })
const mountList = async () => {
  const w = mount(ListPage, { global: { stubs: { NuxtLink } } })
  await flushPromises()
  return w
}
const mountDetail = async () => {
  const w = mount(DetailPage, { global: { stubs: { NuxtLink } } })
  await flushPromises()
  return w
}
const err = (status: number, detail?: string) => Object.assign(new Error('x'), { statusCode: status, data: detail ? { detail } : {} })

describe('m/support list', () => {
  beforeEach(() => {
    Object.values(svc).forEach(f => f.mockReset())
    seedAuth('ADMIN')
    svc.list.mockResolvedValue(page([]))
  })

  it('list_rendersTicketsNewestFirst with first name, subject, preview, relative time and a to-answer marker', async () => {
    svc.list.mockResolvedValue(page([
      ticket('t-old', { lastMessageAt: '2026-11-01T08:00:00' }),
      ticket('t-new', { lastMessageAt: '2026-11-26T05:00:00', lastMessageAuthor: 'USER' }),
      ticket('t-mid', { lastMessageAt: '2026-11-20T08:00:00', lastMessageAuthor: 'ADMIN', lastMessagePreview: 'Réponse' }),
      ticket('t-done', { status: 'RESOLVED', lastMessageAt: '2026-11-26T06:00:00' }),
    ]))
    const w = await mountList()
    const cards = w.findAll('[data-test="support-card"]')
    expect(cards.map(c => c.attributes('href'))).toEqual(['/m/support/t-new', '/m/support/t-mid', '/m/support/t-old'])
    expect(cards[0]!.text()).toContain('Mariam')
    expect(cards[0]!.text()).not.toContain('Traoré')
    expect(cards[0]!.text()).toContain('Sujet t-new')
    expect(cards[0]!.text()).toContain('Bonjour, j’ai un souci')
    expect(cards[0]!.find('[data-test="support-when"]').text()).not.toBe('')
    expect(cards[0]!.find('[data-test="support-marker"]').exists()).toBe(true)
    expect(cards[1]!.find('[data-test="support-marker"]').exists()).toBe(false)
    expect(svc.list).toHaveBeenLastCalledWith('TOUS', 0, 100)
  })

  it('chips Ouverts / Résolus: résolus asks the API for RESOLVED', async () => {
    const w = await mountList()
    expect(w.findAll('[data-test="support-chip"]').map(c => c.text())).toEqual(['Ouverts', 'Résolus'])
    await w.findAll('[data-test="support-chip"]')[1]!.trigger('click'); await flushPromises()
    expect(svc.list).toHaveBeenLastCalledWith('RESOLVED', 0, 100)
    expect(w.findAll('[data-test="support-chip"]')[1]!.attributes('aria-selected')).toBe('true')
  })

  it('shows empty and error states, and a stale response is ignored', async () => {
    let w = await mountList()
    expect(w.find('[data-test="support-empty"]').exists()).toBe(true)
    svc.list.mockRejectedValue(err(500, 'Panne'))
    w = await mountList()
    expect(w.find('[data-test="support-error"]').text()).toBe('Panne')
    let slow!: (_v: unknown) => void
    svc.list.mockReset()
    svc.list
      .mockResolvedValueOnce(page([]))
      .mockImplementationOnce(() => new Promise((r) => { slow = r }))
      .mockResolvedValueOnce(page([ticket('t-fast')]))
    w = await mountList()
    const chips = w.findAll('[data-test="support-chip"]')
    await chips[1]!.trigger('click'); await chips[0]!.trigger('click')
    await flushPromises()
    slow(page([ticket('t-stale', { status: 'RESOLVED' })]))
    await flushPromises()
    expect(w.findAll('[data-test="support-card"]').map(c => c.attributes('href'))).toEqual(['/m/support/t-fast'])
  })

  it('first paint (server render, before mount): Chargement, never a false "Aucune conversation"', async () => {
    const html = await renderToString(ListPage, { global: { stubs: { NuxtLink } } })
    expect(html).toContain('Chargement')
    expect(html).not.toContain('Aucune conversation')
    expect(svc.list).not.toHaveBeenCalled()
  })

  it('shows Chargement while pending', async () => {
    svc.list.mockReturnValue(new Promise(() => {}))
    const w = mount(ListPage, { global: { stubs: { NuxtLink } } })
    await flushPromises()
    expect(w.text()).toContain('Chargement')
  })
})

describe('m/support/[id] detail', () => {
  beforeEach(() => {
    Object.values(svc).forEach(f => f.mockReset())
    routeState.params = { id: U }
    seedAuth('ADMIN')
    svc.get.mockResolvedValue(withMsgs())
  })

  it('detail_rendersBubblesByAuthor: user left neutral, admin right primary', async () => {
    const w = await mountDetail()
    expect(svc.get).toHaveBeenCalledWith(U)
    const bubbles = w.findAll('[data-test="bubble"]')
    expect(bubbles.map(b => b.attributes('data-author'))).toEqual(['USER', 'ADMIN'])
    expect(bubbles[0]!.classes()).toContain('self-start')
    expect(bubbles[0]!.classes()).not.toContain('bg-primary')
    expect(bubbles[1]!.classes()).toContain('self-end')
    expect(bubbles[1]!.classes()).toContain('bg-primary')
    expect(bubbles[1]!.text()).toContain('Bonjour, je regarde')
    expect(w.find('[data-test="support-subject"]').text()).toBe('Sujet ' + U)
  })

  it('reply_sendsMessageAndAppendsBubble: trims, appends, clears the draft', async () => {
    svc.reply.mockResolvedValue({ id: 'm3', authorType: 'ADMIN', content: 'Merci', createdAt: '2026-11-26T08:00:00' })
    const w = await mountDetail()
    await w.find('[data-test="reply-input"]').setValue('  Merci  ')
    await w.find('[data-test="reply-form"]').trigger('submit')
    await flushPromises()
    expect(svc.reply).toHaveBeenCalledWith(U, 'Merci')
    expect(svc.reply.mock.calls[0]).toHaveLength(2)
    const bubbles = w.findAll('[data-test="bubble"]')
    expect(bubbles).toHaveLength(3)
    expect(bubbles[2]!.text()).toContain('Merci')
    expect((w.find('[data-test="reply-input"]').element as HTMLTextAreaElement).value).toBe('')
  })

  it('reply_hidden_withoutManage: no composer without SUPPORT_TICKET_MANAGE', async () => {
    seedAuth('ADMIN', { SUPPORT_TICKET_MANAGE: false })
    const w = await mountDetail()
    expect(w.findAll('[data-test="bubble"]')).toHaveLength(2)
    expect(w.find('[data-test="reply-form"]').exists()).toBe(false)
    expect(w.find('[data-test="reply-send"]').exists()).toBe(false)
  })

  it('no composer on a resolved ticket', async () => {
    svc.get.mockResolvedValue(withMsgs({ status: 'RESOLVED' }))
    const w = await mountDetail()
    expect(w.find('[data-test="reply-form"]').exists()).toBe(false)
    expect(w.find('[data-test="resolved-note"]').exists()).toBe(true)
  })

  it('reply_emptyOrTooLong_isRefused: nothing is sent', async () => {
    const w = await mountDetail()
    await w.find('[data-test="reply-input"]').setValue('   ')
    await w.find('[data-test="reply-form"]').trigger('submit'); await flushPromises()
    expect(svc.reply).not.toHaveBeenCalled()
    expect(w.find('[data-test="reply-send"]').attributes('disabled')).toBeDefined()
    await w.find('[data-test="reply-input"]').setValue('x'.repeat(4001))
    await w.find('[data-test="reply-form"]').trigger('submit'); await flushPromises()
    expect(svc.reply).not.toHaveBeenCalled()
    expect(w.find('[data-test="reply-error"]').text()).toContain('4000')
    await w.find('[data-test="reply-input"]').setValue('x'.repeat(4000))
    svc.reply.mockResolvedValue({ id: 'm9', authorType: 'ADMIN', content: 'x', createdAt: '2026-11-26T08:00:00' })
    await w.find('[data-test="reply-form"]').trigger('submit'); await flushPromises()
    expect(svc.reply).toHaveBeenCalledTimes(1)
  })

  it('reply_failure_keepsDraftAndShowsError: rolls the bubble back', async () => {
    svc.reply.mockRejectedValue(err(500, 'Panne'))
    const w = await mountDetail()
    await w.find('[data-test="reply-input"]').setValue('Bonjour')
    await w.find('[data-test="reply-form"]').trigger('submit'); await flushPromises()
    expect(w.findAll('[data-test="bubble"]')).toHaveLength(2)
    expect((w.find('[data-test="reply-input"]').element as HTMLTextAreaElement).value).toBe('Bonjour')
    expect(w.find('[data-test="reply-error"]').text()).toBe('Panne')
    expect(w.find('[data-test="reply-send"]').attributes('disabled')).toBeUndefined()
  })

  it('reply 409: reloads the ticket, says how to take it from the phone, and keeps the draft', async () => {
    svc.get.mockResolvedValueOnce(withMsgs()).mockResolvedValueOnce(withMsgs({ assignedAdminId: null, status: 'OPEN' }))
    svc.reply.mockRejectedValue(err(409))
    const w = await mountDetail()
    await w.find('[data-test="reply-input"]').setValue('Bonjour')
    await w.find('[data-test="reply-form"]').trigger('submit'); await flushPromises()
    expect(svc.get).toHaveBeenCalledTimes(2)
    expect(w.find('[data-test="reply-error"]').text()).toBe('Ce billet ne vous est pas assigné. Touchez « Prendre en charge » pour répondre.')
    expect(w.text()).not.toContain('ordinateur')
    expect(w.find('[data-test="assign-button"]').exists()).toBe(true)
    expect(w.findAll('[data-test="bubble"]')).toHaveLength(2)
    // Pris en charge depuis le téléphone : le brouillon revient dans le champ.
    svc.assign.mockResolvedValue({})
    svc.get.mockResolvedValueOnce(withMsgs())
    await w.find('[data-test="assign-button"]').trigger('click'); await flushPromises()
    expect((w.find('[data-test="reply-input"]').element as HTMLTextAreaElement).value).toBe('Bonjour')
    expect(w.find('[data-test="reply-error"]').exists()).toBe(false)
  })

  it('reply 409 on a ticket a colleague just took: the reload shows it and says so', async () => {
    svc.get.mockResolvedValueOnce(withMsgs()).mockResolvedValueOnce(withMsgs({ assignedAdminId: 'u7' }))
    svc.reply.mockRejectedValue(err(409))
    const w = await mountDetail()
    await w.find('[data-test="reply-input"]').setValue('Bonjour')
    await w.find('[data-test="reply-form"]').trigger('submit'); await flushPromises()
    expect(w.find('[data-test="reply-error"]').text()).toBe('Ce billet vient d’être pris en charge par un collègue')
    expect(w.find('[data-test="colleague-note"]').exists()).toBe(true)
    expect(w.find('[data-test="reply-form"]').exists()).toBe(false)
  })

  it('reply_noDoubleSend: second submit while sending is ignored and the button is disabled', async () => {
    let done!: (_v: unknown) => void
    svc.reply.mockImplementation(() => new Promise((r) => { done = r }))
    const w = await mountDetail()
    await w.find('[data-test="reply-input"]').setValue('Bonjour')
    await w.find('[data-test="reply-form"]').trigger('submit')
    await w.find('[data-test="reply-form"]').trigger('submit')
    expect(svc.reply).toHaveBeenCalledTimes(1)
    expect(w.find('[data-test="reply-send"]').attributes('disabled')).toBeDefined()
    done({ id: 'm3', authorType: 'ADMIN', content: 'Bonjour', createdAt: '2026-11-26T08:00:00' })
    await flushPromises()
    expect(w.findAll('[data-test="bubble"]')).toHaveLength(3)
    expect(w.find('[data-test="reply-send"]').attributes('disabled')).toBeDefined() // empty draft
  })

  it('invalidId_showsEmptyState: no request is made', async () => {
    routeState.params = { id: '../admin/x' }
    const w = await mountDetail()
    expect(svc.get).not.toHaveBeenCalled()
    expect(w.find('[data-test="ticket-not-found"]').exists()).toBe(true)
    expect(w.find('[data-test="reply-form"]').exists()).toBe(false)
  })

  it('404 and other errors show friendly states', async () => {
    svc.get.mockRejectedValue(err(404))
    let w = await mountDetail()
    expect(w.find('[data-test="ticket-not-found"]').exists()).toBe(true)
    svc.get.mockRejectedValue(err(500, 'Panne'))
    w = await mountDetail()
    expect(w.find('[data-test="ticket-error"]').text()).toBe('Panne')
  })

  it('shows Chargement while pending, notes attachments, and stays free of em dash', async () => {
    svc.get.mockReturnValue(new Promise(() => {}))
    let w = mount(DetailPage, { global: { stubs: { NuxtLink } } })
    await flushPromises()
    expect(w.text()).toContain('Chargement')
    svc.get.mockResolvedValue(withMsgs({ messages: [{ id: 'm1', authorType: 'USER', content: null, createdAt: '2026-11-25T08:00:00', attachments: [{ id: 'a', url: 'https://x/y.jpg', contentType: 'image/jpeg' }] }] }))
    w = await mountDetail()
    expect(w.find('[data-test="bubble"]').text()).toContain('Pièce jointe')
    expect(w.text()).not.toContain('—')
  })

  it('a stale detail response is ignored', async () => {
    const { useMobileSupportTicket } = await import('@/features/mobile/composables/useMobileSupportTicket')
    const { ref } = await import('vue')
    const id = ref<unknown>(U)
    let slow!: (_v: unknown) => void
    svc.get.mockReset()
    svc.get.mockImplementationOnce(() => new Promise((r) => { slow = r })).mockResolvedValueOnce(withMsgs({ subject: 'récent' }))
    const t = useMobileSupportTicket(id)
    const first = t.load()
    await t.load()
    slow(withMsgs({ subject: 'périmé' }))
    await first
    expect(t.ticket.value?.subject).toBe('récent')
  })
})

describe('m/support/[id] prise en charge', () => {
  beforeEach(() => {
    Object.values(svc).forEach(f => f.mockReset())
    routeState.params = { id: U }
    seedAuth('ADMIN')
  })
  const btn = (w: ReturnType<typeof mount>) => w.find('[data-test="assign-button"]')

  it('assign_buttonShown_onlyWhenUnassigned_andManage', async () => {
    svc.get.mockResolvedValue(withMsgs({ assignedAdminId: null, assignedAdminEmail: null }))
    let w = await mountDetail()
    expect(btn(w).text()).toBe('Prendre en charge')
    expect(w.find('[data-test="reply-form"]').exists()).toBe(false)
    seedAuth('ADMIN', { SUPPORT_TICKET_MANAGE: false })
    w = await mountDetail()
    expect(btn(w).exists()).toBe(false)
    expect(w.find('[data-test="reply-form"]').exists()).toBe(false)
    svc.get.mockResolvedValue(withMsgs({ assignedAdminId: null, status: 'RESOLVED' }))
    seedAuth('ADMIN')
    w = await mountDetail()
    expect(btn(w).exists()).toBe(false)
  })

  it('assign_success_refreshesAndShowsReplyBox', async () => {
    svc.get.mockResolvedValueOnce(withMsgs({ assignedAdminId: null })).mockResolvedValueOnce(withMsgs({ assignedAdminId: 'u1' }))
    svc.assign.mockResolvedValue({})
    const w = await mountDetail()
    await btn(w).trigger('click'); await flushPromises()
    expect(svc.assign).toHaveBeenCalledWith(U)
    expect(svc.get).toHaveBeenCalledTimes(2)
    expect(btn(w).exists()).toBe(false)
    expect(w.find('[data-test="reply-form"]').exists()).toBe(true)
    expect(svc.reply).not.toHaveBeenCalled()
  })

  it('assign_409_refreshesWithColleagueMessage', async () => {
    svc.get.mockResolvedValueOnce(withMsgs({ assignedAdminId: null })).mockResolvedValueOnce(withMsgs({ assignedAdminId: 'u7' }))
    svc.assign.mockRejectedValue(err(409))
    const w = await mountDetail()
    await btn(w).trigger('click'); await flushPromises()
    expect(svc.get).toHaveBeenCalledTimes(2)
    expect(w.find('[data-test="assign-error"]').text()).toBe('Ce billet vient d’être pris en charge par un collègue')
    expect(btn(w).exists()).toBe(false)
    expect(w.find('[data-test="reply-form"]').exists()).toBe(false)
  })

  it('assign 403/404/405 shows the problem message and hides the button; other errors keep it and reset loading', async () => {
    svc.get.mockResolvedValue(withMsgs({ assignedAdminId: null }))
    svc.assign.mockRejectedValue(err(405, 'Non disponible'))
    let w = await mountDetail()
    await btn(w).trigger('click'); await flushPromises()
    expect(w.find('[data-test="assign-error"]').text()).toBe('Non disponible')
    expect(btn(w).exists()).toBe(false)
    svc.assign.mockRejectedValue(err(500, 'Panne'))
    w = await mountDetail()
    await btn(w).trigger('click'); await flushPromises()
    expect(w.find('[data-test="assign-error"]').text()).toBe('Panne')
    expect(btn(w).exists()).toBe(true)
    expect(btn(w).attributes('disabled')).toBeUndefined()
  })

  it('assign_noDoubleTap', async () => {
    let done!: (_v: unknown) => void
    svc.get.mockResolvedValueOnce(withMsgs({ assignedAdminId: null })).mockResolvedValue(withMsgs({ assignedAdminId: 'u1' }))
    svc.assign.mockImplementation(() => new Promise((r) => { done = r }))
    const w = await mountDetail()
    await btn(w).trigger('click'); await btn(w).trigger('click')
    expect(svc.assign).toHaveBeenCalledTimes(1)
    expect(btn(w).attributes('disabled')).toBeDefined()
    done({}); await flushPromises()
    expect(svc.assign).toHaveBeenCalledTimes(1)
  })

  it('assignedToColleague_hidesReplyAndButton', async () => {
    svc.get.mockResolvedValue(withMsgs({ assignedAdminId: 'u7' }))
    const w = await mountDetail()
    expect(w.find('[data-test="colleague-note"]').text()).toBe('Billet pris en charge par un collègue')
    expect(btn(w).exists()).toBe(false)
    expect(w.find('[data-test="reply-form"]').exists()).toBe(false)
  })

  it('reply_stillWorksWhenAssignedToMe', async () => {
    svc.get.mockResolvedValue(withMsgs({ assignedAdminId: 'u1' }))
    svc.reply.mockResolvedValue({ id: 'm3', authorType: 'ADMIN', content: 'ok', createdAt: '2026-11-26T08:00:00' })
    const w = await mountDetail()
    expect(btn(w).exists()).toBe(false)
    expect(w.find('[data-test="colleague-note"]').exists()).toBe(false)
    await w.find('[data-test="reply-input"]').setValue('ok')
    await w.find('[data-test="reply-form"]').trigger('submit'); await flushPromises()
    expect(svc.reply).toHaveBeenCalledWith(U, 'ok')
    expect(svc.assign).not.toHaveBeenCalled()
  })
})

// Garde statique (graphe d'imports, appels permis, réseau) : mobileNetworkSurface.spec.ts.
describe('noResolveAssignOrUpload and the support route', () => {
  const root = resolvePath(__dirname, '../../../..')

  it('noResolveAssignOrUpload at runtime: a full reply flow never touches them', async () => {
    seedAuth('ADMIN')
    Object.values(svc).forEach(f => f.mockReset())
    routeState.params = { id: U }
    svc.get.mockResolvedValue(withMsgs())
    svc.reply.mockResolvedValue({ id: 'm3', authorType: 'ADMIN', content: 'ok', createdAt: '2026-11-26T08:00:00' })
    const w = await mountDetail()
    await w.find('[data-test="reply-input"]').setValue('ok')
    await w.find('[data-test="reply-form"]').trigger('submit'); await flushPromises()
    expect(Object.keys(svc).sort()).toEqual(['assign', 'get', 'list', 'reply'])
    expect(svc.assign).not.toHaveBeenCalled()
    expect(svc.list).not.toHaveBeenCalled()
    expect(w.text()).not.toMatch(/Résoudre|Assigner|Réassigner/)
  })

  it('support alerts of the feed link to /m/support/<ticketId> and that route exists', () => {
    expect(feedItemRoute({ id: 'SUPPORT_MESSAGE_RECEIVED:1a2b3c4d-5555-4666-8777-888899990000', type: 'SUPPORT_MESSAGE_RECEIVED', link: `/support?ticket=${U}` }))
      .toBe(`/m/support/${U}`)
    const dir = resolvePath(root, 'app/pages/m/support')
    expect(readdirSync(dir).sort()).toEqual(['[id].vue', 'index.vue'])
  })
})
