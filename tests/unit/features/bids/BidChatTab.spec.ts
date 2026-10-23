import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
vi.mock('@/features/moderation/services/moderationService')
import BidChatTab from '@/features/bids/components/BidChatTab.vue'
import { moderationService } from '@/features/moderation/services/moderationService'
import type { AdminMessage } from '@/features/moderation/types/index'
const svc = moderationService as any

const NuxtLink = { props: ['to'], template: '<a :data-to="JSON.stringify(to)"><slot /></a>' }
const msg = (id: string, over: Partial<AdminMessage> = {}): AdminMessage => ({
  id, conversationId: 'fs-42', senderName: 'Awa Ndiaye', content: `texte ${id}`, flagged: false, deleted: false,
  createdAt: '2026-10-06T18:53:35', ...over,
})
let w: VueWrapper | null = null
async function mountTab() {
  w = mount(BidChatTab, { props: { conversationId: 'fs-42' }, global: { stubs: { NuxtLink } }, attachTo: document.body })
  await flushPromises()
  return w
}

describe('BidChatTab', () => {
  beforeEach(() => { vi.clearAllMocks(); svc.getMessages = vi.fn() })
  afterEach(() => { w?.unmount(); w = null })

  it('chatTab_rendersMessagesInOrder', async () => {
    svc.getMessages.mockResolvedValue([msg('a'), msg('b', { senderName: 'Moussa' }), msg('c')])
    const t = await mountTab()
    const items = t.findAll('[data-test^="chat-message-"]')
    expect(items.map(i => i.attributes('data-test'))).toEqual(['chat-message-a', 'chat-message-b', 'chat-message-c'])
    expect(items[1]!.text()).toContain('Moussa')
    expect(items[1]!.text()).toContain('texte b')
    // 18:53:35 UTC = 20:53 à Paris (heure d'été).
    expect(items[0]!.text()).toContain('20:53')
    expect(t.emitted('loaded')?.[0]).toEqual([3])
  })

  it('chatTab_deletedMessagePlaceholder', async () => {
    svc.getMessages.mockResolvedValue([msg('a', { deleted: true, deletedAt: '2026-10-07T10:00:00Z', content: 'secret' })])
    const t = await mountTab()
    expect(t.find('[data-test="chat-message-a"]').text()).toContain('Message supprimé')
    expect(t.text()).not.toContain('secret')
  })

  it('chatTab_deletedMessageWithImage_noImage', async () => {
    svc.getMessages.mockResolvedValue([msg('a', { deleted: true, type: 'IMAGE', content: '', imageUrl: 'https://r2/full.jpg', thumbUrl: 'https://r2/thumb.jpg' })])
    const t = await mountTab()
    expect(t.find('[data-test="chat-message-a"]').text()).toContain('Message supprimé')
    expect(t.find('[data-test="chat-message-a"] img').exists()).toBe(false)
    expect(t.find('[data-test^="chat-image-"]').exists()).toBe(false)
  })

  it('chatTab_deletedAtOnly_placeholderWithoutBody', async () => {
    svc.getMessages.mockResolvedValue([msg('a', { deleted: false, deletedAt: '2026-10-07T10:00:00Z', content: 'corps' })])
    const t = await mountTab()
    expect(t.find('[data-test="chat-message-a"]').text()).toContain('Message supprimé')
    expect(t.text()).not.toContain('corps')
  })

  it('chatTab_logIsNotLive', async () => {
    svc.getMessages.mockResolvedValue([msg('a')])
    const t = await mountTab()
    expect(t.find('[role="log"]').attributes('aria-live')).toBe('off')
  })

  it('chatTab_reloadWithMessages_showsLoadingIndicator', async () => {
    svc.getMessages.mockResolvedValueOnce([msg('a', { type: 'IMAGE', content: '', imageUrl: 'https://r2/full.jpg', thumbUrl: 'https://r2/thumb.jpg' })])
    const t = await mountTab()
    expect(t.find('[data-test="chat-reloading"]').exists()).toBe(false)
    let resolve!: (_v: unknown) => void
    svc.getMessages.mockReturnValueOnce(new Promise(r => { resolve = r }))
    await t.find('[data-test="chat-image-a"] img').trigger('error')
    await t.find('[data-test="chat-image-a-reload"]').trigger('click')
    expect(t.find('[data-test="chat-reloading"]').text()).toContain('Actualisation')
    expect(t.find('[data-test="chat-message-a"]').exists()).toBe(true)
    resolve([msg('a')]); await flushPromises()
    expect(t.find('[data-test="chat-reloading"]').exists()).toBe(false)
  })

  it('chatTab_noDeleteButton', async () => {
    svc.getMessages.mockResolvedValue([msg('a'), msg('b', { deleted: true, deletedByAdmin: true })])
    const t = await mountTab()
    expect(t.find('[data-test^="delete-msg-"]').exists()).toBe(false)
    expect(t.find('[data-test^="restore-msg-"]').exists()).toBe(false)
    expect(t.text()).not.toContain('Supprimer')
    expect(t.text()).not.toContain('Restaurer')
  })

  it('chatTab_empty', async () => {
    svc.getMessages.mockResolvedValue([])
    const t = await mountTab()
    expect(t.text()).toContain('Aucun message.')
  })

  it('chatTab_errorRetry', async () => {
    svc.getMessages.mockRejectedValueOnce(Object.assign(new Error('boom'), { statusCode: 500, data: {} }))
    const t = await mountTab()
    expect(t.find('[data-test="state-error"]').exists()).toBe(true)
    expect(t.text()).not.toContain('Aucun message.')
    svc.getMessages.mockResolvedValueOnce([msg('a')])
    await t.find('[data-test="state-error"] button').trigger('click')
    await flushPromises()
    expect(t.find('[data-test="chat-message-a"]').exists()).toBe(true)
  })

  it('chatTab_imageOpensViewer', async () => {
    svc.getMessages.mockResolvedValue([
      msg('a', { type: 'IMAGE', content: '', imageUrl: 'https://r2/full.jpg?sig=1', thumbUrl: 'https://r2/thumb.jpg?sig=1' }),
      msg('b', { type: 'IMAGE', content: '', imageUrl: 'http://evil/x.jpg', thumbUrl: 'http://evil/x.jpg' }),
    ])
    const t = await mountTab()
    expect(t.find('[data-test="chat-image-a"] img').attributes('src')).toBe('https://r2/thumb.jpg?sig=1')
    // URL non https : jamais rendue.
    expect(t.find('[data-test="chat-image-b"]').exists()).toBe(false)
    expect(t.find('[data-test="chat-image-b-missing"]').text()).toContain('Cette photo n’est plus disponible.')
    await t.find('[data-test="chat-image-a"]').trigger('click')
    await flushPromises()
    expect(document.querySelector('[data-test="photo-main"]')!.getAttribute('src')).toBe('https://r2/full.jpg?sig=1')
  })

  it('chatTab_expiredThumbReloadsMessages', async () => {
    svc.getMessages.mockResolvedValue([msg('a', { type: 'IMAGE', content: '', imageUrl: 'https://r2/full.jpg', thumbUrl: 'https://r2/thumb.jpg' })])
    const t = await mountTab()
    await t.find('[data-test="chat-image-a"] img').trigger('error')
    expect(t.find('[data-test="chat-image-a-missing"]').text()).toContain('Cette photo n’est plus disponible.')
    await t.find('[data-test="chat-image-a-reload"]').trigger('click')
    await flushPromises()
    expect(svc.getMessages).toHaveBeenCalledTimes(2)
    expect(t.find('[data-test="chat-image-a"] img').exists()).toBe(true)
  })

  it('chatTab_linkToModeration', async () => {
    svc.getMessages.mockResolvedValue([msg('a')])
    const t = await mountTab()
    const link = t.find('[data-test="chat-open-moderation"]')
    expect(link.text()).toContain('Ouvrir dans la modération')
    expect(JSON.parse(link.attributes('data-to')!)).toBe('/moderation?open=fs-42')
  })
})
