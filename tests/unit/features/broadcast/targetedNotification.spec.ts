import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

vi.mock('@/features/users/services/usersService', () => ({ usersService: { list: vi.fn(), get: vi.fn() } }))
vi.mock('@/features/broadcast/services/broadcastService', () => ({
  broadcastService: { preview: vi.fn(), send: vi.fn(), listHistory: vi.fn() },
}))
import { usersService } from '@/features/users/services/usersService'
import { broadcastService } from '@/features/broadcast/services/broadcastService'
import { useUserSearch, isUuid, userDisplayName } from '@/features/broadcast/composables/useUserSearch'
import { useBroadcast } from '@/features/broadcast/composables/useBroadcast'
import BroadcastUserPicker from '@/features/broadcast/components/BroadcastUserPicker.vue'
import BroadcastComposer from '@/features/broadcast/components/BroadcastComposer.vue'

const users = usersService as unknown as Record<string, ReturnType<typeof vi.fn>>
const bsvc = broadcastService as unknown as Record<string, ReturnType<typeof vi.fn>>
const UUID = '3f2b8c1e-4a5d-4e6f-8a9b-0c1d2e3f4a5b'
const awa = { id: UUID, firstName: 'Awa', lastName: 'Diop', email: 'awa@x.fr', phoneNumber: '+221770000000' }
const pageOf = (content: unknown[]) => ({ content, totalElements: content.length, totalPages: 1, number: 0, size: 5 })

beforeEach(() => {
  vi.clearAllMocks()
  users.list.mockResolvedValue(pageOf([awa]))
  users.get.mockResolvedValue(awa)
})

describe('isUuid / userDisplayName', () => {
  it('reconnaît un UUID', () => {
    expect(isUuid(UUID)).toBe(true)
    expect(isUuid(` ${UUID.toUpperCase()} `)).toBe(true)
    expect(isUuid('awa')).toBe(false)
  })
  it('nom, sinon email, sinon téléphone, sinon identifiant court', () => {
    expect(userDisplayName(awa)).toBe('Awa Diop')
    expect(userDisplayName({ ...awa, firstName: null, lastName: null })).toBe('awa@x.fr')
    expect(userDisplayName({ ...awa, firstName: null, lastName: null, email: null })).toBe('+221770000000')
    expect(userDisplayName({ id: UUID, firstName: null, lastName: null, email: null, phoneNumber: '' })).toBe('3f2b8c1e')
  })
})

describe('useUserSearch', () => {
  it('cherche via GET /admin/users?query= (5 résultats max)', async () => {
    const s = useUserSearch()
    await s.search('awa')
    expect(users.list).toHaveBeenCalledWith(expect.objectContaining({ query: 'awa', status: 'TOUS' }), 0, 5)
    expect(s.results.value).toHaveLength(1)
  })

  it('ignore une saisie de moins de 2 caractères', async () => {
    const s = useUserSearch()
    await s.search(' a ')
    expect(users.list).not.toHaveBeenCalled()
    expect(s.results.value).toEqual([])
  })

  it('erreur de recherche : message lisible, résultats vidés', async () => {
    users.list.mockRejectedValue(Object.assign(new Error('500'), { data: { detail: 'Recherche indisponible' } }))
    const s = useUserSearch()
    await s.search('awa')
    expect(s.error.value).toBe('Recherche indisponible')
    expect(s.results.value).toEqual([])
  })

  it('ignore une réponse périmée', async () => {
    let resolveFirst: (_value: unknown) => void = () => {}
    users.list.mockImplementationOnce(() => new Promise((r) => { resolveFirst = r }))
    users.list.mockResolvedValueOnce(pageOf([]))
    const s = useUserSearch()
    const first = s.search('aw')
    await s.search('awa')
    resolveFirst(pageOf([awa]))
    await first
    expect(s.results.value).toEqual([])
  })

  it('resolveName rend le nom, ou null en cas d’échec', async () => {
    const s = useUserSearch()
    expect(await s.resolveName(UUID)).toBe('Awa Diop')
    users.get.mockRejectedValue(new Error('404'))
    expect(await s.resolveName(UUID)).toBeNull()
  })

  it('clear vide tout', async () => {
    const s = useUserSearch()
    await s.search('awa')
    s.clear()
    expect(s.results.value).toEqual([])
    expect(s.error.value).toBeNull()
  })
})

describe('BroadcastUserPicker', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('une saisie d’UUID sélectionne directement l’identifiant', async () => {
    const w = mount(BroadcastUserPicker, { props: { modelValue: '', canSearch: false } })
    await w.find('[data-test="broadcast-user-search"]').setValue(UUID)
    expect(w.emitted('update:modelValue')!.at(-1)).toEqual([UUID])
    expect(users.list).not.toHaveBeenCalled()
  })

  it('recherche par nom (après une pause de frappe), puis sélection d’un résultat', async () => {
    const w = mount(BroadcastUserPicker, { props: { modelValue: '', canSearch: true } })
    await w.find('[data-test="broadcast-user-search"]').setValue('awa')
    expect(users.list).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()
    expect(users.list).toHaveBeenCalledTimes(1)
    await w.find(`[data-test="broadcast-user-result-${UUID}"]`).trigger('click')
    expect(w.emitted('update:modelValue')!.at(-1)).toEqual([UUID])
    await w.setProps({ modelValue: UUID })
    expect(w.find('[data-test="broadcast-user-selected"]').text()).toContain('Awa Diop')
  })

  it('aucun résultat : le dit', async () => {
    users.list.mockResolvedValue(pageOf([]))
    const w = mount(BroadcastUserPicker, { props: { modelValue: '', canSearch: true } })
    await w.find('[data-test="broadcast-user-search"]').setValue('zzz')
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()
    expect(w.find('[data-test="broadcast-user-search-empty"]').exists()).toBe(true)
  })

  it('le placeholder annonce la recherche par UID ou identifiant, seulement avec le droit de recherche', () => {
    const avec = mount(BroadcastUserPicker, { props: { modelValue: '', canSearch: true } })
    expect(avec.find('[data-test="broadcast-user-search"]').attributes('placeholder'))
      .toBe('Nom, e-mail, téléphone, UID ou identifiant')
    const sans = mount(BroadcastUserPicker, { props: { modelValue: '', canSearch: false } })
    expect(sans.find('[data-test="broadcast-user-search"]').attributes('placeholder'))
      .toBe('Identifiant du compte (UUID)')
  })

  it('sans droit de recherche, invite à coller un identifiant', async () => {
    const w = mount(BroadcastUserPicker, { props: { modelValue: '', canSearch: false } })
    await w.find('[data-test="broadcast-user-search"]').setValue('awa')
    await vi.advanceTimersByTimeAsync(300)
    expect(users.list).not.toHaveBeenCalled()
    expect(w.find('[data-test="broadcast-user-uuid-hint"]').exists()).toBe(true)
  })

  it('pré-rempli : résout le nom et permet de changer', async () => {
    const w = mount(BroadcastUserPicker, { props: { modelValue: UUID, canSearch: true } })
    await flushPromises()
    expect(users.get).toHaveBeenCalledWith(UUID)
    expect(w.find('[data-test="broadcast-user-selected"]').text()).toContain('Awa Diop')
    await w.find('[data-test="broadcast-user-clear"]').trigger('click')
    expect(w.emitted('update:modelValue')!.at(-1)).toEqual([''])
  })

  it('pré-rempli sans droit de recherche : montre l’identifiant', () => {
    const w = mount(BroadcastUserPicker, { props: { modelValue: UUID, canSearch: false } })
    expect(users.get).not.toHaveBeenCalled()
    expect(w.find('[data-test="broadcast-user-selected"]').text()).toContain(UUID)
  })

  it('une saisie trop courte ne lance pas de recherche', async () => {
    const w = mount(BroadcastUserPicker, { props: { modelValue: '', canSearch: true } })
    await w.find('[data-test="broadcast-user-search"]').setValue('aw')
    expect(w.emitted('update:modelValue')).toBeUndefined()
    await w.setProps({ modelValue: '' })
    await w.find('[data-test="broadcast-user-search"]').setValue('a')
    await vi.advanceTimersByTimeAsync(300)
    expect(users.list).not.toHaveBeenCalled()
  })
})

describe('BroadcastComposer : notification ciblée', () => {
  it('se pré-remplit sur la cible USER avec l’identifiant reçu', async () => {
    const w = mount(BroadcastComposer, { props: { recipientCount: null, initialUserId: UUID } })
    expect((w.find('[data-test="broadcast-target"]').element as HTMLSelectElement).value).toBe('USER')
    await w.find('[data-test="broadcast-preview"]').trigger('click')
    expect(w.emitted('preview')![0]).toEqual([{ type: 'USER', userId: UUID }])
  })

  it('affiche le nom renvoyé par la preview', async () => {
    const w = mount(BroadcastComposer, { props: { recipientCount: null, initialUserId: UUID } })
    await w.setProps({ recipientCount: 1, targetUserName: 'Awa Diop' })
    expect(w.find('[data-test="broadcast-target-user-name"]').text()).toBe('Destinataire : Awa Diop')
  })

  it('l’estimation périmée ne contient pas de tiret cadratin', async () => {
    const w = mount(BroadcastComposer, { props: { recipientCount: null } })
    await w.setProps({ recipientCount: 3 })
    await w.find('[data-test="broadcast-target"]').setValue('SENDERS')
    expect(w.find('[data-test="broadcast-stale-estimate"]').text()).not.toContain('—')
  })
})

describe('useBroadcast : preview ciblée', () => {
  beforeEach(() => {
    bsvc.listHistory.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
  })

  it('garde targetUserName de la preview', async () => {
    bsvc.preview.mockResolvedValue({ recipientCount: 1, targetUserName: 'Awa Diop' })
    const b = useBroadcast()
    await b.preview({ type: 'USER', userId: UUID })
    expect(b.targetUserName.value).toBe('Awa Diop')
  })

  it('ancien back sans targetUserName : null', async () => {
    bsvc.preview.mockResolvedValue({ recipientCount: 1 })
    const b = useBroadcast()
    await b.preview({ type: 'USER', userId: UUID })
    expect(b.targetUserName.value).toBeNull()
  })

  it('404 utilisateur inconnu : detail, sinon message clair', async () => {
    const b = useBroadcast()
    bsvc.preview.mockRejectedValue(Object.assign(new Error('404'), { statusCode: 404, data: { detail: 'Aucun utilisateur avec cet identifiant.' } }))
    await b.preview({ type: 'USER', userId: UUID })
    expect(b.error.value).toBe('Aucun utilisateur avec cet identifiant.')
    expect(b.recipientCount.value).toBeNull()
    expect(b.targetUserName.value).toBeNull()
    bsvc.preview.mockRejectedValue(Object.assign(new Error('404 Not Found'), { statusCode: 404, data: {} }))
    await b.preview({ type: 'USER', userId: UUID })
    expect(b.error.value).toBe('Utilisateur introuvable : vérifiez l’identifiant.')
  })

  it('422 broadcast-user-not-reachable : detail affiché', async () => {
    bsvc.preview.mockRejectedValue(Object.assign(new Error('422'), {
      statusCode: 422, data: { code: 'broadcast-user-not-reachable', detail: 'Cet utilisateur n’a aucun appareil joignable.' },
    }))
    const b = useBroadcast()
    await b.preview({ type: 'USER', userId: UUID })
    expect(b.error.value).toBe('Cet utilisateur n’a aucun appareil joignable.')
  })

  it('404 à l’envoi : même message clair', async () => {
    bsvc.send.mockRejectedValue(Object.assign(new Error('404 Not Found'), { statusCode: 404, data: {} }))
    const b = useBroadcast()
    await b.send('t', 'b', { type: 'USER', userId: UUID })
    expect(b.error.value).toBe('Utilisateur introuvable : vérifiez l’identifiant.')
  })

  it('un envoi réussi oublie le nom ciblé', async () => {
    bsvc.preview.mockResolvedValue({ recipientCount: 1, targetUserName: 'Awa Diop' })
    bsvc.send.mockResolvedValue({ id: 'b1' })
    const b = useBroadcast()
    await b.preview({ type: 'USER', userId: UUID })
    await b.send('t', 'b', { type: 'USER', userId: UUID })
    expect(b.targetUserName.value).toBeNull()
  })
})
