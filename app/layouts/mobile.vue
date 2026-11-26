<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useMobileTabs, type MobileTab } from '@/features/mobile/composables/useMobileTabs'
import { useNotificationsStore } from '@/stores/notifications'
import { useSwNavigation } from '@/features/mobile/composables/useSwNavigation'
import PushToggle from '@/features/mobile/components/PushToggle.vue'

const route = useRoute()
const tabs = useMobileTabs()
const notifications = useNotificationsStore()
// Repli du service worker quand il ne peut pas naviguer lui-même (clic sur une notification).
useSwNavigation()

// Le manifest vit sous `<base>m/` : il ne s'applique qu'à l'app mobile, pas à la console de bureau.
const base = useRuntimeConfig().app.baseURL.replace(/\/?$/, '/')
useHead({
  link: [
    { rel: 'manifest', href: `${base}m/manifest.webmanifest` },
    { rel: 'apple-touch-icon', href: `${base}m/icon-192.png` },
  ],
  meta: [
    { name: 'theme-color', content: '#0B5FFF' },
    { name: 'apple-mobile-web-app-capable', content: 'yes' },
    { name: 'mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-title', content: 'Yadony' },
    { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
  ],
})

const title = computed(() => (route.meta?.pageTitle as string | undefined) ?? 'Yadony')

function isActive(tab: MobileTab): boolean {
  return route.path === tab.to || route.path.startsWith(`${tab.to}/`)
}

/** Pastilles : compteurs du store de notifications (alertes, support). Absent = pas de pastille. */
function badgeFor(tab: MobileTab): string | null {
  const key = tab.key === 'alertes' ? 'alerts' : tab.key === 'support' ? 'support' : null
  const n = key ? notifications.counts[key] ?? 0 : 0
  if (n <= 0) return null
  return n > 99 ? '99+' : String(n)
}

let unsubscribe: (() => void) | null = null
onMounted(() => { unsubscribe = notifications.subscribe() })
onBeforeUnmount(() => unsubscribe?.())
</script>

<template>
  <div class="mobile-shell fixed inset-0 flex flex-col overflow-hidden bg-bg text-text">
    <header class="mobile-header shrink-0 border-b border-border bg-surface px-4">
      <h1 class="flex h-12 items-center truncate font-display text-lg font-bold">
        <slot name="title">{{ title }}</slot>
      </h1>
      <PushToggle class="pb-2" />
    </header>

    <main class="flex-1 overflow-y-auto px-4 py-4">
      <slot />
    </main>

    <nav class="mobile-tabbar shrink-0 border-t border-border bg-surface" aria-label="Navigation principale">
      <ul class="flex">
        <li v-for="tab in tabs" :key="tab.key" class="min-w-0 flex-1">
          <NuxtLink
            :to="tab.to"
            data-test="mobile-tab"
            :data-tab="tab.key"
            class="relative flex min-h-[48px] flex-col items-center justify-center px-1 text-xs font-semibold whitespace-nowrap"
            :class="isActive(tab) ? 'text-primary' : 'text-text-muted'"
            :aria-current="isActive(tab) ? 'page' : undefined"
          >
            <span class="relative">
              {{ tab.label }}
              <span
                v-if="badgeFor(tab)"
                data-test="mobile-badge"
                class="absolute -right-5 -top-2 min-w-[18px] rounded-full bg-danger px-1 text-center text-[10px] font-bold leading-[18px] text-white"
              >{{ badgeFor(tab) }}</span>
            </span>
          </NuxtLink>
        </li>
      </ul>
    </nav>
  </div>
</template>

<style scoped>
.mobile-header { padding-top: env(safe-area-inset-top); padding-left: max(1rem, env(safe-area-inset-left)); padding-right: max(1rem, env(safe-area-inset-right)); }
.mobile-tabbar { padding-bottom: env(safe-area-inset-bottom); padding-left: env(safe-area-inset-left); padding-right: env(safe-area-inset-right); }
</style>
