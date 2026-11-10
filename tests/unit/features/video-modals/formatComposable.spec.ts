import { describe, it, expect, vi, beforeEach } from 'vitest'
const svc = vi.hoisted(() => ({
  list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), publishVersion: vi.fn(), setActive: vi.fn(), remove: vi.fn(),
  uploadImage: vi.fn(), removeImage: vi.fn(),
}))
vi.mock('@/features/video-modals/services/videoModalService', () => ({ videoModalService: svc }))
import { useVideoModals } from '@/features/video-modals/composables/useVideoModals'
import { infoInput, infoModal } from './fixtures'

const jpeg = (pad = 0) => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(pad).fill(0)])], 'a.jpg', { type: 'image/jpeg' })
const problem = (detail: string) => ({ data: { detail } })

describe('useVideoModals : image', () => {
  beforeEach(() => Object.values(svc).forEach(f => f.mockReset()))

  describe('uploadImage', () => {
    it('envoie le fichier et met la fiche à jour avec la réponse', async () => {
      const vm = useVideoModals()
      vm.current.value = infoModal()
      svc.uploadImage.mockResolvedValue(infoModal({ imageUrl: 'https://cdn/x.jpg' }))
      expect(await vm.uploadImage(infoModal().id, jpeg())).toBe(true)
      expect(vm.current.value?.imageUrl).toBe('https://cdn/x.jpg')
      expect(vm.busy.value).toBe(false)
    })

    it('fichier refusé côté client : aucune requête, message clair', async () => {
      const vm = useVideoModals()
      expect(await vm.uploadImage('m1', jpeg(3 * 1024 * 1024))).toBe(false)
      expect(svc.uploadImage).not.toHaveBeenCalled()
      expect(vm.error.value).toContain('trop lourde')
    })

    it('réponse sans corps : recharge la fiche', async () => {
      const vm = useVideoModals()
      vm.current.value = infoModal()
      svc.uploadImage.mockResolvedValue(undefined)
      svc.get.mockResolvedValue(infoModal({ imageUrl: 'https://cdn/y.jpg' }))
      expect(await vm.uploadImage(infoModal().id, jpeg())).toBe(true)
      await vi.waitFor(() => expect(vm.current.value?.imageUrl).toBe('https://cdn/y.jpg'))
    })

    it('422 du back : son message, rien n’est perdu', async () => {
      const vm = useVideoModals()
      svc.uploadImage.mockRejectedValue(problem('Image trop grande'))
      expect(await vm.uploadImage('m1', jpeg())).toBe(false)
      expect(vm.error.value).toBe('Image trop grande')
    })
  })

  describe('removeImage', () => {
    it('applique la réponse du back', async () => {
      const vm = useVideoModals()
      vm.current.value = infoModal({ imageUrl: 'https://cdn/x.jpg', imageMode: 'TOP' })
      svc.removeImage.mockResolvedValue(infoModal({ imageUrl: null, imageMode: 'NONE' }))
      expect(await vm.removeImage(infoModal().id)).toBe(true)
      expect(vm.current.value?.imageUrl).toBeNull()
    })

    it('réponse vide (204) : la fiche locale repasse à Aucune', async () => {
      const vm = useVideoModals()
      vm.current.value = infoModal({ imageUrl: 'https://cdn/x.jpg', imageMode: 'POSTER' })
      svc.removeImage.mockResolvedValue(undefined)
      expect(await vm.removeImage(infoModal().id)).toBe(true)
      expect(vm.current.value).toMatchObject({ imageUrl: null, imageMode: 'NONE' })
    })

    it('échec : message du back', async () => {
      const vm = useVideoModals()
      svc.removeImage.mockRejectedValue(problem('Introuvable'))
      expect(await vm.removeImage('m1')).toBe(false)
      expect(vm.error.value).toBe('Introuvable')
    })

    it('échec sans détail : message par défaut', async () => {
      const vm = useVideoModals()
      svc.removeImage.mockRejectedValue({})
      expect(await vm.removeImage('m1')).toBe(false)
      expect(vm.error.value).toContain('Suppression de l’image')
    })
  })

  describe('createWithImage', () => {
    const input = infoInput({ imageMode: 'POSTER', layout: 'FULLSCREEN' })
    const created = infoModal()

    it('sans fichier : création normale (avec activation si demandée)', async () => {
      const vm = useVideoModals()
      svc.create.mockResolvedValue(created)
      svc.setActive.mockResolvedValue({ ...created, active: true })
      const res = await vm.createWithImage(infoInput(), true, null)
      expect(res.imageError).toBeNull()
      expect(res.modal?.active).toBe(true)
      expect(svc.uploadImage).not.toHaveBeenCalled()
    })

    it('avec fichier : crée sans image, envoie, enregistre le mode, puis active, dans cet ordre', async () => {
      const order: string[] = []
      svc.create.mockImplementation(async (b) => { order.push(`create:${b.imageMode}`); return created })
      svc.uploadImage.mockImplementation(async () => { order.push('upload'); return { ...created, imageUrl: 'https://cdn/x.jpg' } })
      svc.update.mockImplementation(async (_id, b) => { order.push(`update:${b.imageMode}`); return { ...created, imageUrl: 'https://cdn/x.jpg', imageMode: 'POSTER' } })
      svc.setActive.mockImplementation(async () => { order.push('active'); return { ...created, active: true } })
      const vm = useVideoModals()
      const res = await vm.createWithImage(input, true, jpeg())
      expect(order).toEqual(['create:NONE', 'upload', 'update:POSTER', 'active'])
      expect(res.imageError).toBeNull()
      expect(res.modal?.active).toBe(true)
    })

    it('avec fichier, sans activation : n’active pas', async () => {
      svc.create.mockResolvedValue(created)
      svc.uploadImage.mockResolvedValue(created)
      svc.update.mockResolvedValue(created)
      const vm = useVideoModals()
      await vm.createWithImage(input, false, jpeg())
      expect(svc.setActive).not.toHaveBeenCalled()
    })

    it('création refusée : rien d’envoyé', async () => {
      svc.create.mockRejectedValue(problem('Nom déjà pris'))
      const vm = useVideoModals()
      const res = await vm.createWithImage(input, true, jpeg())
      expect(res).toEqual({ modal: null, imageError: null })
      expect(vm.error.value).toBe('Nom déjà pris')
      expect(svc.uploadImage).not.toHaveBeenCalled()
    })

    it('envoi refusé : la campagne reste créée et inactive, l’erreur est rendue', async () => {
      svc.create.mockResolvedValue(created)
      svc.uploadImage.mockRejectedValue(problem('Fichier refusé'))
      const vm = useVideoModals()
      const res = await vm.createWithImage(input, true, jpeg())
      expect(res.modal?.id).toBe(created.id)
      expect(res.imageError).toBe('Fichier refusé')
      expect(svc.update).not.toHaveBeenCalled()
      expect(svc.setActive).not.toHaveBeenCalled()
    })

    it('mode non enregistré après l’envoi : erreur rendue, pas d’activation', async () => {
      svc.create.mockResolvedValue(created)
      svc.uploadImage.mockResolvedValue(created)
      svc.update.mockRejectedValue(problem('Mode refusé'))
      const vm = useVideoModals()
      const res = await vm.createWithImage(input, true, jpeg())
      expect(res.imageError).toBe('Mode refusé')
      expect(svc.setActive).not.toHaveBeenCalled()
    })
  })
})
