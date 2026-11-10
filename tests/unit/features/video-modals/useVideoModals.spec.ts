import { describe, it, expect, vi, beforeEach } from 'vitest'
const svc = vi.hoisted(() => ({
  list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), publishVersion: vi.fn(), setActive: vi.fn(), remove: vi.fn(),
}))
vi.mock('@/features/video-modals/services/videoModalService', () => ({ videoModalService: svc }))
import { useVideoModals } from '@/features/video-modals/composables/useVideoModals'
import { modal, validInput } from './fixtures'

const problem = (detail: string) => ({ data: { detail } })

describe('useVideoModals', () => {
  beforeEach(() => Object.values(svc).forEach(f => f.mockReset()))

  describe('fetchAll', () => {
    it('charge la liste', async () => {
      svc.list.mockResolvedValue([modal()])
      const vm = useVideoModals()
      await vm.fetchAll()
      expect(vm.items.value).toHaveLength(1)
      expect(vm.loading.value).toBe(false)
      expect(vm.error.value).toBeNull()
    })
    it('ignore une réponse qui n’est pas une liste', async () => {
      svc.list.mockResolvedValue({ content: [] })
      const vm = useVideoModals()
      await vm.fetchAll()
      expect(vm.items.value).toEqual([])
    })
    it('échec : message RFC 7807, ou message par défaut', async () => {
      svc.list.mockRejectedValueOnce(problem('Service indisponible'))
      const vm = useVideoModals()
      await vm.fetchAll()
      expect(vm.error.value).toBe('Service indisponible')
      svc.list.mockRejectedValueOnce({})
      await vm.fetchAll()
      expect(vm.error.value).toBe('Impossible de charger les modals vidéo')
    })
  })

  describe('fetchOne', () => {
    it('charge la fiche', async () => {
      svc.get.mockResolvedValue(modal())
      const vm = useVideoModals()
      await vm.fetchOne('m1')
      expect(svc.get).toHaveBeenCalledWith('m1')
      expect(vm.current.value?.name).toBe('Vidéo d’accueil')
    })
    it('échec : fiche vide et message', async () => {
      svc.get.mockRejectedValue(problem('Modal introuvable'))
      const vm = useVideoModals()
      await vm.fetchOne('m1')
      expect(vm.current.value).toBeNull()
      expect(vm.error.value).toBe('Modal introuvable')
    })
  })

  describe('save', () => {
    it('création sans activation', async () => {
      const created = modal()
      svc.create.mockResolvedValue(created)
      const vm = useVideoModals()
      const res = await vm.save(null, validInput())
      expect(res).toEqual(created)
      expect(svc.setActive).not.toHaveBeenCalled()
      expect(vm.items.value[0]).toEqual(created)
      expect(vm.current.value).toEqual(created)
      expect(vm.busy.value).toBe(false)
    })

    it('création puis activation (le back crée toujours inactif)', async () => {
      svc.create.mockResolvedValue(modal())
      svc.setActive.mockResolvedValue(modal({ active: true }))
      const vm = useVideoModals()
      const res = await vm.save(null, validInput(), true)
      expect(svc.setActive).toHaveBeenCalledWith(modal().id, true)
      expect(res?.active).toBe(true)
    })

    it('activation sans corps (204) : active quand même localement', async () => {
      svc.create.mockResolvedValue(modal())
      svc.setActive.mockResolvedValue(undefined)
      const vm = useVideoModals()
      expect((await vm.save(null, validInput(), true))?.active).toBe(true)
    })

    it('activation en échec : la campagne est créée, le message le dit', async () => {
      svc.create.mockResolvedValue(modal())
      svc.setActive.mockRejectedValue({})
      const vm = useVideoModals()
      const res = await vm.save(null, validInput(), true)
      expect(res?.active).toBe(false)
      expect(vm.error.value).toBe('Modal créé, mais son activation a échoué')
    })

    it('modification : PUT et remplacement dans la liste', async () => {
      svc.list.mockResolvedValue([modal(), modal({ id: 'other' })])
      svc.get.mockResolvedValue(modal())
      svc.update.mockResolvedValue(modal({ titleFr: 'Corrigé' }))
      const vm = useVideoModals()
      await vm.fetchAll()
      await vm.fetchOne(modal().id)
      const res = await vm.save(modal().id, validInput({ titleFr: 'Corrigé' }), true)
      expect(svc.update).toHaveBeenCalledWith(modal().id, expect.objectContaining({ titleFr: 'Corrigé' }))
      expect(svc.setActive).not.toHaveBeenCalled()
      expect(res?.titleFr).toBe('Corrigé')
      expect(vm.items.value).toHaveLength(2)
      expect(vm.items.value[0]!.titleFr).toBe('Corrigé')
      expect(vm.current.value?.titleFr).toBe('Corrigé')
    })

    it('réponse vide : null sans erreur', async () => {
      svc.update.mockResolvedValue(undefined)
      const vm = useVideoModals()
      expect(await vm.save('m1', validInput())).toBeNull()
      expect(vm.error.value).toBeNull()
    })

    it('422 du back : null et detail affiché', async () => {
      svc.create.mockRejectedValue(problem('Lien YouTube non reconnu'))
      const vm = useVideoModals()
      expect(await vm.save(null, validInput())).toBeNull()
      expect(vm.error.value).toBe('Lien YouTube non reconnu')
      svc.update.mockRejectedValue({})
      await vm.save('m1', validInput())
      expect(vm.error.value).toBe('Enregistrement impossible')
    })
  })

  describe('publishVersion', () => {
    it('remplace la campagne par la nouvelle version', async () => {
      svc.list.mockResolvedValue([modal()])
      svc.publishVersion.mockResolvedValue(modal({ version: 2, audience: 'EVERYONE' }))
      const vm = useVideoModals()
      await vm.fetchAll()
      expect(await vm.publishVersion(modal().id, { audience: 'EVERYONE' })).toBe(true)
      expect(vm.items.value[0]!.version).toBe(2)
    })
    it('réponse sans corps : recharge la campagne', async () => {
      svc.list.mockResolvedValue([modal()])
      svc.publishVersion.mockResolvedValue(undefined)
      svc.get.mockResolvedValue(modal({ version: 2 }))
      const vm = useVideoModals()
      await vm.fetchAll()
      expect(await vm.publishVersion(modal().id, { audience: 'EVERYONE' })).toBe(true)
      expect(svc.get).toHaveBeenCalledWith(modal().id)
      expect(vm.items.value[0]!.version).toBe(2)
    })
    it('rechargement en échec : succès gardé, liste inchangée', async () => {
      svc.list.mockResolvedValue([modal()])
      svc.publishVersion.mockResolvedValue(undefined)
      svc.get.mockRejectedValue({})
      const vm = useVideoModals()
      await vm.fetchAll()
      expect(await vm.publishVersion(modal().id, { audience: 'EVERYONE' })).toBe(true)
      expect(vm.items.value[0]!.version).toBe(1)
      expect(vm.error.value).toBeNull()
    })
    it('échec', async () => {
      svc.publishVersion.mockRejectedValue({})
      const vm = useVideoModals()
      expect(await vm.publishVersion('m1', { audience: 'EVERYONE' })).toBe(false)
      expect(vm.error.value).toBe('Publication de la nouvelle version impossible')
    })
  })

  describe('setActive', () => {
    it('réponse avec corps', async () => {
      svc.list.mockResolvedValue([modal()])
      svc.setActive.mockResolvedValue(modal({ active: true }))
      const vm = useVideoModals()
      await vm.fetchAll()
      expect(await vm.setActive(modal().id, true)).toBe(true)
      expect(vm.items.value[0]!.active).toBe(true)
    })
    it('réponse 204 : mise à jour locale de la liste et de la fiche', async () => {
      svc.list.mockResolvedValue([modal({ active: true })])
      svc.get.mockResolvedValue(modal({ active: true }))
      svc.setActive.mockResolvedValue(undefined)
      const vm = useVideoModals()
      await vm.fetchAll()
      await vm.fetchOne(modal().id)
      expect(await vm.setActive(modal().id, false)).toBe(true)
      expect(vm.items.value[0]!.active).toBe(false)
      expect(vm.current.value?.active).toBe(false)
      // Identifiant inconnu : rien ne bouge.
      expect(await vm.setActive('inconnu', true)).toBe(true)
      expect(vm.items.value[0]!.active).toBe(false)
    })
    it('échec : message selon le sens', async () => {
      svc.setActive.mockRejectedValue({})
      const vm = useVideoModals()
      expect(await vm.setActive('m1', true)).toBe(false)
      expect(vm.error.value).toBe('Activation impossible')
      await vm.setActive('m1', false)
      expect(vm.error.value).toBe('Désactivation impossible')
    })
  })

  describe('remove', () => {
    it('retire de la liste et vide la fiche', async () => {
      svc.list.mockResolvedValue([modal(), modal({ id: 'other' })])
      svc.get.mockResolvedValue(modal())
      svc.remove.mockResolvedValue(undefined)
      const vm = useVideoModals()
      await vm.fetchAll()
      await vm.fetchOne(modal().id)
      expect(await vm.remove(modal().id)).toBe(true)
      expect(vm.items.value.map(m => m.id)).toEqual(['other'])
      expect(vm.current.value).toBeNull()
    })
    it('garde la fiche d’une autre campagne', async () => {
      svc.get.mockResolvedValue(modal())
      svc.remove.mockResolvedValue(undefined)
      const vm = useVideoModals()
      await vm.fetchOne(modal().id)
      await vm.remove('other')
      expect(vm.current.value).not.toBeNull()
    })
    it('échec', async () => {
      svc.remove.mockRejectedValue(problem('Déjà supprimé'))
      const vm = useVideoModals()
      expect(await vm.remove('m1')).toBe(false)
      expect(vm.error.value).toBe('Déjà supprimé')
    })
  })
})
