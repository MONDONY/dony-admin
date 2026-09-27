import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PackageRequestFilters from '@/features/package-requests/components/PackageRequestFilters.vue'

const filters = { status: 'ALL', query: '', reportedOnly: false, from: null, to: null }

describe('PackageRequestFilters', () => {
  it('puce de statut active et émission du statut choisi', async () => {
    const w = mount(PackageRequestFilters, { props: { filters: { ...filters, status: 'OPEN' } } })
    expect(w.find('[data-test="pr-chip-status-OPEN"]').classes()).toContain('bg-primary')
    expect(w.find('[data-test="pr-chip-status-REMOVED_BY_ADMIN"]').text()).toBe('Retirées')
    await w.find('[data-test="pr-chip-status-REMOVED_BY_ADMIN"]').trigger('click')
    expect(w.emitted('update:status')![0]).toEqual(['REMOVED_BY_ADMIN'])
  })

  it('l’aide de recherche annonce identifiants et téléphone international', () => {
    const w = mount(PackageRequestFilters, { props: { filters } })
    const input = w.find('[data-test="pr-search"]')
    expect(input.attributes('placeholder')).toContain('+221')
    expect(w.find('[data-test="pr-search-help"]').text()).toContain('identifiant de la demande ou de l’expéditeur')
    expect(w.find('[data-test="pr-search-help"]').text()).toContain('format international')
  })

  it('recherche émise à la validation', async () => {
    const w = mount(PackageRequestFilters, { props: { filters } })
    const input = w.find('[data-test="pr-search"]')
    await input.setValue('Dakar')
    await input.trigger('keyup', { key: 'Enter' })
    expect(w.emitted('update:query')![0]).toEqual(['Dakar'])
    await input.trigger('search')
    expect(w.emitted('update:query')![1]).toEqual(['Dakar'])
  })

  it('case « Signalées seulement »', async () => {
    const w = mount(PackageRequestFilters, { props: { filters } })
    await w.find('[data-test="pr-reported-only"]').setValue(true)
    expect(w.emitted('update:reportedOnly')![0]).toEqual([true])
  })

  it('période : émission et effacement', async () => {
    const w = mount(PackageRequestFilters, { props: { filters } })
    expect(w.find('[data-test="pr-dates-clear"]').exists()).toBe(false)
    await w.find('[data-test="pr-date-from"]').setValue('2026-09-01')
    expect(w.emitted('update:dateRange')![0]).toEqual(['2026-09-01', null])
    await w.find('[data-test="pr-date-to"]').setValue('2026-09-30')
    expect(w.emitted('update:dateRange')![1]).toEqual(['2026-09-01', '2026-09-30'])

    await w.setProps({ filters: { ...filters, from: '2026-09-01', to: '2026-09-30' } })
    await w.find('[data-test="pr-dates-clear"]').trigger('click')
    expect(w.emitted('update:dateRange')![2]).toEqual([null, null])
    expect((w.find('[data-test="pr-date-from"]').element as HTMLInputElement).value).toBe('')
  })
})
