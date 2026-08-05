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
})
