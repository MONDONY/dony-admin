import { ref } from 'vue'
import { userProfileService } from '@/features/user-profile/services/userProfileService'
import { extractProblemMessage } from '@/lib/problemDetail'
import { isEndpointMissing } from '@/lib/endpointMissing'
import type { UserOverview } from '@/features/user-profile/types/index'

export function useUserOverview(userId: string) {
  const overview = ref<UserOverview | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  /** Backend plus ancien (endpoint absent) : l'appelant se replie sur l'ancien affichage. */
  const unavailable = ref(false)

  async function load(): Promise<void> {
    isLoading.value = true
    error.value = null
    unavailable.value = false
    try {
      overview.value = await userProfileService.overview(userId)
    } catch (e) {
      if (isEndpointMissing(e)) unavailable.value = true
      else error.value = extractProblemMessage(e, 'Impossible de charger la synthèse')
    } finally {
      isLoading.value = false
    }
  }

  return { overview, isLoading, error, unavailable, load }
}
