import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'

vi.stubGlobal('definePageMeta', vi.fn())
const U = '3f2a9c1e-1111-4222-8333-444455556666'
const routeState: { params: Record<string, unknown> } = { params: { id: U } }
vi.stubGlobal('useRoute', () => routeState)

const svc = vi.hoisted(() => ({
  list: vi.fn(), get: vi.fn(), reply: vi.fn(), assign: vi.fn(), reassign: vi.fn(), resolve: vi.fn(),
  uploadAttachment: vi.fn(), startTicket: vi.fn(), setPriority: vi.fn(), addNote: vi.fn(), getContext: vi.fn(),
}))
vi.mock('@/features/support/services/supportService', () => ({ supportService: svc }))

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
    expect(svc.list).toHaveBeenLastCalledWith('all', 'TOUS', 0, 100)
  })

  it('chips Ouverts / Résolus: résolus asks the API for RESOLVED', async () => {
    const w = await mountList()
    expect(w.findAll('[data-test="support-chip"]').map(c => c.text())).toEqual(['Ouverts', 'Résolus'])
    await w.findAll('[data-test="support-chip"]')[1]!.trigger('click'); await flushPromises()
    expect(svc.list).toHaveBeenLastCalledWith('all', 'RESOLVED', 0, 100)
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

  it('reply 409 explains that the ticket is not assigned to the admin', async () => {
    svc.reply.mockRejectedValue(err(409))
    const w = await mountDetail()
    await w.find('[data-test="reply-input"]').setValue('Bonjour')
    await w.find('[data-test="reply-form"]').trigger('submit'); await flushPromises()
    expect(w.find('[data-test="reply-error"]').text()).toContain('ordinateur')
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

describe('noResolveAssignOrUpload and the support route', () => {
  const root = resolvePath(__dirname, '../../../..')
  const files = [
    'app/pages/m/support/index.vue', 'app/pages/m/support/[id].vue',
    'app/features/mobile/composables/useMobileSupportList.ts', 'app/features/mobile/composables/useMobileSupportTicket.ts',
    'app/features/mobile/lib/mobileSupport.ts', 'app/features/mobile/components/MobileSupportCard.vue',
  ]

  it('noResolveAssignOrUpload: no source mentions the forbidden service calls or uploader', () => {
    for (const f of files) {
      expect(existsSync(resolvePath(root, f)), f).toBe(true)
      const src = readFileSync(resolvePath(root, f), 'utf8')
      expect(src, f).not.toMatch(/\.(resolve|assign|reassign|uploadAttachment|setPriority|startTicket)\b/)
      expect(src, f).not.toMatch(/SupportAttachmentUploader|StartSupportConversation|type="file"/)
    }
  })

  it('noResolveAssignOrUpload at runtime: a full reply flow never touches them', async () => {
    seedAuth('ADMIN')
    Object.values(svc).forEach(f => f.mockReset())
    routeState.params = { id: U }
    svc.get.mockResolvedValue(withMsgs())
    svc.reply.mockResolvedValue({ id: 'm3', authorType: 'ADMIN', content: 'ok', createdAt: '2026-11-26T08:00:00' })
    const w = await mountDetail()
    await w.find('[data-test="reply-input"]').setValue('ok')
    await w.find('[data-test="reply-form"]').trigger('submit'); await flushPromises()
    for (const k of ['assign', 'reassign', 'resolve', 'uploadAttachment', 'setPriority', 'startTicket']) {
      expect(svc[k as keyof typeof svc], k).not.toHaveBeenCalled()
    }
    expect(w.text()).not.toMatch(/Résoudre|Assigner|Réassigner/)
  })

  it('support alerts of the feed link to /m/support/<ticketId> and that route exists', () => {
    expect(feedItemRoute({ id: 'n', type: 'SUPPORT_MESSAGE_RECEIVED', link: `/support?ticket=${U}` })).toBe(`/m/support/${U}`)
    const dir = resolvePath(root, 'app/pages/m/support')
    expect(readdirSync(dir).sort()).toEqual(['[id].vue', 'index.vue'])
  })
})
