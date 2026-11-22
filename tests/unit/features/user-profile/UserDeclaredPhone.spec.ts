import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { seedAuth } from '~/tests/helpers/auth'
import UserDeclaredPhone from '@/features/user-profile/components/UserDeclaredPhone.vue'
import type { AdminRole } from '@/stores/auth'

const verifyDeclaredPhone = vi.fn()
vi.mock('@/features/users/services/usersService', () => ({
  usersService: { verifyDeclaredPhone: (...a: unknown[]) => verifyDeclaredPhone(...a) },
}))

const USER = { id: 'u1', declaredPhone: '+2250700000000', declaredPhoneLevel: 'DECLARED' }
function mountP(user: Record<string, unknown> = {}, role: AdminRole = 'ADMIN', overrides: Record<string, boolean> = {}) {
  seedAuth(role, overrides)
  return mount(UserDeclaredPhone, { props: { user: { ...USER, ...user } as never } })
}
const BUTTON = '[data-test="declared-phone-verify"]'

describe('UserDeclaredPhone', () => {
  beforeEach(() => { verifyDeclaredPhone.mockReset() })

  it('niveau DECLARED : numéro, pastille « Non vérifié » et bouton « Valider ce numéro »', () => {
    const w = mountP()
    expect(w.get('[data-test="declared-phone"]').text()).toContain('+2250700000000')
    expect(w.get('[data-test="declared-phone-badge"]').text()).toBe('Non vérifié')
    expect(w.get(BUTTON).text()).toBe('Valider ce numéro')
  })

  it('sans l’autorité USER_PHONE_VERIFY (SUPPORT, ou retirée) : pas de bouton, numéro et pastille visibles', () => {
    expect(mountP({}, 'SUPPORT').find(BUTTON).exists()).toBe(false)
    expect(mountP({}, 'SUPPORT').get('[data-test="declared-phone-badge"]').text()).toBe('Non vérifié')
    expect(mountP({}, 'ADMIN', { USER_PHONE_VERIFY: false }).find(BUTTON).exists()).toBe(false)
  })

  it('niveau YADONY_VERIFIED : pastille « Vérifié par Yadony », pas de bouton', () => {
    const w = mountP({ declaredPhoneLevel: 'YADONY_VERIFIED' })
    expect(w.get('[data-test="declared-phone-badge"]').text()).toBe('Vérifié par Yadony')
    expect(w.find(BUTTON).exists()).toBe(false)
  })

  it('détail d’un ancien back (champs absents) ou sans numéro : rien n’est rendu', () => {
    expect(mountP({ declaredPhone: undefined, declaredPhoneLevel: undefined }).find('[data-test="declared-phone-block"]').exists()).toBe(false)
    expect(mountP({ declaredPhone: null, declaredPhoneLevel: null }).find('[data-test="declared-phone-block"]').exists()).toBe(false)
  })

  it('le bouton ouvre une confirmation qui montre le numéro et rappelle d’appeler avant', async () => {
    const w = mountP()
    await w.get(BUTTON).trigger('click')
    const dialog = w.get('[role="dialog"]')
    expect(dialog.text()).toContain('+2250700000000')
    expect(dialog.text()).toContain('Appelez')
    expect(verifyDeclaredPhone).not.toHaveBeenCalled()
  })

  it('confirmation : le corps envoyé est le numéro affiché, puis la pastille passe à « Vérifié par Yadony »', async () => {
    verifyDeclaredPhone.mockResolvedValue({ ...USER, declaredPhoneLevel: 'YADONY_VERIFIED' })
    const w = mountP()
    await w.get(BUTTON).trigger('click')
    await w.get('[data-test="confirm"]').trigger('click')
    await flushPromises()
    expect(verifyDeclaredPhone).toHaveBeenCalledWith('u1', '+2250700000000')
    expect(w.emitted('updated')).toHaveLength(1)
    expect(w.get('[data-test="declared-phone-badge"]').text()).toBe('Vérifié par Yadony')
    expect(w.find(BUTTON).exists()).toBe(false)
    expect(w.find('[role="dialog"]').exists()).toBe(false)
  })

  it.each([
    ['declared-phone-changed', 'Le numéro a changé depuis l’ouverture de la fiche. Rechargez la page.'],
    ['declared-phone-conflict', 'Ce numéro appartient déjà à un autre compte. Il ne peut pas être validé.'],
    ['declared-phone-missing', 'Aucun numéro déclaré à valider.'],
    ['phone-already-set', 'Ce compte a déjà un numéro vérifié par SMS.'],
    ['declared-phone-held-by-unregistered-account', 'Ce numéro est déjà associé à un compte non finalisé. Il ne peut pas être validé pour l’instant. Contactez l’équipe technique.'],
    ['declared-phone-unavailable', 'Service indisponible pour le moment. Réessayez dans quelques minutes.'],
    ['autre-code', 'Impossible de valider ce numéro.'],
  ])('refus %s : message français, niveau inchangé', async (code, message) => {
    verifyDeclaredPhone.mockRejectedValue({ status: 409, data: { code, detail: 'detail technique' } })
    const w = mountP()
    await w.get(BUTTON).trigger('click')
    await w.get('[data-test="confirm"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-test="declared-phone-error"]').text()).toBe(message)
    expect(w.get('[data-test="declared-phone-badge"]').text()).toBe('Non vérifié')
    expect(w.emitted('updated')).toBeUndefined()
  })
})
