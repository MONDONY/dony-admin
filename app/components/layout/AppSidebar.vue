<script setup lang="ts">
import { KeyRound, Keyboard } from 'lucide-vue-next'
import { computed, inject, onBeforeUnmount, onMounted, ref } from 'vue'
import { routeLocationKey } from 'vue-router'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useAuthStore, type AdminPermission } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'
import { navBadges } from '@/features/notifications/lib/navBadges'
import NavItem from './NavItem.vue'
import { HOME_ENTRY, NAV_GROUPS, resolveActiveEntry, type NavEntry } from './navConfig'
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

// Domaines du rail : n'affichent que les entrées autorisées ; un domaine sans entrée disparaît.
const visibleGroups = computed(() =>
  NAV_GROUPS
    .map(g => ({ ...g, entries: g.entries.filter(e => can(e.permission)) }))
    .filter(g => g.entries.length > 0),
)

// Une seule entrée est « courante » : la plus spécifique (/users/rgpd et non /users).
const route = inject(routeLocationKey, null)
const activeEntry = computed(() => resolveActiveEntry(route?.path))
const isActive = (e: NavEntry) => activeEntry.value?.to === e.to
const homeActive = computed(() => isActive(HOME_ENTRY))

const groupBadge = (g: { entries: NavEntry[] }) => {
  const list = g.entries.map(e => badges.value[e.to]).filter((b): b is NonNullable<typeof b> => !!b)
  return {
    count: list.reduce((n, b) => n + b.count, 0),
    tone: list.some(b => b.tone === 'danger') ? ('danger' as const) : ('neutral' as const),
  }
}
const shortcutsHelp = useShortcutsHelp()

// Le panneau d'un domaine s'ouvre au survol (ou au focus clavier, ou au toucher) et se referme
// de lui-même ; après un clic sur une page il reste fermé jusqu'à ce que la souris quitte le rail,
// sinon il resterait collé sur la page qu'on vient d'ouvrir.
const shut = ref(false)
function onPick() {
  shut.value = true
  ;(document.activeElement as HTMLElement | null)?.blur()
}

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

// Bouton du rail : icône + nom court. Allumé (fond bleu + liseré) quand la page affichée est dans ce domaine.
const railBtn = 'relative flex h-[52px] w-[48px] flex-col items-center justify-center gap-0.5 rounded-btn text-[10px] font-medium leading-none transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary'
const railBtnIdle = 'text-text-muted hover:bg-surface-elevated hover:text-text group-hover/dm:bg-surface-elevated group-hover/dm:text-text group-focus-within/dm:bg-surface-elevated group-focus-within/dm:text-text'
const railBtnOn = 'bg-primary/10 font-semibold text-primary before:absolute before:-left-2 before:bottom-3 before:top-3 before:w-[3px] before:rounded-r before:bg-primary'
</script>

<template>
  <aside
    class="relative z-20 flex w-sidebar shrink-0 flex-col border-r border-border bg-surface"
    :data-shut="shut"
    @mouseleave="shut = false"
    @focusin="shut = false"
  >
    <div class="flex h-topbar shrink-0 items-center justify-center border-b border-border">
      <NuxtLink to="/" aria-label="Yadony ADMIN, accueil" class="flex rounded-btn focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
        <img src="/logos/logo-yadony-mark.png" alt="Yadony" class="h-8 w-auto" />
      </NuxtLink>
    </div>

    <!--
      Sous ClientOnly : `can()` dépend de `auth.user`, que seul le plugin Firebase côté client
      peuple. Au rendu serveur, toutes les permissions sont donc fausses et la nav sortait VIDE
      dans le HTML servi, avant que l'hydratation n'ajoute les entrées : décalage d'hydratation
      à chaque chargement et navigation absente au premier paint.
    -->
    <ClientOnly>
      <template #fallback>
        <nav class="flex flex-1 flex-col items-center gap-2 py-3" aria-hidden="true">
          <div v-for="i in 6" :key="i" class="h-[52px] w-[48px] animate-pulse rounded-btn bg-border/40" />
        </nav>
      </template>
      <nav class="flex flex-1 flex-col items-center gap-1 py-3" aria-label="Navigation principale">
        <NuxtLink
          v-if="can(HOME_ENTRY.permission)"
          :to="HOME_ENTRY.to"
          data-test="nav-rail-home"
          :aria-current="homeActive ? 'page' : undefined"
          :class="[railBtn, homeActive ? railBtnOn : 'text-text-muted hover:bg-surface-elevated hover:text-text']"
        >
          <component :is="HOME_ENTRY.icon" class="h-5 w-5" />
          <span>Accueil</span>
        </NuxtLink>

        <div
          v-for="g in visibleGroups" :key="g.id"
          class="group/dm flex w-full justify-center py-0.5"
          :data-test="`nav-group-${g.id}`"
        >
          <button
            type="button"
            :data-test="`nav-rail-${g.id}`"
            :aria-label="g.label"
            aria-haspopup="true"
            :aria-current="g.entries.some(isActive) ? 'true' : undefined"
            :class="[railBtn, g.entries.some(isActive) ? railBtnOn : railBtnIdle]"
          >
            <component :is="g.icon" class="h-5 w-5" />
            <span>{{ g.railLabel }}</span>
            <span
              v-if="groupBadge(g).count > 0"
              data-test="nav-rail-badge"
              :data-tone="groupBadge(g).tone"
              class="absolute right-1.5 top-1 h-2.5 w-2.5 rounded-full border-2 border-surface"
              :class="groupBadge(g).tone === 'danger' ? 'bg-danger' : 'bg-text-muted'"
            ><span class="sr-only">{{ groupBadge(g).count }} à traiter</span></span>
          </button>

          <!-- Panneau du domaine : ancré au bord du rail, sous la barre du haut il la prolonge. -->
          <div
            role="group"
            :aria-label="g.label"
            :data-test="`nav-panel-${g.id}`"
            class="nav-panel absolute bottom-0 left-full top-0 hidden w-60 flex-col border-r border-border bg-surface shadow-lg group-focus-within/dm:flex group-hover/dm:flex"
            :class="shut ? '!hidden' : ''"
          >
            <div class="flex h-topbar shrink-0 items-center border-b border-border px-5">
              <h2 class="font-display text-base font-bold">{{ g.label }}</h2>
            </div>
            <div class="space-y-1 overflow-y-auto p-3">
              <NavItem
                v-for="e in g.entries" :key="e.to" :to="e.to" :label="e.label"
                :active="isActive(e)" v-bind="badgeProps(e.to)" @click="onPick"
              >
                <template #icon><component :is="e.icon" class="h-4 w-4" /></template>
              </NavItem>
            </div>
          </div>
        </div>
      </nav>
    </ClientOnly>

    <ClientOnly>
      <div ref="profileMenuRef" class="relative flex shrink-0 justify-center border-t border-border py-3">
        <button
          type="button" data-test="profile-menu-trigger"
          class="rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          aria-haspopup="menu" :aria-expanded="showProfileMenu" :aria-label="`Mon compte, ${auth.user?.email ?? ''}`"
          @click="showProfileMenu = !showProfileMenu"
        >
          <Avatar>
            <AvatarFallback class="bg-primary text-sm text-white">{{ initials }}</AvatarFallback>
          </Avatar>
        </button>

        <Transition
          enter-active-class="transition duration-100 ease-out"
          enter-from-class="opacity-0 translate-x-1"
          enter-to-class="opacity-100 translate-x-0"
          leave-active-class="transition duration-75 ease-in"
          leave-from-class="opacity-100 translate-x-0"
          leave-to-class="opacity-0 translate-x-1"
        >
          <div
            v-if="showProfileMenu" role="menu" data-test="profile-menu"
            class="absolute bottom-2 left-full z-30 ml-2 w-64 overflow-hidden rounded-card border border-border bg-surface shadow-lg"
          >
            <div class="border-b border-border px-3 py-3">
              <p class="truncate text-sm font-medium">{{ auth.user?.email }}</p>
              <span class="mt-1 inline-block rounded bg-danger/20 px-1.5 py-0.5 text-xs text-danger">{{ auth.user?.role }}</span>
            </div>
            <NuxtLink
              to="/change-password" role="menuitem" data-test="profile-change-password"
              class="flex items-center gap-2 px-3 py-2 text-sm text-text transition-colors hover:bg-surface-elevated"
              @click="closeProfileMenu"
            >
              <KeyRound class="h-4 w-4" />
              Changer mon mot de passe
            </NuxtLink>
            <button
              type="button" role="menuitem" data-test="profile-shortcuts"
              class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text transition-colors hover:bg-surface-elevated"
              @click="closeProfileMenu(); shortcutsHelp.show()"
            >
              <Keyboard class="h-4 w-4" />
              Raccourcis clavier
              <kbd class="ml-auto rounded border border-border px-1.5 text-[11px] text-text-muted">?</kbd>
            </button>
          </div>
        </Transition>
      </div>
      <template #fallback>
        <div class="flex justify-center border-t border-border py-3">
          <div class="h-10 w-10 animate-pulse rounded-full bg-primary/20" />
        </div>
      </template>
    </ClientOnly>
  </aside>
</template>

<style scoped>
.nav-panel { animation: nav-panel-in 140ms ease-out; }
@keyframes nav-panel-in {
  from { opacity: 0; transform: translateX(-6px); }
  to { opacity: 1; transform: none; }
}
@media (prefers-reduced-motion: reduce) {
  .nav-panel { animation: none; }
}
</style>
