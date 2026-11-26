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
  // `permissionAnyOf` : une seule de ces permissions suffit (page dont le contenu est filtré par le back).
  const anyOf = to.meta.permissionAnyOf as readonly AdminPermission[] | undefined
  if (anyOf && !anyOf.some(p => auth.can(p))) {
    return navigateTo('/denied')
  }
})
