import { describe, it, expect } from 'vitest'
import { userStatusMeta } from '@/features/users/components/userStatus'

describe('userStatusMeta', () => {
  it('maps all statuses to label + tone', () => {
    expect(userStatusMeta('ACTIVE')).toEqual({ label: 'Actif', tone: 'success' })
    expect(userStatusMeta('SUSPENDED')).toEqual({ label: 'Suspendu', tone: 'warning' })
    expect(userStatusMeta('BANNED')).toEqual({ label: 'Banni', tone: 'danger' })
    expect(userStatusMeta('PENDING_DELETION')).toEqual({ label: 'Suppression', tone: 'neutral' })
  })
})
