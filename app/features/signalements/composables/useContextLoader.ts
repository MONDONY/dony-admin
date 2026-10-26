import { ref } from 'vue'
import { extractProblemMessage } from '@/lib/problemDetail'
import { isEndpointMissing } from '@/lib/endpointMissing'

/**
 * Contexte du dossier ouvert (signalement, avis) : une lecture par dossier, jamais bloquante. Le
 * dossier s'affiche sans lui (ancien back sans l'endpoint, réponse d'une autre forme, droit manquant,
 * panne) : seul un échec inattendu laisse une phrase. J / K enchaînés ne mélangent pas les dossiers :
 * une réponse n'est gardée que si son dossier est encore celui qui est ouvert.
 *
 * @param fetchContext lecture du contexte d'un dossier
 * @param isContext    garde de forme : toute autre réponse (proxy, ancien back) n'est pas un contexte
 */
export function useContextLoader<T>(
  // eslint-disable-next-line no-unused-vars -- paramètres d'un type de fonction, pas des variables
  fetchContext: (id: string) => Promise<unknown>,
  // eslint-disable-next-line no-unused-vars -- paramètres d'un type de fonction, pas des variables
  isContext: (value: unknown) => value is T,
) {
  const context = ref<T | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  /** L'endpoint n'existe pas encore côté serveur (PR jumelle non déployée) : rien à montrer ni à dire. */
  const unavailable = ref(false)
  let current = 0

  function clear() {
    current += 1
    context.value = null
    error.value = null
    isLoading.value = false
  }

  async function load(id: string | null) {
    if (!id) {
      clear()
      return
    }
    const mine = ++current
    context.value = null
    error.value = null
    isLoading.value = true
    try {
      const result = await fetchContext(id)
      if (mine !== current) return
      if (isContext(result)) {
        context.value = result
        unavailable.value = false
      } else {
        unavailable.value = true
      }
    } catch (e) {
      if (mine !== current) return
      if (isEndpointMissing(e)) unavailable.value = true
      else error.value = extractProblemMessage(e, 'Contexte indisponible')
    } finally {
      if (mine === current) isLoading.value = false
    }
  }

  return { context, isLoading, error, unavailable, load, clear }
}
