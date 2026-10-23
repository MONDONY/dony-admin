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

    it('arrondi à 0,1 % : 7,25 → 0,073', async () => {
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

    it('99,9 et 0 sont acceptés', async () => {
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
      expect(navigateToMock).toHaveBeenCalledWith('/users')
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

  it('aucun droit de gestion exploitable ici : message explicite', () => {
    const w = mountTab({ gpPro: undefined }, 'SUPPORT')
    expect(w.get('[data-test="manage-empty"]').text()).toContain('Aucun réglage')
  })
})
