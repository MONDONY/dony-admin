import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore, type AdminUser, type AdminRole } from '@/stores/auth'

export const makeAdmin = (
  role: AdminRole = 'ADMIN',
  overrides: Record<string, boolean> = {},
): AdminUser => ({
  id: 'u1',
  email: 'admin@yadony.com',
  role,
  status: 'ACTIVE',
  mustChangePassword: false,
  permissionOverrides: overrides,
})

/**
 * Initialise une Pinia fraîche et seed une session admin.
 * À appeler dans beforeEach des specs de composants qui utilisent auth.can().
 */
export function seedAuth(
  role: AdminRole = 'ADMIN',
  overrides: Record<string, boolean> = {},
): ReturnType<typeof useAuthStore> {
  setActivePinia(createPinia())
  const auth = useAuthStore()
  auth.setSession('test-token', makeAdmin(role, overrides))
  return auth
}
