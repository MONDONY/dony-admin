import { useAuthStore } from '@/stores/auth'

export default defineNuxtRouteMiddleware(() => {
  if (import.meta.server) return
  const auth = useAuthStore()
  if (!auth.isAdmin) {
    return navigateTo('/denied')
  }
})
