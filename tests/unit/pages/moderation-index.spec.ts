/** /moderation : le poste ouvre la conversation signalée, ou celle d'un lien `?open=<conversationId>`. */
import { describe, it, expect, vi, afterEach, beforeAll, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick, reactive } from 'vue'
import { seedAuth } from '~/tests/helpers/auth'

vi.stubGlobal('definePageMeta', vi.fn())
const route = reactive<{ meta: object; query: Record<string, string> }>({ meta: {}, query: {} })
const replace = vi.fn()
vi.stubGlobal('useRoute', () => route)
vi.stubGlobal('useRouter', () => ({ replace }))

const svc = vi.hoisted(() => ({ listConversations: vi.fn(), getMessages: vi.fn(), deleteMessage: vi.fn(), restoreMessage: vi.fn() }))
const reports = vi.hoisted(() => ({ list: vi.fn(), getContext: vi.fn() }))
vi.mock('@/features/moderation/services/moderationService', () => ({ moderationService: svc }))
vi.mock('@/features/signalements/services/reportsService', () => ({ reportsService: reports }))

const R1 = '33333333-3333-4333-8333-333333333333'
const page = (content: unknown[], totalElements = content.length) => ({ content, totalElements, totalPages: 1, number: 0, size: 100 })
const conv = (id: string, a: string, b: string, over: Record<string, unknown> = {}) => ({
  id, bidId: null, participantA: a, participantB: b, lastMessageAt: new Date(Date.now() - 3_600_000).toISOString(), messageCount: 0,
  flagged: false, createdAt: '2026-10-12T10:00:00Z', ...over,
})
const msg = (id: string, over: Record<string, unknown> = {}) => ({
  id, conversationId: 'c1', senderName: 'Aïcha', content: 'Bonjour', flagged: false, deleted: false, createdAt: '2026-10-20T16:02:00Z', ...over,
})
const openReport = {
  id: R1, targetType: 'MESSAGE', targetId: 'c1', targetLabel: 'Aïcha ↔ Moussa', reason: 'SPAM', description: null, reporterName: 'Aïcha',
  status: 'OPEN', actionTaken: null, resolutionNote: null, resolvedAt: null, createdAt: new Date(Date.now() - 100 * 3_600_000).toISOString(), photoUrls: [],
}

// Un poste monté écoute la route et le clavier : chaque test démonte les siens pour ne pas réagir aux suivants.
const mounted: ReturnType<typeof mount>[] = []
async function mountPage() {
  const mod = await import('@/pages/moderation/index.vue')
  const w = mount(mod.default, { attachTo: document.body })
  mounted.push(w)
  await flushPromises()
  return w
}
const title = (w: ReturnType<typeof mount>) => w.find('[data-test="thread-title"]').text()
const press = (key: string) => window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))

describe('/moderation', () => {
  // Premier import de la page à froid : lent quand toute la suite tourne en parallèle.
  beforeAll(async () => { await import('@/pages/moderation/index.vue') }, 30_000)

  afterEach(() => { while (mounted.length) mounted.pop()!.unmount() })

  beforeEach(() => {
    vi.clearAllMocks()
    seedAuth('ADMIN')
    route.query = {}
    svc.listConversations.mockResolvedValue(page([conv('c1', 'Aïcha', 'Moussa'), conv('c2', 'Mariam', 'Ousmane')]))
    svc.getMessages.mockImplementation((id: string) => Promise.resolve(id === 'c1'
      ? [msg('m1'), msg('m2', { senderName: 'Moussa', content: 'Gagnez 500 € vite' })]
      : [msg('m3', { conversationId: 'c2', senderName: 'Mariam', content: 'Merci' })]))
    svc.deleteMessage.mockResolvedValue(undefined)
    svc.restoreMessage.mockResolvedValue(undefined)
    reports.list.mockResolvedValue(page([openReport]))
    reports.getContext.mockResolvedValue({ messages: [{ id: 'm1', body: 'Bonjour', flagged: false, deleted: false, fromSubject: false }, { id: 'm2', body: 'Gagnez', flagged: true, deleted: false, fromSubject: true }] })
  })

  it('sans ?open= : ouvre la conversation signalée et met le message visé en évidence', async () => {
    const w = await mountPage()
    expect(svc.getMessages).toHaveBeenCalledWith('c1')
    expect(reports.getContext).toHaveBeenCalledWith(R1)
    expect(title(w)).toBe('Aïcha ↔ Moussa')
    expect(w.find('[data-test="message-m2"]').attributes('data-flagged')).toBe('true')
    expect(w.find('[data-test="summary-open"]').text()).toBe('1')
    expect(replace).not.toHaveBeenCalled()
  })

  it('?open= vers une conversation calme bascule sur « Toutes » et ouvre son fil', async () => {
    route.query = { open: 'c2' }
    const w = await mountPage()
    expect(svc.getMessages).toHaveBeenCalledWith('c2')
    expect(title(w)).toBe('Mariam ↔ Ousmane')
    expect(w.find('[data-test="scope-all"]').attributes('aria-pressed')).toBe('true')
    expect(reports.getContext).not.toHaveBeenCalled()
  })

  it('?open= vers une conversation hors de la page chargée : elle s’ouvre telle quelle', async () => {
    route.query = { open: 'fs-42' }
    const w = await mountPage()
    expect(svc.getMessages).toHaveBeenCalledWith('fs-42')
    expect(title(w)).toBe('Conversation signalée')
    expect(w.find('[data-test="decision-no-report"]').exists()).toBe(true)
  })

  it('?open= malveillant : ignoré, la conversation signalée s’ouvre', async () => {
    route.query = { open: '../../admin/x' }
    const w = await mountPage()
    expect(svc.getMessages).not.toHaveBeenCalledWith('../../admin/x')
    expect(svc.getMessages).toHaveBeenCalledWith('c1')
    expect(title(w)).toBe('Aïcha ↔ Moussa')
  })

  it('aucune conversation : file vide, rien à ouvrir', async () => {
    svc.listConversations.mockResolvedValue(page([]))
    reports.list.mockResolvedValue(page([]))
    const w = await mountPage()
    expect(svc.getMessages).not.toHaveBeenCalled()
    expect(w.find('[data-test="thread-empty"]').exists()).toBe(true)
    expect(w.find('[data-test="moderation-queue-panel"]').text()).toContain('Aucune conversation')
  })

  it('sans signalement ouvert : la file montre toute l’activité d’office', async () => {
    reports.list.mockResolvedValue(page([]))
    const w = await mountPage()
    expect(w.find('[data-test="scope-all"]').attributes('aria-pressed')).toBe('true')
    expect(w.find('[data-test="summary-oldest"]').text()).toBe('—')
    expect(svc.getMessages).toHaveBeenCalledWith('c1')
  })

  it('signalements en panne : note, file utilisable', async () => {
    reports.list.mockRejectedValue(new Error('500'))
    const w = await mountPage()
    expect(w.find('[data-test="moderation-reports-unavailable"]').exists()).toBe(true)
    expect(w.find('[data-test="conv-row-c1"]').exists()).toBe(true)
    expect(title(w)).toBe('Aïcha ↔ Moussa')
  })

  it('page tronquée : le dit', async () => {
    svc.listConversations.mockResolvedValue(page([conv('c1', 'Aïcha', 'Moussa')], 340))
    const w = await mountPage()
    expect(w.find('[data-test="moderation-truncated"]').exists()).toBe(true)
  })

  it('un clic dans la file change de conversation et écrit ?open=', async () => {
    const w = await mountPage()
    await w.find('[data-test="scope-all"]').trigger('click')
    await w.find('[data-test="open-c2"]').trigger('click')
    await flushPromises()
    expect(title(w)).toBe('Mariam ↔ Ousmane')
    expect(replace).toHaveBeenCalledWith({ query: { open: 'c2' } })
    expect(reports.getContext).toHaveBeenCalledTimes(1)
    // Re-cliquer la conversation déjà ouverte ne relit rien.
    svc.getMessages.mockClear()
    await w.find('[data-test="open-c2"]').trigger('click')
    expect(svc.getMessages).not.toHaveBeenCalled()
  })

  it('le lien reste valable une page déjà ouverte, sans rouvrir l’écho de sa propre écriture', async () => {
    const w = await mountPage()
    route.query = { open: 'c2' }
    await nextTick()
    await flushPromises()
    expect(title(w)).toBe('Mariam ↔ Ousmane')
    svc.getMessages.mockClear()
    // L'écran écrit `open` lui-même (clic) : l'écho du router ne relit rien.
    await w.find('[data-test="open-c1"]').trigger('click')
    route.query = { open: 'c1' }
    await nextTick()
    await flushPromises()
    expect(svc.getMessages).toHaveBeenCalledTimes(1)
  })

  it('la recherche filtre la file et une conversation écartée est remplacée par la première', async () => {
    const w = await mountPage()
    await w.find('[data-test="scope-all"]').trigger('click')
    await w.find('[data-test="moderation-search"]').setValue('ousmane')
    await flushPromises()
    expect(w.find('[data-test="conv-row-c1"]').exists()).toBe(false)
    expect(title(w)).toBe('Mariam ↔ Ousmane')
  })

  it('J / K parcourent la file', async () => {
    const w = await mountPage()
    await w.find('[data-test="scope-all"]').trigger('click')
    press('j')
    await flushPromises()
    expect(title(w)).toBe('Mariam ↔ Ousmane')
    press('k')
    await flushPromises()
    expect(title(w)).toBe('Aïcha ↔ Moussa')
  })

  it('supprimer le message signalé : motif demandé, puis suppression et relecture', async () => {
    const w = await mountPage()
    await w.find('[data-test="decision-delete"]').trigger('click')
    await w.find('[data-test="reason"]').setValue('spam avéré')
    svc.getMessages.mockClear()
    await w.find('[data-test="confirm"]').trigger('click')
    await flushPromises()
    expect(svc.deleteMessage).toHaveBeenCalledWith('c1', 'm2', 'spam avéré')
    expect(svc.getMessages).toHaveBeenCalledWith('c1')
  })

  it('annuler la suppression d’un dialogue ne supprime rien', async () => {
    const w = await mountPage()
    await w.find('[data-test="delete-msg-m1"]').trigger('click')
    await w.find('[data-test="cancel"]').trigger('click')
    expect(svc.deleteMessage).not.toHaveBeenCalled()
    expect(w.find('[data-test="reason"]').exists()).toBe(false)
  })

  it('suppression refusée : la phrase du back s’affiche', async () => {
    svc.deleteMessage.mockRejectedValue(Object.assign(new Error('500'), { data: { detail: 'Firestore indisponible' } }))
    const w = await mountPage()
    await w.find('[data-test="delete-msg-m1"]').trigger('click')
    await w.find('[data-test="reason"]').setValue('hors sujet')
    await w.find('[data-test="confirm"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="thread-delete-error"]').text()).toBe('Firestore indisponible')
  })

  it('restaurer un message supprimé par un admin : motif de 10 caractères au moins', async () => {
    svc.getMessages.mockResolvedValue([msg('m3', { deleted: true, deletedByAdmin: true, deletedAt: '2026-10-25T15:02:00Z' })])
    const w = await mountPage()
    await w.find('[data-test="restore-msg-m3"]').trigger('click')
    await w.find('[data-test="restore-reason"]').setValue('suppression abusive')
    await w.find('[data-test="restore-confirm"]').trigger('click')
    await flushPromises()
    expect(svc.restoreMessage).toHaveBeenCalledWith('c1', 'm3', 'suppression abusive')
    expect(w.find('[data-test="restore-reason"]').exists()).toBe(false)
  })

  it('restauration refusée (422) : le dialogue reste ouvert ; échec ordinaire : message dans le fil', async () => {
    svc.getMessages.mockResolvedValue([msg('m3', { deleted: true, deletedByAdmin: true, deletedAt: '2026-10-25T15:02:00Z' })])
    svc.restoreMessage.mockRejectedValue(Object.assign(new Error('409'), { statusCode: 409, data: { detail: 'Déjà visible.' } }))
    const w = await mountPage()
    await w.find('[data-test="restore-msg-m3"]').trigger('click')
    await w.find('[data-test="restore-reason"]').setValue('suppression abusive')
    await w.find('[data-test="restore-confirm"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="thread-restore-error"]').text()).toBe('Déjà visible.')
  })
})
