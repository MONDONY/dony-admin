import { useAuthStore } from '@/stores/auth'

export default defineNuxtPlugin(() => {
  useAuthStore().rehydrate()
})
