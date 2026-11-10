/** Fiches Modals vidéo : création, modification sans nouvelle version, nouvelle version, suppression. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { seedAuth } from '~/tests/helpers/auth'
import { infoModal, modal } from '../features/video-modals/fixtures'

vi.stubGlobal('definePageMeta', vi.fn())
const navigateTo = vi.fn()
vi.stubGlobal('navigateTo', navigateTo)
const route = { params: { id: modal().id } as Record<string, unknown>, query: {} }
vi.stubGlobal('useRoute', () => route)

const svc = vi.hoisted(() => ({
  list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), publishVersion: vi.fn(), setActive: vi.fn(), remove: vi.fn(),
}))
vi.mock('@/features/video-modals/services/videoModalService', () => ({ videoModalService: svc }))

const NuxtLink = { name: 'NuxtLink', props: ['to'], template: '<a :href="to"><slot /></a>' }
const mounted: VueWrapper[] = []
async function mountPage(path: 'nouveau' | '[id]') {
  const mod = path === 'nouveau' ? await import('@/pages/modals-video/nouveau.vue') : await import('@/pages/modals-video/[id].vue')
  const w = mount(mod.default, { global: { stubs: { NuxtLink } }, attachTo: document.body })
  mounted.push(w)
  await flushPromises()
  return w
}

describe('pages/modals-video/nouveau', () => {
  afterEach(() => { mounted.splice(0).forEach(w => w.unmount()) })
  beforeEach(() => {
    seedAuth('ADMIN')
    Object.values(svc).forEach(f => f.mockReset())
    navigateTo.mockReset()
  })

  it('crée puis ouvre la fiche', async () => {
    svc.create.mockResolvedValue(modal())
    const w = await mountPage('nouveau')
    await w.get('[data-test="vm-type-VIDEO"]').trigger('click')
    await w.get('[data-test="vm-name"]').setValue('Vidéo d’accueil')
    await w.get('[data-test="vm-url"]').setValue('https://youtu.be/dQw4w9WgXcQ')
    await w.get('[data-test="vm-title-fr"]').setValue('Bienvenue')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(svc.create).toHaveBeenCalled()
    expect(navigateTo).toHaveBeenCalledWith(`/modals-video/${modal().id}`)
  })

  it('422 : reste sur place avec le message', async () => {
    svc.create.mockRejectedValue({ data: { detail: 'Lien YouTube non reconnu' } })
    const w = await mountPage('nouveau')
    await w.get('[data-test="vm-type-VIDEO"]').trigger('click')
    await w.get('[data-test="vm-name"]').setValue('A')
    await w.get('[data-test="vm-url"]').setValue('https://youtu.be/dQw4w9WgXcQ')
    await w.get('[data-test="vm-title-fr"]').setValue('B')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(navigateTo).not.toHaveBeenCalled()
    expect(w.get('[data-test="vm-error"]').text()).toBe('Lien YouTube non reconnu')
  })
})

describe('pages/modals-video/nouveau : type Information', () => {
  afterEach(() => { mounted.splice(0).forEach(w => w.unmount()) })
  beforeEach(() => {
    seedAuth('ADMIN')
    Object.values(svc).forEach(f => f.mockReset())
    navigateTo.mockReset()
  })

  it('le choix du type vient en premier, aucun formulaire avant', async () => {
    const w = await mountPage('nouveau')
    expect(w.find('[data-test="vm-type-picker"]').exists()).toBe(true)
    expect(w.find('[data-test="vm-form"]').exists()).toBe(false)
    expect(w.text()).toContain('Vidéo')
    expect(w.text()).toContain('Information')
  })

  it('Information : formulaire sans vidéo, création du corps INFO, retour possible au choix', async () => {
    svc.create.mockResolvedValue(infoModal())
    const w = await mountPage('nouveau')
    await w.get('[data-test="vm-type-INFO"]').trigger('click')
    expect(w.find('[data-test="vm-url"]').exists()).toBe(false)
    expect(w.find('[data-test="vm-body-fr"]').exists()).toBe(true)
    await w.get('[data-test="vm-change-type"]').trigger('click')
    expect(w.find('[data-test="vm-type-picker"]').exists()).toBe(true)
    await w.get('[data-test="vm-type-INFO"]').trigger('click')
    await w.get('[data-test="vm-name"]').setValue('Annonce')
    await w.get('[data-test="vm-title-fr"]').setValue('Nouveauté')
    await w.get('[data-test="vm-body-fr"]').setValue('Un texte')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(svc.create).toHaveBeenCalledWith(expect.objectContaining({
      type: 'INFO', youtubeUrl: null, bodyFr: 'Un texte', primaryAction: { kind: 'CLOSE', screen: null, url: null },
    }))
    expect(navigateTo).toHaveBeenCalledWith(`/modals-video/${infoModal().id}`)
  })
})

describe('pages/modals-video/[id]', () => {
  afterEach(() => { mounted.splice(0).forEach(w => w.unmount()) })
  beforeEach(() => {
    seedAuth('ADMIN')
    Object.values(svc).forEach(f => f.mockReset())
    navigateTo.mockReset()
    route.params = { id: modal().id }
    svc.get.mockResolvedValue(modal())
  })

  it('identifiant invalide : aucun appel, message', async () => {
    route.params = { id: '../admin' }
    const w = await mountPage('[id]')
    expect(svc.get).not.toHaveBeenCalled()
    expect(w.get('[data-test="state-error"]').text()).toContain('Identifiant de modal invalide')
  })

  it('enregistrer : PUT puis confirmation « sans nouvelle version »', async () => {
    svc.update.mockResolvedValue(modal({ titleFr: 'Corrigé' }))
    const w = await mountPage('[id]')
    await w.get('[data-test="vm-title-fr"]').setValue('Corrigé')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(svc.update).toHaveBeenCalledWith(modal().id, expect.objectContaining({ titleFr: 'Corrigé' }))
    expect(w.get('[data-test="vm-saved"]').text()).toContain('sans nouvelle version')
  })

  it('interrupteur : PATCH immédiat', async () => {
    svc.setActive.mockResolvedValue(modal({ active: true }))
    const w = await mountPage('[id]')
    await w.get('[data-test="vm-switch"]').trigger('click')
    await flushPromises()
    expect(svc.setActive).toHaveBeenCalledWith(modal().id, true)
    expect(w.get('[data-test="vm-switch"]').attributes('aria-checked')).toBe('true')
  })

  it('nouvelle version avec nouveau lien : le formulaire repart de la version publiée', async () => {
    const newUrl = 'https://www.youtube.com/watch?v=abcdefghijk'
    svc.publishVersion.mockResolvedValue(modal({ version: 2, youtubeUrl: newUrl, audience: 'EVERYONE' }))
    const w = await mountPage('[id]')
    await w.get('[data-test="vm-new-version"]').trigger('click')
    await w.get('[data-test="vm-audience-EVERYONE"] input').setValue(true)
    await w.get('[data-test="vm-version-url"]').setValue(newUrl)
    await w.get('[data-test="vm-version-confirm"]').trigger('click')
    await flushPromises()
    expect(svc.publishVersion).toHaveBeenCalledWith(modal().id, { audience: 'EVERYONE', youtubeUrl: newUrl })
    expect(w.find('[data-test="vm-version-overlay"]').exists()).toBe(false)
    expect((w.get('[data-test="vm-url"]').element as HTMLInputElement).value).toBe(newUrl)
    expect(w.get('[data-test="vm-version-box"]').text()).toContain('Version 2')
  })

  it('fiche Information : type affiché, enregistrement avec le corps INFO', async () => {
    svc.get.mockResolvedValue(infoModal())
    svc.update.mockResolvedValue(infoModal({ titleFr: 'Corrigé' }))
    const w = await mountPage('[id]')
    expect(w.get('[data-test="vm-type"]').text()).toContain('Information')
    await w.get('[data-test="vm-title-fr"]').setValue('Corrigé')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(svc.update).toHaveBeenCalledWith(modal().id, expect.objectContaining({ type: 'INFO', titleFr: 'Corrigé', youtubeUrl: null }))
  })

  it('suppression confirmée : retour à la liste', async () => {
    svc.remove.mockResolvedValue(undefined)
    const w = await mountPage('[id]')
    await w.get('[data-test="vm-delete"]').trigger('click')
    await w.get('[data-test="confirm"]').trigger('click')
    await flushPromises()
    expect(svc.remove).toHaveBeenCalledWith(modal().id)
    expect(navigateTo).toHaveBeenCalledWith('/modals-video')
  })

  it('introuvable : erreur et Réessayer', async () => {
    svc.get.mockRejectedValueOnce({ data: { detail: 'Modal introuvable' } })
    const w = await mountPage('[id]')
    expect(w.get('[data-test="state-error"]').text()).toContain('Modal introuvable')
    await w.get('[data-test="state-retry"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="vm-form"]').exists()).toBe(true)
  })
})
