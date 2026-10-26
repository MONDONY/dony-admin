/**
 * Page /support : poste de traitement (file groupée, conversation, contexte et actions), lien profond
 * ?ticket= (notifications SUPPORT_*), filtre ?userId= (fiche utilisateur) et nouvelle conversation.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { reactive } from 'vue'
import { seedAuth } from '~/tests/helpers/auth'
import { ago, message, NOW, ticket } from '../features/support/supportFixtures'

vi.stubGlobal('definePageMeta', vi.fn())
const replaceMock = vi.fn()
vi.stubGlobal('useRouter', () => ({ replace: replaceMock }))
const route = reactive<{ meta: Record<string, unknown>; query: Record<string, string> }>({ meta: {}, query: {} })
vi.stubGlobal('useRoute', () => route)

const support = vi.hoisted(() => ({
  list: vi.fn(), get: vi.fn(), listByUser: vi.fn(), assign: vi.fn(), reassign: vi.fn(), reply: vi.fn(), resolve: vi.fn(),
}))
vi.mock('@/features/support/services/supportService', () => ({ supportService: support }))
const users = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/features/users/services/usersService', () => ({ usersService: users }))

const UID = '11111111-1111-4111-8111-111111111111'
// seedAuth pose l'administrateur « u1 ».
const t1 = ticket({ id: 't1', subject: 'Où est mon colis ?', userId: UID, lastMessageAt: ago(200) })
const t2 = ticket({ id: 't2', subject: 'Remboursement', category: 'PAYMENT', status: 'WAITING_SUPPORT', userId: 'u2', userDisplayName: 'Fatou B.', assignedAdminId: 'u1', assignedAdminEmail: 'admin@yadony.com', lastMessageAt: ago(5) })
const t3 = ticket({ id: 't3', subject: 'Comment proposer un trajet ?', status: 'WAITING_USER', userId: UID, assignedAdminId: 'x', assignedAdminEmail: 'x@yadony.com', lastMessageAt: ago(30) })
const t4 = ticket({ id: 't4', subject: 'Vérification refusée', category: 'KYC', status: 'RESOLVED', userId: 'u3', userDisplayName: 'Salif T.', assignedAdminId: 'u1', assignedAdminEmail: 'admin@yadony.com', resolvedAt: ago(24), lastMessageAt: ago(24) })
const page = (content: unknown[], total = content.length) => ({ content, totalElements: total, totalPages: 1, number: 0, size: 100 })
const withMessages = (t: ReturnType<typeof ticket>) => ({ ...t, messages: [message(`m-${t.id}`, 'USER', ago(40), `Message de ${t.id}`)] })

const DialogStub = {
  name: 'StartSupportConversationDialog', props: ['open', 'recipient'], emits: ['close', 'sent'],
  template: '<div v-if="open" data-test="start-dialog-stub">{{ recipient ? recipient.name + \'|\' + recipient.id : \'aucun\' }}<button data-test="stub-sent" @click="$emit(\'sent\', { id: \'t42\' })" /><button data-test="stub-close" @click="$emit(\'close\')" /></div>',
}
const UploaderStub = { name: 'SupportAttachmentUploader', emits: ['change', 'busy'], template: '<div />' }

// Une page d'un test précédent encore montée réagirait aux changements de la route partagée.
const mounted: VueWrapper[] = []
async function mountPage() {
  const mod = await import('@/pages/support/index.vue')
  const w = mount(mod.default, { attachTo: document.body, global: { stubs: { NuxtLink: true, StartSupportConversationDialog: DialogStub, SupportAttachmentUploader: UploaderStub } } })
  mounted.push(w)
  await flushPromises()
  return w
}
const subject = (w: VueWrapper) => w.get('[data-test="support-subject"]').text()
const rows = (w: VueWrapper) => w.findAll('[data-test^="support-row-"]').map((r) => r.attributes('data-test')!.replace('support-row-', ''))
const press = async (key: string, init: { metaKey?: boolean } = {}) => { window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init })); await flushPromises() }

describe('pages/support', () => {
  afterEach(() => { mounted.splice(0).forEach((w) => w.unmount()); vi.useRealTimers(); sessionStorage.clear() })
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
    sessionStorage.clear()
    vi.clearAllMocks()
    seedAuth('ADMIN')
    route.query = {}
    replaceMock.mockReset().mockImplementation(({ query }: { query: Record<string, string> }) => { route.query = query; return Promise.resolve() })
    support.list.mockResolvedValue(page([t1, t2, t3, t4]))
    support.get.mockImplementation((id: string) => Promise.resolve(withMessages([t1, t2, t3, t4].find((t) => t.id === id) ?? ticket({ id }))))
    support.listByUser.mockResolvedValue(page([]))
    support.assign.mockResolvedValue({}); support.reassign.mockResolvedValue({}); support.resolve.mockResolvedValue({})
    support.reply.mockResolvedValue({ id: 'm1' })
    users.get.mockResolvedValue({ id: UID, firstName: 'Awa', lastName: 'Diallo', status: 'ACTIVE', kycStatus: 'VERIFIED', createdAt: '2026-08-12T10:00:00Z' })
  })

  describe('poste', () => {
    it('lit une page de 100 conversations et ouvre d’emblée la première de la file', async () => {
      const w = await mountPage()
      expect(support.list).toHaveBeenCalledTimes(1)
      expect(support.list.mock.calls[0]).toEqual(['all', 'TOUS', 0, 100])
      // Périmètre « Non assignés » par défaut : le plus ancien à répondre.
      expect(rows(w)).toEqual(['t1'])
      expect(subject(w)).toBe('Où est mon colis ?')
      expect(support.get).toHaveBeenCalledWith('t1')
      expect(w.get('[data-test="support-message-m-t1"]').text()).toContain('Message de t1')
      expect(replaceMock).not.toHaveBeenCalled()
    })

    it('bandeau de synthèse : à répondre, non assignés, plus ancien, résolus de la semaine', async () => {
      const w = await mountPage()
      expect(w.get('[data-test="summary-to-answer"]').text()).toBe('2')
      expect(w.get('[data-test="summary-unassigned"]').text()).toBe('1')
      expect(w.get('[data-test="summary-oldest"]').text()).toBe('8 j')
      expect(w.get('[data-test="support-summary"]').text()).toContain('Où est mon colis ?')
      expect(w.get('[data-test="summary-resolved"]').text()).toBe('1')
    })

    it('rien à répondre : « — » comme plus ancien', async () => {
      support.list.mockResolvedValue(page([t4]))
      const w = await mountPage()
      expect(w.get('[data-test="summary-oldest"]').text()).toBe('—')
    })

    it('onglets avec leur compte : Non assignés, Mes tickets, Tous', async () => {
      const w = await mountPage()
      expect(w.get('[data-test="scope-unassigned"]').text()).toContain('1')
      expect(w.get('[data-test="scope-mine"]').text()).toContain('2')
      expect(w.get('[data-test="scope-all"]').text()).toContain('4')
      await w.get('[data-test="scope-mine"]').trigger('click')
      expect(rows(w)).toEqual(['t2', 't4'])
      expect(subject(w)).toBe('Remboursement')
      await w.get('[data-test="scope-all"]').trigger('click')
      expect(rows(w)).toEqual(['t1', 't2', 't3', 't4'])
      expect(support.list).toHaveBeenCalledTimes(1)
    })

    it('recherche, catégorie et priorité haute filtrent la file', async () => {
      const w = await mountPage()
      await w.get('[data-test="scope-all"]').trigger('click')
      await w.get('[data-test="support-search"]').setValue('fatou')
      expect(rows(w)).toEqual(['t2'])
      await w.get('[data-test="support-search"]').setValue('')
      await w.get('[data-test="category-KYC"]').trigger('click')
      expect(rows(w)).toEqual(['t4'])
      await w.get('[data-test="category-KYC"]').trigger('click')
      expect(rows(w)).toHaveLength(4)
      await w.get('[data-test="filter-high"]').trigger('click')
      expect(w.text()).toContain('Aucun ticket')
      await w.get('[data-test="support-search"]').setValue('introuvable')
      expect(w.text()).toContain('Aucun ticket')
    })

    it('la liste tronquée est signalée', async () => {
      support.list.mockResolvedValue(page([t1], 250))
      const w = await mountPage()
      expect(w.get('[data-test="support-truncated"]').text()).toContain('100 conversations')
    })

    it('erreur de lecture : « Réessayer » relit', async () => {
      support.list.mockRejectedValueOnce(Object.assign(new Error('x'), { data: { detail: 'Base indisponible' } }))
      const w = await mountPage()
      expect(w.get('[data-test="state-error"]').text()).toContain('Base indisponible')
      await w.get('[data-test="state-error"] button').trigger('click')
      await flushPromises()
      expect(rows(w)).toEqual(['t1'])
    })

    it('un clic ouvre le ticket et l’écrit dans l’URL, sans le rouvrir en écho', async () => {
      const w = await mountPage()
      await w.get('[data-test="scope-all"]').trigger('click')
      await w.get('[data-test="support-open-t3"]').trigger('click')
      await flushPromises()
      expect(subject(w)).toBe('Comment proposer un trajet ?')
      expect(replaceMock).toHaveBeenLastCalledWith({ query: { ticket: 't3' } })
      expect(support.get.mock.calls.filter((c) => c[0] === 't3')).toHaveLength(1)
      await w.get('[data-test="support-open-t3"]').trigger('click')
      expect(replaceMock).toHaveBeenCalledTimes(1)
    })

    it('autres paramètres de l’URL conservés', async () => {
      route.query = { foo: 'bar' }
      const w = await mountPage()
      await w.get('[data-test="scope-all"]').trigger('click')
      await w.get('[data-test="support-open-t2"]').trigger('click')
      expect(route.query).toEqual({ foo: 'bar', ticket: 't2' })
    })

    it('un filtre qui écarte le ticket ouvert le remplace par le premier visible', async () => {
      const w = await mountPage()
      await w.get('[data-test="scope-all"]').trigger('click')
      await w.get('[data-test="support-open-t3"]').trigger('click')
      await w.get('[data-test="support-search"]').setValue('fatou')
      await flushPromises()
      expect(subject(w)).toBe('Remboursement')
    })
  })

  describe('contexte', () => {
    it('fiche et autres conversations de la personne', async () => {
      support.listByUser.mockResolvedValue(page([t1, t3]))
      const w = await mountPage()
      expect(users.get).toHaveBeenCalledWith(UID)
      expect(support.listByUser).toHaveBeenCalledWith(UID, 6)
      expect(w.get('[data-test="support-user-facts"]').text()).toContain('Identité vérifiée')
      // Le ticket affiché est exclu de ses propres « autres conversations ».
      expect(w.find('[data-test="support-related-t1"]').exists()).toBe(false)
      expect(w.get('[data-test="support-related-t3"]').text()).toContain('Comment proposer un trajet ?')
      await w.get('[data-test="support-related-t3"]').trigger('click')
      await flushPromises()
      expect(subject(w)).toBe('Comment proposer un trajet ?')
    })

    it('sans USER_VIEW : pas de lecture de la fiche', async () => {
      seedAuth('ADMIN', { USER_VIEW: false })
      await mountPage()
      expect(users.get).not.toHaveBeenCalled()
    })

    it('fiche illisible : le contexte reste lisible', async () => {
      users.get.mockRejectedValue(new Error('403'))
      const w = await mountPage()
      expect(w.get('[data-test="support-user-name"]').text()).toBe('user D')
    })
  })

  describe('gestes', () => {
    it('s’assigner : appel, ticket et file relus, zone de réponse ouverte', async () => {
      const w = await mountPage()
      support.get.mockClear()
      // Le serveur fait foi : après l'assignation, la relecture rend le ticket à moi.
      support.get.mockImplementation((id: string) => Promise.resolve(withMessages({ ...t1, id, assignedAdminId: 'u1', assignedAdminEmail: 'admin@yadony.com', status: 'ASSIGNED' })))
      await w.get('[data-test="support-assign"]').trigger('click')
      await flushPromises()
      expect(support.assign).toHaveBeenCalledWith('t1')
      expect(support.get).toHaveBeenCalledWith('t1')
      expect(support.list).toHaveBeenCalledTimes(2)
      expect(w.find('[data-test="support-composer"]').exists()).toBe(true)
    })

    it('refus à l’assignation : l’erreur reste dans la colonne d’actions', async () => {
      support.assign.mockRejectedValue(Object.assign(new Error('409'), { data: { detail: 'Déjà pris par un collègue.' } }))
      const w = await mountPage()
      await w.get('[data-test="support-action-assign"]').trigger('click')
      await flushPromises()
      expect(w.get('[data-test="support-action-error"]').text()).toBe('Déjà pris par un collègue.')
    })

    it('reprendre un ticket d’un collègue', async () => {
      const w = await mountPage()
      await w.get('[data-test="scope-all"]').trigger('click')
      await w.get('[data-test="support-open-t3"]').trigger('click')
      await flushPromises()
      await w.get('[data-test="support-action-reassign"]').trigger('click')
      await flushPromises()
      expect(support.reassign).toHaveBeenCalledWith('t3', 'u1')
    })

    it('répondre : envoyé, brouillon effacé', async () => {
      const w = await mountPage()
      await w.get('[data-test="scope-mine"]').trigger('click')
      await flushPromises()
      await w.get('[data-test="support-reply"]').setValue('Bonjour')
      await w.get('[data-test="support-send"]').trigger('click')
      await flushPromises()
      expect(support.reply).toHaveBeenCalledWith('t2', 'Bonjour', [])
      expect((w.get('[data-test="support-reply"]').element as HTMLTextAreaElement).value).toBe('')
    })

    it('refus à l’envoi : le brouillon est conservé', async () => {
      support.reply.mockRejectedValue(Object.assign(new Error('409'), { data: { detail: 'Ticket résolu.' } }))
      const w = await mountPage()
      await w.get('[data-test="scope-mine"]').trigger('click')
      await flushPromises()
      await w.get('[data-test="support-reply"]').setValue('Bonjour')
      await w.get('[data-test="support-send"]').trigger('click')
      await flushPromises()
      expect((w.get('[data-test="support-reply"]').element as HTMLTextAreaElement).value).toBe('Bonjour')
      expect(w.get('[data-test="support-action-error"]').text()).toBe('Ticket résolu.')
    })

    it('un brouillon par ticket : il revient quand on revient au ticket', async () => {
      support.list.mockResolvedValue(page([t2, { ...t2, id: 't5', subject: 'Autre mienne' }]))
      support.get.mockImplementation((id: string) => Promise.resolve(withMessages({ ...t2, id })))
      const w = await mountPage()
      await w.get('[data-test="scope-mine"]').trigger('click')
      await flushPromises()
      await w.get('[data-test="support-reply"]').setValue('À finir')
      await w.get('[data-test="support-open-t5"]').trigger('click')
      await flushPromises()
      expect((w.get('[data-test="support-reply"]').element as HTMLTextAreaElement).value).toBe('')
      await w.get('[data-test="support-open-t2"]').trigger('click')
      await flushPromises()
      expect((w.get('[data-test="support-reply"]').element as HTMLTextAreaElement).value).toBe('À finir')
    })

    it('résoudre : deux clics, puis le ticket suivant s’ouvre', async () => {
      support.list.mockResolvedValueOnce(page([t2, t3])).mockResolvedValue(page([{ ...t2, status: 'RESOLVED', resolvedAt: ago(0.1) }, t3]))
      const w = await mountPage()
      await w.get('[data-test="scope-all"]').trigger('click')
      await w.get('[data-test="support-open-t2"]').trigger('click')
      await flushPromises()
      await w.get('[data-test="support-action-resolve"]').trigger('click')
      expect(support.resolve).not.toHaveBeenCalled()
      await w.get('[data-test="support-action-resolve"]').trigger('click')
      await flushPromises()
      expect(support.resolve).toHaveBeenCalledWith('t2')
      expect(subject(w)).toBe('Comment proposer un trajet ?')
    })

    it('résolution refusée : on reste sur le ticket', async () => {
      support.resolve.mockRejectedValue(Object.assign(new Error('409'), { data: { detail: 'Déjà résolu.' } }))
      const w = await mountPage()
      await w.get('[data-test="scope-mine"]').trigger('click')
      await flushPromises()
      await w.get('[data-test="support-action-resolve"]').trigger('click')
      await w.get('[data-test="support-action-resolve"]').trigger('click')
      await flushPromises()
      expect(subject(w)).toBe('Remboursement')
      expect(w.get('[data-test="support-action-error"]').text()).toBe('Déjà résolu.')
    })

    it('résoudre le seul ticket affiché : rien ne s’ouvre à la place', async () => {
      support.list.mockResolvedValueOnce(page([t2])).mockResolvedValue(page([{ ...t2, status: 'RESOLVED', resolvedAt: ago(0.1) }]))
      const w = await mountPage()
      await w.get('[data-test="scope-mine"]').trigger('click')
      await flushPromises()
      await w.get('[data-test="support-action-resolve"]').trigger('click')
      await w.get('[data-test="support-action-resolve"]').trigger('click')
      await flushPromises()
      expect(support.resolve).toHaveBeenCalledWith('t2')
      expect(subject(w)).toBe('Remboursement')
    })
  })

  describe('clavier', () => {
    it('J et K parcourent la file', async () => {
      const w = await mountPage()
      await w.get('[data-test="scope-all"]').trigger('click')
      await press('j')
      expect(subject(w)).toBe('Remboursement')
      await press('k')
      expect(subject(w)).toBe('Où est mon colis ?')
    })

    it('un chiffre insère la réponse type, ⌘⏎ envoie', async () => {
      const w = await mountPage()
      await w.get('[data-test="scope-mine"]').trigger('click')
      await flushPromises()
      await press('1')
      expect((w.get('[data-test="support-reply"]').element as HTMLTextAreaElement).value).toContain('plus de détails')
      await press('Enter', { metaKey: true })
      expect(support.reply).toHaveBeenCalledTimes(1)
    })

    it('fenêtre de nouvelle conversation ouverte : raccourcis suspendus', async () => {
      const w = await mountPage()
      await w.get('[data-test="scope-all"]').trigger('click')
      await w.get('[data-test="support-new-conversation"]').trigger('click')
      await press('j')
      expect(subject(w)).toBe('Où est mon colis ?')
    })
  })

  describe('lien profond ?ticket=', () => {
    it('ticket de la file : ouvert, périmètre inchangé, URL intacte', async () => {
      route.query = { ticket: 't1' }
      const w = await mountPage()
      expect(support.get).toHaveBeenCalledWith('t1')
      expect(subject(w)).toBe('Où est mon colis ?')
      expect(w.get('[data-test="scope-unassigned"]').attributes('aria-pressed')).toBe('true')
      expect(replaceMock).not.toHaveBeenCalled()
    })

    it('hors du périmètre courant : bascule sur « Tous » pour le retrouver dans la liste', async () => {
      route.query = { ticket: 't3' }
      const w = await mountPage()
      expect(subject(w)).toBe('Comment proposer un trajet ?')
      expect(w.get('[data-test="scope-all"]').attributes('aria-pressed')).toBe('true')
      expect(rows(w)).toContain('t3')
    })

    it('hors de la page chargée : lu par identifiant et gardé à l’écran', async () => {
      route.query = { ticket: 'far' }
      const w = await mountPage()
      expect(support.get).toHaveBeenCalledWith('far')
      expect(w.get('[data-test="support-message-m-far"]').text()).toContain('Message de far')
    })

    it('ticket introuvable : message, pas de bascule de périmètre', async () => {
      support.get.mockRejectedValue(Object.assign(new Error('404'), { statusCode: 404, data: { code: 'ticket-not-found', detail: 'Ticket introuvable.' } }))
      route.query = { ticket: 'zz' }
      const w = await mountPage()
      expect(w.get('[data-test="support-open-error"]').text()).toBe('Ticket introuvable.')
      expect(w.get('[data-test="scope-unassigned"]').attributes('aria-pressed')).toBe('true')
    })

    it('ticket introuvable sans détail : message par défaut', async () => {
      support.get.mockRejectedValue({})
      route.query = { ticket: 'zz' }
      const w = await mountPage()
      expect(w.get('[data-test="support-open-error"]').text()).toBe('Action impossible')
    })

    it('navigation interne vers ?ticket= alors que la page est déjà ouverte', async () => {
      const w = await mountPage()
      route.query = { ticket: 't3' }
      await flushPromises()
      expect(subject(w)).toBe('Comment proposer un trajet ?')
    })

    it('un lien vers le ticket déjà ouvert ne le relit pas', async () => {
      const w = await mountPage()
      support.get.mockClear()
      route.query = { ticket: 't1' }
      await flushPromises()
      expect(support.get).not.toHaveBeenCalled()
      expect(subject(w)).toBe('Où est mon colis ?')
    })
  })

  describe('nouvelle conversation', () => {
    it('ouvre la fenêtre sans destinataire imposé, la ferme', async () => {
      const w = await mountPage()
      expect(w.find('[data-test="start-dialog-stub"]').exists()).toBe(false)
      await w.get('[data-test="support-new-conversation"]').trigger('click')
      expect(w.get('[data-test="start-dialog-stub"]').text()).toContain('aucun')
      await w.get('[data-test="stub-close"]').trigger('click')
      expect(w.find('[data-test="start-dialog-stub"]').exists()).toBe(false)
    })

    it('conversation créée : la liste est rechargée', async () => {
      const w = await mountPage()
      await w.get('[data-test="support-new-conversation"]').trigger('click')
      await w.get('[data-test="stub-sent"]').trigger('click')
      await flushPromises()
      expect(support.list).toHaveBeenCalledTimes(2)
      expect(w.find('[data-test="start-dialog-stub"]').exists()).toBe(false)
    })

    it('sans SUPPORT_TICKET_MANAGE : pas de bouton', async () => {
      seedAuth('ADMIN', { SUPPORT_TICKET_MANAGE: false })
      const w = await mountPage()
      expect(w.find('[data-test="support-new-conversation"]').exists()).toBe(false)
    })
  })

  describe('filtre ?userId=', () => {
    beforeEach(() => {
      support.list.mockResolvedValue(page([t1, t3]))
    })

    it('liste lue avec l’utilisateur, bandeau avec son nom, onglets masqués', async () => {
      route.query = { userId: UID }
      const w = await mountPage()
      expect(support.list).toHaveBeenCalledTimes(1)
      expect(support.list.mock.calls[0]).toEqual(['all', 'TOUS', 0, 100, UID])
      expect(w.get('[data-test="support-user-filter"]').text()).toContain('Conversations de user D')
      expect(w.find('[data-test="support-scopes"]').exists()).toBe(false)
      expect(rows(w)).toEqual(['t1', 't3'])
    })

    it('sans filtre : onglets visibles', async () => {
      const w = await mountPage()
      expect(w.find('[data-test="support-scopes"]').exists()).toBe(true)
    })

    it('sans ticket : nom lu sur la fiche utilisateur', async () => {
      support.list.mockResolvedValue(page([]))
      route.query = { userId: UID }
      const w = await mountPage()
      expect(users.get).toHaveBeenCalledWith(UID)
      expect(w.get('[data-test="support-user-filter"]').text()).toContain('Conversations de Awa Diallo')
    })

    it('sans ticket ni droit USER_VIEW : identifiant court', async () => {
      seedAuth('ADMIN', { USER_VIEW: false })
      support.list.mockResolvedValue(page([]))
      route.query = { userId: 'abcdef12-3456-7890-abcd-ef1234567890' }
      const w = await mountPage()
      expect(users.get).not.toHaveBeenCalled()
      expect(w.get('[data-test="support-user-filter"]').text()).toContain('Conversations de abcdef12')
    })

    it('fiche illisible : identifiant court', async () => {
      users.get.mockRejectedValue(new Error('404'))
      support.list.mockResolvedValue(page([]))
      route.query = { userId: 'abcdef12-3456-7890-abcd-ef1234567890' }
      const w = await mountPage()
      expect(w.get('[data-test="support-user-filter"]').text()).toContain('Conversations de abcdef12')
    })

    it('ancien back qui ignore ?userId= : lignes écartées et avertissement', async () => {
      support.list.mockResolvedValue(page([t1, { ...t2, userId: 'u2' }]))
      route.query = { userId: UID }
      const w = await mountPage()
      expect(w.find('[data-test="support-user-filter-ignored"]').exists()).toBe(true)
      expect(rows(w)).toEqual(['t1'])
    })

    it('« Retirer le filtre » enlève userId de l’URL et recharge sans filtre', async () => {
      route.query = { userId: UID, foo: 'bar' }
      const w = await mountPage()
      await w.get('[data-test="support-user-filter-clear"]').trigger('click')
      expect(replaceMock).toHaveBeenCalledWith({ query: { foo: 'bar' } })
      route.query = { foo: 'bar' }
      await flushPromises()
      expect(w.find('[data-test="support-user-filter"]').exists()).toBe(false)
      expect(support.list.mock.calls.at(-1)).toEqual(['all', 'TOUS', 0, 100])
    })

    it('filtre actif : « Nouvelle conversation » vise cette personne', async () => {
      route.query = { userId: UID }
      const w = await mountPage()
      await w.get('[data-test="support-new-conversation"]').trigger('click')
      expect(w.get('[data-test="start-dialog-stub"]').text()).toContain(`user D|${UID}`)
    })

    it('filtre posé par une navigation interne', async () => {
      support.list.mockResolvedValue(page([t1, t2, t3, t4]))
      const w = await mountPage()
      route.query = { userId: UID }
      await flushPromises()
      expect(support.list.mock.calls.at(-1)).toEqual(['all', 'TOUS', 0, 100, UID])
      expect(w.find('[data-test="support-user-filter"]').exists()).toBe(true)
    })
  })
})
