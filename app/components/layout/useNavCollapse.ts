import { ref } from 'vue'

const STORAGE_KEY = 'yadony.admin.nav.collapsed'

function read(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  }
  catch { return [] }
}

function write(ids: string[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ids)) }
  catch { /* navigation privée ou stockage bloqué : le repli ne survit simplement pas au rechargement */ }
}

/**
 * Groupes du menu repliés par l'admin. Tout est ouvert par défaut : un nouvel admin voit
 * toutes les pages, il ne replie que ce qu'il n'utilise pas. Mémorisé par navigateur.
 */
export function useNavCollapse() {
  const collapsed = ref<string[]>(read())
  const isOpen = (id: string) => !collapsed.value.includes(id)
  function toggle(id: string) {
    collapsed.value = isOpen(id) ? [...collapsed.value, id] : collapsed.value.filter(c => c !== id)
    write(collapsed.value)
  }
  return { collapsed, isOpen, toggle }
}
