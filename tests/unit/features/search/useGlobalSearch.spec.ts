import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { seedAuth } from '~/tests/helpers/auth'
import { useGlobalSearch } from '@/features/search/composables/useGlobalSearch'
import type { SearchSource } from '@/features/search/services/globalSearchService'

function deferred<T>() {
  let resolve!: (_value: T) => void
  const promise = new Promise<T>((r) => { resolve = r })
  return { promise, resolve }
}

describe('useGlobalSearch', () => {
  beforeEach(() => { vi.useFakeTimers(); seedAuth('SUPPORT') })
  afterEach(() => vi.useRealTimers())

  it('pages tout de suite, données après la pause, seulement les sources permises', async () => {
    const users = vi.fn().mockResolvedValue([{ key: 'users:1', group: 'users', title: 'Awa', to: '/users' }])
    const payments = vi.fn().mockResolvedValue([])
    const sources: SearchSource[] = [
      { group: 'users', label: 'Utilisateurs', permission: 'USER_VIEW', run: users },
      { group: 'payments', label: 'Paiements', permission: 'ADMIN_MANAGE', run: payments },
    ]
    const s = useGlobalSearch(sources)
    s.query.value = 'a'
    await nextTick()
    expect(s.groups.value).toEqual([])
    s.query.value = 'awa'
    await nextTick()
    expect(users).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(200)
    expect(users).toHaveBeenCalledWith('awa')
    expect(payments).not.toHaveBeenCalled()
    expect(s.groups.value).toEqual([{ group: 'users', label: 'Utilisateurs', loading: false, failed: false, items: [expect.objectContaining({ title: 'Awa' })] }])
    expect(s.searching.value).toBe(false)
  })

  it('une source en panne est marquée sans bloquer les autres', async () => {
    const sources: SearchSource[] = [
      { group: 'users', label: 'Utilisateurs', permission: 'USER_VIEW', run: vi.fn().mockRejectedValue(new Error('500')) },
      { group: 'support', label: 'Support', permission: 'SUPPORT_TICKET_VIEW', run: vi.fn().mockResolvedValue([]) },
    ]
    const s = useGlobalSearch(sources)
    await s.runSearch('awa')
    expect(s.groups.value.map(g => [g.group, g.failed])).toEqual([['users', true], ['support', false]])
  })

  it('une réponse d’une saisie dépassée est ignorée ; reset vide tout', async () => {
    const slow = deferred<never[]>()
    const run = vi.fn().mockReturnValueOnce(slow.promise).mockResolvedValueOnce([{ key: 'users:2', group: 'users', title: 'Moussa', to: '/users' }])
    const s = useGlobalSearch([{ group: 'users', label: 'Utilisateurs', permission: 'USER_VIEW', run }])
    const first = s.runSearch('awa')
    await s.runSearch('moussa')
    slow.resolve([])
    await first
    expect(s.groups.value[0].items[0].title).toBe('Moussa')
    s.query.value = 'zz'
    await nextTick()
    s.reset()
    await vi.advanceTimersByTimeAsync(300)
    expect(s.query.value).toBe('')
    expect(s.groups.value).toEqual([])
  })
})
