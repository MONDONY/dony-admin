import { computed, onScopeDispose, ref } from 'vue'
import { mobileMessagesService } from '@/features/mobile/services/mobileMessagesService'
import { effectiveQuery, MESSAGES_PAGE_SIZE, MESSAGES_SEARCH_DELAY_MS, type MessagesChip } from '@/features/mobile/lib/mobileMessages'
import type { AdminConversation } from '@/features/moderation/types/index'
import { extractProblemMessage } from '@/lib/problemDetail'

/** Liste mobile des conversations : lecture seule, « Signalées » par défaut, recherche différée, « Voir plus ». */
export function useMobileMessageList() {
  const chip = ref<MessagesChip>('FLAGGED')
  const search = ref('')
  const items = ref<AdminConversation[]>([])
  const page = ref(0)
  const totalPages = ref(0)
  const isLoading = ref(false)
  const isLoadingMore = ref(false)
  const error = ref<string | null>(null)
  let seq = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  let appliedQuery: string | undefined

  const hasMore = computed(() => page.value + 1 < totalPages.value)

  const filters = () => ({ flagged: chip.value === 'FLAGGED', q: effectiveQuery(search.value) })

  async function load() {
    const my = ++seq
    isLoadingMore.value = false
    isLoading.value = true
    error.value = null
    const f = filters()
    appliedQuery = f.q
    try {
      const res = await mobileMessagesService.listConversations(0, MESSAGES_PAGE_SIZE, f)
      if (my !== seq) return
      items.value = res.content ?? []
      page.value = 0
      totalPages.value = res.totalPages ?? 0
    } catch (e) {
      if (my !== seq) return
      items.value = []
      totalPages.value = 0
      error.value = extractProblemMessage(e, 'Impossible de charger les conversations')
    } finally {
      if (my === seq) isLoading.value = false
    }
  }

  async function loadMore() {
    if (!hasMore.value || isLoading.value || isLoadingMore.value) return
    const my = ++seq
    const next = page.value + 1
    isLoadingMore.value = true
    error.value = null
    try {
      const res = await mobileMessagesService.listConversations(next, MESSAGES_PAGE_SIZE, filters())
      if (my !== seq) return
      const known = new Set(items.value.map(c => c.id))
      items.value = [...items.value, ...(res.content ?? []).filter(c => !known.has(c.id))]
      page.value = next
      totalPages.value = res.totalPages ?? totalPages.value
    } catch (e) {
      if (my === seq) error.value = extractProblemMessage(e, 'Impossible de charger la suite')
    } finally {
      if (my === seq) isLoadingMore.value = false
    }
  }

  async function selectChip(next: MessagesChip) {
    if (timer) { clearTimeout(timer); timer = null }
    chip.value = next
    await load()
  }

  /** Saisie : la requête part 300 ms après la dernière frappe, et seulement si la recherche effective change. */
  function setSearch(value: string) {
    search.value = value
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      if (effectiveQuery(search.value) !== appliedQuery) void load()
    }, MESSAGES_SEARCH_DELAY_MS)
  }

  onScopeDispose(() => { if (timer) clearTimeout(timer) })

  return { chip, search, items, isLoading, isLoadingMore, error, hasMore, load, loadMore, selectChip, setSearch }
}
