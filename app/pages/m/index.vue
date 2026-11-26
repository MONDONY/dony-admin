<script setup lang="ts">
import { useMobileTabs } from '@/features/mobile/composables/useMobileTabs'
import { useAuthStore } from '@/stores/auth'

definePageMeta({ layout: 'mobile', middleware: 'admin-only' })

// L'auth n'existe que côté client (firebase.client.ts, plugin attendu avant le montage de la
// page) : sur le serveur le store est vide, décider là enverrait tout le monde sur /denied.
const auth = useAuthStore()
const tabs = useMobileTabs()
if (!useNuxtApp().ssrContext) {
  if (!auth.isAuthenticated) await navigateTo('/login', { replace: true })
  else await navigateTo(tabs.value[0]?.to ?? '/denied', { replace: true })
}
</script>

<template>
  <div />
</template>
