import { useAuthStore, type AdminUser } from '@/stores/auth'

export default defineNuxtPlugin(() => {
  if (!import.meta.dev) return
  const auth = useAuthStore()
  const w = window as unknown as {
    __donyAuth: ReturnType<typeof useAuthStore>
    __donyAuthSeed?: AdminUser | null
  }
  w.__donyAuth = auth
  // Re-hydrate the store on every page load from a seed injected via addInitScript.
  // null seed = unauthenticated E2E test (don't set session).
  if (w.__donyAuthSeed) {
    auth.setSession('fake-token', w.__donyAuthSeed)
  }
})
