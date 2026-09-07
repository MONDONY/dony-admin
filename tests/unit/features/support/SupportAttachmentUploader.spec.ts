import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { seedAuth } from '~/tests/helpers/auth'

// Mock du service d'upload - vi.mock est hisse, on utilise un wrapper
vi.mock('@/features/support/services/supportService', () => ({
  supportService: {
    uploadAttachment: (...args: unknown[]) => uploadAttachmentMock(...args),
  },
}))

const uploadAttachmentMock = vi.fn()

import SupportAttachmentUploader from '@/features/support/components/SupportAttachmentUploader.vue'

function makeFile(name = 'photo.jpg', type = 'image/jpeg', size = 1024): File {
  return new File(['x'.repeat(size)], name, { type })
}

function mountUploader() {
  return mount(SupportAttachmentUploader, {
    attachTo: document.body,
  })
}

describe('SupportAttachmentUploader', () => {
  beforeEach(() => {
    seedAuth('ADMIN')
    uploadAttachmentMock.mockReset()
  })

  it("rend un bouton d'ajout (input file cache)", () => {
    const w = mountUploader()
    const input = w.find('input[type="file"]')
    expect(input.exists()).toBe(true)
    w.unmount()
  })

  it('apres selection d\'un fichier, emet busy:true puis busy:false', async () => {
    uploadAttachmentMock.mockResolvedValue({ key: 'support/admin/u1/1_a.jpg', url: 'https://signed/1' })
    const w = mountUploader()
    const input = w.find('input[type="file"]')

    const file = makeFile()
    Object.defineProperty(input.element, 'files', {
      value: [file],
      configurable: true,
    })
    await input.trigger('change')

    // busy:true doit avoir ete emis
    const busyEvents = w.emitted('busy') as boolean[][]
    expect(busyEvents).toBeTruthy()
    expect(busyEvents[0]).toEqual([true])

    // Attendre la resolution de la promesse
    await new Promise(r => setTimeout(r, 0))
    await new Promise(r => setTimeout(r, 0))

    const busyEventsAfter = w.emitted('busy') as boolean[][]
    expect(busyEventsAfter[busyEventsAfter.length - 1]).toEqual([false])
    w.unmount()
  })

  it('emet change avec les cles rendues par le service', async () => {
    uploadAttachmentMock.mockResolvedValue({ key: 'support/admin/u1/1_a.jpg', url: 'https://signed/1' })
    const w = mountUploader()
    const input = w.find('input[type="file"]')

    Object.defineProperty(input.element, 'files', {
      value: [makeFile()],
      configurable: true,
    })
    await input.trigger('change')
    await new Promise(r => setTimeout(r, 0))
    await new Promise(r => setTimeout(r, 0))

    const changeEvents = w.emitted('change') as string[][][]
    expect(changeEvents).toBeTruthy()
    const lastChange = changeEvents[changeEvents.length - 1]
    expect(lastChange[0]).toContain('support/admin/u1/1_a.jpg')
    w.unmount()
  })

  it("desactive l'ajout au quatrieme fichier (plafond 4)", async () => {
    uploadAttachmentMock.mockImplementation((file: File) =>
      Promise.resolve({ key: `support/admin/u1/${file.name}`, url: `https://signed/${file.name}` }),
    )
    const w = mountUploader()

    // Ajouter 4 fichiers un par un
    for (let i = 1; i <= 4; i++) {
      const input = w.find('input[type="file"]')
      Object.defineProperty(input.element, 'files', {
        value: [makeFile(`photo${i}.jpg`)],
        configurable: true,
      })
      await input.trigger('change')
      await new Promise(r => setTimeout(r, 0))
      await new Promise(r => setTimeout(r, 0))
    }

    // Le bouton d'ajout doit etre desactive
    const addBtn = w.find('[data-testid="add-image-btn"]')
    expect(addBtn.exists()).toBe(true)
    expect(addBtn.attributes('disabled')).toBeDefined()
    w.unmount()
  })

  it("un upload en echec laisse la vignette retirable et n'ajoute pas de cle", async () => {
    uploadAttachmentMock.mockRejectedValue(new Error('500 Internal Server Error'))
    const w = mountUploader()
    const input = w.find('input[type="file"]')

    Object.defineProperty(input.element, 'files', {
      value: [makeFile('bad.jpg')],
      configurable: true,
    })
    await input.trigger('change')
    await new Promise(r => setTimeout(r, 0))
    await new Promise(r => setTimeout(r, 0))

    // Aucune cle ne doit etre dans le dernier change (echec = pas de cle)
    const changeEvents = w.emitted('change') as string[][][] | undefined
    const keysAfterFailure = changeEvents
      ? (changeEvents[changeEvents.length - 1]?.[0] ?? [])
      : []
    expect(keysAfterFailure).toHaveLength(0)

    // La vignette en echec est retirable
    const removeBtn = w.find('[data-testid="remove-item"]')
    expect(removeBtn.exists()).toBe(true)
    w.unmount()
  })

  it('ne fait rien quand on retire un identifiant inconnu', async () => {
    uploadAttachmentMock.mockResolvedValue({ key: 'support/admin/u1/1_a.jpg', url: 'https://signed/1' })
    const w = mountUploader()
    const input = w.find('input[type="file"]')

    // Ajouter un fichier
    Object.defineProperty(input.element, 'files', {
      value: [makeFile()],
      configurable: true,
    })
    await input.trigger('change')
    await new Promise(r => setTimeout(r, 0))
    await new Promise(r => setTimeout(r, 0))

    // Enregistrer le nombre initial d'items
    const initialCount = w.vm.items.length
    expect(initialCount).toBeGreaterThan(0)

    // Essayer de retirer un id qui n'existe pas
    w.vm.removeItem('id-inconnu-xyz')

    // Le nombre d'items doit rester inchange
    expect(w.vm.items.length).toBe(initialCount)

    // Aucun change event avec moins de cles ne doit etre emis
    const changeEvents = w.emitted('change') as string[][][] | undefined
    if (changeEvents) {
      const lastChange = changeEvents[changeEvents.length - 1]
      expect(lastChange[0]).toHaveLength(initialCount)
    }
    w.unmount()
  })

  it('affiche l\'indicateur d\'echec apres un upload rate', async () => {
    uploadAttachmentMock.mockRejectedValue(new Error('500 Internal Server Error'))
    const w = mountUploader()
    const input = w.find('input[type="file"]')

    Object.defineProperty(input.element, 'files', {
      value: [makeFile('bad.jpg')],
      configurable: true,
    })
    await input.trigger('change')
    await new Promise(r => setTimeout(r, 0))
    await new Promise(r => setTimeout(r, 0))

    // Verifier que la vignette a le statut error
    const item = w.vm.items[0]
    expect(item).toBeTruthy()
    expect(item.status).toBe('error')

    // Verifier que l'indicateur d'erreur est rendu
    const errorIndicator = w.find('.bg-danger\\/20')
    expect(errorIndicator.exists()).toBe(true)

    // Verifier que le texte d'erreur est visible
    const errorText = errorIndicator.find('.text-danger')
    expect(errorText.exists()).toBe(true)
    expect(errorText.text()).toBe('!')
    w.unmount()
  })

  it('tronque les fichiers au plafond quand on en envoie 5 avec 2 slots libres', async () => {
    uploadAttachmentMock.mockImplementation((file: File) =>
      Promise.resolve({ key: `support/admin/u1/${file.name}`, url: `https://signed/${file.name}` }),
    )
    const w = mountUploader()

    // Ajouter d'abord 2 fichiers
    for (let i = 1; i <= 2; i++) {
      const input = w.find('input[type="file"]')
      Object.defineProperty(input.element, 'files', {
        value: [makeFile(`pre${i}.jpg`)],
        configurable: true,
      })
      await input.trigger('change')
      await new Promise(r => setTimeout(r, 0))
      await new Promise(r => setTimeout(r, 0))
    }

    // Verifier que 2 items sont presents
    expect(w.vm.items).toHaveLength(2)

    // Maintenant envoyer 5 fichiers d'un coup (2 slots restent)
    const input = w.find('input[type="file"]')
    const fiveFiles = [
      makeFile('extra1.jpg'),
      makeFile('extra2.jpg'),
      makeFile('extra3.jpg'),
      makeFile('extra4.jpg'),
      makeFile('extra5.jpg'),
    ]
    Object.defineProperty(input.element, 'files', {
      value: fiveFiles,
      configurable: true,
    })
    await input.trigger('change')
    await new Promise(r => setTimeout(r, 0))
    await new Promise(r => setTimeout(r, 0))

    // Verifier que seuls 4 items au total sont presents (2 pre + 2 extra)
    expect(w.vm.items).toHaveLength(4)

    // Verifier que change a ete emis avec 4 cles
    const changeEvents = w.emitted('change') as string[][][] | undefined
    expect(changeEvents).toBeTruthy()
    const lastChange = changeEvents![changeEvents!.length - 1]
    expect(lastChange[0]).toHaveLength(4)

    w.unmount()
  })
})
