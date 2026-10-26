import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/features/incidents/services/incidentsService')
import { useIncidents, INCIDENTS_PAGE_SIZE } from '@/features/incidents/composables/useIncidents'
import { incidentsService } from '@/features/incidents/services/incidentsService'
import { dispute, noShow } from './noShowFixtures'
const svc = incidentsService as any

const page = (content: unknown[], total = content.length) => ({ content, totalElements: total, totalPages: 1, number: 0, size: INCIDENTS_PAGE_SIZE })
const boom = (detail: string) => Object.assign(new Error(detail), { statusCode: 500, data: { detail } })

describe('useIncidents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    svc.listDisputes = vi.fn().mockImplementation(async (status: string) => page(status === 'OPEN' ? [dispute({ id: 'd1' })] : [dispute({ id: 'd9', status: 'RESOLVED' })]))
    svc.listNoShows = vi.fn().mockResolvedValue(page([noShow({ id: 'n1' }), noShow({ id: 'n2', status: 'CONFIRMED' })]))
  })

  it('onglet À traiter : litiges ouverts et absences en attente, sans lire les litiges résolus', async () => {
    const s = useIncidents()
    await s.fetch()
    expect(svc.listDisputes).toHaveBeenCalledTimes(1)
    expect(svc.listDisputes).toHaveBeenCalledWith('OPEN', 0, INCIDENTS_PAGE_SIZE)
    expect(svc.listNoShows).toHaveBeenCalledWith({ status: 'ALL', scope: 'ALL' }, 0, INCIDENTS_PAGE_SIZE)
    expect(s.incidents.value.map((i) => i.key)).toEqual(['dispute:d1', 'noshow:n1'])
    expect(s.todo.value).toHaveLength(2)
    expect(s.isLoading.value).toBe(false)
    expect(s.error.value).toBeNull()
    expect(s.warning.value).toBeNull()
  })

  it('onglet Traités : litiges résolus et absences déjà tranchées', async () => {
    const s = useIncidents()
    await s.fetch()
    await s.setTab('DONE')
    expect(svc.listDisputes).toHaveBeenCalledWith('RESOLVED', 0, INCIDENTS_PAGE_SIZE)
    expect(s.incidents.value.map((i) => i.key)).toEqual(['dispute:d9', 'noshow:n2'])
    // La synthèse ne dépend pas de l'onglet.
    expect(s.todo.value.map((i) => i.key)).toEqual(['dispute:d1', 'noshow:n1'])
  })

  it('onglet Tous : tout, et revenir sur le même onglet ne relit rien', async () => {
    const s = useIncidents()
    await s.fetch()
    await s.setTab('ALL')
    expect(s.incidents.value).toHaveLength(4)
    const calls = svc.listDisputes.mock.calls.length
    await s.setTab('ALL')
    expect(svc.listDisputes.mock.calls.length).toBe(calls)
  })

  it('une source en panne : la file reste, avec un avertissement', async () => {
    svc.listNoShows.mockRejectedValue(boom('Absences en panne'))
    const s = useIncidents()
    await s.fetch()
    expect(s.incidents.value.map((i) => i.key)).toEqual(['dispute:d1'])
    expect(s.warning.value).toBe('Liste incomplète : Absences en panne')
    expect(s.error.value).toBeNull()
  })

  it('le litige résolu en panne sur l’onglet Traités : avertissement, le reste s’affiche', async () => {
    const s = useIncidents()
    await s.fetch()
    svc.listDisputes.mockImplementation(async (status: string) => { if (status === 'RESOLVED') throw boom('Résolus en panne'); return page([dispute({ id: 'd1' })]) })
    await s.setTab('DONE')
    expect(s.warning.value).toBe('Liste incomplète : Résolus en panne')
    expect(s.incidents.value.map((i) => i.key)).toEqual(['noshow:n2'])
  })

  it('toutes les sources en panne : erreur, pas de liste vide trompeuse', async () => {
    svc.listDisputes.mockRejectedValue(boom('Litiges en panne'))
    svc.listNoShows.mockRejectedValue(boom('Absences en panne'))
    const s = useIncidents()
    await s.fetch()
    expect(s.error.value).toBe('Litiges en panne')
    expect(s.warning.value).toBeNull()
  })

  it('erreur sans détail : message par défaut', async () => {
    svc.listDisputes.mockRejectedValue({})
    svc.listNoShows.mockRejectedValue({})
    const s = useIncidents()
    await s.fetch()
    expect(s.error.value).toBe('Litiges indisponibles')
  })

  it('signale une liste tronquée quand le serveur en a plus que la page', async () => {
    svc.listDisputes.mockResolvedValue(page([dispute()], 250))
    const s = useIncidents()
    await s.fetch()
    expect(s.truncated.value).toBe(true)
    svc.listDisputes.mockResolvedValue(page([dispute()]))
    svc.listNoShows.mockResolvedValue(page([noShow()], 300))
    await s.fetch()
    expect(s.truncated.value).toBe(true)
    svc.listNoShows.mockResolvedValue(page([noShow()]))
    await s.fetch()
    expect(s.truncated.value).toBe(false)
  })

  it('tronqué aussi sur les litiges résolus', async () => {
    const s = useIncidents()
    await s.fetch()
    svc.listDisputes.mockImplementation(async (status: string) => page([dispute({ status: status === 'OPEN' ? 'OPEN' : 'RESOLVED' })], status === 'OPEN' ? 1 : 400))
    await s.setTab('DONE')
    expect(s.truncated.value).toBe(true)
  })
})
