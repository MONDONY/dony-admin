import { onBeforeUnmount, onMounted, ref } from 'vue'
import { ALL_NAV_ENTRIES } from '@/components/layout/navConfig'
import type { AdminPermission } from '@/stores/auth'

/** Délai laissé pour taper la lettre après « g ». */
export const CHORD_TIMEOUT_MS = 1200

const helpOpen = ref(false)

/** Fenêtre d'aide « ? » : état partagé entre le menu (bouton) et la fenêtre elle-même. */
export function useShortcutsHelp() {
  return {
    open: helpOpen,
    show: () => { helpOpen.value = true },
    hide: () => { helpOpen.value = false },
    toggle: () => { helpOpen.value = !helpOpen.value },
  }
}

export interface ShortcutDeps {
  // eslint-disable-next-line no-unused-vars -- paramètres d'un type de fonction, pas des variables
  navigate: (to: string) => unknown
  // eslint-disable-next-line no-unused-vars -- paramètres d'un type de fonction, pas des variables
  can: (permission: AdminPermission) => boolean
  now?: () => number
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))
}

/**
 * Gestionnaire pur (testable sans navigateur) : « g » puis une lettre ouvre la page, « ? »
 * ouvre l'aide, Échap la ferme. Ignoré dans un champ de saisie et avec Ctrl/⌘/Alt.
 * « / » et ⌘K restent à la recherche globale.
 */
export function createShortcutHandler({ navigate, can, now = Date.now }: ShortcutDeps) {
  let chordAt = 0
  return function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape' && helpOpen.value) { helpOpen.value = false; return }
    if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) { chordAt = 0; return }

    if (chordAt && now() - chordAt <= CHORD_TIMEOUT_MS) {
      chordAt = 0
      const entry = ALL_NAV_ENTRIES.find(n => n.shortcut === e.key.toLowerCase())
      if (entry && can(entry.permission)) {
        e.preventDefault()
        void navigate(entry.to)
      }
      return
    }
    chordAt = 0

    if (e.key === '?') { e.preventDefault(); helpOpen.value = !helpOpen.value; return }
    if (e.key.toLowerCase() === 'g' && !e.shiftKey) chordAt = now()
  }
}

export function useGlobalShortcuts(deps: ShortcutDeps) {
  const handler = createShortcutHandler(deps)
  onMounted(() => window.addEventListener('keydown', handler))
  onBeforeUnmount(() => window.removeEventListener('keydown', handler))
}
