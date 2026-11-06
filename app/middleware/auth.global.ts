import { useAuthStore } from '@/stores/auth'

const PUBLIC_ROUTES = ['/login', '/denied']

export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.server) return
  if (PUBLIC_ROUTES.includes(to.path)) {
    return
  }
  const auth = useAuthStore()

  if (to.path === '/change-password' && !auth.isAuthenticated) return navigateTo('/login')

  if (!auth.isAuthenticated) {
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
