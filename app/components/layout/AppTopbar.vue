<script setup lang="ts">
import { ArrowLeft, ChevronRight, LogOut } from 'lucide-vue-next'
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import ThemeToggle from '@/components/ui/ThemeToggle.vue'
import NotificationBell from '@/features/notifications/components/NotificationBell.vue'
import GlobalSearch from '@/features/search/components/GlobalSearch.vue'
import { useFirebaseAuth } from '@/features/auth/composables/useFirebaseAuth'
import { useNotificationsStore } from '@/stores/notifications'
import { formatTabTitle } from '@/features/notifications/lib/format'
import type { Crumb } from './breadcrumb'

defineProps<{
  title: string
  subtitle?: string
  /** Fil d'Ariane de la page : vide sur l'accueil et hors menu. */
  crumbs?: Crumb[]
  /** Présent : un bouton « Retour » s'affiche (page de détail). */
  backTo?: string | null
}>()
const emit = defineEmits<{ back: [] }>()

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
    <div class="flex min-w-0 items-center gap-3">
      <button
        v-if="backTo" type="button" data-test="topbar-back" aria-label="Retour"
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-btn border border-border text-text-muted transition-colors hover:bg-surface-elevated hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        @click="emit('back')"
      >
        <ArrowLeft class="h-4 w-4" />
      </button>
      <div class="min-w-0">
        <nav v-if="crumbs?.length" aria-label="Fil d’Ariane" data-test="breadcrumb">
          <ol class="flex items-center gap-1 text-xs leading-tight text-text-muted">
            <!-- Étroit : seuls les deux derniers maillons restent, le reste est caché au lieu d'être tronqué en « A… C… ». -->
            <li v-for="(c, i) in crumbs" :key="i" class="min-w-0 items-center gap-1" :class="i < crumbs.length - 2 ? 'hidden sm:flex' : 'flex'">
              <ChevronRight v-if="i > 0" class="h-3 w-3 shrink-0" :class="i === crumbs.length - 2 ? 'hidden sm:block' : ''" aria-hidden="true" />
              <NuxtLink v-if="c.to" :to="c.to" class="truncate rounded-xs hover:text-primary hover:underline">{{ c.label }}</NuxtLink>
              <span v-else class="truncate" :class="i === crumbs.length - 1 ? 'font-medium text-text' : ''" :aria-current="i === crumbs.length - 1 ? 'page' : undefined">{{ c.label }}</span>
            </li>
          </ol>
        </nav>
        <div class="flex items-baseline gap-3">
          <h1 class="font-display text-xl font-bold leading-tight">{{ title }}</h1>
          <p v-if="subtitle" class="hidden truncate text-sm text-text-muted lg:block">{{ subtitle }}</p>
        </div>
      </div>
    </div>
    <div class="flex items-center gap-2">
      <ClientOnly><GlobalSearch /></ClientOnly>
      <ThemeToggle />
      <NotificationBell />
      <Button variant="ghost" size="icon" aria-label="Se déconnecter" @click="logout"><LogOut class="w-4 h-4" /></Button>
    </div>
  </header>
</template>
