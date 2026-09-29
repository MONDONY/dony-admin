import { describe, it, expect, vi, beforeEach } from 'vitest'

const startMock = vi.fn()
vi.mock('@/features/support/services/supportService', () => ({
  supportService: { startTicket: (...a: unknown[]) => startMock(...a) },
}))
import { useStartSupportConversation } from '@/features/support/composables/useStartSupportConversation'

const payload = {
  userId: 'user-1', category: 'OTHER' as const, subject: 'Votre colis', message: 'Bonjour', attachmentKeys: [],
}
const httpError = (status: number, data?: Record<string, unknown>) =>
  Object.assign(new Error(`${status}`), { statusCode: status, data })

describe('useStartSupportConversation', () => {
  beforeEach(() => { startMock.mockReset() })

  it('renvoie le ticket créé et remet l’état à zéro', async () => {
    startMock.mockResolvedValue({ id: 't9' })
    const s = useStartSupportConversation()
    const promise = s.submit(payload)
    expect(s.sending.value).toBe(true)
    const ticket = await promise
    expect(ticket).toEqual({ id: 't9' })
    expect(startMock).toHaveBeenCalledWith(payload)
    expect(s.sending.value).toBe(false)
    expect(s.error.value).toBeNull()
    expect(s.fieldErrors.value).toEqual({})
  })

  it('ancien back (405 sans code) : fonction pas encore disponible', async () => {
    startMock.mockRejectedValue(httpError(405))
    const s = useStartSupportConversation()
    expect(await s.submit(payload)).toBeNull()
    expect(s.error.value).toBe('Cette fonction n’est pas encore disponible sur le serveur.')
    expect(s.unavailable.value).toBe(true)
  })

  it('ancien back (404 sans code) : même message', async () => {
    startMock.mockRejectedValue(httpError(404, { detail: 'No endpoint' }))
    const s = useStartSupportConversation()
    await s.submit(payload)
    expect(s.error.value).toBe('Cette fonction n’est pas encore disponible sur le serveur.')
  })

  it('404 user-not-found : utilisateur introuvable (message du back)', async () => {
    startMock.mockRejectedValue(httpError(404, { code: 'user-not-found', detail: 'Utilisateur introuvable.' }))
    const s = useStartSupportConversation()
    await s.submit(payload)
    expect(s.error.value).toBe('Utilisateur introuvable.')
    expect(s.unavailable.value).toBe(false)
  })

  it('404 user-not-found sans détail : repli lisible', async () => {
    startMock.mockRejectedValue(httpError(404, { code: 'user-not-found' }))
    const s = useStartSupportConversation()
    await s.submit(payload)
    expect(s.error.value).toBe('Ce compte est introuvable : il a peut-être été supprimé.')
  })

  it('403 : droit manquant', async () => {
    startMock.mockRejectedValue(httpError(403))
    const s = useStartSupportConversation()
    await s.submit(payload)
    expect(s.error.value).toBe('Vous n’avez pas la permission d’écrire aux utilisateurs.')
  })

  it('422 : erreurs par champ, message général générique', async () => {
    startMock.mockRejectedValue(httpError(422, {
      detail: 'Validation failed', violations: { subject: 'Sujet trop long', message: 'Message obligatoire' },
    }))
    const s = useStartSupportConversation()
    await s.submit(payload)
    expect(s.fieldErrors.value).toEqual({ subject: 'Sujet trop long', message: 'Message obligatoire' })
    expect(s.error.value).toBe('Corrigez les champs signalés.')
  })

  it('422 sur un champ non affiché : son message devient l’erreur générale', async () => {
    startMock.mockRejectedValue(httpError(422, { violations: { firstMessage: 'Trop long', subject: 'Vide' } }))
    const s = useStartSupportConversation()
    await s.submit(payload)
    expect(s.error.value).toBe('Trop long')
    expect(s.fieldErrors.value.subject).toBe('Vide')
  })

  it('422 sans violations exploitables : détail du back', async () => {
    startMock.mockRejectedValue(httpError(422, { detail: 'Catégorie inconnue.', violations: { category: 42 } }))
    const s = useStartSupportConversation()
    await s.submit(payload)
    expect(s.fieldErrors.value).toEqual({})
    expect(s.error.value).toBe('Catégorie inconnue.')
  })

  it('autre erreur : détail ou repli', async () => {
    startMock.mockRejectedValue(new Error(''))
    const s = useStartSupportConversation()
    await s.submit(payload)
    expect(s.error.value).toBe('L’envoi a échoué. Réessayez.')
  })

  it('reset efface erreurs et indisponibilité', async () => {
    startMock.mockRejectedValue(httpError(405))
    const s = useStartSupportConversation()
    await s.submit(payload)
    s.reset()
    expect(s.error.value).toBeNull()
    expect(s.unavailable.value).toBe(false)
    expect(s.fieldErrors.value).toEqual({})
  })
})
