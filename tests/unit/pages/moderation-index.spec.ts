/** /moderation?open=<conversationId> (« Voir la conversation » d'une fiche colis) ouvre le fil. */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { seedAuth } from '~/tests/helpers/auth'

vi.stubGlobal('definePageMeta', vi.fn())
let query: Record<string, string> = {}
vi.stubGlobal('useRoute', () => ({ meta: {}, query }))

const svc = vi.hoisted(() => ({ listConversations: vi.fn(), getMessages: vi.fn(), deleteMessage: vi.fn(), restoreMessage: vi.fn() }))
vi.mock('@/features/moderation/services/moderationService', () => ({ moderationService: svc }))

async function mountPage() {
  const mod = await import('@/pages/moderation/index.vue')
  const w = mount(mod.default)
  await flushPromises()
  return w
}

describe('/moderation', () => {
  // Premier import de la page à froid : lent quand toute la suite tourne en parallèle.
  beforeAll(async () => { await import('@/pages/moderation/index.vue') }, 30_000)

  beforeEach(() => {
    vi.clearAllMocks()
    seedAuth('ADMIN')
    query = {}
    svc.listConversations.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    svc.getMessages.mockResolvedValue([])
  })
  it('?open= ouvre le fil de la conversation', async () => {
    query = { open: 'fs-42' }
    const w = await mountPage()
    expect(svc.getMessages).toHaveBeenCalledWith('fs-42')
    expect(w.find('[data-test="thread-overlay"]').exists()).toBe(true)
  })
  it('sans ?open= : la liste seule', async () => {
    const w = await mountPage()
    expect(svc.getMessages).not.toHaveBeenCalled()
    expect(w.find('[data-test="thread-overlay"]').exists()).toBe(false)
  })
})
