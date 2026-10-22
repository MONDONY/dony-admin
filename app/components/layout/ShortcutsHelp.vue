<script setup lang="ts">
import { computed } from 'vue'
import { ALL_NAV_ENTRIES } from './navConfig'
import { useShortcutsHelp } from '@/composables/useShortcuts'
import { useAuthStore } from '@/stores/auth'

const { open, hide } = useShortcutsHelp()
const auth = useAuthStore()

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
const mod = isMac ? '⌘' : 'Ctrl'

const pages = computed(() =>
  ALL_NAV_ENTRIES.filter(e => e.shortcut && auth.can(e.permission)),
)
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[12vh] backdrop-blur-[2px]"
      data-test="shortcuts-overlay"
      @mousedown.self="hide"
    >
      <div
        role="dialog" aria-modal="true" aria-label="Raccourcis clavier"
        class="w-full max-w-md rounded-card border border-border bg-surface p-5 shadow-xl"
      >
        <div class="mb-4 flex items-center justify-between">
          <h2 class="font-display text-lg font-bold">Raccourcis clavier</h2>
          <button type="button" class="text-sm text-text-muted hover:text-text" data-test="shortcuts-close" @click="hide">Fermer</button>
        </div>

        <h3 class="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">Partout</h3>
        <ul class="mb-4 space-y-1.5 text-sm">
          <li class="flex items-center justify-between"><span>Rechercher</span><span><kbd class="kbd">{{ mod }}</kbd> <kbd class="kbd">K</kbd> ou <kbd class="kbd">/</kbd></span></li>
          <li class="flex items-center justify-between"><span>Fermer un panneau ou une fenêtre</span><kbd class="kbd">Échap</kbd></li>
          <li class="flex items-center justify-between"><span>Afficher cette aide</span><kbd class="kbd">?</kbd></li>
        </ul>

        <h3 class="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">Aller à… (<kbd class="kbd">g</kbd> puis une lettre)</h3>
        <ul class="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm" data-test="shortcuts-pages">
          <li v-for="e in pages" :key="e.to" class="flex items-center justify-between">
            <span class="truncate">{{ e.label }}</span>
            <span class="shrink-0"><kbd class="kbd">g</kbd> <kbd class="kbd">{{ e.shortcut!.toUpperCase() }}</kbd></span>
          </li>
        </ul>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.kbd {
  border: 1px solid var(--border, currentColor);
  border-radius: 4px;
  padding: 1px 6px;
  font-family: inherit;
  font-size: 11px;
  line-height: 1.4;
}
</style>
