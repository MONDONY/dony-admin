import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { seedAuth } from '~/tests/helpers/auth'
import UserManageTab from '@/features/user-profile/components/UserManageTab.vue'
import type { AdminRole } from '@/stores/auth'

const navigateToMock = vi.fn()
vi.stubGlobal('navigateTo', navigateToMock)
const impactMock = vi.fn()
const deleteMock = vi.fn()
vi.mock('@/features/users/services/usersService', () => ({
  usersService: {
    getDeletionImpact: (...a: unknown[]) => impactMock(...a),
    deleteUser: (...a: unknown[]) => deleteMock(...a),
  },
}))

const GpStub = { name: 'UserGpProSection', props: ['userId', 'userName', 'gpPro', 'gpProGrantedAt', 'kycStatus', 'status'], emits: ['changed'], template: '<div data-test="gp-stub">{{ userId }}|{{ userName }}|{{ gpPro }}|{{ kycStatus }}|{{ status }}</div>' }
const RecetteStub = { name: 'UserRecetteTesterSection', props: ['userId'], template: '<div data-test="recette-stub">{{ userId }}</div>' }
const DeletionStub = {
  name: 'UserDeletionDialog', props: ['open', 'user', 'impact', 'isLoading', 'busy', 'error'], emits: ['confirm', 'cancel'],
  template: '<div v-if="open" data-test="deletion-stub">{{ isLoading }}|{{ error }}|{{ impact && impact.blocked }}</div>',
}
const USER = {
  id: 'u1', firstName: 'Awa', lastName: 'Diallo', email: null, status: 'ACTIVE', kycStatus: 'VERIFIED',
  commissionRateOverride: null, proSubscription: null, gpPro: false, gpProGrantedAt: null,
}
let wrapper: VueWrapper | null = null

function mountTab(user: Record<string, unknown> = {}, role: AdminRole = 'ADMIN', overrides: Record<string, boolean> = {}, busy = false) {
  seedAuth(role, overrides)
  wrapper = mount(UserManageTab, {
    props: { user: { ...USER, ...user } as never, busy },
    global: { stubs: { UserGpProSection: GpStub, UserRecetteTesterSection: RecetteStub, UserDeletionDialog: DeletionStub } },
  })
  return wrapper
}
const confirm = async (w: VueWrapper, reason?: string) => {
  if (reason !== undefined) await w.get('[data-test="reason"]').setValue(reason)
  await w.get('[data-test="confirm"]').trigger('click')
  await flushPromises()
}

describe('UserManageTab', () => {
  beforeEach(() => { navigateToMock.mockReset(); impactMock.mockReset(); deleteMock.mockReset() })
  afterEach(() => { wrapper?.unmount(); wrapper = null })

  describe('commission', () => {
    it('sans dérogation : taux global, pas de bouton de réinitialisation', () => {
      const w = mountTab()
      expect(w.get('[data-test="commission-state"]').text()).toContain('Taux global appliqué')
      expect(w.find('[data-test="commission-reset"]').exists()).toBe(false)
    })

    it('dérogation : taux affiché, champ prérempli sans bruit flottant', () => {
      const w = mountTab({ commissionRateOverride: 0.07 })
      expect(w.get('[data-test="commission-state"]').text()).toContain('Dérogation actuelle : 7.0 %')
      expect((w.get('[data-test="commission-input"]').element as HTMLInputElement).value).toBe('7')
    })

    it('8 → confirmation sans motif puis setCommission(0.08)', async () => {
      const w = mountTab()
      await w.get('[data-test="commission-input"]').setValue('8')
      await w.get('[data-test="commission-apply"]').trigger('click')
      expect(w.get('[role="dialog"]').text()).toContain('Un taux de commission de 8.0 % sera appliqué')
      expect(w.find('[data-test="reason"]').exists()).toBe(false)
      await confirm(w)
      expect(w.emitted('setCommission')![0]).toEqual([0.08])
    })

    it('arrondi au dixième de pour cent : 7,26 → 0,073 (7,3 %)', async () => {
      const w = mountTab()
      await w.get('[data-test="commission-input"]').setValue('7.26')
      await w.get('[data-test="commission-apply"]').trigger('click')
      await confirm(w)
      expect(w.emitted('setCommission')![0]).toEqual([0.073])
    })

    it.each(['100', '99.95', '-1', '', 'abc'])('valeur « %s » refusée : aucun dialogue', async (v) => {
      const w = mountTab()
      await w.get('[data-test="commission-input"]').setValue(v)
      await w.get('[data-test="commission-apply"]').trigger('click')
      expect(w.find('[role="dialog"]').exists()).toBe(false)
      expect(w.emitted('setCommission')).toBeUndefined()
      expect(w.get('[data-test="commission-invalid"]').attributes('role')).toBe('alert')
    })

    it('99,9 est accepté : 0,999', async () => {
      const w = mountTab()
      await w.get('[data-test="commission-input"]').setValue('99.9')
      await w.get('[data-test="commission-apply"]').trigger('click')
      await confirm(w)
      expect(w.emitted('setCommission')![0]).toEqual([0.999])
    })

    it('0 est accepté', async () => {
      const w = mountTab()
      await w.get('[data-test="commission-input"]').setValue('0')
      await w.get('[data-test="commission-apply"]').trigger('click')
      expect(w.find('[role="dialog"]').exists()).toBe(true)
      await confirm(w)
      expect(w.emitted('setCommission')![0]).toEqual([0])
    })

    it('réinitialiser : confirmation puis setCommission(null)', async () => {
      const w = mountTab({ commissionRateOverride: 0.05 })
      await w.get('[data-test="commission-reset"]').trigger('click')
      expect(w.get('[role="dialog"]').text()).toContain('Réinitialiser la commission')
      await confirm(w)
      expect(w.emitted('setCommission')![0]).toEqual([null])
    })

    it('Échap annule sans émettre', async () => {
      const w = mountTab({ commissionRateOverride: 0.05 })
      await w.get('[data-test="commission-reset"]').trigger('click')
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      await flushPromises()
      expect(w.find('[role="dialog"]').exists()).toBe(false)
      expect(w.emitted('setCommission')).toBeUndefined()
    })

    it('le champ suit la dérogation après une mise à jour de la fiche', async () => {
      const w = mountTab()
      await w.setProps({ user: { ...USER, commissionRateOverride: 0.08 } })
      expect((w.get('[data-test="commission-input"]').element as HTMLInputElement).value).toBe('8')
      await w.setProps({ user: { ...USER, commissionRateOverride: null } })
      expect((w.get('[data-test="commission-input"]').element as HTMLInputElement).value).toBe('')
    })

    it('carte absente sans USER_COMMISSION', () => {
      const w = mountTab({}, 'ADMIN', { USER_COMMISSION: false })
      expect(w.find('[data-test="commission-card"]').exists()).toBe(false)
    })
  })

  describe('limite mensuelle de trajets', () => {
    const withUsage = (extra: Record<string, unknown> = {}) => ({ monthlyTripsUsed: 3, ...extra })

    it('affiche la limite et le nombre de trajets publiés ce mois-ci', () => {
      const w = mountTab(withUsage({ monthlyTripLimit: 5 }))
      expect(w.get('[data-test="trip-limit-card"]').exists()).toBe(true)
      expect(w.get('[data-test="trip-limit-used"]').text()).toBe('3 trajets publiés ce mois-ci')
      expect((w.get('[data-test="trip-limit-input"]').element as HTMLInputElement).value).toBe('5')
      expect(w.get('[data-test="trip-limit-state"]').text()).toContain('5 trajets par mois')
    })

    it('un seul trajet : singulier', () => {
      const w = mountTab({ monthlyTripsUsed: 1 })
      expect(w.get('[data-test="trip-limit-used"]').text()).toBe('1 trajet publié ce mois-ci')
    })

    it('sans limite (champ absent du JSON) : « Aucune limite », champ vide', () => {
      const w = mountTab(withUsage())
      expect(w.get('[data-test="trip-limit-state"]').text()).toContain('Aucune limite')
      expect((w.get('[data-test="trip-limit-input"]').element as HTMLInputElement).value).toBe('')
    })

    it('champ vide : envoie null (aucune limite)', async () => {
      const w = mountTab(withUsage({ monthlyTripLimit: 5 }))
      await w.get('[data-test="trip-limit-input"]').setValue('')
      await w.get('[data-test="trip-limit-save"]').trigger('click')
      expect(w.emitted('setMonthlyTripLimit')![0]).toEqual([null])
      expect(w.find('[data-test="trip-limit-invalid"]').exists()).toBe(false)
    })

    it.each([['1', 1], ['12', 12], ['100', 100]])('valeur « %s » : envoie %d', async (v, n) => {
      const w = mountTab(withUsage())
      await w.get('[data-test="trip-limit-input"]').setValue(v)
      await w.get('[data-test="trip-limit-save"]').trigger('click')
      expect(w.emitted('setMonthlyTripLimit')![0]).toEqual([n])
    })

    it.each(['0', '101', '-3', '2.5'])('valeur « %s » hors de 1 à 100 : erreur locale, aucun appel', async (v) => {
      const w = mountTab(withUsage())
      await w.get('[data-test="trip-limit-input"]').setValue(v)
      await w.get('[data-test="trip-limit-save"]').trigger('click')
      expect(w.emitted('setMonthlyTripLimit')).toBeUndefined()
      expect(w.get('[data-test="trip-limit-invalid"]').attributes('role')).toBe('alert')
      expect(w.get('[data-test="trip-limit-invalid"]').text()).toContain('entre 1 et 100')
    })

    it('la saisie valide efface l’erreur locale', async () => {
      const w = mountTab(withUsage())
      await w.get('[data-test="trip-limit-input"]').setValue('0')
      await w.get('[data-test="trip-limit-save"]').trigger('click')
      await w.get('[data-test="trip-limit-input"]').setValue('4')
      await w.get('[data-test="trip-limit-save"]').trigger('click')
      expect(w.find('[data-test="trip-limit-invalid"]').exists()).toBe(false)
      expect(w.emitted('setMonthlyTripLimit')![0]).toEqual([4])
    })

    it('le champ suit la fiche après une mise à jour', async () => {
      const w = mountTab(withUsage())
      await w.setProps({ user: { ...USER, monthlyTripsUsed: 3, monthlyTripLimit: 8 } })
      expect((w.get('[data-test="trip-limit-input"]').element as HTMLInputElement).value).toBe('8')
      await w.setProps({ user: { ...USER, monthlyTripsUsed: 3 } })
      expect((w.get('[data-test="trip-limit-input"]').element as HTMLInputElement).value).toBe('')
    })

    it('confirmation de succès une fois l’enregistrement terminé sans erreur', async () => {
      const w = mountTab(withUsage())
      await w.get('[data-test="trip-limit-input"]').setValue('6')
      await w.get('[data-test="trip-limit-save"]').trigger('click')
      await w.setProps({ busy: true })
      await w.setProps({ busy: false, user: { ...USER, monthlyTripsUsed: 3, monthlyTripLimit: 6 } })
      expect(w.get('[data-test="trip-limit-saved"]').attributes('role')).toBe('status')
    })

    it('pas de confirmation de succès quand le geste a échoué', async () => {
      const w = mountTab(withUsage())
      await w.get('[data-test="trip-limit-input"]').setValue('6')
      await w.get('[data-test="trip-limit-save"]').trigger('click')
      await w.setProps({ busy: true })
      await w.setProps({ busy: false, error: 'Droit insuffisant' })
      expect(w.find('[data-test="trip-limit-saved"]').exists()).toBe(false)
      expect(w.get('[data-test="manage-error"]').text()).toBe('Droit insuffisant')
    })

    it('ancien back sans les champs : pas de bloc, pas d’erreur', () => {
      const w = mountTab()
      expect(w.find('[data-test="trip-limit-card"]').exists()).toBe(false)
      expect(w.find('[data-test="manage-error"]').exists()).toBe(false)
    })

    it('bloc absent sans le droit USER_COMMISSION', () => {
      const w = mountTab(withUsage(), 'ADMIN', { USER_COMMISSION: false })
      expect(w.find('[data-test="trip-limit-card"]').exists()).toBe(false)
    })

    it('bouton désactivé pendant l’enregistrement', () => {
      const w = mountTab(withUsage(), 'ADMIN', {}, true)
      expect(w.get('[data-test="trip-limit-save"]').attributes('disabled')).toBeDefined()
    })
  })

  describe('accès PRO', () => {
    it('aucun abonnement : offrir avec motif', async () => {
      const w = mountTab()
      expect(w.get('[data-test="pro-source"]').text()).toBe('aucun')
      expect(w.find('[data-test="action-revoke-pro"]').exists()).toBe(false)
      await w.get('[data-test="action-grant-pro"]').trigger('click')
      expect(w.get('[role="dialog"]').text()).toContain('Offrir un accès PRO')
      await confirm(w, 'Geste commercial')
      expect(w.emitted('grantPro')![0]).toEqual(['Geste commercial'])
    })

    it('accès offert : révoquer sans motif, motif affiché, plus d’octroi', async () => {
      const w = mountTab({ proSubscription: { source: 'ADMIN_GRANT', status: 'ACTIVE', adminGrantReason: 'Partenaire' } })
      expect(w.get('[data-test="pro-source"]').text()).toBe('accès offert par un administrateur')
      expect(w.get('[data-test="pro-grant-section"]').text()).toContain('motif : Partenaire')
      expect(w.find('[data-test="action-grant-pro"]').exists()).toBe(false)
      await w.get('[data-test="action-revoke-pro"]').trigger('click')
      expect(w.find('[data-test="reason"]').exists()).toBe(false)
      await confirm(w)
      expect(w.emitted('revokePro')).toHaveLength(1)
    })

    it('abonnement Stripe en cours : ni octroi ni révocation, indication', () => {
      const w = mountTab({ proSubscription: { source: 'STRIPE', status: 'ACTIVE' } })
      expect(w.get('[data-test="pro-source"]').text()).toBe('abonnement payant')
      expect(w.find('[data-test="action-grant-pro"]').exists()).toBe(false)
      expect(w.get('[data-test="pro-stripe-hint"]').text()).toContain('résiliation se fait dans Stripe')
    })

    it('abonnement Stripe expiré : l’octroi reste possible', () => {
      const w = mountTab({ proSubscription: { source: 'STRIPE', status: 'EXPIRED' } })
      expect(w.find('[data-test="action-grant-pro"]').exists()).toBe(true)
      expect(w.find('[data-test="pro-stripe-hint"]').exists()).toBe(false)
    })

    it('grâce historique : libellé', () => {
      expect(mountTab({ proSubscription: { source: 'LEGACY_FREE', status: 'LEGACY_GRACE' } }).get('[data-test="pro-source"]').text()).toBe('grâce historique')
    })

    it('occupé : boutons désactivés ; sans USER_PRO_GRANT : carte absente', () => {
      const w = mountTab({}, 'ADMIN', {}, true)
      expect(w.get('[data-test="action-grant-pro"]').attributes('disabled')).toBeDefined()
      wrapper?.unmount()
      expect(mountTab({}, 'ADMIN', { USER_PRO_GRANT: false }).find('[data-test="pro-grant-section"]').exists()).toBe(false)
    })
  })

  describe('GP Pro et mode recette', () => {
    it('GP Pro : mêmes propriétés que le tiroir, rafraîchissement transmis', async () => {
      const w = mountTab({ gpPro: true })
      expect(w.get('[data-test="gp-stub"]').text()).toBe('u1|Awa Diallo|true|VERIFIED|ACTIVE')
      w.getComponent(GpStub).vm.$emit('changed')
      expect(w.emitted('changed')).toHaveLength(1)
    })
    it('GP Pro absent si le serveur ne l’expose pas ou sans GP_PRO_REVIEW', () => {
      expect(mountTab({ gpPro: undefined }).find('[data-test="gp-stub"]').exists()).toBe(false)
      wrapper?.unmount()
      expect(mountTab({}, 'ADMIN', { GP_PRO_REVIEW: false }).find('[data-test="gp-stub"]').exists()).toBe(false)
    })
    it('mode recette : absent pour ADMIN, présent pour SUPER_ADMIN', () => {
      expect(mountTab({}, 'ADMIN').find('[data-test="recette-stub"]').exists()).toBe(false)
      wrapper?.unmount()
      expect(mountTab({}, 'SUPER_ADMIN').get('[data-test="recette-stub"]').text()).toBe('u1')
    })
  })

  describe('zone de danger', () => {
    it('absente sans USER_DELETE', () => {
      expect(mountTab({}, 'ADMIN', { USER_DELETE: false }).find('[data-test="action-delete"]').exists()).toBe(false)
    })

    it('ouvre l’analyse d’impact puis le dialogue', async () => {
      impactMock.mockResolvedValue({ blocked: false, findings: [] })
      const w = mountTab()
      await w.get('[data-test="action-delete"]').trigger('click')
      expect(impactMock).toHaveBeenCalledWith('u1')
      await flushPromises()
      expect(w.get('[data-test="deletion-stub"]').text()).toBe('false||false')
    })

    it('confirmation réussie : suppression puis redirection vers la liste', async () => {
      impactMock.mockResolvedValue({ blocked: false, findings: [] })
      deleteMock.mockResolvedValue(undefined)
      const w = mountTab()
      await w.get('[data-test="action-delete"]').trigger('click')
      await flushPromises()
      w.getComponent(DeletionStub).vm.$emit('confirm', 'FRAUD', 'Fraude')
      await flushPromises()
      expect(deleteMock).toHaveBeenCalledWith('u1', 'FRAUD', 'Fraude')
      expect(navigateToMock).toHaveBeenCalledWith('/users', { replace: true })
    })

    it('échec : le dialogue reste ouvert avec l’erreur, pas de redirection', async () => {
      impactMock.mockResolvedValue({ blocked: false, findings: [] })
      deleteMock.mockRejectedValue({ data: { detail: 'Impossible : litige ouvert' } })
      const w = mountTab()
      await w.get('[data-test="action-delete"]').trigger('click')
      await flushPromises()
      w.getComponent(DeletionStub).vm.$emit('confirm', 'FRAUD', 'Fraude')
      await flushPromises()
      expect(navigateToMock).not.toHaveBeenCalled()
      expect(w.get('[data-test="deletion-stub"]').text()).toContain('Impossible : litige ouvert')
    })

    it('annuler ferme le dialogue', async () => {
      impactMock.mockResolvedValue({ blocked: false, findings: [] })
      const w = mountTab()
      await w.get('[data-test="action-delete"]').trigger('click')
      await flushPromises()
      w.getComponent(DeletionStub).vm.$emit('cancel')
      await flushPromises()
      expect(w.find('[data-test="deletion-stub"]').exists()).toBe(false)
    })

    it('démonté pendant la suppression : pas de redirection', async () => {
      impactMock.mockResolvedValue({ blocked: false, findings: [] })
      const d = Promise.withResolvers<void>()
      deleteMock.mockReturnValue(d.promise)
      const w = mountTab()
      await w.get('[data-test="action-delete"]').trigger('click')
      await flushPromises()
      w.getComponent(DeletionStub).vm.$emit('confirm', 'FRAUD', 'Fraude')
      w.unmount(); wrapper = null
      d.resolve(); await flushPromises()
      expect(navigateToMock).not.toHaveBeenCalled()
    })
  })

  it('erreur de geste : répétée en haut de l’onglet, role=alert', () => {
    const w = mountTab({}, 'ADMIN')
    expect(w.find('[data-test="manage-error"]').exists()).toBe(false)
    wrapper?.unmount()
    seedAuth('ADMIN')
    wrapper = mount(UserManageTab, {
      props: { user: USER as never, error: 'Commission refusée' },
      global: { stubs: { UserGpProSection: GpStub, UserRecetteTesterSection: RecetteStub, UserDeletionDialog: DeletionStub } },
    })
    const e = wrapper.get('[data-test="manage-error"]')
    expect(e.attributes('role')).toBe('alert')
    expect(e.text()).toBe('Commission refusée')
  })

  it('aucun droit de gestion exploitable ici : message explicite', () => {
    const w = mountTab({ gpPro: undefined }, 'SUPPORT')
    expect(w.get('[data-test="manage-empty"]').text()).toContain('Aucun réglage')
  })
})
