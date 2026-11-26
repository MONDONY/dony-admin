import { computed, ref } from 'vue'
import { supportService } from '@/features/support/services/supportService'
import { SUPPORT_PAGE_SIZE } from '@/features/support/composables/useSupportTickets'
import { filterForChip, sortNewestFirst, type SupportChip } from '@/features/mobile/lib/mobileSupport'
import type { AdminSupportTicket } from '@/features/support/types/index'
import { extractProblemMessage } from '@/lib/problemDetail'

/** Liste mobile des conversations : lecture seule, une page, plus récentes d'abord. */
export function useMobileSupportList() {
  const chip = ref<SupportChip>('OPEN')
  const tickets = ref<AdminSupportTicket[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  let seq = 0

  const sorted = computed(() => sortNewestFirst(filterForChip(tickets.value, chip.value)))

  async function load() {
    const my = ++seq
    const wanted = chip.value
    isLoading.value = true
    error.value = null
    try {
      const page = await supportService.list('all', wanted === 'RESOLVED' ? 'RESOLVED' : 'TOUS', 0, SUPPORT_PAGE_SIZE)
      if (my === seq) tickets.value = page.content
    } catch (e) {
      if (my === seq) error.value = extractProblemMessage(e, 'Impossible de charger les conversations')
    } finally {
      if (my === seq) isLoading.value = false
    }
  }

  async function selectChip(next: SupportChip) {
    chip.value = next
    await load()
  }

  return { chip, sorted, isLoading, error, load, selectChip }
}
