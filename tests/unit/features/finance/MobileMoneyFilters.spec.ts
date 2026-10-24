import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import MobileMoneyFilters from '@/features/finance/components/MobileMoneyFilters.vue'

const mountF = (props: Record<string, unknown> = {}) => mount(MobileMoneyFilters, {
  props: { query: '', kind: '', provider: '', providers: ['ORANGE_CIV', 'WAVE_SEN'], ...props },
})

describe('MobileMoneyFilters', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('placeholder sans mention du téléphone', () => {
    const p = mountF().find('[data-test="mm-search"]').attributes('placeholder')
    expect(p).toBe('Chercher : nom, référence d’opération, n° de suivi, trajet')
    expect(p).not.toMatch(/t[ée]l[ée]phone|num[ée]ro/i)
  })
  it('frappe : émet après 300 ms, une seule fois', async () => {
    const w = mountF()
    const input = w.find('[data-test="mm-search"]')
    await input.setValue('aw'); await input.setValue('awa')
    vi.advanceTimersByTime(299)
    expect(w.emitted('update:query')).toBeUndefined()
    vi.advanceTimersByTime(2)
    expect(w.emitted('update:query')).toEqual([['awa']])
  })
  it('Entrée émet tout de suite et annule la temporisation', async () => {
    const w = mountF()
    const input = w.find('[data-test="mm-search"]')
    await input.setValue('YD-1')
    await input.trigger('keydown', { key: 'Enter' })
    expect(w.emitted('update:query')).toEqual([['YD-1']])
    vi.advanceTimersByTime(500)
    expect(w.emitted('update:query')).toHaveLength(1)
  })
  it('pas d’émission si le texte est déjà le filtre appliqué', async () => {
    const w = mountF({ query: 'awa' })
    await w.find('[data-test="mm-search"]').setValue('awa')
    vi.advanceTimersByTime(400)
    expect(w.emitted('update:query')).toBeUndefined()
  })
  it('Type : Tous, Dépôt, Versement, Remboursement', async () => {
    const w = mountF()
    const sel = w.find('[data-test="mm-filter-kind"]')
    expect(sel.findAll('option').map(o => o.text())).toEqual(['Tous les types', 'Dépôt', 'Versement', 'Remboursement'])
    await sel.setValue('PAYOUT')
    expect(w.emitted('update:kind')).toEqual([['PAYOUT']])
  })
  it('Opérateur : Tous + opérateurs connus, valeur choisie toujours listée', async () => {
    const w = mountF({ provider: 'MTN_MOMO_CIV' })
    const opts = w.find('[data-test="mm-filter-provider"]').findAll('option')
    expect(opts.map(o => o.text())).toEqual(['Tous les opérateurs', 'MTN MoMo', 'Orange Money', 'Wave'])
    await w.find('[data-test="mm-filter-provider"]').setValue('WAVE_SEN')
    expect(w.emitted('update:provider')).toEqual([['WAVE_SEN']])
  })
})
