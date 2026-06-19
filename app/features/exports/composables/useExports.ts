import { reactive, ref } from 'vue'
import { exportService } from '@/features/exports/services/exportService'
import { downloadBlob } from '@/lib/downloadBlob'
import type { ExportFilterState } from '@/features/exports/types/index'

export function useExports() {
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const filters = reactive<ExportFilterState>({ type: 'transactions', from: null, to: null })

  function filename(): string {
    const range = [filters.from, filters.to].filter(Boolean).join('_')
    return range ? `export-${filters.type}-${range}.csv` : `export-${filters.type}.csv`
  }

  async function run() {
    isLoading.value = true
    error.value = null
    try {
      const blob = await exportService.fetchBlob({ type: filters.type, from: filters.from, to: filters.to })
      downloadBlob(blob, filename())
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      isLoading.value = false
    }
  }

  return { isLoading, error, filters, run }
}
