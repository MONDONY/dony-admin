import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import NoShowFilters from '@/features/incidents/components/NoShowFilters.vue'

const mountFilters = (status = 'PENDING_CONFIRMATION', scope = 'ALL') => mount(NoShowFilters, { props: { status, scope } as never })

describe('NoShowFilters', () => {
  it('onglets de statut', async () => {
    const w = mountFilters()
    expect(w.find('[data-test="noshow-status-pending"]').attributes('aria-pressed')).toBe('true')
    await w.find('[data-test="noshow-status-contested"]').trigger('click')
    await w.find('[data-test="noshow-status-decided"]').trigger('click')
    await w.find('[data-test="noshow-status-all"]').trigger('click')
    await w.find('[data-test="noshow-status-pending"]').trigger('click')
    // l'onglet déjà actif n'émet rien
    expect(w.emitted('update:status')).toEqual([['CONTESTED'], ['CONFIRMED'], ['ALL']])
    expect(w.find('[data-test="noshow-decided-confirmed"]').exists()).toBe(false)
  })

  it('« Tranchés » : absence confirmée ou résolus', async () => {
    const w = mountFilters('RESOLVED')
    expect(w.find('[data-test="noshow-status-decided"]').attributes('aria-pressed')).toBe('true')
    expect(w.find('[data-test="noshow-decided-resolved"]').attributes('aria-pressed')).toBe('true')
    await w.find('[data-test="noshow-decided-confirmed"]').trigger('click')
    await w.find('[data-test="noshow-decided-resolved"]').trigger('click')
    await w.find('[data-test="noshow-status-decided"]').trigger('click')
    expect(w.emitted('update:status')).toEqual([['CONFIRMED']])
  })

  it('onglets actifs pour Contestés et Tous', () => {
    expect(mountFilters('CONTESTED').find('[data-test="noshow-status-contested"]').attributes('aria-pressed')).toBe('true')
    expect(mountFilters('ALL').find('[data-test="noshow-status-all"]').attributes('aria-pressed')).toBe('true')
  })

  it('portée', async () => {
    const w = mountFilters('ALL', 'DELIVERY')
    expect(w.find('[data-test="noshow-scope-DELIVERY"]').attributes('aria-pressed')).toBe('true')
    await w.find('[data-test="noshow-scope-HANDOVER"]').trigger('click')
    await w.find('[data-test="noshow-scope-ALL"]').trigger('click')
    await w.find('[data-test="noshow-scope-DELIVERY"]').trigger('click')
    expect(w.emitted('update:scope')).toEqual([['HANDOVER'], ['ALL']])
  })
})
