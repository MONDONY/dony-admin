import type { AdminPermission } from '@/stores/auth'

declare module '#app' {
  interface PageMeta {
    /** Permission backend requise pour accéder à la page (vérifiée par le middleware admin-only). */
    permission?: AdminPermission
    pageTitle?: string
    pageSubtitle?: string
  }
}

export {}
