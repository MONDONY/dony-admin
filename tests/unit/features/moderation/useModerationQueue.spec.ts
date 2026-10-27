import { describe, it, expect, vi, beforeEach } from 'vitest'
import { seedAuth } from '~/tests/helpers/auth'
vi.mock('@/features/moderation/services/moderationService')
vi.mock('@/features/signalements/services/reportsService')
import { useModerationQueue, CONVERSATION_PAGE_SIZE } from '@/features/moderation/composables/useModerationQueue'
import { moderationService } from '@/features/moderation/services/moderationService'
import { reportsService } from '@/features/signalements/services/reportsService'
import { isReportContext } from '@/features/moderation/composables/useModerationReportContext'
import { conversation, report } from './moderationFixtures'

const mod = moderationService as any
const rep = reportsService as any
const page = (content: unknown[], totalElements = content.length) => ({ content, totalElements, totalPages: 1, number: 0, size: 100 })

describe('useModerationQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    seedAuth('ADMIN')
    mod.listConversations = vi.fn().mockResolvedValue(page([conversation('c1'), conversation('c2')]))
    rep.list = vi.fn().mockResolvedValue(page([report('r1', 'c1')]))
  })

  it('charge 100 conversations et les signalements ouverts sur un message', async () => {
    const q = useModerationQueue()
    await q.fetchQueue()
    expect(mod.listConversations).toHaveBeenCalledWith(0, CONVERSATION_PAGE_SIZE)
    expect(rep.list).toHaveBeenCalledWith({ status: 'OPEN', targetType: 'MESSAGE' }, 0, CONVERSATION_PAGE_SIZE)
    expect(q.items.value.find((c) => c.id === 'c1')!.reports).toHaveLength(1)
    expect(q.reportsUnavailable.value).toBe(false)
    expect(q.truncated.value).toBe(false)
    expect(q.isLoading.value).toBe(false)
  })

  it('signale une page tronquée quand le back compte plus de conversations', async () => {
    mod.listConversations.mockResolvedValue(page([conversation('c1')], 340))
    const q = useModerationQueue()
    await q.fetchQueue()
    expect(q.truncated.value).toBe(true)
  })

  it('sans REPORT_VIEW : les signalements ne sont pas demandés, la file marche', async () => {
    seedAuth('ADMIN', { REPORT_VIEW: false })
    const q = useModerationQueue()
    await q.fetchQueue()
    expect(rep.list).not.toHaveBeenCalled()
    expect(q.items.value).toHaveLength(2)
    expect(q.reportsUnavailable.value).toBe(false)
  })

  it('signalements en panne : la file reste affichée, avec une note', async () => {
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
    mod.listConversations.mockRejectedValue(Object.assign(new Error('500'), { data: { detail: 'Base indisponible' } }))
    const q = useModerationQueue()
    await q.fetchQueue()
    expect(q.error.value).toBe('Base indisponible')
    expect(q.isLoading.value).toBe(false)
  })

  it('total absent : pas de page tronquée', async () => {
    mod.listConversations.mockResolvedValue({ content: [conversation('c1')] })
    const q = useModerationQueue()
    await q.fetchQueue()
    expect(q.truncated.value).toBe(false)
  })
})

describe('isReportContext', () => {
  it('un objet est un contexte ; une chaîne, un tableau ou null non', () => {
    expect(isReportContext({})).toBe(true)
    expect(isReportContext({ messages: [] })).toBe(true)
    expect(isReportContext('<html>')).toBe(false)
    expect(isReportContext([])).toBe(false)
    expect(isReportContext(null)).toBe(false)
  })
})
