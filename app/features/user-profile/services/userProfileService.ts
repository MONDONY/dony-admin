import { useApi } from '@/composables/useApi'
import type { SectionPage, UserOverview, UserOverviewKpis, UserSection } from '@/features/user-profile/types/index'

const KPI_KEYS: (keyof UserOverviewKpis)[] = [
  'parcelsInProgress', 'activeTrips', 'heldByCurrency', 'openDisputes', 'totalDisputes',
  'reportsReceived', 'reportsSent', 'reportsPending', 'averageRating', 'ratingCount',
]

/**
 * Le back omet les champs nuls du JSON (NON_NULL) : on les remet à `null` une seule fois ici,
 * pour que le reste du code garde le contrat strict `T | null` (null = permission absente).
 */
export function normalizeOverview(raw: Partial<UserOverview> | null | undefined): UserOverview {
  const src = (raw?.kpis ?? {}) as Partial<UserOverviewKpis>
  const kpis = {} as Record<string, unknown>
  for (const k of KPI_KEYS) kpis[k] = src[k] ?? null
  return {
    kpis: kpis as unknown as UserOverviewKpis,
    inProgress: raw?.inProgress ?? null,
    timeline: raw?.timeline ?? null,
  }
}

export const userProfileService = {
  async overview(id: string): Promise<UserOverview> {
    return normalizeOverview(await useApi()<Partial<UserOverview>>(`/admin/users/${encodeURIComponent(id)}/overview`))
  },
  section<T>(id: string, section: UserSection, page: number, size: number, extra?: Record<string, string>): Promise<SectionPage<T>> {
    return useApi()<SectionPage<T>>(`/admin/users/${encodeURIComponent(id)}/${section}`, { query: { page, size, ...extra } })
  },
}
