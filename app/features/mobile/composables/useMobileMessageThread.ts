import { computed, ref, type Ref } from 'vue'
import { mobileMessagesService } from '@/features/mobile/services/mobileMessagesService'
import { reportReasons, shortParticipant, toBubbles } from '@/features/mobile/lib/mobileMessages'
import type { AdminMessage, ConversationContext } from '@/features/moderation/types/index'
import { extractProblemMessage } from '@/lib/problemDetail'
import { firestoreIdParam } from '@/lib/safeInput'

/** Fil d'une conversation en lecture seule. Le contexte (motifs, participants) est facultatif. */
export function useMobileMessageThread(rawId: Ref<unknown>) {
  const messages = ref<AdminMessage[]>([])
  const context = ref<ConversationContext | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const invalid = ref(false)
  /** Photo ouverte en grand dans la même page (URL présignée : gardée en mémoire seulement). */
  const openImage = ref<string | null>(null)
  let seq = 0

  const id = computed(() => firestoreIdParam(rawId.value))
  const bubbles = computed(() => toBubbles(messages.value, reportReasons(context.value?.reports)))
  const participants = computed(() => (context.value?.participants ?? []).map(p => shortParticipant(p.displayName)))

  async function load() {
    const current = id.value
    const my = ++seq
    error.value = null
    invalid.value = false
    if (!current) {
      invalid.value = true
      return
    }
    isLoading.value = true
    messages.value = []
    context.value = null
    openImage.value = null
    const ctx = (async () => {
      try { return await mobileMessagesService.getContext(current) } catch { return null }
    })()
    try {
      const list = await mobileMessagesService.getMessages(current)
      const c = await ctx
      if (my !== seq) return
      messages.value = list
      context.value = c
    } catch (e) {
      if (my === seq) error.value = extractProblemMessage(e, 'Impossible de charger la conversation')
    } finally {
      if (my === seq) isLoading.value = false
    }
  }

  const showImage = (url: string) => { openImage.value = url }
  const closeImage = () => { openImage.value = null }

  return { bubbles, participants, isLoading, error, invalid, openImage, load, showImage, closeImage }
}
