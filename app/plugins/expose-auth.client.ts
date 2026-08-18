import { useAuthStore, type AdminUser } from '@/stores/auth'

export default defineNuxtPlugin(() => {
  if (!import.meta.dev) return
  const auth = useAuthStore()
  const w = window as unknown as {
    __yadonyAuth: ReturnType<typeof useAuthStore>
    __yadonyAuthSeed?: AdminUser | null
  }
  w.__yadonyAuth = auth
  // Re-hydrate the store on every page load from a seed injected via addInitScript.
  // null seed = unauthenticated E2E test (don't set session).
  if (w.__yadonyAuthSeed) {
    auth.setSession('fake-token', w.__yadonyAuthSeed)
  }
})
