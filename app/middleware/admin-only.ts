import { useAuthStore, type AdminPermission } from '@/stores/auth'

export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.server) return
  const auth = useAuthStore()
  if (!auth.isAdmin) {
    return navigateTo('/denied')
  }
  // Contrôle fin par permission : chaque page déclare `permission` dans
  // definePageMeta — miroir des @PreAuthorize("hasAuthority(...)") du backend.
  const permission = to.meta.permission as AdminPermission | undefined
  if (permission && !auth.can(permission)) {
    return navigateTo('/denied')
  }
})
