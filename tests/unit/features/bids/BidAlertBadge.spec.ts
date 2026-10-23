import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BidAlertBadge from '@/features/bids/components/BidAlertBadge.vue'

describe('BidAlertBadge', () => {
  it('affiche l’étiquette courte de l’alerte', () => {
    const w = mount(BidAlertBadge, { props: { code: 'DISPUTE_OPEN' } })
    expect(w.find('[data-test="bid-alert"]').text()).toBe('Litige')
    expect(w.classes().join(' ')).toContain('danger')
  })
  it('ton avertissement pour un retard', () => {
    expect(mount(BidAlertBadge, { props: { code: 'LATE' } }).classes().join(' ')).toContain('warning')
  })
  it('ne rend rien pour un code inconnu, absent ou null', () => {
    for (const code of ['PIRATE', undefined, null]) {
      expect(mount(BidAlertBadge, { props: { code } }).find('[data-test="bid-alert"]').exists()).toBe(false)
    }
  })
})
