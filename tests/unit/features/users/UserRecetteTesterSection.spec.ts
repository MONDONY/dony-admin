import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { seedAuth } from '~/tests/helpers/auth'

const getMock = vi.hoisted(() => vi.fn())
const setMock = vi.hoisted(() => vi.fn())
vi.mock('@/features/users/services/usersService', () => ({
  usersService: {
    getRecetteTester: (...a: unknown[]) => getMock(...a),
    setRecetteTester: (...a: unknown[]) => setMock(...a),
  },
}))
import UserRecetteTesterSection from '@/features/users/components/UserRecetteTesterSection.vue'
import { _resetRecetteModeMemo } from '@/features/users/composables/useRecetteTester'

const status = (recetteTester: boolean, recetteModeActive: boolean) => ({ userId: 'u1', recetteTester, recetteModeActive })
const httpError = (statusCode: number, data: Record<string, unknown> = {}) =>
  Object.assign(new Error(`${statusCode}`), { statusCode, data })

function mountSection(userId = 'u1') {
  return mount(UserRecetteTesterSection, { props: { userId } })
}
async function confirmToggle(w: ReturnType<typeof mountSection>) {
  await w.find('[data-test="recette-switch"]').trigger('click')
  await w.find('[data-test="recette-confirm-button"]').trigger('click')
}

describe('UserRecetteTesterSection', () => {
  beforeEach(() => {
    seedAuth('SUPER_ADMIN')
    getMock.mockReset()
    setMock.mockReset()
    _resetRecetteModeMemo()
  })
  afterEach(() => vi.useRealTimers())

  it('chargement puis interrupteur éteint pour un compte non testeur', async () => {
    getMock.mockResolvedValue(status(false, false))
    const w = mountSection()
    expect(w.find('[data-test="recette-loading"]').exists()).toBe(true)
    await flushPromises()
    expect(getMock).toHaveBeenCalledWith('u1')
    const sw = w.find('[data-test="recette-switch"]')
    expect(sw.attributes('aria-checked')).toBe('false')
    expect(w.text()).toContain('Mode recette (staging)')
    expect(w.text()).toContain('Chaque utilisation est tracée.')
    expect(w.find('[data-test="recette-badge"]').exists()).toBe(false)
  })

  it('compte testeur en staging : interrupteur allumé et badge « Testeur »', async () => {
    getMock.mockResolvedValue(status(true, true))
    const w = mountSection()
    await flushPromises()
    expect(w.find('[data-test="recette-switch"]').attributes('aria-checked')).toBe('true')
    expect(w.find('[data-test="recette-badge"]').text()).toBe('Testeur')
  })

  it('testeur mais mode inactif (prod) : texte discret, aucun interrupteur', async () => {
    getMock.mockResolvedValue(status(true, false))
    const w = mountSection()
    await flushPromises()
    expect(w.find('[data-test="recette-closed"]').text()).toContain('Indisponible hors staging')
    expect(w.find('[data-test="recette-switch"]').exists()).toBe(false)
    expect(w.find('[data-test="recette-badge"]').exists()).toBe(false)
  })

  it('lecture en échec : section masquée, sans erreur', async () => {
    getMock.mockRejectedValue(httpError(404))
    const w = mountSection()
    await flushPromises()
    expect(w.find('[data-test="recette-section"]').exists()).toBe(false)
  })

  it('annuler la confirmation ne fait aucun appel', async () => {
    getMock.mockResolvedValue(status(false, false))
    const w = mountSection()
    await flushPromises()
    await w.find('[data-test="recette-switch"]').trigger('click')
    expect(w.find('[data-test="recette-confirm"]').text()).toContain('Désigner ce compte comme testeur')
    await w.find('[data-test="recette-cancel"]').trigger('click')
    expect(w.find('[data-test="recette-confirm"]').exists()).toBe(false)
    expect(setMock).not.toHaveBeenCalled()
  })

  it('activation : état optimiste, chargement, puis toast de succès qui s’efface', async () => {
    vi.useFakeTimers()
    getMock.mockResolvedValue(status(false, false))
    let resolve!: (_v: unknown) => void
    setMock.mockReturnValue(new Promise((r) => { resolve = r }))
    const w = mountSection()
    await flushPromises()
    await confirmToggle(w)
    expect(setMock).toHaveBeenCalledWith('u1', true)
    const sw = w.find('[data-test="recette-switch"]')
    expect(sw.attributes('aria-checked')).toBe('true')
    expect(sw.attributes('disabled')).toBeDefined()
    expect(w.find('[data-test="recette-busy"]').exists()).toBe(true)
    // Un second clic pendant l'enregistrement est ignoré.
    await sw.trigger('click')
    expect(w.find('[data-test="recette-confirm"]').exists()).toBe(false)
    resolve(status(true, true))
    await flushPromises()
    expect(w.find('[data-test="recette-feedback"]').text()).toBe('Compte testeur activé.')
    expect(w.find('[data-test="recette-feedback"]').attributes('role')).toBe('status')
    expect(w.find('[data-test="recette-badge"]').exists()).toBe(true)
    vi.advanceTimersByTime(4000)
    await flushPromises()
    expect(w.find('[data-test="recette-feedback"]').exists()).toBe(false)
  })

  it('désactivation : message dédié', async () => {
    getMock.mockResolvedValue(status(true, true))
    setMock.mockResolvedValue(status(false, false))
    const w = mountSection()
    await flushPromises()
    await w.find('[data-test="recette-switch"]').trigger('click')
    expect(w.find('[data-test="recette-confirm"]').text()).toContain('Retirer le statut de testeur')
    await w.find('[data-test="recette-confirm-button"]').trigger('click')
    await flushPromises()
    expect(setMock).toHaveBeenCalledWith('u1', false)
    expect(w.find('[data-test="recette-switch"]').attributes('aria-checked')).toBe('false')
    expect(w.find('[data-test="recette-feedback"]').text()).toBe('Compte testeur désactivé.')
  })

  it('409 recette-disabled : état annulé, section fermée et mémorisée pour les fiches suivantes', async () => {
    getMock.mockResolvedValue(status(false, false))
    setMock.mockRejectedValue(httpError(409, { code: 'recette-disabled', detail: 'fermé' }))
    const w = mountSection()
    await flushPromises()
    await confirmToggle(w)
    await flushPromises()
    expect(w.find('[data-test="recette-switch"]').exists()).toBe(false)
    expect(w.find('[data-test="recette-closed"]').exists()).toBe(true)
    expect(w.find('[data-test="recette-feedback"]').text()).toContain('Mode recette fermé')
    expect(w.find('[data-test="recette-feedback"]').attributes('role')).toBe('alert')
    w.unmount()

    const next = mountSection('u2')
    await flushPromises()
    expect(next.find('[data-test="recette-closed"]').exists()).toBe(true)
  })

  it('404 user-not-found : état annulé et message dédié', async () => {
    getMock.mockResolvedValue(status(false, false))
    setMock.mockRejectedValue(httpError(404, { code: 'user-not-found' }))
    const w = mountSection()
    await flushPromises()
    await confirmToggle(w)
    await flushPromises()
    expect(w.find('[data-test="recette-switch"]').attributes('aria-checked')).toBe('false')
    expect(w.find('[data-test="recette-feedback"]').text()).toBe('Utilisateur introuvable.')
  })

  it('422 : message de requête invalide', async () => {
    getMock.mockResolvedValue(status(true, true))
    setMock.mockRejectedValue(httpError(422))
    const w = mountSection()
    await flushPromises()
    await confirmToggle(w)
    await flushPromises()
    expect(w.find('[data-test="recette-switch"]').attributes('aria-checked')).toBe('true')
    expect(w.find('[data-test="recette-feedback"]').text()).toContain('requête invalide')
  })

  it('autre erreur : detail du ProblemDetail, sinon repli', async () => {
    getMock.mockResolvedValue(status(false, false))
    setMock.mockRejectedValueOnce(httpError(500, { detail: 'Serveur indisponible' }))
    setMock.mockRejectedValueOnce(new Error(''))
    const w = mountSection()
    await flushPromises()
    await confirmToggle(w)
    await flushPromises()
    expect(w.find('[data-test="recette-feedback"]').text()).toBe('Serveur indisponible')
    await confirmToggle(w)
    await flushPromises()
    expect(w.find('[data-test="recette-feedback"]').text()).toBe('Modification impossible, réessayez.')
  })
})
