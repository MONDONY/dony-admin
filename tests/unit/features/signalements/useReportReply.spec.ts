import { describe, it, expect, vi, beforeEach } from 'vitest'
const replyMock = vi.fn()
vi.mock('@/features/signalements/services/reportsService', () => ({
  reportsService: { reply: (...a: unknown[]) => replyMock(...a) },
}))
import { REPLY_UNAVAILABLE_MESSAGE, useReportReply } from '@/features/signalements/composables/useReportReply'

const httpError = (status: number, data?: Record<string, unknown>) =>
  Object.assign(new Error(`${status} Erreur`), { statusCode: status, data })
const ok = { ticketId: 't1', created: true, ticket: { id: 't1', userDisplayName: 'Awa Diallo' } }

describe('useReportReply', () => {
  beforeEach(() => { replyMock.mockReset() })

  it('succès : rend la réponse et passe par l’état d’envoi', async () => {
    let resolveIt: (_v: unknown) => void = () => {}
    replyMock.mockReturnValue(new Promise((r) => { resolveIt = r }))
    const c = useReportReply()
    const p = c.submit('r1', { message: 'Merci', attachmentKeys: [] })
    expect(c.sending.value).toBe(true)
    resolveIt(ok)
    expect(await p).toEqual(ok)
    expect(c.sending.value).toBe(false)
    expect(c.error.value).toBeNull()
    expect(replyMock).toHaveBeenCalledWith('r1', { message: 'Merci', attachmentKeys: [] })
  })

  it('ancien back (404 sans code) : indisponible', async () => {
    replyMock.mockRejectedValue(httpError(404))
    const c = useReportReply()
    expect(await c.submit('r1', { message: 'x' })).toBeNull()
    expect(c.unavailable.value).toBe(true)
    expect(c.error.value).toBe(REPLY_UNAVAILABLE_MESSAGE)
    expect(REPLY_UNAVAILABLE_MESSAGE).toBe('Cette fonction n’est pas encore disponible sur le serveur.')
  })

  it('ancien back (405) : indisponible', async () => {
    replyMock.mockRejectedValue(httpError(405))
    const c = useReportReply()
    await c.submit('r1', { message: 'x' })
    expect(c.unavailable.value).toBe(true)
  })

  it('403 : permission', async () => {
    replyMock.mockRejectedValue(httpError(403))
    const c = useReportReply()
    await c.submit('r1', { message: 'x' })
    expect(c.error.value).toContain('permission')
    expect(c.unavailable.value).toBe(false)
  })

  it('404 avec code : signalement introuvable', async () => {
    replyMock.mockRejectedValue(httpError(404, { code: 'report-not-found' }))
    const c = useReportReply()
    await c.submit('r1', { message: 'x' })
    expect(c.error.value).toContain('introuvable')
    expect(c.unavailable.value).toBe(false)
  })

  it('422 report-not-app-bug', async () => {
    replyMock.mockRejectedValue(httpError(422, { code: 'report-not-app-bug' }))
    const c = useReportReply()
    await c.submit('r1', { message: 'x' })
    expect(c.error.value).toContain('rapports de bug')
  })

  it('reporter-unavailable (422) : le detail du back d’abord', async () => {
    replyMock.mockRejectedValue(httpError(422, { code: 'reporter-unavailable', detail: 'Compte supprimé.' }))
    const c = useReportReply()
    await c.submit('r1', { message: 'x' })
    expect(c.error.value).toBe('Compte supprimé.')
    replyMock.mockRejectedValue(httpError(422, { code: 'reporter-unavailable' }))
    await c.submit('r1', { message: 'x' })
    expect(c.error.value).toContain('signalant')
  })

  it('422 de validation : erreurs par champ, champs inconnus dans l’erreur générale', async () => {
    replyMock.mockRejectedValue(httpError(422, { violations: { message: 'Trop long', attachmentKeys: 'Clé inconnue', x: 42 } }))
    const c = useReportReply()
    await c.submit('r1', { message: 'x' })
    expect(c.fieldErrors.value).toEqual({ message: 'Trop long', attachmentKeys: 'Clé inconnue' })
    expect(c.error.value).toBe('Corrigez les champs signalés.')
    replyMock.mockRejectedValue(httpError(422, { violations: { other: 'Autre souci' } }))
    await c.submit('r1', { message: 'x' })
    expect(c.error.value).toBe('Autre souci')
  })

  it('422 support-invalid-field : erreur sous le message (detail, sinon bornes)', async () => {
    replyMock.mockRejectedValue(httpError(422, { code: 'support-invalid-field', detail: 'Message trop long.' }))
    const c = useReportReply()
    await c.submit('r1', { message: 'x' })
    expect(c.fieldErrors.value).toEqual({ message: 'Message trop long.' })
    expect(c.error.value).toBe('Corrigez les champs signalés.')
    replyMock.mockRejectedValue(httpError(422, { code: 'support-invalid-field' }))
    await c.submit('r1', { message: 'x' })
    expect(c.fieldErrors.value.message).toBe('Le message doit faire entre 1 et 4000 caractères.')
  })

  it('422 support-invalid-field avec violations : elles priment', async () => {
    replyMock.mockRejectedValue(httpError(422, { code: 'support-invalid-field', violations: { message: 'Vide' } }))
    const c = useReportReply()
    await c.submit('r1', { message: 'x' })
    expect(c.fieldErrors.value).toEqual({ message: 'Vide' })
  })

  it.each([
    ['support-attachment-not-owned', 'image jointe est invalide'],
    ['support-too-many-attachments', 'Quatre images'],
  ])('422 %s : erreur sous les images', async (code, text) => {
    replyMock.mockRejectedValue(httpError(422, { code }))
    const c = useReportReply()
    await c.submit('r1', { message: 'x' })
    expect(c.fieldErrors.value.attachmentKeys).toContain(text)
    expect(c.error.value).toBe('Corrigez les champs signalés.')
    replyMock.mockRejectedValue(httpError(422, { code, detail: 'Detail du back' }))
    await c.submit('r1', { message: 'x' })
    expect(c.fieldErrors.value.attachmentKeys).toBe('Detail du back')
  })

  it('422 sans violations exploitables : detail ou repli', async () => {
    replyMock.mockRejectedValue(httpError(422, { violations: ['liste'], detail: 'Refusé' }))
    const c = useReportReply()
    await c.submit('r1', { message: 'x' })
    expect(c.error.value).toBe('Refusé')
  })

  it('erreur réseau : repli', async () => {
    replyMock.mockRejectedValue(new Error(''))
    const c = useReportReply()
    await c.submit('r1', { message: 'x' })
    expect(c.error.value).toBe('L’envoi a échoué. Réessayez.')
  })

  it('reset efface tout', async () => {
    replyMock.mockRejectedValue(httpError(404))
    const c = useReportReply()
    await c.submit('r1', { message: 'x' })
    c.reset()
    expect(c.error.value).toBeNull()
    expect(c.unavailable.value).toBe(false)
    expect(c.fieldErrors.value).toEqual({})
  })
})
