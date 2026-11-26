import { useAuthStore } from '@/stores/auth'
import { LOCK_ROUTE, isMobileAppPath, rememberReturnPath } from '@/features/mobile/lib/lockState'

const PUBLIC_ROUTES = ['/login', '/denied', LOCK_ROUTE]

export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.server) return
  if (PUBLIC_ROUTES.includes(to.path)) {
    return
  }
  const auth = useAuthStore()

  if (to.path === '/change-password' && !auth.isAuthenticated) return navigateTo('/login')

  if (!auth.isAuthenticated) {
    // App mobile : connexion par la page de verrouillage (dans la portée de l'app installée),
    // puis retour à la page demandée (notification touchée, lien profond).
    if (isMobileAppPath(to.path)) {
      rememberReturnPath(to.fullPath ?? to.path)
      return navigateTo(LOCK_ROUTE)
    }
    return navigateTo('/login')
  }

  if (auth.user?.mustChangePassword && to.path !== '/change-password') {
    return navigateTo('/change-password')
  }

  // Double authentification obligatoire : un admin sans second facteur inscrit ne quitte pas
  // la page d'inscription. `null` (état inconnu) ne force rien.
  if (auth.mfaEnrolled === false && !auth.mfaUnavailable
      && !auth.user?.mustChangePassword && to.path !== '/mfa-setup') {
    return navigateTo('/mfa-setup')
  }
})
