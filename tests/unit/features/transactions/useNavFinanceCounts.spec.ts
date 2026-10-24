/** Pastille du menu « Transactions » : nombres des sections rechargés au rythme des compteurs du menu. */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'

const svc = vi.hoisted(() => ({ counts: vi.fn() }))
vi.mock('@/features/transactions/services/transactionsService', () => ({ transactionsService: svc }))

import { useNavFinanceCounts } from '@/features/transactions/composables/useNavFinanceCounts'

const finance = { payments: 1, mobileMoney: 2, soldes: 3, chargebacks: 4, details: { paymentsAttention: 1, mobileMoneyAttention: 2, walletRefundsPending: 2, cashCommissionsAttention: 1, chargebacksOpen: 4 } }

function host(tick: ReturnType<typeof ref<number>>, enabled: () => boolean) {
  let out!: ReturnType<typeof useNavFinanceCounts>
  const C = defineComponent({ setup() { out = useNavFinanceCounts(() => tick.value, enabled); return () => h('div') } })
  const w = mount(C)
  return { w, get: () => out.value }
}

describe('useNavFinanceCounts', () => {
  beforeEach(() => { svc.counts.mockReset() })

  it('chargé au montage puis à chaque rafraîchissement des compteurs', async () => {
    svc.counts.mockResolvedValue(finance)
    const tick = ref(0)
    const { get } = host(tick, () => true)
    await flushPromises()
    expect(get()).toEqual(finance)
    tick.value++
    await flushPromises()
    expect(svc.counts).toHaveBeenCalledTimes(2)
  })

  it('sans PAYMENT_VIEW : aucun appel, null', async () => {
    const tick = ref(0)
    const { get } = host(tick, () => false)
    tick.value++
    await flushPromises()
    expect(svc.counts).not.toHaveBeenCalled()
    expect(get()).toBeNull()
  })

  it('ancien back (route absente) : null, la pastille garde les clés actuelles', async () => {
    svc.counts.mockRejectedValue(Object.assign(new Error('nf'), { statusCode: 404 }))
    const { get } = host(ref(0), () => true)
    await flushPromises()
    expect(get()).toBeNull()
  })
})
