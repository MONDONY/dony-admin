import { ref } from 'vue'
import { usersService } from '@/features/users/services/usersService'
import { extractProblemMessage } from '@/lib/problemDetail'
import type { AdminUserListItem } from '@/features/users/types/index'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_RESULTS = 5
const MIN_QUERY = 2

/** Un identifiant collé tel quel reste accepté : pas besoin du droit de recherche pour lui. */
export function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim())
}

type Identity = Pick<AdminUserListItem, 'id' | 'firstName' | 'lastName' | 'email' | 'phoneNumber'>

/** Nom affiché d'un destinataire : nom complet, sinon email, téléphone, identifiant court. */
export function userDisplayName(u: Identity): string {
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim()
  return name || u.email?.trim() || u.phoneNumber?.trim() || u.id.slice(0, 8)
}

/**
 * Recherche d'un destinataire pour une notification ciblée, via GET /admin/users?query=
 * (la recherche de l'écran Utilisateurs : nom, téléphone, email).
 */
export function useUserSearch() {
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
      const page = await usersService.list(
        { status: 'TOUS', role: null, kyc: null, pro: null, city: null, query }, 0, MAX_RESULTS,
      )
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

  /** Nom d'un identifiant reçu (pré-remplissage) ; null si la fiche ne se lit pas. */
  async function resolveName(id: string): Promise<string | null> {
    try {
      return userDisplayName(await usersService.get(id))
    } catch {
      return null
    }
  }

  function clear() {
    seq++
    results.value = []
    searched.value = false
    searching.value = false
    error.value = null
  }

  return { results, searching, searched, error, search, resolveName, clear }
}
