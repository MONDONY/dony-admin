import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import PhotoViewer from '@/components/ui/PhotoViewer.vue'
import { useEscapeClose } from '@/composables/useEscapeClose'

const items = [
  { url: 'https://r2/a.jpg', caption: 'Remise du colis · 01/06/2026 12:00', subcaption: 'Paris 11e' },
  { url: 'https://r2/b.jpg', caption: 'En transit · 02/06/2026 12:00' },
  { url: 'https://r2/c.jpg', caption: 'Livraison · 03/06/2026 12:00' },
]

const wrappers: VueWrapper[] = []
function mountViewer(props: Record<string, unknown>) {
  const w = mount(PhotoViewer, { props, attachTo: document.body })
  wrappers.push(w)
  return w
}
afterEach(() => { while (wrappers.length) wrappers.pop()!.unmount(); document.body.innerHTML = '' })

const key = (k: string, init: Partial<Pick<KeyboardEvent, 'ctrlKey' | 'metaKey' | 'shiftKey'>> = {}) =>
  document.querySelector('[data-test="photo-viewer"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init }))
const zoomText = (w: VueWrapper) => w.find('[data-test="photo-zoom-level"]').text().replace(/\s/g, ' ')
const mainSrc = (w: VueWrapper) => w.find('[data-test="photo-main"]').attributes('src')

describe('PhotoViewer', () => {
  it('legacyUrlsStillWork', async () => {
    const w = mountViewer({ urls: null })
    expect(w.find('[data-test="photo-viewer"]').exists()).toBe(false)
    await w.setProps({ urls: ['https://r2/1.jpg', 'https://r2/2.jpg'], title: 'Photos de la demande', alt: 'Photo du colis' })
    const v = w.find('[data-test="photo-viewer"]')
    expect(v.attributes('role')).toBe('dialog')
    expect(v.attributes('aria-modal')).toBe('true')
    expect(v.text()).toContain('Photos de la demande')
    expect(v.findAll('img')).toHaveLength(2)
    expect(v.find('img').attributes('alt')).toBe('Photo du colis')
    await w.find('[data-test="photo-viewer-close"]').trigger('click')
    expect(w.emitted('close')).toHaveLength(1)
  })

  it('items_override_urls', () => {
    const w = mountViewer({ urls: ['https://r2/legacy.jpg'], items, startIndex: 1 })
    expect(w.findAll('[data-test="photo-main"]')).toHaveLength(1)
    expect(mainSrc(w)).toBe('https://r2/b.jpg')
    expect(w.find('[data-test="photo-viewer"]').html()).not.toContain('legacy.jpg')
  })

  it('items vides : visionneuse fermée', () => {
    const w = mountViewer({ urls: null, items: [] })
    expect(w.find('[data-test="photo-viewer"]').exists()).toBe(false)
  })

  it('nextPrev_buttonsAndKeys', async () => {
    const w = mountViewer({ urls: null, items })
    expect(mainSrc(w)).toBe('https://r2/a.jpg')
    await w.find('[data-test="photo-next"]').trigger('click')
    expect(mainSrc(w)).toBe('https://r2/b.jpg')
    key('ArrowRight'); await nextTick()
    expect(mainSrc(w)).toBe('https://r2/c.jpg')
    key('ArrowLeft'); await nextTick()
    expect(mainSrc(w)).toBe('https://r2/b.jpg')
    await w.find('[data-test="photo-prev"]').trigger('click')
    expect(mainSrc(w)).toBe('https://r2/a.jpg')
    expect(w.find('[data-test="photo-position"]').text()).toBe('1 sur 3')
  })

  it('disabledAtBounds', async () => {
    const w = mountViewer({ urls: null, items })
    expect(w.find('[data-test="photo-prev"]').attributes('disabled')).toBeDefined()
    expect(w.find('[data-test="photo-next"]').attributes('disabled')).toBeUndefined()
    key('ArrowLeft'); await nextTick()
    expect(mainSrc(w)).toBe('https://r2/a.jpg')
    await w.setProps({ startIndex: 2 })
    await w.setProps({ items: [...items] })
    key('ArrowRight'); key('ArrowRight'); key('ArrowRight'); await nextTick()
    expect(mainSrc(w)).toBe('https://r2/c.jpg')
    expect(w.find('[data-test="photo-next"]').attributes('disabled')).toBeDefined()
    expect(w.find('[data-test="photo-prev"]').attributes('disabled')).toBeUndefined()
  })

  it('zoom_buttonsKeysAndWheel_clamped', async () => {
    const w = mountViewer({ urls: null, items })
    expect(zoomText(w)).toBe('100 %')
    await w.find('[data-test="photo-zoom-in"]').trigger('click')
    expect(zoomText(w)).toBe('125 %')
    key('-'); key('-'); await nextTick()
    expect(zoomText(w)).toBe('75 %')
    key('0'); await nextTick()
    expect(zoomText(w)).toBe('100 %')
    for (let i = 0; i < 20; i++) key('+')
    await nextTick()
    expect(zoomText(w)).toBe('400 %')
    expect(w.find('[data-test="photo-zoom-in"]').attributes('disabled')).toBeDefined()
    for (let i = 0; i < 20; i++) await w.find('[data-test="photo-zoom-out"]').trigger('click')
    expect(zoomText(w)).toBe('50 %')
    expect(w.find('[data-test="photo-zoom-out"]').attributes('disabled')).toBeDefined()
    const stage = w.find('[data-test="photo-stage"]')
    await stage.trigger('wheel', { deltaY: -100, ctrlKey: true })
    expect(zoomText(w)).toBe('75 %')
    await stage.trigger('wheel', { deltaY: 100, ctrlKey: true })
    expect(zoomText(w)).toBe('50 %')
    await stage.trigger('wheel', { deltaY: -100 })
    expect(zoomText(w)).toBe('50 %')
  })

  it('zoomResetOnPhotoChange', async () => {
    const w = mountViewer({ urls: null, items })
    await w.find('[data-test="photo-zoom-in"]').trigger('click')
    expect(zoomText(w)).toBe('125 %')
    await w.find('[data-test="photo-next"]').trigger('click')
    expect(zoomText(w)).toBe('100 %')
  })

  it('thumbs_selectPhoto', async () => {
    const w = mountViewer({ urls: null, items })
    expect(w.findAll('[data-test^="photo-thumb-"]')).toHaveLength(3)
    await w.find('[data-test="photo-thumb-2"]').trigger('click')
    expect(mainSrc(w)).toBe('https://r2/c.jpg')
    expect(w.find('[data-test="photo-thumb-2"]').attributes('aria-current')).toBe('true')
    expect(w.find('[data-test="photo-thumb-0"]').attributes('aria-current')).toBeUndefined()
  })

  it('caption_shown', async () => {
    const w = mountViewer({ urls: null, items })
    expect(w.find('[data-test="photo-caption"]').text()).toBe('Remise du colis · 01/06/2026 12:00')
    expect(w.find('[data-test="photo-subcaption"]').text()).toBe('Paris 11e')
    await w.find('[data-test="photo-next"]').trigger('click')
    expect(w.find('[data-test="photo-caption"]').text()).toBe('En transit · 02/06/2026 12:00')
    expect(w.find('[data-test="photo-subcaption"]').exists()).toBe(false)
  })

  it('openInNewTab_hasRelNoopener', () => {
    const a = mountViewer({ urls: null, items }).find('[data-test="photo-open-tab"]')
    expect(a.element.tagName).toBe('A')
    expect(a.attributes('href')).toBe('https://r2/a.jpg')
    expect(a.attributes('target')).toBe('_blank')
    expect(a.attributes('rel')).toBe('noopener noreferrer')
    expect(a.text()).toBe('Ouvrir dans un onglet')
  })

  it('download_hasDownloadAttribute', () => {
    const a = mountViewer({ urls: null, items }).find('[data-test="photo-download"]')
    expect(a.attributes('href')).toBe('https://r2/a.jpg')
    expect(a.attributes('download')).toBeDefined()
    expect(a.attributes('rel')).toBe('noopener noreferrer')
    expect(a.text()).toBe('Télécharger')
  })

  it('escape_closesOnlyViewer', async () => {
    const drawerClose = vi.fn()
    const windowBubble = vi.fn()
    window.addEventListener('keydown', windowBubble)
    const Host = defineComponent({
      setup() {
        useEscapeClose(drawerClose)
        const list = ref<typeof items | null>(items)
        return () => h(PhotoViewer, { urls: null, items: list.value, onClose: () => { list.value = null } })
      },
    })
    const w = mount(Host, { attachTo: document.body })
    wrappers.push(w)
    await nextTick()
    key('Escape'); await nextTick()
    expect(w.find('[data-test="photo-viewer"]').exists()).toBe(false)
    expect(drawerClose).not.toHaveBeenCalled()
    expect(windowBubble).not.toHaveBeenCalled()
    // Visionneuse fermée : Échap revient au tiroir.
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(drawerClose).toHaveBeenCalledTimes(1)
    window.removeEventListener('keydown', windowBubble)
  })

  it('touches ignorées une fois fermée', async () => {
    const w = mountViewer({ urls: null, items })
    await w.setProps({ items: null })
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(w.emitted('close')).toBeUndefined()
  })

  it('imageError_showsReload_andEmitsReload', async () => {
    const w = mountViewer({ urls: null, items })
    await w.find('[data-test="photo-next"]').trigger('click')
    await w.find('[data-test="photo-main"]').trigger('error')
    expect(w.find('[data-test="photo-main"]').exists()).toBe(false)
    expect(w.find('[data-test="photo-error"]').text()).toContain('Cette photo n’est plus disponible.')
    await w.find('[data-test="photo-reload"]').trigger('click')
    expect(w.emitted('reload')).toEqual([[1]])
    // Une autre photo reste affichée normalement.
    await w.find('[data-test="photo-prev"]').trigger('click')
    expect(w.find('[data-test="photo-main"]').exists()).toBe(true)
    // De nouvelles URL effacent l'erreur.
    await w.setProps({ items: items.map(i => ({ ...i, url: `${i.url}?v=2` })), startIndex: 1 })
    await w.find('[data-test="photo-next"]').trigger('click')
    expect(w.find('[data-test="photo-error"]').exists()).toBe(false)
  })

  it('focusRestored_onClose', async () => {
    const trigger = document.createElement('button')
    document.body.appendChild(trigger)
    trigger.focus()
    const w = mountViewer({ urls: null, items: null })
    await w.setProps({ items })
    await nextTick()
    const dialog = w.find('[data-test="photo-viewer"]').element
    expect(dialog.contains(document.activeElement)).toBe(true)
    await w.find('[data-test="photo-viewer-close"]').trigger('click')
    expect(w.emitted('close')).toHaveLength(1)
    await w.setProps({ items: null })
    await nextTick()
    expect(document.activeElement).toBe(trigger)
  })

  it('clic sur le fond : ferme', async () => {
    const w = mountViewer({ urls: null, items })
    await w.find('[data-test="photo-viewer"]').trigger('click')
    expect(w.emitted('close')).toHaveLength(1)
  })
})
