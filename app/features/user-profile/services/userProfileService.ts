import { useApi } from '@/composables/useApi'
import type { SectionPage, UserOverview, UserSection } from '@/features/user-profile/types/index'

export const userProfileService = {
  overview(id: string): Promise<UserOverview> {
    return useApi()<UserOverview>(`/admin/users/${encodeURIComponent(id)}/overview`)
  },
  section<T>(id: string, section: UserSection, page: number, size: number, extra?: Record<string, string>): Promise<SectionPage<T>> {
    return useApi()<SectionPage<T>>(`/admin/users/${encodeURIComponent(id)}/${section}`, { query: { page, size, ...extra } })
  },
}
