import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ConversationsTable from '@/features/moderation/components/ConversationsTable.vue'

const conversations = [
  { id: 'c1', bidId: 'b1', participantA: 'Awa', participantB: 'Karim', lastMessageAt: '2026-06-02T10:00:00Z', messageCount: 8, flagged: true, createdAt: '2026-06-01T10:00:00Z' },
]

describe('ConversationsTable', () => {
  it('renders rows with participants + count', () => {
    const w = mount(ConversationsTable, { props: { conversations, loading: false } })
    expect(w.find('[data-test="conv-row-c1"]').exists()).toBe(true)
    expect(w.text()).toContain('Awa')
    expect(w.text()).toContain('Karim')
    expect(w.text()).toContain('8')
  })

  it('shows a flagged badge', () => {
    const w = mount(ConversationsTable, { props: { conversations, loading: false } })
    expect(w.find('[data-test="conv-flagged-c1"]').exists()).toBe(true)
  })

  it('emits open', async () => {
    const w = mount(ConversationsTable, { props: { conversations, loading: false } })
    await w.find('[data-test="open-c1"]').trigger('click')
    expect(w.emitted('open')![0]).toEqual(['c1'])
  })

  it('empty state', () => {
    expect(mount(ConversationsTable, { props: { conversations: [], loading: false } }).text()).toMatch(/Aucune conversation/i)
  })
})
