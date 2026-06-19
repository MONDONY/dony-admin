import { useAuthStore, type AdminUser } from '@/stores/auth'

export default defineNuxtPlugin(() => {
  if (!import.meta.dev) return
  const auth = useAuthStore()
  const w = window as unknown as {
    __donyAuth: ReturnType<typeof useAuthStore>
    __donyAuthSeed?: AdminUser
  }
  w.__donyAuth = auth
  // Re-hydrate the store on every page load from a seed injected via addInitScript.
  // Used by E2E tests to keep the session alive across full navigations.
  if (w.__donyAuthSeed) {
    auth.setSession('fake-token', w.__donyAuthSeed)
  }
})
