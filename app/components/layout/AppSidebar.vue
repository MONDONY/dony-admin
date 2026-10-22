<script setup lang="ts">
import { KeyRound, Keyboard } from 'lucide-vue-next'
import { computed, inject, onBeforeUnmount, onMounted, ref } from 'vue'
import { routeLocationKey } from 'vue-router'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useAuthStore, type AdminPermission } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'
import { navBadges } from '@/features/notifications/lib/navBadges'
import NavItem from './NavItem.vue'
import NavGroup from './NavGroup.vue'
import { HOME_ENTRY, NAV_GROUPS, type NavEntry } from './navConfig'
import { useNavCollapse } from './useNavCollapse'
import { useShortcutsHelp } from '@/composables/useShortcuts'

const auth = useAuthStore()
const initials = computed(() =>
  auth.user?.email?.slice(0, 2).toUpperCase() ?? '?',
)
const can = (p: AdminPermission) => auth.can(p)

// Compteurs du menu : même source (et même minuteur) que la cloche de la barre du haut.
const notifications = useNotificationsStore()
const badges = computed(() => (notifications.unavailable ? {} : navBadges(notifications.counts)))
const badgeProps = (to: string) => {
  const b = badges.value[to]
  return b ? { badge: b.count, badgeTone: b.tone } : {}
}

// Groupes du menu : n'affichent que les entrées autorisées ; un groupe sans entrée disparaît.
const visibleGroups = computed(() =>
  NAV_GROUPS
    .map(g => ({ ...g, entries: g.entries.filter(e => can(e.permission)) }))
    .filter(g => g.entries.length > 0),
)
const route = inject(routeLocationKey, null)
const isActive = (e: NavEntry) => {
  const path = route?.path
  if (!path) return false
  return e.to === '/' ? path === '/' : path === e.to || path.startsWith(`${e.to}/`)
}
const { isOpen, toggle } = useNavCollapse()
const groupOpen = (g: { id: string; entries: NavEntry[] }) => isOpen(g.id) || g.entries.some(isActive)
const groupBadge = (g: { entries: NavEntry[] }) => {
  const list = g.entries.map(e => badges.value[e.to]).filter((b): b is NonNullable<typeof b> => !!b)
  return {
    badge: list.reduce((n, b) => n + b.count, 0),
    badgeTone: list.some(b => b.tone === 'danger') ? ('danger' as const) : ('neutral' as const),
  }
}
const shortcutsHelp = useShortcutsHelp()

let unsubscribeNotifications: (() => void) | null = null

const showProfileMenu = ref(false)
const profileMenuRef = ref<HTMLElement | null>(null)

function closeProfileMenu() {
  showProfileMenu.value = false
}

function onDocumentClick(e: MouseEvent) {
  if (profileMenuRef.value && !profileMenuRef.value.contains(e.target as Node)) {
    closeProfileMenu()
  }
}

function onDocumentKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') closeProfileMenu()
}

onMounted(() => {
  unsubscribeNotifications = notifications.subscribe()
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onDocumentKeydown)
})
onBeforeUnmount(() => {
  unsubscribeNotifications?.()
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onDocumentKeydown)
})
</script>

<template>
  <aside class="w-sidebar shrink-0 bg-surface border-r border-border flex flex-col">
    <div class="px-6 py-5 border-b border-border">
      <NuxtLink to="/" class="flex items-center gap-2">
        <img src="/logos/logo-yadony.png" alt="Yadony" class="h-7 w-auto" />
        <span class="text-text">ADMIN</span>
      </NuxtLink>
    </div>

    <ClientOnly>
      <div ref="profileMenuRef" class="relative border-b border-border">
        <button
          type="button" data-test="profile-menu-trigger"
          class="w-full px-4 py-4 flex items-center gap-3 text-left hover:bg-surface-elevated transition-colors"
          aria-haspopup="menu" :aria-expanded="showProfileMenu"
          @click="showProfileMenu = !showProfileMenu"
        >
          <Avatar>
            <AvatarFallback class="bg-primary text-white text-sm">{{ initials }}</AvatarFallback>
          </Avatar>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium truncate">{{ auth.user?.email }}</p>
            <span class="text-xs bg-danger/20 text-danger px-1.5 py-0.5 rounded">{{ auth.user?.role }}</span>
          </div>
        </button>

        <Transition
          enter-active-class="transition duration-100 ease-out"
          enter-from-class="opacity-0 -translate-y-1"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition duration-75 ease-in"
          leave-from-class="opacity-100 translate-y-0"
          leave-to-class="opacity-0 -translate-y-1"
        >
          <div
            v-if="showProfileMenu" role="menu" data-test="profile-menu"
            class="absolute left-2 right-2 top-full z-10 mt-1 rounded-card border border-border bg-surface shadow-lg overflow-hidden"
          >
            <NuxtLink
              to="/change-password" role="menuitem" data-test="profile-change-password"
              class="flex items-center gap-2 px-3 py-2 text-sm text-text hover:bg-surface-elevated transition-colors"
              @click="closeProfileMenu"
            >
              <KeyRound class="w-4 h-4" />
              Changer mon mot de passe
            </NuxtLink>
            <button
              type="button" role="menuitem" data-test="profile-shortcuts"
              class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text hover:bg-surface-elevated transition-colors"
              @click="closeProfileMenu(); shortcutsHelp.show()"
            >
              <Keyboard class="w-4 h-4" />
              Raccourcis clavier
              <kbd class="ml-auto rounded border border-border px-1.5 text-[11px] text-text-muted">?</kbd>
            </button>
          </div>
        </Transition>
      </div>
      <template #fallback>
        <div class="px-4 py-4 border-b border-border flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-primary/20 animate-pulse" />
          <div class="flex-1 space-y-1">
            <div class="h-3 bg-border rounded w-24 animate-pulse" />
            <div class="h-3 bg-border rounded w-8 animate-pulse" />
          </div>
        </div>
      </template>
    </ClientOnly>

    <!--
      Sous ClientOnly, comme le bloc profil juste au-dessus : `can()` dépend de `auth.user`,
      que seul le plugin Firebase côté client peuple. Au rendu serveur, toutes les
      permissions sont donc fausses et la nav sortait VIDE dans le HTML servi, avant que
      l'hydratation n'ajoute les quinze entrées — décalage d'hydratation à chaque chargement
      et navigation absente au premier paint.
    -->
    <ClientOnly>
      <template #fallback>
        <nav class="flex-1 px-3 py-4 space-y-1" aria-hidden="true">
          <div v-for="i in 8" :key="i" class="h-9 rounded-btn bg-border/40 animate-pulse" />
        </nav>
      </template>
    <nav class="flex-1 px-3 py-4 space-y-3 overflow-y-auto" aria-label="Navigation principale">
      <NavItem v-if="can(HOME_ENTRY.permission)" :to="HOME_ENTRY.to" :label="HOME_ENTRY.label">
        <template #icon><component :is="HOME_ENTRY.icon" class="w-4 h-4" /></template>
      </NavItem>
      <NavGroup
        v-for="g in visibleGroups" :id="g.id" :key="g.id" :label="g.label"
        :open="groupOpen(g)" :active="g.entries.some(isActive)"
        v-bind="groupBadge(g)" @toggle="toggle(g.id)"
      >
        <NavItem v-for="e in g.entries" :key="e.to" :to="e.to" v-bind="badgeProps(e.to)" :label="e.label">
          <template #icon><component :is="e.icon" class="w-4 h-4" /></template>
        </NavItem>
      </NavGroup>
    </nav>
    </ClientOnly>
  </aside>
</template>
