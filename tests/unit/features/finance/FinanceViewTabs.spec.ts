import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FinanceViewTabs from '@/features/finance/components/FinanceViewTabs.vue'
import { MOBILE_MONEY_VIEWS } from '@/features/finance/lib/mobileMoneyViews'

const counts = (attention: number, failed = attention) => ({ failed, open: 1, done: 7, all: 10, attention })
const mountTabs = (props: Record<string, unknown> = {}) => mount(FinanceViewTabs, {
  props: { views: MOBILE_MONEY_VIEWS, counts: counts(3), modelValue: 'FAILED', ariaLabel: 'Vues', testPrefix: 'mm-view', ...props },
})

describe('FinanceViewTabs', () => {
  it('un onglet par vue avec son nombre', () => {
    const w = mountTabs()
    expect(w.find('[data-test="mm-view-FAILED"]').text()).toContain('Échecs')
    expect(w.find('[data-test="mm-view-FAILED"]').text()).toContain('3')
    expect(w.find('[data-test="mm-view-DONE"]').text()).toContain('7')
    expect(w.find('[data-test="mm-view-ALL"]').text()).toContain('10')
  })
  it('émet la vue choisie', async () => {
    const w = mountTabs()
    await w.find('[data-test="mm-view-OPEN"]').trigger('click')
    expect(w.emitted('update:modelValue')).toEqual([['OPEN']])
  })
  it('vue d’alerte : rouge quand attention > 0, avec le nombre failed', () => {
    const w = mountTabs({ counts: counts(2, 1) })
    const badge = w.find('[data-test="mm-view-FAILED"] [data-test="tab-count"]')
    expect(badge.text()).toBe('1')
    expect(badge.classes().join(' ')).toMatch(/danger/)
  })
  it('vue d’alerte à zéro : le 0 reste visible, sans rouge', () => {
    const w = mountTabs({ counts: counts(0) })
    const badge = w.find('[data-test="mm-view-FAILED"] [data-test="tab-count"]')
    expect(badge.text()).toBe('0')
    expect(badge.classes().join(' ')).not.toMatch(/danger/)
  })
  it('une vue sans alerte à zéro n’affiche pas de nombre', () => {
    const w = mountTabs({ counts: { ...counts(0), open: 0 } })
    expect(w.find('[data-test="mm-view-OPEN"] [data-test="tab-count"]').exists()).toBe(false)
  })
  it('sans nombres : aucun nombre, jamais de 0 inventé', () => {
    const w = mountTabs({ counts: null })
    expect(w.findAll('[data-test="tab-count"]').length).toBe(0)
  })
})
