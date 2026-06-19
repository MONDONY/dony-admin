import { useApi } from '@/composables/useApi'
import type { ExportFilterState } from '@/features/exports/types/index'

export const exportService = {
  fetchBlob(filters: ExportFilterState): Promise<Blob> {
    const query: Record<string, string> = {}
    if (filters.from) query.from = filters.from
    if (filters.to) query.to = filters.to
    return useApi()<Blob>(`/admin/exports/${filters.type}`, { query, responseType: 'blob' })
  },
}
