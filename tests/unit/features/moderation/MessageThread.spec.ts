import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import MessageThread from '@/features/moderation/components/MessageThread.vue'
import { seedAuth } from '~/tests/helpers/auth'

const messages = [
  { id: 'm1', conversationId: 'c1', senderName: 'Awa', content: 'Bonjour', flagged: false, deleted: false, createdAt: '2026-06-01T10:00:00Z' },
  { id: 'm2', conversationId: 'c1', senderName: 'Karim', content: 'insulte', flagged: true, deleted: false, createdAt: '2026-06-01T10:05:00Z' },
  { id: 'm3', conversationId: 'c1', senderName: 'Awa', content: 'supprimé', flagged: false, deleted: true, createdAt: '2026-06-01T10:06:00Z' },
]

describe('MessageThread', () => {
  beforeEach(() => seedAuth('ADMIN'))
  it('renders messages with sender + content', () => {
    const w = mount(MessageThread, { props: { messages, loading: false } })
    expect(w.find('[data-test="message-m1"]').text()).toContain('Bonjour')
    expect(w.find('[data-test="message-m2"]').text()).toContain('insulte')
  })

  it('shows a flagged badge', () => {
    const w = mount(MessageThread, { props: { messages, loading: false } })
    expect(w.find('[data-test="msg-flagged-m2"]').exists()).toBe(true)
  })

  it('emits delete for non-deleted messages', async () => {
    const w = mount(MessageThread, { props: { messages, loading: false } })
    await w.find('[data-test="delete-msg-m2"]').trigger('click')
    expect(w.emitted('delete')![0]).toEqual(['m2'])
  })

  it('hides delete and shows placeholder for deleted messages', () => {
    const w = mount(MessageThread, { props: { messages, loading: false } })
    expect(w.find('[data-test="delete-msg-m3"]').exists()).toBe(false)
    expect(w.find('[data-test="message-m3"]').text()).toMatch(/supprimé/i)
  })

  it('empty state', () => {
    expect(mount(MessageThread, { props: { messages: [], loading: false } }).text()).toMatch(/Aucun message/i)
  })
})
