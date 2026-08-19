import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/features/bids/services/bidsAdminService')
import { useAdminAnnouncements } from '@/features/bids/composables/useAdminAnnouncements'
import { bidsAdminService } from '@/features/bids/services/bidsAdminService'
const svc = bidsAdminService as any

const a1 = { id: 'a1', status: 'ACTIVE', travelerName: 'Awa', corridor: 'Lyon → Abidjan', departureDate: '2026-07-01', availableKg: 10, pricePerKg: 8 }
const a2 = { id: 'a2', status: 'FULL', travelerName: 'Boudou', corridor: 'Paris → Dakar', departureDate: '2026-07-15', availableKg: 0, pricePerKg: 12 }
const a3 = { id: 'a3', status: 'CANCELLED', travelerName: null, corridor: 'Marseille → Douala', departureDate: '2026-06-20', availableKg: 5, pricePerKg: 10 }

function seeded() {
  return useAdminAnnouncements()
}

describe('useAdminAnnouncements', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    svc.listAnnouncements = vi.fn()
    svc.removeAnnouncement = vi.fn()
    svc.restoreAnnouncement = vi.fn()
  })

  it('load fetches the page and stores its content', async () => {
    svc.listAnnouncements.mockResolvedValue({ content: [a1, a2, a3], totalElements: 3, totalPages: 1, number: 0, size: 20 })
    const s = seeded()
    await s.load()
    expect(s.announcements.value).toEqual([a1, a2, a3])
    expect(s.isLoading.value).toBe(false)
  })

  it('remove replaces the row at the correct index, in place, without changing the list length', async () => {
    svc.listAnnouncements.mockResolvedValue({ content: [a1, a2, a3], totalElements: 3, totalPages: 1, number: 0, size: 20 })
    const updated = { ...a2, status: 'REMOVED_BY_ADMIN' }
    svc.removeAnnouncement.mockResolvedValue(updated)
    const s = seeded()
    await s.load()
    await s.remove('a2', 'SUSPECTED_FRAUD', '')

    expect(s.announcements.value).toHaveLength(3)
    expect(s.announcements.value[1]).toEqual(updated)
    // Untouched rows keep their original value — this is a targeted splice at
    // index 1, not a rebuild of the whole array (reference equality doesn't
    // apply here: `ref()` deep-wraps array elements in reactive proxies).
    expect(s.announcements.value[0]).toEqual(a1)
    expect(s.announcements.value[2]).toEqual(a3)
  })

  it('remove transmet l’id, le motif catalogué et la note interne, sans rechargement complet', async () => {
    svc.listAnnouncements.mockResolvedValue({ content: [a1], totalElements: 1, totalPages: 1, number: 0, size: 20 })
    svc.removeAnnouncement.mockResolvedValue({ ...a1, status: 'REMOVED_BY_ADMIN' })
    const s = seeded()
    await s.load()
    expect(svc.listAnnouncements).toHaveBeenCalledTimes(1)

    await s.remove('a1', 'SUSPECTED_FRAUD', 'ticket #4821')

    expect(svc.removeAnnouncement).toHaveBeenCalledWith('a1', 'SUSPECTED_FRAUD', 'ticket #4821')
    // The core regression this test guards against: a naive fix could call
    // load()/listAnnouncements again instead of splicing the returned row.
    expect(svc.listAnnouncements).toHaveBeenCalledTimes(1)
  })

  it('restore replaces the row at the correct index and calls the service with just the id', async () => {
    const removed = { ...a1, status: 'REMOVED_BY_ADMIN' }
    svc.listAnnouncements.mockResolvedValue({ content: [removed, a2], totalElements: 2, totalPages: 1, number: 0, size: 20 })
    const restored = { ...a1, status: 'ACTIVE' }
    svc.restoreAnnouncement.mockResolvedValue(restored)
    const s = seeded()
    await s.load()

    await s.restore('a1')

    expect(svc.restoreAnnouncement).toHaveBeenCalledWith('a1')
    expect(s.announcements.value).toHaveLength(2)
    expect(s.announcements.value[0]).toEqual(restored)
    expect(svc.listAnnouncements).toHaveBeenCalledTimes(1)
  })

  it('remove does nothing to the list if the id is not present (defensive, no crash)', async () => {
    svc.listAnnouncements.mockResolvedValue({ content: [a1], totalElements: 1, totalPages: 1, number: 0, size: 20 })
    svc.removeAnnouncement.mockResolvedValue({ ...a2, status: 'REMOVED_BY_ADMIN' })
    const s = seeded()
    await s.load()
    await s.remove('a2', 'OTHER', '')
    expect(s.announcements.value).toEqual([a1])
  })

  it('busy is true while the remove call is in flight and false once settled', async () => {
    svc.listAnnouncements.mockResolvedValue({ content: [a1], totalElements: 1, totalPages: 1, number: 0, size: 20 })
    let resolveRemove!: (_value: unknown) => void
    svc.removeAnnouncement.mockReturnValue(new Promise((resolve) => { resolveRemove = resolve }))
    const s = seeded()
    await s.load()

    const p = s.remove('a1', 'OTHER', '')
    expect(s.busy.value).toBe(true)
    resolveRemove({ ...a1, status: 'REMOVED_BY_ADMIN' })
    await p
    expect(s.busy.value).toBe(false)
  })

  it('on a 409-style error, error.value carries the backend detail message, not the raw fetch error', async () => {
    svc.listAnnouncements.mockResolvedValue({ content: [a1], totalElements: 1, totalPages: 1, number: 0, size: 20 })
    const fetchError = Object.assign(new Error('[POST] "/admin/announcements/a1/remove": 409 Conflict'), {
      data: { type: 'https://yadony.app/errors/announcement-has-accepted-bids', title: 'Announcement Has Accepted Bids', status: 409, detail: 'Des colis acceptés sont en cours sur cette annonce.' },
    })
    svc.removeAnnouncement.mockRejectedValue(fetchError)
    const s = seeded()
    await s.load()

    await s.remove('a1', 'OTHER', '')

    expect(s.error.value).toBe('Des colis acceptés sont en cours sur cette annonce.')
    expect(s.busy.value).toBe(false)
    // The row must stay untouched — a failed action does not corrupt the list.
    expect(s.announcements.value).toEqual([a1])
  })

  it('falls back to the generic error message when the backend response has no detail field', async () => {
    svc.listAnnouncements.mockResolvedValue({ content: [a1], totalElements: 1, totalPages: 1, number: 0, size: 20 })
    svc.removeAnnouncement.mockRejectedValue(new Error('network down'))
    const s = seeded()
    await s.load()
    await s.remove('a1', 'OTHER', '')
    expect(s.error.value).toBe('network down')
  })

  it('a new action clears the previous error', async () => {
    svc.listAnnouncements.mockResolvedValue({ content: [a1], totalElements: 1, totalPages: 1, number: 0, size: 20 })
    svc.removeAnnouncement.mockRejectedValueOnce(new Error('oops'))
    svc.restoreAnnouncement.mockResolvedValue({ ...a1, status: 'ACTIVE' })
    const s = seeded()
    await s.load()
    await s.remove('a1', 'OTHER', '')
    expect(s.error.value).toBe('oops')

    await s.restore('a1')
    expect(s.error.value).toBeNull()
  })
})
