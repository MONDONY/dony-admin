import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PeriodFilter from '@/features/finance/components/PeriodFilter.vue'

describe('PeriodFilter', () => {
  it('émet la période saisie à chaque changement de borne', async () => {
    const w = mount(PeriodFilter, { props: { modelDateFrom: null, modelDateTo: null } })
    await w.find('[data-test="period-from"]').setValue('2026-08-01')
    await w.find('[data-test="period-from"]').trigger('change')
    expect(w.emitted('update:dateRange')!.at(-1)).toEqual(['2026-08-01', null])
    await w.find('[data-test="period-to"]').setValue('2026-08-31')
    await w.find('[data-test="period-to"]').trigger('change')
    expect(w.emitted('update:dateRange')!.at(-1)).toEqual(['2026-08-01', '2026-08-31'])
  })

  it('ne propose « Effacer » qu’une fois une borne appliquée, et remet la période à vide', async () => {
    const w = mount(PeriodFilter, { props: { modelDateFrom: null, modelDateTo: null } })
    expect(w.find('[data-test="period-clear"]').exists()).toBe(false)
    await w.setProps({ modelDateFrom: '2026-08-01' })
    await w.find('[data-test="period-clear"]').trigger('click')
    expect(w.emitted('update:dateRange')!.at(-1)).toEqual([null, null])
    expect((w.find('[data-test="period-from"]').element as HTMLInputElement).value).toBe('')
  })

  it('préremplit les champs depuis les bornes courantes', () => {
    const w = mount(PeriodFilter, { props: { modelDateFrom: '2026-01-01', modelDateTo: '2026-03-31' } })
    expect((w.find('[data-test="period-from"]').element as HTMLInputElement).value).toBe('2026-01-01')
    expect((w.find('[data-test="period-to"]').element as HTMLInputElement).value).toBe('2026-03-31')
  })

  it('indique la période par défaut du back quand aucune borne n’est choisie', () => {
    const w = mount(PeriodFilter, { props: { modelDateFrom: null, modelDateTo: null } })
    expect(w.text()).toContain('12 derniers mois')
  })
})
