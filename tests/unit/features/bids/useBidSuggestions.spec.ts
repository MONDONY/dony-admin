import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
vi.mock('@/features/bids/services/bidsAdminService')
import { useBidSuggestions } from '@/features/bids/composables/useBidSuggestions'
import { bidsAdminService } from '@/features/bids/services/bidsAdminService'
import type { AdminBidSuggest } from '@/features/bids/types/index'
const svc = bidsAdminService as any

const sug = (name: string): AdminBidSuggest => ({ senders: [{ id: 's', name, count: 1 }], travelers: [], recipients: [], trips: [], parcels: [] })

describe('useBidSuggestions', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); svc.suggest = vi.fn() })
  afterEach(() => vi.useRealTimers())

  it('query_debounces200ms', async () => {
    svc.suggest.mockResolvedValue(sug('Awa'))
    const s = useBidSuggestions()
    s.query('aw'); s.query('awa')
    await vi.advanceTimersByTimeAsync(199)
    expect(svc.suggest).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(svc.suggest).toHaveBeenCalledTimes(1); expect(svc.suggest).toHaveBeenCalledWith('awa')
    expect(s.suggestions.value?.senders[0]?.name).toBe('Awa'); expect(s.isLoading.value).toBe(false)
  })
  it('query_shorterThanTwo_clears', async () => {
    svc.suggest.mockResolvedValue(sug('Awa'))
    const s = useBidSuggestions()
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
    const s = useBidSuggestions()
    s.query('ab'); await vi.advanceTimersByTimeAsync(200)
    s.query('abc'); await vi.advanceTimersByTimeAsync(200)
    resolveFirst(sug('Ancien')); await vi.advanceTimersByTimeAsync(0)
    expect(s.suggestions.value?.senders[0]?.name).toBe('Nouveau'); expect(s.isLoading.value).toBe(false)
  })
  it('query_missingEndpoint_marksUnavailable', async () => {
    svc.suggest.mockRejectedValue(Object.assign(new Error('nf'), { statusCode: 405, data: {} }))
    const s = useBidSuggestions()
    s.query('abc'); await vi.advanceTimersByTimeAsync(200)
    expect(s.unavailable.value).toBe(true); expect(s.suggestions.value).toBeNull()
  })
  it('clear_resets', async () => {
    svc.suggest.mockResolvedValue(sug('Awa'))
    const s = useBidSuggestions()
    s.query('abc'); await vi.advanceTimersByTimeAsync(200)
    s.query('abcd'); s.clear()
    await vi.advanceTimersByTimeAsync(500)
    expect(s.suggestions.value).toBeNull(); expect(svc.suggest).toHaveBeenCalledTimes(1)
  })
})
