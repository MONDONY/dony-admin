import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { readFileSync, existsSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'

const metaSpy = vi.fn()
vi.stubGlobal('definePageMeta', metaSpy)
const routeState: { params: Record<string, unknown> } = { params: { id: 'conv_1' } }
vi.stubGlobal('useRoute', () => routeState)

const svc = vi.hoisted(() => ({ listConversations: vi.fn(), getMessages: vi.fn(), getContext: vi.fn() }))
vi.mock('@/features/mobile/services/mobileMessagesService', () => ({ mobileMessagesService: svc }))

import ListPage from '@/pages/m/messages/index.vue'
import ThreadPage from '@/pages/m/messages/[id].vue'
import { seedAuth } from '../../../helpers/auth'
import {
  conversationSeverity, effectiveQuery, messageCountLabel, pairLabel, reportCountLabel, reportReasons, shortParticipant, threadRoute, toBubbles,
} from '@/features/mobile/lib/mobileMessages'

const NuxtLink = { name: 'NuxtLink', props: ['to'], template: '<a :href="to" v-bind="$attrs"><slot /></a>' }
const conv = (id: string, over: Record<string, unknown> = {}) => ({
  id, bidId: 'b1', participantA: 'Aicha Traoré', participantB: 'Moussa Diallo', lastMessageAt: '2026-11-25T08:00:00',
  messageCount: 4, flagged: false, createdAt: '2026-11-01T08:00:00', openReportCount: 0, lastMessagePreview: 'Bonjour', ...over,
})
const page = (content: unknown[], totalPages = 1, number = 0) => ({ content, totalElements: content.length, totalPages, number, size: 20 })
const mountList = async () => {
  const w = mount(ListPage, { global: { stubs: { NuxtLink } } })
  await flushPromises()
  return w
}
const mountThread = async () => {
  const w = mount(ThreadPage, { global: { stubs: { NuxtLink } } })
  await flushPromises()
  return w
}
const msg = (id: string, over: Record<string, unknown> = {}) => ({
  id, conversationId: 'c', senderName: 'Aicha Traoré', content: 'Texte ' + id, flagged: false, deleted: false, type: 'TEXT',
  imageUrl: null, thumbUrl: null, createdAt: '2026-11-25T08:00:00', ...over,
})
const ctx = (over: Record<string, unknown> = {}) => ({
  history: [], notes: [], reports: [{ id: 'r1', reason: 'HARASSMENT', status: 'OPEN', reporterName: 'X', createdAt: null }],
  participants: [{ userId: 'u1', displayName: 'Aicha Traoré', role: 'A' }, { userId: 'u2', displayName: 'Moussa Diallo', role: 'B' }], ...over,
})
const deferred = <T>() => {
  // eslint-disable-next-line no-unused-vars
  const box: { fn: ((value: T) => void) | null } = { fn: null }
  const promise = new Promise<T>(r => { box.fn = r })
  return { promise, resolve: (value: T) => box.fn?.(value) }
}

describe('m/messages list', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    Object.values(svc).forEach(f => f.mockReset())
    seedAuth('ADMIN')
    svc.listConversations.mockResolvedValue(page([]))
  })
  afterEach(() => vi.useRealTimers())

  it('list_defaultsToFlaggedFilter', async () => {
    svc.listConversations.mockResolvedValue(page([conv('c1', { flagged: true, openReportCount: 2 })]))
    const w = await mountList()
    expect(svc.listConversations).toHaveBeenCalledWith(0, 20, { flagged: true, q: undefined })
    expect(w.findAll('[data-test="messages-chip"]').map(c => c.text())).toEqual(['Signalées', 'Toutes'])
    expect(w.find('[data-chip="FLAGGED"]').attributes('aria-selected')).toBe('true')
    const card = w.find('[data-test="conversation-card"]')
    expect(card.text()).toContain('Aicha T. et Moussa D.')
    expect(card.text()).not.toContain('Traoré')
    expect(card.text()).toContain('« Bonjour »')
    expect(card.find('[data-test="conversation-tag"]').text()).toBe('2 signalements')
    expect(card.text()).toContain('4 messages')
    expect(card.attributes('data-severity')).toBe('danger')
    expect(w.text()).toContain('Conversations entre utilisateurs')
    expect(w.find('[data-test="messages-search"]').attributes('placeholder')).toBe('Rechercher un nom ou un colis')
  })

  it('chips_switchToAllRemovesFlag', async () => {
    const w = await mountList()
    await w.find('[data-chip="ALL"]').trigger('click'); await flushPromises()
    expect(svc.listConversations).toHaveBeenLastCalledWith(0, 20, { flagged: false, q: undefined })
    expect(w.find('[data-chip="ALL"]').attributes('aria-selected')).toBe('true')
  })

  it('search_passesQ_debounced_minTwoChars on both chips', async () => {
    const w = await mountList()
    const input = w.find('[data-test="messages-search"]')
    await input.setValue('a'); vi.advanceTimersByTime(400); await flushPromises()
    expect(svc.listConversations).toHaveBeenCalledTimes(1)
    await input.setValue('  Ai '); vi.advanceTimersByTime(299); await flushPromises()
    expect(svc.listConversations).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(2); await flushPromises()
    expect(svc.listConversations).toHaveBeenCalledTimes(2)
    expect(svc.listConversations).toHaveBeenLastCalledWith(0, 20, { flagged: true, q: 'Ai' })
    await w.find('[data-chip="ALL"]').trigger('click'); await flushPromises()
    expect(svc.listConversations).toHaveBeenLastCalledWith(0, 20, { flagged: false, q: 'Ai' })
    // same effective query again: no new request
    await input.setValue('Ai  '); vi.advanceTimersByTime(400); await flushPromises()
    expect(svc.listConversations).toHaveBeenCalledTimes(3)
    // back under 2 chars drops the filter
    await input.setValue('A'); vi.advanceTimersByTime(400); await flushPromises()
    expect(svc.listConversations).toHaveBeenLastCalledWith(0, 20, { flagged: false, q: undefined })
  })

  it('list_loadMore_appendsNextPage', async () => {
    svc.listConversations.mockResolvedValueOnce(page([conv('c1')], 2, 0))
    const w = await mountList()
    expect(w.findAll('[data-test="conversation-card"]')).toHaveLength(1)
    svc.listConversations.mockResolvedValueOnce(page([conv('c1'), conv('c2')], 2, 1))
    await w.find('[data-test="messages-more"]').trigger('click'); await flushPromises()
    expect(svc.listConversations).toHaveBeenLastCalledWith(1, 20, { flagged: true, q: undefined })
    expect(w.findAll('[data-test="conversation-card"]')).toHaveLength(2)
    expect(w.find('[data-test="messages-more"]').exists()).toBe(false)
  })

  it('loadMore failure keeps the list and shows an error with retry', async () => {
    svc.listConversations.mockResolvedValueOnce(page([conv('c1')], 2, 0))
    const w = await mountList()
    svc.listConversations.mockRejectedValueOnce(new Error('x'))
    await w.find('[data-test="messages-more"]').trigger('click'); await flushPromises()
    expect(w.find('[data-test="messages-error"]').text()).not.toBe('')
    expect(w.findAll('[data-test="conversation-card"]')).toHaveLength(1)
  })

  it('staleResponse_isIgnored', async () => {
    const first = deferred<ReturnType<typeof page>>()
    svc.listConversations.mockReturnValueOnce(first.promise)
    const w = mount(ListPage, { global: { stubs: { NuxtLink } } })
    svc.listConversations.mockResolvedValueOnce(page([conv('fresh')]))
    await w.find('[data-chip="ALL"]').trigger('click'); await flushPromises()
    first.resolve(page([conv('stale')]))
    await flushPromises()
    const hrefs = w.findAll('[data-test="conversation-card"]').map(c => c.attributes('href'))
    expect(hrefs).toEqual(['/m/messages/fresh'])
  })

  it('card_linksToThreadWithValidatedId: unsafe ids are not links', async () => {
    svc.listConversations.mockResolvedValue(page([conv('conv_ok-1'), conv('../admin/x'), conv('a b')]))
    const w = await mountList()
    const cards = w.findAll('[data-test="conversation-card"]')
    expect(cards[0]!.attributes('href')).toBe('/m/messages/conv_ok-1')
    expect(cards[1]!.attributes('href')).toBeUndefined()
    expect(cards[2]!.attributes('href')).toBeUndefined()
    expect(threadRoute({ id: 'x/y' })).toBeNull()
  })

  it('error shows a retry button that reloads; empty state is shown', async () => {
    svc.listConversations.mockRejectedValueOnce(new Error('x'))
    const w = await mountList()
    expect(w.find('[data-test="messages-error"]').exists()).toBe(true)
    await w.find('[data-test="messages-retry"]').trigger('click'); await flushPromises()
    expect(w.find('[data-test="messages-error"]').exists()).toBe(false)
    expect(w.find('[data-test="messages-empty"]').exists()).toBe(true)
  })

  it('guard_requiresModerationView', async () => {
    metaSpy.mockClear()
    svc.getMessages.mockResolvedValue([])
    await mountList()
    await mountThread()
    const metas = metaSpy.mock.calls.map(c => c[0])
    expect(metas.length).toBeGreaterThan(0)
    for (const m of metas) {
      expect(m).toMatchObject({ layout: 'mobile', middleware: 'admin-only', permission: 'MODERATION_VIEW' })
    }
    expect(metas.map(m => m.pageTitle)).toEqual(expect.arrayContaining(['Messages', 'Conversation']))
  })
})

describe('m/messages thread', () => {
  beforeEach(() => {
    Object.values(svc).forEach(f => f.mockReset())
    seedAuth('ADMIN')
    routeState.params = { id: 'conv_1' }
    svc.getMessages.mockResolvedValue([])
    svc.getContext.mockResolvedValue(ctx())
  })

  it('thread_rendersChronologicalWithSenderNames', async () => {
    svc.getMessages.mockResolvedValue([
      msg('m2', { senderName: 'Moussa Diallo', createdAt: '2026-11-25T10:00:00' }),
      msg('m1', { createdAt: '2026-11-25T08:00:00' }),
    ])
    const w = await mountThread()
    expect(svc.getMessages).toHaveBeenCalledWith('conv_1')
    const bubbles = w.findAll('[data-test="bubble"]')
    expect(bubbles.map(b => b.find('[data-test="bubble-sender"]').text())).toEqual(['Aicha T.', 'Moussa D.'])
    expect(bubbles[0]!.text()).toContain('Texte m1')
    expect(w.find('[data-test="thread-participants"]').text()).toBe('Aicha T. et Moussa D.')
    expect(w.text()).toContain('‹ Messages')
    expect(w.find('[data-test="desktop-note"]').text()).toBe('Pour supprimer un message ou sanctionner, passez sur l’ordinateur.')
  })

  it('thread_marksFlaggedMessagesWithReason', async () => {
    svc.getMessages.mockResolvedValue([msg('m1'), msg('m2', { flagged: true })])
    const w = await mountThread()
    const b = w.findAll('[data-test="bubble"]')
    expect(b[0]!.attributes('data-flagged')).toBeUndefined()
    expect(b[1]!.attributes('data-flagged')).toBe('true')
    expect(b[1]!.find('[data-test="bubble-reason"]').text()).toMatch(/^Signalé : /)
    expect(b[1]!.find('[data-test="bubble-reason"]').text().length).toBeGreaterThan('Signalé : '.length)
  })

  it('thread_deletedMessage_showsPlaceholderNotContent', async () => {
    svc.getMessages.mockResolvedValue([msg('m1', { deleted: true, content: 'SECRET', flagged: true, type: 'IMAGE', imageUrl: 'https://r2/x.jpg', thumbUrl: 'https://r2/t.jpg' })])
    const w = await mountThread()
    expect(w.find('[data-test="bubble-deleted"]').text()).toBe('Message supprimé')
    expect(w.html()).not.toContain('SECRET')
    expect(w.html()).not.toContain('r2/')
    expect(w.find('[data-test="bubble-reason"]').exists()).toBe(false)
  })

  it('thread_contextFailure_stillShowsMessages', async () => {
    svc.getContext.mockRejectedValue(Object.assign(new Error('x'), { statusCode: 404 }))
    svc.getMessages.mockResolvedValue([msg('m1', { flagged: true })])
    const w = await mountThread()
    expect(w.find('[data-test="thread-error"]').exists()).toBe(false)
    expect(w.text()).toContain('Texte m1')
    expect(w.find('[data-test="bubble-reason"]').text()).toBe('Signalé')
    expect(w.find('[data-test="thread-participants"]').exists()).toBe(false)
  })

  it('messages failure shows an error with retry; invalid id is not fetched', async () => {
    svc.getMessages.mockRejectedValueOnce(new Error('x'))
    const w = await mountThread()
    expect(w.find('[data-test="thread-error"]').exists()).toBe(true)
    await w.find('[data-test="thread-retry"]').trigger('click'); await flushPromises()
    expect(w.find('[data-test="thread-error"]').exists()).toBe(false)
    routeState.params = { id: '../x' }
    svc.getMessages.mockClear()
    const w2 = await mountThread()
    expect(svc.getMessages).not.toHaveBeenCalled()
    expect(w2.find('[data-test="thread-invalid"]').exists()).toBe(true)
  })

  it('thread_image_usesThumbThenOpensOverlay_noStorageWrites', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const log = vi.spyOn(console, 'log')
    const open = vi.spyOn(window, 'open')
    svc.getMessages.mockResolvedValue([
      msg('m1', { type: 'IMAGE', content: '', imageUrl: 'https://r2.example/full.jpg?sig=1', thumbUrl: 'https://r2.example/thumb.jpg?sig=1' }),
      msg('m2', { type: 'IMAGE', content: '', imageUrl: 'https://r2.example/only.jpg?sig=2', thumbUrl: null }),
      msg('m3', { type: 'IMAGE', content: '', imageUrl: 'javascript:alert(1)', thumbUrl: 'data:x' }),
    ])
    const w = await mountThread()
    const imgs = w.findAll('[data-test="bubble-image"] img')
    expect(imgs).toHaveLength(2)
    expect(imgs[0]!.attributes('src')).toBe('https://r2.example/thumb.jpg?sig=1')
    expect(imgs[0]!.attributes('loading')).toBe('lazy')
    expect(imgs[0]!.attributes('referrerpolicy')).toBe('no-referrer')
    expect(imgs[1]!.attributes('src')).toBe('https://r2.example/only.jpg?sig=2')
    expect(w.find('[data-test="image-overlay"]').exists()).toBe(false)
    await w.find('[data-test="bubble-image"]').trigger('click')
    const big = w.find('[data-test="image-overlay"] img')
    expect(big.attributes('src')).toBe('https://r2.example/full.jpg?sig=1')
    expect(w.find('[data-test="image-overlay"] a, [data-test="image-overlay"] [download]').exists()).toBe(false)
    await w.find('[data-test="image-close"]').trigger('click')
    expect(w.find('[data-test="image-overlay"]').exists()).toBe(false)
    expect(open).not.toHaveBeenCalled()
    expect(setItem).not.toHaveBeenCalled()
    expect(log).not.toHaveBeenCalled()
    vi.restoreAllMocks()
  })

  it('thread_hasNoDeleteRestoreNoteControl', async () => {
    svc.getMessages.mockResolvedValue([msg('m1', { flagged: true }), msg('m2', { deleted: true })])
    const w = await mountThread()
    expect(w.text()).not.toMatch(/Supprimer\b|Restaurer|Ajouter une note|Mettre en sourdine|Résoudre|Rejeter/)
    expect(w.findAll('button')).toHaveLength(0)
    expect(w.find('textarea, input, form').exists()).toBe(false)
  })
})

describe('mobileMessages lib', () => {
  it('names, severity, labels', () => {
    expect(shortParticipant(null)).toBe('Utilisateur')
    expect(shortParticipant('Aïcha')).toBe('Aïcha')
    expect(shortParticipant('Jean Pierre  dupont')).toBe('Jean D.')
    expect(pairLabel('A B', undefined)).toBe('A B. et Utilisateur')
    const now = Date.parse('2026-11-26T00:00:00Z')
    expect(conversationSeverity(conv('x', { openReportCount: 1 }) as never, now)).toBe('danger')
    expect(conversationSeverity(conv('x', { flagged: true }) as never, now)).toBe('danger')
    expect(conversationSeverity(conv('x', { lastMessageAt: '2026-11-24T00:00:00' }) as never, now)).toBe('warning')
    expect(conversationSeverity(conv('x', { lastMessageAt: '2026-10-01T00:00:00' }) as never, now)).toBe('neutral')
    expect(conversationSeverity(conv('x', { lastMessageAt: null }) as never, now)).toBe('neutral')
    expect(reportCountLabel({ flagged: false, openReportCount: 1 })).toBe('1 signalement')
    expect(reportCountLabel({ flagged: true })).toBe('Signalée')
    expect(reportCountLabel({ flagged: false })).toBeNull()
    expect(messageCountLabel(1)).toBe('1 message')
    expect(effectiveQuery(' a ')).toBeUndefined()
    expect(effectiveQuery(' ab ')).toBe('ab')
    expect(reportReasons(undefined)).toEqual([])
    expect(reportReasons([{ id: '1', reason: null, status: null, reporterName: null, createdAt: null }])).toEqual([])
    expect(toBubbles([msg('a', { createdAt: 'nope' }) as never, msg('b', { createdAt: 'nope' }) as never], []).map(b => b.id)).toEqual(['a', 'b'])
  })
})

describe('modules_neverImportDestructiveMethods', () => {
  const root = resolvePath(__dirname, '../../../..')
  const entries = ['app/pages/m/messages/index.vue', 'app/pages/m/messages/[id].vue']
  const crawl = (): string[] => {
    const seen = new Set<string>()
    const walk = (rel: string) => {
      if (seen.has(rel)) return
      seen.add(rel)
      const full = resolvePath(root, rel)
      expect(existsSync(full), rel).toBe(true)
      const src = readFileSync(full, 'utf8')
      for (const m of src.matchAll(/from '@\/(features\/mobile\/[^']+?)(\.ts|\.vue)?'/g)) {
        const base = `app/${m[1]}`
        const ext = m[2] ?? (existsSync(resolvePath(root, `${base}.ts`)) ? '.ts' : '.vue')
        walk(base + ext)
      }
    }
    entries.forEach(walk)
    return [...seen]
  }

  it('no mobile module reached from the pages can delete, restore, note or use the desktop moderation code', () => {
    const files = crawl()
    expect(files.length).toBeGreaterThanOrEqual(7)
    expect(files).toContain('app/features/mobile/services/mobileMessagesService.ts')
    for (const f of files) {
      const src = readFileSync(resolvePath(root, f), 'utf8')
      expect(src, f).not.toMatch(/deleteMessage|restoreMessage|addNote|moderationService|features\/moderation\/components|features\/moderation\/services/)
    }
  })
})
