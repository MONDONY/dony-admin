import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
vi.mock('@/features/topup-codes/services/topupCodesService')
import { topupCodesService } from '@/features/topup-codes/services/topupCodesService'
import TopupCodeRedemptionsPanel from '@/features/topup-codes/components/TopupCodeRedemptionsPanel.vue'
const svc = topupCodesService as any

const code = { id: 't1', code: 'DAKAR2000', amount: 2000, currency: 'XOF', redeemedCount: 1, maxRedemptions: 100 } as any

describe('TopupCodeRedemptionsPanel', () => {
  beforeEach(() => { svc.redemptions = vi.fn() })

  it('liste les utilisateurs avec lien vers leur fiche', async () => {
    svc.redemptions.mockResolvedValue([
      { id: 'r1', userId: 'u1', userName: 'Awa Diop', amount: 2000, currency: 'XOF', createdAt: '2026-10-15T10:00:00' },
    ])
    const w = mount(TopupCodeRedemptionsPanel, { props: { code }, global: { stubs: { NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } } } })
    await flushPromises()
    expect(svc.redemptions).toHaveBeenCalledWith('t1')
    expect(w.text()).toContain('Awa Diop')
    expect(w.get('a').attributes('href')).toBe('/users?open=u1')
  })

  it('affiche l’erreur de chargement', async () => {
    svc.redemptions.mockRejectedValue(Object.assign(new Error('x'), { data: { detail: 'Boom lisible' } }))
    const w = mount(TopupCodeRedemptionsPanel, { props: { code }, global: { stubs: { NuxtLink: true } } })
    await flushPromises()
    expect(w.get('[data-test="redemptions-error"]').text()).toBe('Boom lisible')
  })

  it('rien quand code est null ; émet close', async () => {
    svc.redemptions.mockResolvedValue([])
    const w = mount(TopupCodeRedemptionsPanel, { props: { code: null } })
    expect(w.find('[data-test="topup-redemptions"]').exists()).toBe(false)
    await w.setProps({ code })
    await flushPromises()
    await w.get('[data-test="redemptions-close"]').trigger('click')
    expect(w.emitted('close')).toBeTruthy()
  })
})
