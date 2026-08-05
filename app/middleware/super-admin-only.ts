import { useAuthStore } from '@/stores/auth'

export default defineNuxtRouteMiddleware(() => {
  if (import.meta.server) return
  const auth = useAuthStore()
  if (auth.user?.role !== 'SUPER_ADMIN') {
    return navigateTo('/denied')
  }
})
