import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PaymentAlertBadge from '@/features/payments/components/PaymentAlertBadge.vue'

describe('PaymentAlertBadge', () => {
  it.each([
    ['HELD', 'Retenu', 'Versement retenu', 'text-danger'],
    ['CHARGEBACK_OPEN', 'Litige bancaire', 'Litige bancaire ouvert', 'text-danger'],
    ['MM_FAILED', 'Versement échoué', 'Versement échoué', 'text-danger'],
    ['ESCROW_J48', 'Séquestre > 48 h', 'En séquestre depuis plus de 48 h', 'text-warning'],
  ])('%s : étiquette courte, libellé complet, ton', (code, short, long, tone) => {
    const s = mount(PaymentAlertBadge, { props: { code, short: true } })
    expect(s.text()).toBe(short)
    expect(s.classes()).toContain(tone)
    expect(mount(PaymentAlertBadge, { props: { code } }).text()).toBe(long)
  })

  it('rien pour un code inconnu, null ou absent', () => {
    for (const code of ['NOPE', null, undefined, '']) {
      expect(mount(PaymentAlertBadge, { props: { code } }).text()).toBe('')
    }
    expect(mount(PaymentAlertBadge).html()).toBe('<!--v-if-->')
  })
})
