import { onBeforeUnmount, onMounted } from 'vue'

export interface WorkbenchShortcutDeps {
  /** Faux quand une fenêtre est ouverte par-dessus le poste de traitement. */
  enabled: () => boolean
  // eslint-disable-next-line no-unused-vars -- paramètres d'un type de fonction, pas des variables
  move: (step: 1 | -1) => void
  // eslint-disable-next-line no-unused-vars -- paramètres d'un type de fonction, pas des variables
  pick: (n: number) => void
  confirm: () => void
}

/** Cases et boutons radio ne reçoivent pas de texte : les raccourcis y restent actifs. */
const NON_TEXT_INPUTS = new Set(['checkbox', 'radio', 'button', 'submit', 'reset'])

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  if (el.isContentEditable) return true
  if (el.tagName === 'INPUT') return !NON_TEXT_INPUTS.has((el as HTMLInputElement).type)
  return el.tagName === 'TEXTAREA' || el.tagName === 'SELECT'
}

/**
 * Gestionnaire pur (testable sans navigateur) : J / K changent de signalement, 1 à 9 choisissent
 * l'action, ⏎ confirme (⌘⏎ ou Ctrl⏎ aussi depuis un champ de saisie). Ignoré dans un champ de
 * saisie, avec Alt, et quand une fenêtre est ouverte. ⏎ sur un bouton ou un lien garde son
 * rôle natif : il ne doit pas confirmer en plus.
 */
export function createWorkbenchKeyHandler({ enabled, move, pick, confirm }: WorkbenchShortcutDeps) {
  return function onKey(e: KeyboardEvent) {
    if (!enabled() || e.altKey) return
    const modified = e.metaKey || e.ctrlKey

    if (e.key === 'Enter' && modified) {
      e.preventDefault()
      confirm()
      return
    }
    if (modified || isTyping(e.target)) return

    const tag = (e.target as HTMLElement | null)?.tagName
    if (e.key === 'Enter') {
      if (tag === 'BUTTON' || tag === 'A') return
      e.preventDefault()
      confirm()
      return
    }
    if (e.key === 'j' || e.key === 'J') { e.preventDefault(); move(1); return }
    if (e.key === 'k' || e.key === 'K') { e.preventDefault(); move(-1); return }
    if (/^[1-9]$/.test(e.key)) { e.preventDefault(); pick(Number(e.key)) }
  }
}

export function useWorkbenchShortcuts(deps: WorkbenchShortcutDeps) {
  const handler = createWorkbenchKeyHandler(deps)
  onMounted(() => window.addEventListener('keydown', handler))
  onBeforeUnmount(() => window.removeEventListener('keydown', handler))
}
