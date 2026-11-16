import { ref } from 'vue'
import { helpCenterService } from '@/features/help-center/services/helpCenterService'
import type { HelpArticle } from '@/features/help-center/types'
import { problemCode } from '@/lib/endpointMissing'
import { extractProblemMessage } from '@/lib/problemDetail'

export function useHelpArticle() {
  const article = ref<HelpArticle | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const notFound = ref(false)
  let seq = 0

  async function load(id: string): Promise<void> {
    const mine = ++seq
    isLoading.value = true
    error.value = null
    notFound.value = false
    try {
      const a = await helpCenterService.article(id)
      if (mine === seq) article.value = a
    } catch (e) {
      if (mine !== seq) return
      article.value = null
      notFound.value = problemCode(e) === 'admin-help-article-not-found'
      if (!notFound.value) error.value = extractProblemMessage(e, 'Impossible de charger cette fiche')
    } finally {
      if (mine === seq) isLoading.value = false
    }
  }

  return { article, isLoading, error, notFound, load }
}
