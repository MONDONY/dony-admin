import { nextTick, watch, type Ref } from 'vue'

/**
 * Ligne ouverte par lien (`?open=<id>`) dans un tableau : amenée au milieu de l'écran une fois
 * rendue, une seule fois par identifiant (un rechargement de la liste ne refait pas défiler).
 * La ligne porte `data-row-id` ; le mouvement est instantané si l'utilisateur réduit les animations.
 */
export function useRowHighlight(root: Ref<HTMLElement | null>, id: () => string | null | undefined, rows: () => unknown[]) {
  let done: string | null = null
  watch([id, () => rows().length], async ([wanted]) => {
    if (!wanted) { done = null; return }
    if (done === wanted) return
    await nextTick()
    const el = [...(root.value?.querySelectorAll<HTMLElement>('[data-row-id]') ?? [])].find(e => e.dataset.rowId === wanted)
    if (!el) return
    done = wanted
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView?.({ block: 'center', behavior: reduce ? 'auto' : 'smooth' })
  }, { immediate: true })
}
