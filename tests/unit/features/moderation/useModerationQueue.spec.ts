import { describe, it, expect, vi, beforeEach } from 'vitest'
import { seedAuth } from '~/tests/helpers/auth'
vi.mock('@/features/moderation/services/moderationService')
vi.mock('@/features/signalements/services/reportsService')
import { useModerationQueue, CONVERSATION_PAGE_SIZE } from '@/features/moderation/composables/useModerationQueue'
import { moderationService } from '@/features/moderation/services/moderationService'
import { reportsService } from '@/features/signalements/services/reportsService'
import { isReportContext } from '@/features/moderation/composables/useModerationReportContext'
import { isConversationContext } from '@/features/moderation/composables/useModerationContext'
import { conversation, report } from './moderationFixtures'

const mod = moderationService as any
const rep = reportsService as any
const page = (content: unknown[], totalElements = content.length) => ({ content, totalElements, totalPages: 1, number: 0, size: 100 })

describe('useModerationQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    seedAuth('ADMIN')
    mod.listConversations = vi.fn((_p: number, _s: number, filters: { flagged?: boolean } = {}) =>
      Promise.resolve(filters.flagged ? page([conversation('c1', { openReportCount: 1 })]) : page([conversation('c1', { openReportCount: 1 }), conversation('c2')])))
    rep.list = vi.fn().mockResolvedValue(page([report('r1', 'c1')]))
  })

  it('charge la page récente, les conversations signalées et le détail des signalements ouverts', async () => {
    const q = useModerationQueue()
    await q.fetchQueue()
    expect(mod.listConversations).toHaveBeenCalledWith(0, CONVERSATION_PAGE_SIZE, {})
    expect(mod.listConversations).toHaveBeenCalledWith(0, CONVERSATION_PAGE_SIZE, { flagged: true })
    expect(rep.list).toHaveBeenCalledWith({ status: 'OPEN', targetType: 'MESSAGE' }, 0, CONVERSATION_PAGE_SIZE)
    expect(q.items.value.map((c) => c.id)).toEqual(['c1', 'c2'])
    expect(q.items.value.find((c) => c.id === 'c1')!.reports).toHaveLength(1)
    expect(q.reportsUnavailable.value).toBe(false)
    expect(q.flagsUnsupported.value).toBe(false)
    expect(q.truncated.value).toBe(false)
    expect(q.isLoading.value).toBe(false)
  })

  it('une conversation signalée ancienne, hors de la page récente, entre dans la file par la liste des signalées', async () => {
    mod.listConversations = vi.fn((_p: number, _s: number, filters: { flagged?: boolean } = {}) =>
      Promise.resolve(filters.flagged ? page([conversation('old', { openReportCount: 2 })]) : page([conversation('c2')], 340)))
    rep.list.mockResolvedValue(page([report('r9', 'old')]))
    const q = useModerationQueue()
    await q.fetchQueue()
    expect(q.items.value.map((c) => c.id)).toEqual(['c2', 'old'])
    expect(q.items.value.find((c) => c.id === 'old')).toMatchObject({ openReportCount: 2, partial: false })
    expect(q.items.value.find((c) => c.id === 'old')!.reports).toHaveLength(1)
    expect(q.truncated.value).toBe(true)
  })

  it('la recherche par nom part au serveur, sans seconde lecture des signalées', async () => {
    const q = useModerationQueue()
    await q.fetchQueue({ q: '  Aicha ' })
    expect(mod.listConversations).toHaveBeenCalledTimes(1)
    expect(mod.listConversations).toHaveBeenCalledWith(0, CONVERSATION_PAGE_SIZE, { q: 'Aicha' })
  })

  it('ancien back : aucune conversation ne porte d’identifiant interne, la file le dit', async () => {
    mod.listConversations = vi.fn(() => Promise.resolve(page([conversation('c1', { conversationId: undefined })])))
    const q = useModerationQueue()
    await q.fetchQueue()
    expect(q.flagsUnsupported.value).toBe(true)
    expect(q.items.value[0]!.reports).toEqual([])
  })

  it('la lecture des signalées en panne ne casse pas la file', async () => {
    mod.listConversations = vi.fn((_p: number, _s: number, filters: { flagged?: boolean } = {}) =>
      filters.flagged ? Promise.reject(new Error('500')) : Promise.resolve(page([conversation('c1')])))
    const q = useModerationQueue()
    await q.fetchQueue()
    expect(q.error.value).toBeNull()
    expect(q.items.value.map((c) => c.id)).toEqual(['c1'])
  })

  it('une page « signalées » d’une autre forme est ignorée', async () => {
    mod.listConversations = vi.fn((_p: number, _s: number, filters: { flagged?: boolean } = {}) =>
      Promise.resolve(filters.flagged ? '<html>' : page([conversation('c1')])))
    const q = useModerationQueue()
    await q.fetchQueue()
    expect(q.items.value.map((c) => c.id)).toEqual(['c1'])
  })

  it('sans REPORT_VIEW : le détail des signalements n’est pas demandé, le compte du serveur reste', async () => {
    seedAuth('ADMIN', { REPORT_VIEW: false })
    const q = useModerationQueue()
    await q.fetchQueue()
    expect(rep.list).not.toHaveBeenCalled()
    expect(q.items.value.find((c) => c.id === 'c1')).toMatchObject({ openReportCount: 1, reports: [] })
    expect(q.reportsUnavailable.value).toBe(false)
  })

  it('détail des signalements en panne : la file reste affichée, avec une note', async () => {
    rep.list.mockRejectedValue(new Error('500'))
    const q = useModerationQueue()
    await q.fetchQueue()
    expect(q.reportsUnavailable.value).toBe(true)
    expect(q.error.value).toBeNull()
    expect(q.items.value).toHaveLength(2)
    rep.list.mockResolvedValue(page([]))
    await q.fetchQueue()
    expect(q.reportsUnavailable.value).toBe(false)
  })

  it('réponse de signalements d’une autre forme : ignorée', async () => {
    rep.list.mockResolvedValue('<html>')
    const q = useModerationQueue()
    await q.fetchQueue()
    expect(q.items.value.every((c) => c.reports.length === 0)).toBe(true)
  })

  it('conversations en panne : phrase du back', async () => {
    mod.listConversations = vi.fn(() => Promise.reject(Object.assign(new Error('500'), { data: { detail: 'Base indisponible' } })))
    const q = useModerationQueue()
    await q.fetchQueue()
    expect(q.error.value).toBe('Base indisponible')
    expect(q.isLoading.value).toBe(false)
  })

  it('total absent : pas de page tronquée', async () => {
    mod.listConversations = vi.fn(() => Promise.resolve({ content: [conversation('c1')] }))
    const q = useModerationQueue()
    await q.fetchQueue()
    expect(q.truncated.value).toBe(false)
  })

  it('une lecture plus lente que la suivante est écartée (frappe rapide dans la recherche)', async () => {
    // eslint-disable-next-line no-unused-vars -- paramètre d'un type de fonction
    let releaseFirst: (v: unknown) => void = () => {}
    mod.listConversations = vi.fn()
      .mockImplementationOnce(() => new Promise((r) => { releaseFirst = r }))
      .mockResolvedValue(page([conversation('fresh')]))
    rep.list.mockResolvedValue(page([]))
    const q = useModerationQueue()
    const slow = q.fetchQueue({ q: 'ai' })
    await q.fetchQueue({ q: 'aicha' })
    releaseFirst(page([conversation('stale')]))
    await slow
    expect(q.items.value.map((c) => c.id)).toEqual(['fresh'])
    expect(q.isLoading.value).toBe(false)
  })
})

describe('gardes de forme des contextes', () => {
  it('contexte de signalement : un objet', () => {
    expect(isReportContext({})).toBe(true)
    expect(isReportContext({ messages: [] })).toBe(true)
    expect(isReportContext('<html>')).toBe(false)
    expect(isReportContext([])).toBe(false)
    expect(isReportContext(null)).toBe(false)
  })

  it('contexte de conversation : historique et notes sont des listes', () => {
    expect(isConversationContext({ history: [], notes: [], reports: [], participants: [] })).toBe(true)
    expect(isConversationContext({ history: [], notes: [] })).toBe(true)
    expect(isConversationContext({ history: [] })).toBe(false)
    expect(isConversationContext({ notes: [] })).toBe(false)
    expect(isConversationContext('<html>')).toBe(false)
    expect(isConversationContext(null)).toBe(false)
  })
})
