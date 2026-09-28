<script setup lang="ts">
import { LogOut } from 'lucide-vue-next'
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import ThemeToggle from '@/components/ui/ThemeToggle.vue'
import NotificationBell from '@/features/notifications/components/NotificationBell.vue'
import { useFirebaseAuth } from '@/features/auth/composables/useFirebaseAuth'
import { useNotificationsStore } from '@/stores/notifications'
import { formatTabTitle } from '@/features/notifications/lib/format'

defineProps<{ title: string; subtitle?: string }>()

const DEFAULT_TITLE = 'Yadony ADMIN'
const notifications = useNotificationsStore()

// « (3) Yadony ADMIN » : les nouveautés se voient depuis un autre onglet.
// Les compteurs sont lus dans le computed lui-même (pas dans la fonction) : sinon il ne
// dépendrait de rien et le titre ne suivrait jamais la pastille.
useHead(computed(() => {
  const unread = notifications.unavailable ? 0 : notifications.unreadCount
  const capped = notifications.unreadCapped
  return { titleTemplate: (t?: string) => formatTabTitle(t || DEFAULT_TITLE, unread, capped) }
}))

async function logout() {
  const { signOut } = useFirebaseAuth()
  await signOut()
}
</script>

<template>
  <header class="h-topbar shrink-0 bg-surface border-b border-border flex items-center justify-between px-6">
    <div>
      <h1 class="font-display text-xl font-bold">{{ title }}</h1>
      <p v-if="subtitle" class="text-sm text-text-muted">{{ subtitle }}</p>
    </div>
    <div class="flex items-center gap-2">
      <ThemeToggle />
      <NotificationBell />
      <Button variant="ghost" size="icon" aria-label="Se déconnecter" @click="logout"><LogOut class="w-4 h-4" /></Button>
    </div>
  </header>
</template>
