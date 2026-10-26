import { ref } from 'vue'

const STORAGE_KEY = 'yadony-admin-support-drafts'

function read(): Record<string, string> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

/**
 * Brouillons de réponse, un par ticket : passer à un autre ticket ne perd pas ce qui était écrit.
 * Gardés pour la session du navigateur (sessionStorage) ; sans stockage (navigation privée), ils
 * vivent seulement tant que la page est ouverte.
 */
export function useReplyDrafts() {
  const drafts = ref<Record<string, string>>(read())

  function persist() {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(drafts.value))
    } catch { /* stockage indisponible : le brouillon reste en mémoire */ }
  }

  const get = (id: string): string => drafts.value[id] ?? ''

  function set(id: string, text: string) {
    const next = { ...drafts.value }
    if (text.trim()) next[id] = text
    else delete next[id]
    drafts.value = next
    persist()
  }

  const clear = (id: string) => set(id, '')

  return { get, set, clear }
}
