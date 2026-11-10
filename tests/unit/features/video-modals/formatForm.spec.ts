import { afterEach, describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import VideoModalForm from '@/features/video-modals/components/VideoModalForm.vue'
import type { VideoModalInput } from '@/features/video-modals/types/index'
import { infoModal, modal } from './fixtures'

const mountForm = (props: Record<string, unknown> = {}) => mount(VideoModalForm, { props: { modal: null, ...props } })
const JPEG = () => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 1])], 'concours.jpg', { type: 'image/jpeg' })
const GIF = () => new File([new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0])], 'a.gif', { type: 'image/gif' })

async function fillInfo(w: ReturnType<typeof mountForm>) {
  await w.get('[data-test="vm-name"]').setValue('Concours')
  await w.get('[data-test="vm-title-fr"]').setValue('Concours')
  await w.get('[data-test="vm-body-fr"]').setValue('Gagnez un billet')
}

async function pick(w: ReturnType<typeof mountForm>, file: File) {
  const input = w.get('[data-test="vm-image-file"]')
  Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
  await input.trigger('change')
}

afterEach(() => vi.unstubAllGlobals())

describe('formulaire : format et taille (vidéo et information)', () => {
  it('le sélecteur de format, le curseur et le rappel de compatibilité sont visibles dans les deux types', () => {
    for (const w of [mountForm(), mountForm({ type: 'INFO' })]) {
      expect(w.find('[data-test="vm-format"]').exists()).toBe(true)
      expect(w.get('[data-test="vm-compat-note"]').text()).toBe(
        'Les nouveaux formats et images ne s’affichent que sur la version récente de l’application ; les anciennes versions ne reçoivent pas ces modals.',
      )
    }
  })

  it('vidéo : choisir Carte centrée et 60 % est envoyé et l’aperçu suit', async () => {
    const w = mountForm()
    await w.get('[data-test="vm-name"]').setValue('V')
    await w.get('[data-test="vm-url"]').setValue('https://youtu.be/dQw4w9WgXcQ')
    await w.get('[data-test="vm-title-fr"]').setValue('T')
    await w.get('[data-test="vm-layout-CENTERED"]').trigger('click')
    await w.get('[data-test="vm-size-auto"]').setValue(false)
    await w.get('[data-test="vm-size-range"]').setValue('70')
    expect(w.get('[data-test="vm-shell"]').attributes('data-layout')).toBe('CENTERED')
    expect(w.get('[data-test="vm-shell"]').attributes('style')).toContain('70%')
    await w.get('form').trigger('submit')
    const [input] = w.emitted('submit')![0] as [VideoModalInput]
    expect(input).toMatchObject({ type: 'VIDEO', layout: 'CENTERED', sizePercent: 70 })
    expect(input).not.toHaveProperty('imageMode')
  })

  it('vidéo : pas de section Image', () => {
    expect(mountForm().find('[data-test="vm-image"]').exists()).toBe(false)
  })

  it('campagne vidéo ancienne : feuille du bas, taille auto, envoi inchangé', async () => {
    const w = mountForm({ modal: modal() })
    expect(w.get('[data-test="vm-layout-BOTTOM_SHEET"]').attributes('aria-checked')).toBe('true')
    expect(w.get('[data-test="vm-size-value"]').text()).toBe('Auto')
    await w.get('form').trigger('submit')
    const [input] = w.emitted('submit')![0] as [VideoModalInput]
    expect(input).toMatchObject({ layout: 'BOTTOM_SHEET', sizePercent: null })
  })

  it('plein écran : curseur désactivé, taille non envoyée', async () => {
    const w = mountForm({ modal: infoModal({ layout: 'CENTERED', sizePercent: 50 }) })
    await w.get('[data-test="vm-layout-FULLSCREEN"]').trigger('click')
    expect(w.get('[data-test="vm-size-range"]').attributes('disabled')).toBeDefined()
    await w.get('form').trigger('submit')
    const [input] = w.emitted('submit')![0] as [VideoModalInput]
    expect(input).toMatchObject({ layout: 'FULLSCREEN', sizePercent: null })
  })
})

describe('formulaire information : image', () => {
  it('section Image présente ; mode Aucune par défaut ; l’aperçu n’a pas d’image', () => {
    const w = mountForm({ type: 'INFO' })
    expect(w.find('[data-test="vm-image"]').exists()).toBe(true)
    expect(w.get('[data-test="vm-image-mode-NONE"]').attributes('aria-checked')).toBe('true')
    expect(w.find('[data-test="vm-preview-banner"]').exists()).toBe(false)
  })

  it('mode choisi sans image : refus avec un message clair', async () => {
    const w = mountForm({ type: 'INFO' })
    await fillInfo(w)
    await w.get('[data-test="vm-image-mode-TOP"]').trigger('click')
    await w.get('form').trigger('submit')
    expect(w.emitted('submit')).toBeUndefined()
    expect(w.get('[data-test="vm-image-mode-error"]').text()).toContain('Envoyez une image')
  })

  it('création : fichier valide choisi, aperçu en direct, envoyé avec la soumission', async () => {
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:abc'), revokeObjectURL: vi.fn() }))
    const w = mountForm({ type: 'INFO' })
    await fillInfo(w)
    await w.get('[data-test="vm-image-mode-POSTER"]').trigger('click')
    await pick(w, JPEG())
    await vi.waitFor(() => expect(w.get('[data-test="vm-image-state"]').text()).toBe('concours.jpg'))
    expect(w.get('[data-test="vm-preview-image"]').attributes('src')).toBe('blob:abc')
    expect(w.find('[data-test="vm-preview-title"]').exists()).toBe(false)
    await w.get('[data-test="vm-image-fit-CONTAIN"]').trigger('click')
    await w.get('[data-test="vm-image-alt-fr"]').setValue('Affiche')
    await w.get('form').trigger('submit')
    const [input, activate, file] = w.emitted('submit')![0] as [VideoModalInput, boolean, File | null]
    expect(input).toMatchObject({ imageMode: 'POSTER', imageFit: 'CONTAIN', imageAltFr: 'Affiche' })
    expect(input).not.toHaveProperty('imageUrl')
    expect(activate).toBe(false)
    expect(file?.name).toBe('concours.jpg')
    w.unmount()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:abc')
  })

  it('création : fichier refusé (GIF) avec message, rien n’est retenu', async () => {
    const w = mountForm({ type: 'INFO' })
    await w.get('[data-test="vm-image-mode-TOP"]').trigger('click')
    await pick(w, GIF())
    await vi.waitFor(() => expect(w.find('[data-test="vm-image-file-error"]').exists()).toBe(true))
    expect(w.get('[data-test="vm-image-file-error"]').text()).toContain('Format non accepté')
    expect(w.get('[data-test="vm-image-state"]').text()).toBe('Aucune image envoyée')
  })

  it('création : retirer le fichier choisi repasse le mode à Aucune', async () => {
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:abc'), revokeObjectURL: vi.fn() }))
    const w = mountForm({ type: 'INFO' })
    await w.get('[data-test="vm-image-mode-TOP"]').trigger('click')
    await pick(w, JPEG())
    await vi.waitFor(() => expect(w.find('[data-test="vm-image-remove"]').exists()).toBe(true))
    await w.get('[data-test="vm-image-remove"]').trigger('click')
    expect(w.emitted('remove-image')).toBeUndefined()
    expect(w.get('[data-test="vm-image-mode-NONE"]').attributes('aria-checked')).toBe('true')
  })

  it('modification : le fichier part tout de suite (upload-image), sans attendre Enregistrer', async () => {
    const m = infoModal()
    const w = mountForm({ modal: m })
    await w.get('[data-test="vm-image-mode-TOP"]').trigger('click')
    const f = JPEG()
    await pick(w, f)
    await vi.waitFor(() => expect(w.emitted('upload-image')).toBeTruthy())
    expect(w.emitted('upload-image')![0]).toEqual([f])
  })

  it('modification : image du serveur affichée dans l’aperçu, Retirer émet remove-image', async () => {
    const w = mountForm({ modal: infoModal({ imageMode: 'TOP', imageUrl: 'https://cdn/x.jpg', imageFit: 'CONTAIN', imageAltFr: 'Alt' }) })
    expect(w.get('[data-test="vm-preview-image"]').attributes('src')).toBe('https://cdn/x.jpg')
    expect(w.get('[data-test="vm-image-fit-CONTAIN"]').attributes('aria-checked')).toBe('true')
    await w.get('[data-test="vm-image-remove"]').trigger('click')
    expect(w.emitted('remove-image')).toHaveLength(1)
    await w.get('form').trigger('submit')
    const [input, , file] = w.emitted('submit')![0] as [VideoModalInput, boolean, File | null]
    expect(input).toMatchObject({ imageMode: 'TOP', imageAltFr: 'Alt' })
    expect(file).toBeNull()
  })

  it('l’image retirée par le back repasse la saisie à Aucune', async () => {
    const w = mountForm({ modal: infoModal({ imageMode: 'POSTER', imageUrl: 'https://cdn/x.jpg' }) })
    await w.setProps({ modal: infoModal({ imageMode: 'NONE', imageUrl: null }) })
    await vi.waitFor(() => expect(w.get('[data-test="vm-image-mode-NONE"]').attributes('aria-checked')).toBe('true'))
  })

  it('texte alternatif de plus de 200 caractères : refus', async () => {
    const w = mountForm({ modal: infoModal({ imageMode: 'TOP', imageUrl: 'https://cdn/x.jpg' }) })
    await w.get('[data-test="vm-image-alt-fr"]').setValue('a'.repeat(201))
    await w.get('form').trigger('submit')
    expect(w.emitted('submit')).toBeUndefined()
    expect(w.text()).toContain('200 caractères au plus')
  })

  it('non-régression : information sans image, créée comme avant', async () => {
    const w = mountForm({ type: 'INFO' })
    await fillInfo(w)
    await w.get('form').trigger('submit')
    const [input, , file] = w.emitted('submit')![0] as [VideoModalInput, boolean, File | null]
    expect(input).toMatchObject({ type: 'INFO', layout: 'BOTTOM_SHEET', sizePercent: null, imageMode: 'NONE' })
    expect(file).toBeNull()
  })
})
