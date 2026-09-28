<script setup lang="ts">
import { Bell, BellOff, CheckCheck, RefreshCw } from 'lucide-vue-next'
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useNotificationsStore, MARK_SEEN_DELAY_MS } from '@/stores/notifications'
import {
  formatFullDate, formatRelativeFr, isSafeInternalLink, isUnread,
} from '@/features/notifications/lib/format'
import { notificationIcon, severityClasses } from '@/features/notifications/lib/notificationMeta'
import type { AdminNotification } from '@/features/notifications/types/index'

const store = useNotificationsStore()

const isOpen = ref(false)
const rootRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLButtonElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)
/** lastSeenAt figé à l'ouverture : les nouveautés restent en évidence même une fois marquées lues. */
const highlightSince = ref<string | null>(null)
const now = ref(Date.now())

let openSession = 0
let markTimer: ReturnType<typeof setTimeout> | null = null
let clockTimer: ReturnType<typeof setInterval> | null = null
let unsubscribe: (() => void) | null = null

const ariaLabel = computed(() => {
  if (!store.badge) return 'Notifications'
  if (store.badge === '99+') return 'Notifications, plus de 99 non lues'
  return `Notifications, ${store.unreadCount} ${store.unreadCount > 1 ? 'non lues' : 'non lue'}`
})
const showMarkAll = computed(() =>
  !store.unavailable && store.feedStatus === 'ready' && store.unreadCount > 0)

function clearTimers() {
  if (markTimer !== null) clearTimeout(markTimer)
  if (clockTimer !== null) clearInterval(clockTimer)
  markTimer = null
  clockTimer = null
}

/**
 * Marquage automatique après 2 s d'affichage plutôt qu'à la fermeture : un clic sur une
 * notification navigue et ferme, et une fermeture involontaire (clic à côté) marquerait aussi.
 * Une ouverture furtive (moins de 2 s) ne compte pas comme une lecture.
 */
function scheduleMarkSeen(session: number) {
  if (store.unreadCount === 0) return
  markTimer = setTimeout(() => {
    markTimer = null
    if (isOpen.value && session === openSession) void store.markAllSeen()
  }, MARK_SEEN_DELAY_MS)
}

async function load(session: number) {
  await store.openPanel()
  if (!isOpen.value || session !== openSession) return
  now.value = Date.now()
  if (store.feedStatus === 'ready') scheduleMarkSeen(session)
}

async function openPanel() {
  const session = ++openSession
  isOpen.value = true
  highlightSince.value = store.lastSeenAt
  now.value = Date.now()
  clockTimer = setInterval(() => { now.value = Date.now() }, 30_000)
  await nextTick()
  panelRef.value?.focus()
  await load(session)
  if (isOpen.value && session === openSession) highlightSince.value = store.lastSeenAt
}

function close(returnFocus: boolean) {
  if (!isOpen.value) return
  openSession++
  isOpen.value = false
  clearTimers()
  if (returnFocus) triggerRef.value?.focus()
}

function toggle() {
  if (isOpen.value) close(false)
  else void openPanel()
}

async function retry() {
  const session = openSession
  await load(session)
  if (isOpen.value && session === openSession) highlightSince.value = store.lastSeenAt
}

function select(n: AdminNotification) {
  close(false)
  if (isSafeInternalLink(n.link)) void navigateTo(n.link)
}

function onDocumentClick(e: MouseEvent) {
  if (isOpen.value && rootRef.value && !rootRef.value.contains(e.target as Node)) close(false)
}
function onDocumentKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && isOpen.value) close(true)
}

onMounted(() => {
  unsubscribe = store.subscribe()
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onDocumentKeydown)
})
onBeforeUnmount(() => {
  clearTimers()
  unsubscribe?.()
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onDocumentKeydown)
})
</script>

<template>
  <div ref="rootRef" class="relative">
    <button
      ref="triggerRef"
      type="button"
      data-test="notif-bell"
      class="relative inline-flex h-10 w-10 items-center justify-center rounded-btn text-text hover:bg-surface-elevated transition-[background-color,transform] duration-150 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
      :aria-label="ariaLabel"
      aria-haspopup="dialog"
      :aria-expanded="isOpen"
      aria-controls="notifications-panel"
      @click="toggle"
    >
      <Bell class="w-4 h-4" />
      <Transition
        enter-active-class="transition-[opacity,transform,filter] duration-300 ease-[cubic-bezier(0.2,0,0,1)]"
        enter-from-class="opacity-0 scale-[0.25] blur-[4px]"
        leave-active-class="transition-[opacity,transform] duration-150 ease-in"
        leave-to-class="opacity-0 scale-75"
      >
        <span
          v-if="store.badge"
          data-test="notif-badge"
          aria-hidden="true"
          class="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-danger text-white text-[10px] font-semibold leading-4 text-center tabular-nums ring-2 ring-surface"
        >{{ store.badge }}</span>
      </Transition>
    </button>

    <Transition
      enter-active-class="transition-[opacity,transform] duration-150 ease-[cubic-bezier(0.2,0,0,1)]"
      enter-from-class="opacity-0 -translate-y-1 scale-[0.98]"
      leave-active-class="transition-opacity duration-100 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isOpen"
        id="notifications-panel"
        ref="panelRef"
        data-test="notif-panel"
        role="dialog"
        aria-label="Notifications"
        tabindex="-1"
        class="absolute right-0 top-full z-50 mt-2 w-[380px] max-w-[calc(100vw-2rem)] origin-top-right rounded-card border border-border bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.06),0_8px_24px_rgba(0,0,0,0.12)] overflow-hidden focus:outline-none"
      >
        <div class="flex items-center justify-between gap-2 px-4 py-3 border-b border-border">
          <h2 class="font-display text-sm font-bold">Notifications</h2>
          <button
            v-if="showMarkAll"
            type="button"
            data-test="notif-mark-all"
            class="inline-flex items-center gap-1.5 rounded-xs px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-[background-color,transform] duration-150 active:scale-[0.96]"
            @click="store.markAllSeen()"
          >
            <CheckCheck class="w-3.5 h-3.5" />
            Tout marquer comme lu
          </button>
        </div>

        <p v-if="store.markSeenError" data-test="notif-mark-error" role="alert" class="px-4 py-2 text-xs text-danger border-b border-border">
          {{ store.markSeenError }}
        </p>

        <div class="max-h-[420px] overflow-y-auto">
          <div v-if="store.unavailable" data-test="notif-unavailable" class="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <BellOff class="w-5 h-5 text-text-muted" />
            <p class="text-sm text-text-muted text-pretty">Notifications indisponibles pour le moment.</p>
          </div>

          <ul v-else-if="store.feedStatus === 'loading' || store.feedStatus === 'idle'" data-test="notif-skeleton" aria-hidden="true" class="divide-y divide-border">
            <li v-for="i in 4" :key="i" class="flex gap-3 px-4 py-3">
              <div class="h-8 w-8 shrink-0 rounded-full bg-border/60 animate-pulse" />
              <div class="flex-1 space-y-2 py-0.5">
                <div class="h-3 w-2/3 rounded bg-border/60 animate-pulse" />
                <div class="h-3 w-full rounded bg-border/40 animate-pulse" />
              </div>
            </li>
          </ul>

          <div v-else-if="store.feedStatus === 'error'" data-test="notif-error" role="alert" class="flex flex-col items-center gap-3 px-6 py-8 text-center">
            <p class="text-sm text-danger text-pretty">{{ store.feedError }}</p>
            <button
              type="button"
              data-test="notif-retry"
              class="inline-flex items-center gap-1.5 rounded-btn border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface-elevated transition-[background-color,transform] duration-150 active:scale-[0.96]"
              @click="retry"
            >
              <RefreshCw class="w-3.5 h-3.5" />
              Réessayer
            </button>
          </div>

          <div v-else-if="store.items.length === 0" data-test="notif-empty" class="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <Bell class="w-5 h-5 text-text-muted" />
            <p class="text-sm font-medium">Rien de nouveau</p>
            <p class="text-xs text-text-muted text-pretty">Les nouveaux signalements, tickets et dossiers à traiter apparaîtront ici.</p>
          </div>

          <ul v-else class="divide-y divide-border">
            <li v-for="(n, index) in store.items" :key="n.id" class="notif-row" :style="{ animationDelay: `${Math.min(index, 8) * 30}ms` }">
              <button
                type="button"
                data-test="notif-item"
                :data-unread="isUnread(n.createdAt, highlightSince)"
                class="relative flex w-full gap-3 px-4 py-3 text-left hover:bg-surface-elevated focus-visible:bg-surface-elevated focus-visible:outline-none transition-colors"
                :class="isUnread(n.createdAt, highlightSince) ? 'bg-primary/5' : ''"
                @click="select(n)"
              >
                <span
                  data-test="notif-icon"
                  class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                  :class="severityClasses(n.severity)"
                >
                  <component :is="notificationIcon(n.type)" class="w-4 h-4" />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="flex items-start justify-between gap-2">
                    <span class="text-sm font-medium text-text" :class="isUnread(n.createdAt, highlightSince) ? 'font-semibold' : ''">{{ n.title }}</span>
                    <time
                      :datetime="n.createdAt"
                      :title="formatFullDate(n.createdAt)"
                      class="shrink-0 text-xs text-text-muted tabular-nums"
                    >{{ formatRelativeFr(n.createdAt, now) }}</time>
                  </span>
                  <span v-if="n.summary" class="mt-0.5 block text-xs text-text-muted line-clamp-2 text-pretty">{{ n.summary }}</span>
                </span>
                <span
                  v-if="isUnread(n.createdAt, highlightSince)"
                  class="absolute left-1.5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-primary"
                  aria-hidden="true"
                />
                <span v-if="isUnread(n.createdAt, highlightSince)" class="sr-only">Non lue</span>
              </button>
            </li>
          </ul>
        </div>

        <div v-if="!store.unavailable && store.feedStatus === 'ready' && (store.hasMore || store.loadMoreError)" class="border-t border-border px-4 py-2 text-center">
          <p v-if="store.loadMoreError" data-test="notif-load-more-error" role="alert" class="pb-1 text-xs text-danger">{{ store.loadMoreError }}</p>
          <button
            v-if="store.hasMore"
            type="button"
            data-test="notif-load-more"
            class="rounded-xs px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 disabled:opacity-50 transition-[background-color,transform] duration-150 active:scale-[0.96]"
            :disabled="store.loadingMore"
            @click="store.loadMore()"
          >
            {{ store.loadingMore ? 'Chargement…' : 'Charger plus' }}
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.notif-row {
  animation: notif-in 200ms cubic-bezier(0.2, 0, 0, 1) both;
}
@keyframes notif-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
@media (prefers-reduced-motion: reduce) {
  .notif-row { animation: none; }
}
</style>
