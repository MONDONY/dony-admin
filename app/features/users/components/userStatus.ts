import type { UserStatus } from '@/features/users/types/index'

export function userStatusMeta(status: UserStatus): { label: string; tone: 'success' | 'danger' | 'warning' | 'neutral' } {
  switch (status) {
    case 'ACTIVE': return { label: 'Actif', tone: 'success' }
    case 'SUSPENDED': return { label: 'Suspendu', tone: 'warning' }
    case 'BANNED': return { label: 'Banni', tone: 'danger' }
    case 'PENDING_DELETION': return { label: 'Suppression', tone: 'neutral' }
  }
}
