<script setup lang="ts">
import {
  LayoutDashboard, Users, CreditCard, Package, AlertTriangle,
  Bell, MessageSquare, Ticket, ScrollText, Download, Flag, ShieldCheck, KeyRound,
} from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useAuthStore } from '@/stores/auth'
import NavItem from './NavItem.vue'

const auth = useAuthStore()
const initials = computed(() =>
  auth.user?.email?.slice(0, 2).toUpperCase() ?? '?',
)
const isSuperAdmin = computed(() => auth.user?.role === 'SUPER_ADMIN')

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
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onDocumentKeydown)
})
onBeforeUnmount(() => {
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

    <nav class="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
      <NavItem to="/" label="Vue d’ensemble"><template #icon><LayoutDashboard class="w-4 h-4" /></template></NavItem>
      <NavItem to="/users" label="Utilisateurs"><template #icon><Users class="w-4 h-4" /></template></NavItem>
      <NavItem to="/transactions" label="Transactions"><template #icon><CreditCard class="w-4 h-4" /></template></NavItem>
      <NavItem to="/colis" label="Colis"><template #icon><Package class="w-4 h-4" /></template></NavItem>
      <NavItem to="/incidents" label="Incidents"><template #icon><AlertTriangle class="w-4 h-4" /></template></NavItem>
      <NavItem to="/alertes" label="Alertes"><template #icon><Bell class="w-4 h-4" /></template></NavItem>
      <NavItem to="/moderation" label="Modération"><template #icon><MessageSquare class="w-4 h-4" /></template></NavItem>
      <NavItem to="/promo" label="Codes promo"><template #icon><Ticket class="w-4 h-4" /></template></NavItem>
      <NavItem to="/audit" label="Audit"><template #icon><ScrollText class="w-4 h-4" /></template></NavItem>
      <NavItem to="/exports" label="Exports"><template #icon><Download class="w-4 h-4" /></template></NavItem>
      <NavItem to="/signalements" label="Signalements"><template #icon><Flag class="w-4 h-4" /></template></NavItem>
      <NavItem v-if="isSuperAdmin" to="/administrateurs" label="Administrateurs"><template #icon><ShieldCheck class="w-4 h-4" /></template></NavItem>
    </nav>
  </aside>
</template>
