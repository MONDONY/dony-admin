import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/features/users/services/usersService')

import { usersService } from '@/features/users/services/usersService'
import { useUserDeletion } from '@/features/users/composables/useUserDeletion'

const svc = usersService as unknown as {
  getDeletionImpact: ReturnType<typeof vi.fn>
  deleteUser: ReturnType<typeof vi.fn>
}

const cleanImpact = { blocked: false, findings: [] }

describe('useUserDeletion', () => {
  beforeEach(() => {
    svc.getDeletionImpact = vi.fn()
    svc.deleteUser = vi.fn()
  })

  it('charge le rapport d\'impact', async () => {
    svc.getDeletionImpact.mockResolvedValue(cleanImpact)
    const d = useUserDeletion()

    await d.loadImpact('u1')

    expect(svc.getDeletionImpact).toHaveBeenCalledWith('u1')
    expect(d.impact.value).toEqual(cleanImpact)
    expect(d.isLoading.value).toBe(false)
  })

  // Le rapport doit disparaître dès le début du chargement, pas seulement à son issue :
  // afficher celui du compte précédent pendant qu'on charge le suivant l'attribuerait au
  // mauvais compte, sur l'écran même où se décide une suppression irréversible.
  it('vide le rapport dès le début du chargement, avant que l\'appel ne réponde', async () => {
    svc.getDeletionImpact.mockResolvedValue(cleanImpact)
    const d = useUserDeletion()
    await d.loadImpact('u1')
    expect(d.impact.value).toEqual(cleanImpact)

    let resolveSecond: (v: unknown) => void = () => {}
    svc.getDeletionImpact.mockReturnValue(new Promise((r) => { resolveSecond = r }))

    const pending = d.loadImpact('u2')
    // L'appel n'a pas encore répondu : le rapport précédent doit déjà avoir disparu.
    expect(d.impact.value).toBeNull()
    expect(d.isLoading.value).toBe(true)

    resolveSecond(cleanImpact)
    await pending
    expect(d.impact.value).toEqual(cleanImpact)
  })

  // Laisser le rapport précédent visible après un échec ferait décider l'administrateur
  // sur des informations qui ne sont plus celles du compte affiché.
  it('vide le rapport quand le chargement échoue', async () => {
    svc.getDeletionImpact.mockResolvedValue(cleanImpact)
    const d = useUserDeletion()
    await d.loadImpact('u1')

    svc.getDeletionImpact.mockRejectedValue(new Error('boom'))
    await d.loadImpact('u2')

    expect(d.impact.value).toBeNull()
    expect(d.error.value).toBeTruthy()
  })

  it('remove() rend true et appelle le service avec les deux motifs', async () => {
    svc.deleteUser.mockResolvedValue(undefined)
    const d = useUserDeletion()

    const ok = await d.remove('u1', 'FRAUD', 'faux documents')

    expect(ok).toBe(true)
    expect(svc.deleteUser).toHaveBeenCalledWith('u1', 'FRAUD', 'faux documents')
    expect(d.busy.value).toBe(false)
  })

  it('remove() rend false et expose le message du back en cas de refus', async () => {
    svc.deleteUser.mockRejectedValue({
      data: { detail: 'Suppression impossible — des engagements financiers sont encore en cours' },
    })
    const d = useUserDeletion()

    const ok = await d.remove('u1', 'FRAUD', 'faux documents')

    expect(ok).toBe(false)
    expect(d.error.value).toContain('engagements financiers')
    expect(d.busy.value).toBe(false)
  })

  // Constat 2 — garde d'obsolescence : si la réponse du premier appel arrive après celle
  // du second, elle ne doit pas écraser le rapport du compte actuellement affiché.
  it('ignore la réponse du premier appel quand un second a déjà répondu', async () => {
    let resolveFirst!: (v: unknown) => void
    const firstImpact = { blocked: false, findings: [{ severity: 'INFO', code: 'INFO_A', count: 1, parties: [] }] }
    const secondImpact = { blocked: false, findings: [] }

    // Premier appel : ne résout pas tout de suite
    svc.getDeletionImpact.mockReturnValueOnce(new Promise((r) => { resolveFirst = r }))
    // Deuxième appel : résout immédiatement
    svc.getDeletionImpact.mockResolvedValueOnce(secondImpact)

    const d = useUserDeletion()

    // Lancer le premier appel sans l'attendre
    const p1 = d.loadImpact('u-compte-A')
    // Lancer le second avant que le premier n'ait répondu
    const p2 = d.loadImpact('u-compte-B')
    await p2

    // Faire répondre le premier après le second — la réponse doit être ignorée
    resolveFirst(firstImpact)
    await p1

    // Le rapport doit être celui du second appel, pas du premier
    expect(d.impact.value).toEqual(secondImpact)
    expect(d.isLoading.value).toBe(false)
  })

  it('reset() efface le rapport et l\'erreur', async () => {
    svc.getDeletionImpact.mockResolvedValue(cleanImpact)
    const d = useUserDeletion()
    await d.loadImpact('u1')

    d.reset()

    expect(d.impact.value).toBeNull()
    expect(d.error.value).toBeNull()
  })
})
