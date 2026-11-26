import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

vi.stubGlobal('definePageMeta', vi.fn())

const svc = vi.hoisted(() => ({ sendToOne: vi.fn() }))
vi.mock('@/features/mobile/services/mobileNotifyService', () => ({ mobileNotifyService: svc }))
const users = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn() }))
vi.mock('@/features/users/services/usersService', () => ({ usersService: users }))

import Page from '@/pages/m/diffuser.vue'
import { seedAuth } from '../../../helpers/auth'
import { useMobileTabs } from '@/features/mobile/composables/useMobileTabs'
import { canSendNotification, notifyErrorMessage, NOTIFY_BODY_MAX, NOTIFY_TITLE_MAX } from '@/features/mobile/lib/mobileNotify'

const UID = '11111111-1111-4111-8111-111111111111'
const user = { id: UID, firstName: 'Aïcha', lastName: 'Traoré', email: null, phoneNumber: '+33600000000' }
const deferred = <T>() => {
  // eslint-disable-next-line no-unused-vars
  const box: { fn: ((value: T) => void) | null } = { fn: null }
  const promise = new Promise<T>(r => { box.fn = r })
  return { promise, resolve: (value: T) => box.fn?.(value) }
}
const mountPage = () => mount(Page)
const find = (w: ReturnType<typeof mountPage>, t: string) => w.find(`[data-test="${t}"]`)

async function pickUser(w: ReturnType<typeof mountPage>) {
  await find(w, 'notify-search').setValue('Aïcha')
  vi.advanceTimersByTime(400); await flushPromises()
  await find(w, 'notify-result').trigger('click')
}
async function fill(w: ReturnType<typeof mountPage>, title = 'Titre', body = 'Message') {
  await find(w, 'notify-title').setValue(title)
  await find(w, 'notify-body').setValue(body)
}

describe('m/diffuser', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    Object.values(svc).forEach(f => f.mockReset())
    Object.values(users).forEach(f => f.mockReset())
    seedAuth('ADMIN')
    users.list.mockResolvedValue({ content: [user] })
    svc.sendToOne.mockResolvedValue({ id: 'b1' })
  })

  it('send_requiresExactlyOneRecipient', async () => {
    const w = mountPage()
    await fill(w)
    expect(find(w, 'notify-review').attributes('disabled')).toBeDefined()
    await find(w, 'notify-review').trigger('click')
    expect(find(w, 'notify-confirm').exists()).toBe(false)
    await pickUser(w)
    expect(find(w, 'notify-recipient').text()).toBe('Aïcha Traoré')
    expect(find(w, 'notify-review').attributes('disabled')).toBeUndefined()
    expect(find(w, 'notify-review').text()).toBe('Envoyer à 1 personne')
    // a non-UUID id is never sendable
    expect(canSendNotification({ userId: 'abc', title: 't', body: 'b' })).toBe(false)
    expect(canSendNotification({ userId: `${UID},${UID}`, title: 't', body: 'b' })).toBe(false)
    expect(canSendNotification({ userId: UID, title: 't', body: 'b' })).toBe(true)
    await find(w, 'notify-change').trigger('click')
    expect(find(w, 'notify-review').attributes('disabled')).toBeDefined()
    expect(svc.sendToOne).not.toHaveBeenCalled()
  })

  it('picker_pastedUuid_resolvesTheName_orShowsNotFound', async () => {
    users.get.mockResolvedValueOnce({ ...user })
    const w = mountPage()
    await find(w, 'notify-search').setValue(UID); await flushPromises()
    expect(users.get).toHaveBeenCalledWith(UID)
    expect(find(w, 'notify-recipient').text()).toBe('Aïcha Traoré')
    await find(w, 'notify-change').trigger('click')
    users.get.mockRejectedValueOnce(new Error('x'))
    await find(w, 'notify-search').setValue(UID); await flushPromises()
    expect(find(w, 'notify-search-error').text()).toContain('introuvable')
    expect(find(w, 'notify-recipient').exists()).toBe(false)
  })

  it('picker_searchEmptyAndError', async () => {
    users.list.mockResolvedValueOnce({ content: [] })
    const w = mountPage()
    await find(w, 'notify-search').setValue('zz'); vi.advanceTimersByTime(400); await flushPromises()
    expect(find(w, 'notify-search-empty').text()).toContain('Aucun utilisateur')
    users.list.mockRejectedValueOnce(new Error('x'))
    await find(w, 'notify-search').setValue('zzz'); vi.advanceTimersByTime(400); await flushPromises()
    expect(find(w, 'notify-search-error').exists()).toBe(true)
  })

  it('send_requiresTitleAndBodyWithinLimits', async () => {
    const w = mountPage()
    await pickUser(w)
    await fill(w, '   ', 'Message')
    expect(find(w, 'notify-review').attributes('disabled')).toBeDefined()
    await fill(w, 'Titre', '  \n ')
    expect(find(w, 'notify-review').attributes('disabled')).toBeDefined()
    await fill(w, 'T'.repeat(NOTIFY_TITLE_MAX + 1), 'ok')
    expect(find(w, 'notify-review').attributes('disabled')).toBeDefined()
    await fill(w, 'ok', 'M'.repeat(NOTIFY_BODY_MAX + 1))
    expect(find(w, 'notify-review').attributes('disabled')).toBeDefined()
    await fill(w, 'T'.repeat(NOTIFY_TITLE_MAX), 'M'.repeat(NOTIFY_BODY_MAX))
    expect(find(w, 'notify-review').attributes('disabled')).toBeUndefined()
    expect(find(w, 'notify-title').attributes('maxlength')).toBe(String(NOTIFY_TITLE_MAX))
    expect(find(w, 'notify-body').attributes('maxlength')).toBe(String(NOTIFY_BODY_MAX))
  })

  it('send_requiresConfirmation', async () => {
    const w = mountPage()
    await pickUser(w); await fill(w, '  Salut ', ' Bonjour à tous ')
    await find(w, 'notify-review').trigger('click')
    expect(svc.sendToOne).not.toHaveBeenCalled()
    expect(find(w, 'confirm-recipient').text()).toBe('Aïcha Traoré')
    expect(find(w, 'confirm-title').text()).toBe('Salut')
    expect(find(w, 'confirm-body').text()).toBe('Bonjour à tous')
    expect(find(w, 'notify-confirm-send').text()).toBe('Confirmer l’envoi')
    // "Modifier" goes back without sending
    await find(w, 'notify-edit').trigger('click')
    expect(svc.sendToOne).not.toHaveBeenCalled()
    expect((find(w, 'notify-title').element as HTMLInputElement).value).toBe('  Salut ')
    await find(w, 'notify-review').trigger('click')
    await find(w, 'notify-confirm-send').trigger('click'); await flushPromises()
    expect(svc.sendToOne).toHaveBeenCalledTimes(1)
  })

  it('send_requestBody_isSingleUserAudience', async () => {
    const w = mountPage()
    await pickUser(w); await fill(w, '  Salut ', ' Bonjour ')
    await find(w, 'notify-review').trigger('click')
    await find(w, 'notify-confirm-send').trigger('click'); await flushPromises()
    expect(svc.sendToOne).toHaveBeenCalledWith({ userId: UID, title: 'Salut', body: 'Bonjour' })
  })

  it('send_noDoubleSend', async () => {
    const d = deferred<unknown>()
    svc.sendToOne.mockReturnValueOnce(d.promise)
    const w = mountPage()
    await pickUser(w); await fill(w)
    await find(w, 'notify-review').trigger('click')
    await find(w, 'notify-confirm-send').trigger('click')
    expect(find(w, 'notify-confirm-send').attributes('disabled')).toBeDefined()
    await find(w, 'notify-confirm-send').trigger('click')
    await find(w, 'notify-edit').trigger('click')
    expect(find(w, 'notify-confirm').exists()).toBe(true)
    d.resolve({}); await flushPromises()
    expect(svc.sendToOne).toHaveBeenCalledTimes(1)
    expect(find(w, 'notify-sent').text()).toContain('Notification envoyée')
  })

  it('send_failure_keepsFormAndShowsProblem', async () => {
    svc.sendToOne.mockRejectedValueOnce({ statusCode: 422, data: { detail: 'Titre trop long pour le push' } })
    const w = mountPage()
    await pickUser(w); await fill(w, 'Mon titre', 'Mon message')
    await find(w, 'notify-review').trigger('click')
    await find(w, 'notify-confirm-send').trigger('click'); await flushPromises()
    expect(find(w, 'notify-error').text()).toBe('Titre trop long pour le push')
    expect((find(w, 'notify-title').element as HTMLInputElement).value).toBe('Mon titre')
    expect((find(w, 'notify-body').element as HTMLTextAreaElement).value).toBe('Mon message')
    expect(find(w, 'notify-recipient').text()).toBe('Aïcha Traoré')
    expect(find(w, 'notify-sent').exists()).toBe(false)
    // retry allowed
    await find(w, 'notify-review').trigger('click')
    await find(w, 'notify-confirm-send').trigger('click'); await flushPromises()
    expect(svc.sendToOne).toHaveBeenCalledTimes(2)
    expect(find(w, 'notify-sent').exists()).toBe(true)
  })

  it('send_404or405_showsClearMessage', async () => {
    for (const status of [403, 404, 405]) {
      svc.sendToOne.mockRejectedValueOnce({ statusCode: status, message: '[POST] "/x": 404 Not Found' })
      const w = mountPage()
      await pickUser(w); await fill(w)
      await find(w, 'notify-review').trigger('click')
      await find(w, 'notify-confirm-send').trigger('click'); await flushPromises()
      const msg = find(w, 'notify-error').text()
      expect(msg).not.toContain('[POST]')
      expect(msg.length).toBeGreaterThan(20)
      w.unmount()
    }
    expect(notifyErrorMessage({ statusCode: 404, data: { detail: 'Utilisateur inconnu' } })).toBe('Utilisateur inconnu')
    expect(notifyErrorMessage(new Error('x'))).toBe('x')
    expect(notifyErrorMessage({})).toBe('Envoi impossible')
    expect(notifyErrorMessage({ status: 405 })).toContain('ordinateur')
  })

  it('picker_withoutUserView_showsNoteAndBlocksSend', async () => {
    seedAuth('ADMIN', { USER_VIEW: false })
    const w = mountPage()
    expect(find(w, 'notify-no-userview').text()).toBe('La recherche d’un utilisateur demande un droit supplémentaire')
    expect(find(w, 'notify-search').exists()).toBe(false)
    await fill(w)
    expect(find(w, 'notify-review').attributes('disabled')).toBeDefined()
    await find(w, 'notify-review').trigger('click')
    expect(find(w, 'notify-confirm').exists()).toBe(false)
    expect(users.list).not.toHaveBeenCalled()
    expect(svc.sendToOne).not.toHaveBeenCalled()
  })

  it('tab_hidden_withoutNotificationSend', () => {
    seedAuth('ADMIN', { NOTIFICATION_SEND: false })
    expect(useMobileTabs().value.map(t => t.key)).not.toContain('diffuser')
    seedAuth('ADMIN')
    expect(useMobileTabs().value.map(t => t.key)).toContain('diffuser')
  })

  it('page_guard_requiresNotificationSend', () => {
    const spy = vi.mocked(globalThis.definePageMeta as unknown as ReturnType<typeof vi.fn>)
    spy.mockClear()
    mountPage()
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({
      layout: 'mobile', middleware: 'admin-only', permission: 'NOTIFICATION_SEND', pageTitle: 'Diffuser',
    }))
  })

  it('success_resetsOnNewNotification', async () => {
    const w = mountPage()
    await pickUser(w); await fill(w)
    await find(w, 'notify-review').trigger('click')
    await find(w, 'notify-confirm-send').trigger('click'); await flushPromises()
    expect(find(w, 'notify-sent').text()).toContain('Notification envoyée')
    await find(w, 'notify-new').trigger('click')
    expect(find(w, 'notify-sent').exists()).toBe(false)
    expect((find(w, 'notify-title').element as HTMLInputElement).value).toBe('')
    expect((find(w, 'notify-body').element as HTMLTextAreaElement).value).toBe('')
    expect(find(w, 'notify-recipient').exists()).toBe(false)
    expect(find(w, 'notify-review').attributes('disabled')).toBeDefined()
  })

  it('does not persist the draft or log it', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const log = vi.spyOn(console, 'log'); const err = vi.spyOn(console, 'error')
    const w = mountPage()
    await pickUser(w); await fill(w, 'Secret', 'Secret')
    await find(w, 'notify-review').trigger('click')
    expect(setItem).not.toHaveBeenCalled()
    expect(log).not.toHaveBeenCalled(); expect(err).not.toHaveBeenCalled()
    vi.restoreAllMocks()
  })
})
