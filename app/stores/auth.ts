import { defineStore } from 'pinia'

export type AdminRole = 'SUPER_ADMIN' | 'ADMIN' | 'SUPPORT'

/** Miroir exact de com.yadony.api.admin.account.AdminPermission (25 permissions). */
export type AdminPermission =
  | 'ADMIN_MANAGE'
  | 'METRICS_VIEW'
  | 'USER_VIEW'
  | 'USER_SUSPEND'
  | 'USER_BAN'
  | 'USER_KYC'
  | 'USER_GDPR_DELETE'
  | 'USER_COMMISSION'
  | 'PAYMENT_VIEW'
  | 'PAYMENT_RELEASE'
  | 'PAYMENT_REFUND'
  | 'BID_VIEW'
  | 'DISPUTE_VIEW'
  | 'DISPUTE_RESOLVE'
  | 'ALERT_VIEW'
  | 'ALERT_RESOLVE'
  | 'MODERATION_VIEW'
  | 'MESSAGE_DELETE'
  | 'REPORT_VIEW'
  | 'REPORT_RESOLVE'
  | 'RATING_MODERATE'
  | 'PROMO_MANAGE'
  | 'AUDIT_VIEW'
  | 'EXPORT_RUN'

export const ALL_PERMISSIONS: readonly AdminPermission[] = [
  'ADMIN_MANAGE',
  'METRICS_VIEW',
  'USER_VIEW',
  'USER_SUSPEND',
  'USER_BAN',
  'USER_KYC',
  'USER_GDPR_DELETE',
  'USER_COMMISSION',
  'PAYMENT_VIEW',
  'PAYMENT_RELEASE',
  'PAYMENT_REFUND',
  'BID_VIEW',
  'DISPUTE_VIEW',
  'DISPUTE_RESOLVE',
  'ALERT_VIEW',
  'ALERT_RESOLVE',
  'MODERATION_VIEW',
  'MESSAGE_DELETE',
  'REPORT_VIEW',
  'REPORT_RESOLVE',
  'RATING_MODERATE',
  'PROMO_MANAGE',
  'AUDIT_VIEW',
  'EXPORT_RUN',
]

/**
 * Permissions de base par rôle — miroir de AdminRole.permissions() côté backend :
 * - SUPER_ADMIN : toutes
 * - ADMIN : toutes sauf ADMIN_MANAGE
 * - SUPPORT : 15 permissions lecture + actions limitées
 */
const ROLE_PERMISSIONS: Record<AdminRole, readonly AdminPermission[]> = {
  SUPER_ADMIN: ALL_PERMISSIONS,
  ADMIN: ALL_PERMISSIONS.filter((p) => p !== 'ADMIN_MANAGE'),
  SUPPORT: [
    'METRICS_VIEW',
    'USER_VIEW',
    'USER_SUSPEND',
    'USER_BAN',
    'USER_KYC',
    'PAYMENT_VIEW',
    'BID_VIEW',
    'DISPUTE_VIEW',
    'ALERT_VIEW',
    'ALERT_RESOLVE',
    'MODERATION_VIEW',
    'MESSAGE_DELETE',
    'REPORT_VIEW',
    'REPORT_RESOLVE',
    'RATING_MODERATE',
  ],
}

/**
 * Calcule les permissions effectives — miroir de AdminPermissions.effective() :
 * - SUPER_ADMIN ignore les overrides
 * - autres rôles : base + overrides (true = accorde, false = révoque)
 * - noms de permission invalides silencieusement ignorés
 */
export function effectivePermissions(
  role: AdminRole,
  overrides: Record<string, boolean> | null | undefined,
): Set<AdminPermission> {
  const set = new Set<AdminPermission>(ROLE_PERMISSIONS[role])
  if (role === 'SUPER_ADMIN') return set
  for (const [name, granted] of Object.entries(overrides ?? {})) {
    if (!(ALL_PERMISSIONS as readonly string[]).includes(name)) continue
    if (granted) set.add(name as AdminPermission)
    else set.delete(name as AdminPermission)
  }
  return set
}

export interface AdminUser {
  id: string
  email: string
  role: AdminRole
  status: string
  mustChangePassword: boolean
  permissionOverrides: Record<string, boolean>
}

interface AuthState {
  idToken: string | null
  user: AdminUser | null
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    idToken: null,
    user: null,
  }),
  getters: {
    isAuthenticated: (state): boolean =>
      state.idToken !== null && state.user !== null,
    /**
     * Accès au back-office : les trois rôles (le backend accorde ROLE_ADMIN à
     * SUPER_ADMIN, ADMIN et SUPPORT). Le contrôle fin se fait par permission
     * via `can()` — jamais uniquement via isAdmin.
     */
    isAdmin: (state): boolean =>
      state.user?.role === 'SUPER_ADMIN' || state.user?.role === 'ADMIN' || state.user?.role === 'SUPPORT',
    isSupport: (state): boolean =>
      state.user?.role === 'SUPPORT',
    /** Permissions effectives (base du rôle + overrides), recalculées à chaque changement d'utilisateur. */
    permissions(state): Set<AdminPermission> {
      if (!state.user) return new Set()
      return effectivePermissions(state.user.role, state.user.permissionOverrides)
    },
    /** `auth.can('PAYMENT_REFUND')` — source unique de vérité côté front. */
    can(): (permission: AdminPermission) => boolean {
      return (permission) => this.permissions.has(permission)
    },
  },
  actions: {
    setSession(token: string, user: AdminUser) {
      this.idToken = token
      this.user = user
    },
    clear() {
      this.idToken = null
      this.user = null
    },
  },
})
