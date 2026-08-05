export type ManagedAdminRole = 'ADMIN' | 'SUPPORT'
export type AdminStatus = 'ACTIVE' | 'DISABLED'

export interface TemporaryCredentials {
  email: string
  temporaryPassword: string
}

export interface AdminAccount {
  id: string
  email: string
  role: 'SUPER_ADMIN' | ManagedAdminRole
  status: AdminStatus
  mustChangePassword: boolean
  createdAt: string | null
  lastLoginAt: string | null
}

export interface AdminAccountPage {
  content: AdminAccount[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}
