<script setup lang="ts">
import {
  LayoutDashboard, Users, CreditCard, Package, AlertTriangle,
  Bell, MessageSquare, Ticket, ScrollText, Download, Flag,
} from 'lucide-vue-next'
import { computed } from 'vue'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useAuthStore } from '@/stores/auth'
import NavItem from './NavItem.vue'

const auth = useAuthStore()
const initials = computed(() =>
  auth.user?.login?.slice(0, 2).toUpperCase() ?? '?',
)
</script>

<template>
  <aside class="w-sidebar shrink-0 bg-surface border-r border-border flex flex-col">
    <div class="px-6 py-5 border-b border-border">
      <NuxtLink to="/" class="font-display font-bold text-xl text-primary">
        dony <span class="text-text">ADMIN</span>
      </NuxtLink>
    </div>

    <ClientOnly>
      <div class="px-4 py-4 border-b border-border flex items-center gap-3">
        <Avatar>
          <AvatarFallback class="bg-primary text-white text-sm">{{ initials }}</AvatarFallback>
        </Avatar>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium truncate">{{ auth.user?.login }}</p>
          <span class="text-xs bg-danger/20 text-danger px-1.5 py-0.5 rounded">{{ auth.user?.role }}</span>
        </div>
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
    </nav>
  </aside>
</template>
