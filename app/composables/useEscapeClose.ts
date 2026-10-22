import { onBeforeUnmount, onMounted } from 'vue'

/**
 * Échap ferme un panneau latéral ou une fiche. Ignoré quand un champ de saisie a le focus
 * (Échap y sert d'abord à quitter le champ) ou quand une fenêtre de dialogue est ouverte
 * par-dessus (c'est elle qui doit se fermer en premier).
 */
export function useEscapeClose(onClose: () => void, isActive: () => boolean = () => true) {
  function onKey(e: KeyboardEvent) {
    if (e.key !== 'Escape' || e.defaultPrevented || !isActive()) return
    const el = e.target as HTMLElement | null
    if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return
    if (document.querySelector('[role="dialog"][aria-modal="true"]')) return
    onClose()
  }
  onMounted(() => window.addEventListener('keydown', onKey))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
}
