import { describe, it, expect, vi, beforeEach } from 'vitest'

const users = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn() }))
vi.mock('@/features/mobile/services/mobileUsersService', () => ({ mobileUsersService: users }))

import { useMobileUserSearch } from '@/features/mobile/composables/useMobileUserSearch'

const u = (id: string) => ({ id, firstName: 'Aïcha', lastName: 'Traoré', email: null, phoneNumber: null })

describe('useMobileUserSearch', () => {
  beforeEach(() => { users.list.mockReset() })

  it('searches 5 results at most with the trimmed term, and marks the search done', async () => {
    users.list.mockResolvedValue({ content: [u('a')] })
    const s = useMobileUserSearch()
    await s.search('  Aïcha ')
    expect(users.list).toHaveBeenCalledWith('Aïcha', 5)
    expect(s.results.value.map(r => r.id)).toEqual(['a'])
    expect(s.searched.value).toBe(true)
    expect(s.searching.value).toBe(false)
  })

  it('under two characters: no request, results and state cleared', async () => {
    users.list.mockResolvedValue({ content: [u('a')] })
    const s = useMobileUserSearch()
    await s.search('Aï')
    await s.search(' a ')
    expect(users.list).toHaveBeenCalledTimes(1)
    expect(s.results.value).toEqual([])
    expect(s.searched.value).toBe(false)
  })

  it('a failure shows the problem message and empties the results', async () => {
    users.list.mockRejectedValue(Object.assign(new Error('x'), { statusCode: 500, data: { detail: 'Panne' } }))
    const s = useMobileUserSearch()
    await s.search('Aïcha')
    expect(s.error.value).toBe('Panne')
    expect(s.results.value).toEqual([])
    expect(s.searching.value).toBe(false)
  })

  it('a slow earlier answer (success or failure) never overwrites a newer one; clear() drops pending answers', async () => {
    let slowOk!: (_v: unknown) => void
    let slowKo!: (_e: unknown) => void
    users.list
      .mockImplementationOnce(() => new Promise((r) => { slowOk = r }))
      .mockImplementationOnce(() => new Promise((_r, j) => { slowKo = j }))
      .mockResolvedValueOnce({ content: [u('new')] })
    const s = useMobileUserSearch()
    const first = s.search('Ai')
    const second = s.search('Aïc')
    await s.search('Aïcha')
    slowOk({ content: [u('old')] }); slowKo(new Error('late'))
    await first; await second
    expect(s.results.value.map(r => r.id)).toEqual(['new'])
    expect(s.error.value).toBeNull()
    let pending!: (_v: unknown) => void
    users.list.mockImplementationOnce(() => new Promise((r) => { pending = r }))
    const late = s.search('Moussa')
    expect(s.searching.value).toBe(true)
    s.clear()
    pending({ content: [u('late')] }); await late
    expect(s.results.value).toEqual([])
    expect(s.searching.value).toBe(false)
    expect(s.searched.value).toBe(false)
  })
})
