import { onBeforeUnmount, onMounted } from 'vue'

/**
 * Échap ferme un panneau latéral ou une fiche. Ignoré quand un champ de saisie a le focus
 * (Échap y sert d'abord à quitter le champ) ou quand une fenêtre de dialogue est ouverte
 * par-dessus (c'est elle qui doit se fermer en premier).
 *
 * `root` : racine du panneau quand il est lui-même un dialogue modal (tiroir). Seul le dialogue
 * modal le plus haut (le dernier du DOM) compte alors : Échap ferme le panneau si c'est lui,
 * et laisse la main à la visionneuse ou à la confirmation ouverte par-dessus sinon.
 */
export function useEscapeClose(
  onClose: () => void,
  isActive: () => boolean = () => true,
  root?: () => HTMLElement | null,
) {
  function onKey(e: KeyboardEvent) {
    if (e.key !== 'Escape' || e.defaultPrevented || !isActive()) return
    const el = e.target as HTMLElement | null
    if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return
    const modals = document.querySelectorAll('[role="dialog"][aria-modal="true"]')
    if (root) {
      const top = modals[modals.length - 1]
      if (top && top !== root()) return
    } else if (modals.length) {
      return
    }
    onClose()
  }
  onMounted(() => window.addEventListener('keydown', onKey))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
}
