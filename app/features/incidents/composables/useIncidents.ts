import { computed, ref } from 'vue'
import { incidentsService } from '@/features/incidents/services/incidentsService'
import type { AdminDisputeListItem, AdminNoShow } from '@/features/incidents/types/index'
import { disputeIncident, noShowIncident, type Incident, type TabFilter } from '@/features/incidents/lib/incidentWorkbench'
import { extractProblemMessage } from '@/lib/problemDetail'

/** Une page de chaque nature : au-delà, la file le dit et l'admin affine par la recherche ou le statut. */
export const INCIDENTS_PAGE_SIZE = 100

/**
 * File fusionnée des litiges et des déclarations d'absence. Les litiges ouverts et toutes les
 * absences sont toujours lus (la synthèse en dépend) ; les litiges résolus ne le sont que pour les
 * onglets « Traités » et « Tous ». Une source en panne n'efface pas l'autre.
 */
export function useIncidents() {
  const openDisputes = ref<AdminDisputeListItem[]>([])
  const closedDisputes = ref<AdminDisputeListItem[]>([])
  const noshows = ref<AdminNoShow[]>([])
  const tab = ref<TabFilter>('TODO')
  const isLoading = ref(false)
  /** Les deux sources ont échoué : rien à montrer. */
  const error = ref<string | null>(null)
  /** Une seule source a échoué : la file est partielle et le dit. */
  const warning = ref<string | null>(null)
  const truncated = ref(false)

  /** Tous les incidents connus, dans l'ordre de lecture ; l'onglet n'en retient qu'une partie. */
  const all = computed<Incident[]>(() => [
    ...openDisputes.value.map(disputeIncident),
    ...closedDisputes.value.map(disputeIncident),
    ...noshows.value.map(noShowIncident),
  ])
  const incidents = computed<Incident[]>(() => all.value.filter((i) => tab.value === 'ALL' || (tab.value === 'TODO') === i.todo))
  /** Ce qui reste à traiter, quel que soit l'onglet : la synthèse ne dépend pas du filtre. */
  const todo = computed<Incident[]>(() => all.value.filter((i) => i.todo))

  async function fetch() {
    isLoading.value = true
    error.value = null; warning.value = null
    const needClosed = tab.value !== 'TODO'
    const [open, closed, ns] = await Promise.allSettled([
      incidentsService.listDisputes('OPEN', 0, INCIDENTS_PAGE_SIZE),
      needClosed ? incidentsService.listDisputes('RESOLVED', 0, INCIDENTS_PAGE_SIZE) : Promise.resolve(null),
      incidentsService.listNoShows({ status: 'ALL', scope: 'ALL' }, 0, INCIDENTS_PAGE_SIZE),
    ])
    const failures: string[] = []
    if (open.status === 'fulfilled') {
      openDisputes.value = open.value.content
      truncated.value = open.value.totalElements > open.value.content.length
    } else failures.push(extractProblemMessage(open.reason, 'Litiges indisponibles'))
    if (closed.status === 'fulfilled') {
      closedDisputes.value = closed.value?.content ?? []
      if (closed.value && closed.value.totalElements > closed.value.content.length) truncated.value = true
    } else failures.push(extractProblemMessage(closed.reason, 'Litiges résolus indisponibles'))
    if (ns.status === 'fulfilled') {
      noshows.value = ns.value.content
      if (ns.value.totalElements > ns.value.content.length) truncated.value = true
    } else failures.push(extractProblemMessage(ns.reason, 'Absences indisponibles'))

    const sources = needClosed ? 3 : 2
    if (failures.length >= sources) error.value = failures[0]!
    else if (failures.length) warning.value = `Liste incomplète : ${failures.join(' ; ')}`
    isLoading.value = false
  }

  async function setTab(next: TabFilter) {
    if (next === tab.value) return
    tab.value = next
    await fetch()
  }

  return { incidents, todo, tab, isLoading, error, warning, truncated, fetch, setTab, noshows }
}
