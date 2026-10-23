import { defineStore } from 'pinia'

export type AdminRole = 'SUPER_ADMIN' | 'ADMIN' | 'SUPPORT'

/** Miroir exact de com.yadony.api.admin.account.AdminPermission (39 permissions). */
export type AdminPermission =
  | 'ADMIN_MANAGE'
  | 'METRICS_VIEW'
  | 'USER_VIEW'
  | 'USER_SUSPEND'
  | 'USER_BAN'
  | 'USER_KYC'
  | 'USER_GDPR_DELETE'
  | 'USER_DELETE'
  | 'USER_COMMISSION'
  | 'USER_PRO_GRANT'
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
  | 'CONTENT_REMOVE'
  | 'USER_MESSAGE_MUTE'
  | 'REPORT_VIEW'
  | 'REPORT_RESOLVE'
  | 'REPORT_DELETE'
  | 'RATING_MODERATE'
  | 'RATING_DELETE'
  | 'PROMO_MANAGE'
  | 'GP_PRO_REVIEW'
  | 'AUDIT_VIEW'
  | 'EXPORT_RUN'
  | 'NOTIFICATION_SEND'
  | 'CONFIG_MANAGE'
  | 'SUPPORT_TICKET_VIEW'
  | 'SUPPORT_TICKET_MANAGE'
  | 'WALLET_ADJUST'
  | 'KYC_DECIDE'
  | 'TOPUP_CODE_MANAGE'
  | 'ASSISTANT_MANAGE'

export const ALL_PERMISSIONS: readonly AdminPermission[] = [
  'ADMIN_MANAGE',
  'METRICS_VIEW',
  'USER_VIEW',
  'USER_SUSPEND',
  'USER_BAN',
  'USER_KYC',
  'USER_GDPR_DELETE',
  'USER_DELETE',
  'USER_COMMISSION',
  // Offrir ou révoquer un accès PRO gratuit : même portée commerciale que
  // USER_COMMISSION côté backend, donc accordée aux mêmes rôles.
  'USER_PRO_GRANT',
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
  'CONTENT_REMOVE',
  'USER_MESSAGE_MUTE',
  'REPORT_VIEW',
  'REPORT_RESOLVE',
  'REPORT_DELETE',
  'RATING_MODERATE',
  'RATING_DELETE',
  'PROMO_MANAGE',
  // Examiner les demandes GP Pro, accorder et retirer le badge : un signal de confiance
  // montré aux expéditeurs, jamais accordé au rôle SUPPORT (yadony-back #560).
  'GP_PRO_REVIEW',
  'AUDIT_VIEW',
  'EXPORT_RUN',
  // Lot D — ni l'une ni l'autre n'appartient au rôle SUPPORT.
  'NOTIFICATION_SEND',
  'CONFIG_MANAGE',
  // Messagerie support : voir la file, puis répondre/assigner/résoudre.
  'SUPPORT_TICKET_VIEW',
  'SUPPORT_TICKET_MANAGE',
  // Correction manuelle d'un solde de portefeuille (crédit ou débit motivé) : un geste
  // d'argent, donc ni au rôle SUPPORT ni lié à PAYMENT_VIEW qui ne fait que lire.
  'WALLET_ADJUST',
  // Valider, refuser ou révoquer une identité à la main : engage la plateforme sur l'identité
  // d'un utilisateur (publications, paiements, versements). Ni au rôle SUPPORT, qui garde
  // USER_KYC pour consulter la file et réinitialiser une vérification.
  'KYC_DECIDE',
  // Codes de recharge du solde : créer de l'argent (crédit non remboursable). Ni au rôle SUPPORT.
  'TOPUP_CODE_MANAGE',
  // Assistant IA : clés d'API des fournisseurs. Jamais au rôle SUPPORT (une clé est un secret).
  'ASSISTANT_MANAGE',
]

/**
 * Permissions de base par rôle — miroir de AdminRole.permissions() côté backend :
 * - SUPER_ADMIN : toutes
 * - ADMIN : toutes sauf ADMIN_MANAGE
 * - SUPPORT : 15 permissions, lecture + actions limitées (ni suspendre, ni bannir, ni couper la messagerie)
 */
const ROLE_PERMISSIONS: Record<AdminRole, readonly AdminPermission[]> = {
  SUPER_ADMIN: ALL_PERMISSIONS,
  ADMIN: ALL_PERMISSIONS.filter((p) => p !== 'ADMIN_MANAGE'),
  SUPPORT: [
    'METRICS_VIEW',
    'USER_VIEW',
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
    // La messagerie support est le coeur du métier de ce rôle.
    'SUPPORT_TICKET_VIEW',
    'SUPPORT_TICKET_MANAGE',
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
    can() {
      return (permission: AdminPermission): boolean => this.permissions.has(permission)
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
