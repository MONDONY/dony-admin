import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
vi.mock('@/features/payments/services/paymentsService')
import { usePaymentSuggestions } from '@/features/payments/composables/usePaymentSuggestions'
import { paymentsService } from '@/features/payments/services/paymentsService'
import type { PaymentSuggest } from '@/features/payments/types/index'
const svc = paymentsService as any

const sug = (name: string): PaymentSuggest => ({ senders: [{ id: 's', name } as any], travelers: [], trips: [], parcels: [] })

describe('usePaymentSuggestions', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); svc.suggest = vi.fn() })
  afterEach(() => { vi.useRealTimers() })

  it('query_debounces200ms', async () => {
    svc.suggest.mockResolvedValue(sug('Awa'))
    const s = usePaymentSuggestions()
    s.query('aw'); s.query('awa')
    await vi.advanceTimersByTimeAsync(199)
    expect(svc.suggest).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(svc.suggest).toHaveBeenCalledTimes(1); expect(svc.suggest).toHaveBeenCalledWith('awa')
    expect(s.suggestions.value?.senders[0]?.name).toBe('Awa')
  })
  it('query_shorterThanTwo_clears', async () => {
    svc.suggest.mockResolvedValue(sug('Awa'))
    const s = usePaymentSuggestions()
    s.query('awa'); await vi.advanceTimersByTimeAsync(200)
    s.query(' a ')
    expect(s.suggestions.value).toBeNull()
    await vi.advanceTimersByTimeAsync(500)
    expect(svc.suggest).toHaveBeenCalledTimes(1)
  })
  it('query_ignoresStaleResponse', async () => {
    let resolveFirst!: (_v: unknown) => void
    svc.suggest.mockReturnValueOnce(new Promise(r => { resolveFirst = r }))
    svc.suggest.mockResolvedValueOnce(sug('Nouveau'))
    const s = usePaymentSuggestions()
    s.query('ab'); await vi.advanceTimersByTimeAsync(200)
    s.query('abc'); await vi.advanceTimersByTimeAsync(200)
    resolveFirst(sug('Ancien')); await vi.advanceTimersByTimeAsync(0)
    expect(s.suggestions.value?.senders[0]?.name).toBe('Nouveau')
  })
  it('clear_dropsPendingTimerAndResponse', async () => {
    svc.suggest.mockResolvedValue(sug('Awa'))
    const s = usePaymentSuggestions()
    s.query('awa'); s.clear()
    await vi.advanceTimersByTimeAsync(500)
    expect(svc.suggest).not.toHaveBeenCalled(); expect(s.suggestions.value).toBeNull()
  })
  it('missingEndpoint_marksUnavailable', async () => {
    svc.suggest.mockRejectedValue(Object.assign(new Error('nf'), { statusCode: 404, data: {} }))
    const s = usePaymentSuggestions()
    s.query('awa'); await vi.advanceTimersByTimeAsync(200)
    expect(s.unavailable.value).toBe(true); expect(s.suggestions.value).toBeNull()
  })
  it('otherError_clearsSuggestions_staysAvailable', async () => {
    svc.suggest.mockRejectedValue(Object.assign(new Error('x'), { statusCode: 500 }))
    const s = usePaymentSuggestions()
    s.query('awa'); await vi.advanceTimersByTimeAsync(200)
    expect(s.unavailable.value).toBe(false); expect(s.suggestions.value).toBeNull()
  })
  it('exactFor_onlyForTheTextTheSuggestionsAnswered', async () => {
    svc.suggest.mockResolvedValue({ ...sug('Awa'), exactPaymentId: 'p9' })
    const s = usePaymentSuggestions()
    expect(s.exactFor('pi_1')).toBeNull()
    s.query(' pi_1 '); await vi.advanceTimersByTimeAsync(200)
    expect(s.answeredQuery.value).toBe('pi_1')
    expect(s.exactFor('pi_1 ')).toBe('p9')
    // Texte modifié depuis la réponse : la référence exacte ne vaut plus.
    expect(s.exactFor('pi_12')).toBeNull()
    s.query('pi_12')
    expect(s.exactFor('pi_12')).toBeNull()
    s.clear()
    expect(s.answeredQuery.value).toBeNull(); expect(s.exactFor('pi_1')).toBeNull()
  })
  it('exactFor_withoutExactId_null', async () => {
    svc.suggest.mockResolvedValue(sug('Awa'))
    const s = usePaymentSuggestions()
    s.query('awa'); await vi.advanceTimersByTimeAsync(200)
    expect(s.exactFor('awa')).toBeNull()
  })
})
