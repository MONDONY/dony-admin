import { ref } from 'vue'
import { mobileUsersService } from '@/features/mobile/services/mobileUsersService'
import { extractProblemMessage } from '@/lib/problemDetail'
import type { AdminUserListItem } from '@/features/users/types/index'

const MAX_RESULTS = 5
const MIN_QUERY = 2

/**
 * Recherche d'un destinataire pour Diffuser (GET /admin/users?query=, lecture seule). Copie mobile de la
 * recherche du poste ordinateur : elle ne passe que par `mobileUsersService`, jamais par le service des
 * utilisateurs du poste ordinateur et ses écritures.
 */
export function useMobileUserSearch() {
  const results = ref<AdminUserListItem[]>([])
  const searching = ref(false)
  const searched = ref(false)
  const error = ref<string | null>(null)
  // Une frappe rapide lance plusieurs requêtes : seule la dernière a le droit d'écrire.
  let seq = 0

  async function search(term: string) {
    const query = term.trim()
    const current = ++seq
    error.value = null
    if (query.length < MIN_QUERY) {
      results.value = []
      searched.value = false
      searching.value = false
      return
    }
    searching.value = true
    try {
      const page = await mobileUsersService.list(query, MAX_RESULTS)
      if (current !== seq) return
      results.value = page.content
      searched.value = true
    } catch (e) {
      if (current !== seq) return
      results.value = []
      error.value = extractProblemMessage(e, 'Recherche d’utilisateur impossible')
    } finally {
      if (current === seq) searching.value = false
    }
  }

  function clear() {
    seq++
    results.value = []
    searched.value = false
    searching.value = false
    error.value = null
  }

  return { results, searching, searched, error, search, clear }
}
