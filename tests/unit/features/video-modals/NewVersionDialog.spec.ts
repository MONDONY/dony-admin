import { describe, it, expect, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import NewVersionDialog from '@/features/video-modals/components/NewVersionDialog.vue'
import { infoModal, modal } from './fixtures'

const mounted: VueWrapper[] = []
function mountDialog(props: Record<string, unknown> = {}) {
  const w = mount(NewVersionDialog, { props: { open: true, modal: modal({ version: 2 }), ...props }, attachTo: document.body })
  mounted.push(w)
  return w
}

describe('NewVersionDialog', () => {
  afterEach(() => mounted.splice(0).forEach(w => w.unmount()))

  it('fermé ou sans campagne : rien', () => {
    expect(mountDialog({ open: false }).find('[data-test="vm-version-overlay"]').exists()).toBe(false)
    expect(mountDialog({ modal: null }).find('[data-test="vm-version-overlay"]').exists()).toBe(false)
  })

  it('public par défaut « jamais répondu », lien absent du corps', async () => {
    const w = mountDialog()
    const confirm = w.get('[data-test="vm-version-confirm"]')
    expect(confirm.text()).toBe('Publier la version 3')
    await confirm.trigger('click')
    expect(w.emitted('confirm')![0]).toEqual([{ audience: 'NEVER_ANSWERED' }])
  })

  it('choix du public et nouveau lien', async () => {
    const w = mountDialog()
    await w.get('[data-test="vm-audience-EVERYONE"] input').setValue(true)
    await w.get('[data-test="vm-version-url"]').setValue(' https://www.youtube.com/shorts/dQw4w9WgXcQ ')
    await w.get('[data-test="vm-version-confirm"]').trigger('click')
    expect(w.emitted('confirm')![0]).toEqual([{ audience: 'EVERYONE', youtubeUrl: 'https://www.youtube.com/shorts/dQw4w9WgXcQ' }])
  })

  it('lien non reconnu : bouton bloqué et message', async () => {
    const w = mountDialog()
    await w.get('[data-test="vm-version-url"]').setValue('https://vimeo.com/1')
    expect(w.find('[data-test="vm-version-url-error"]').exists()).toBe(true)
    expect(w.get('[data-test="vm-version-confirm"]').attributes('disabled')).toBeDefined()
    await w.get('[data-test="vm-version-confirm"]').trigger('click')
    expect(w.emitted('confirm')).toBeUndefined()
  })

  it('lien http refusé, message qui parle de https', async () => {
    const w = mountDialog()
    await w.get('[data-test="vm-version-url"]').setValue('http://youtu.be/dQw4w9WgXcQ')
    expect(w.get('[data-test="vm-version-url-error"]').text()).toContain('https://')
    expect(w.get('[data-test="vm-version-confirm"]').attributes('disabled')).toBeDefined()
  })

  it('libellé de l’audience par défaut : version précédente seule', () => {
    expect(mountDialog().get('[data-test="vm-audience-NEVER_ANSWERED"]').text()).toContain('n’ont pas répondu à la version précédente')
  })

  it('occupé : bouton bloqué', () => {
    expect(mountDialog({ busy: true }).get('[data-test="vm-version-confirm"]').attributes('disabled')).toBeDefined()
  })

  it('Annuler et Échap annulent ; une réouverture repart à zéro', async () => {
    const w = mountDialog()
    await w.get('[data-test="vm-version-cancel"]').trigger('click')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    expect(w.emitted('cancel')).toHaveLength(2)

    await w.get('[data-test="vm-audience-EVERYONE"] input').setValue(true)
    await w.get('[data-test="vm-version-url"]').setValue('x')
    await w.setProps({ open: false })
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(w.emitted('cancel')).toHaveLength(2)
    await w.setProps({ open: true })
    await w.get('[data-test="vm-version-confirm"]').trigger('click')
    expect(w.emitted('confirm')![0]).toEqual([{ audience: 'NEVER_ANSWERED' }])
  })

  it('campagne sans version connue : version 1 proposée', () => {
    const w = mountDialog({ modal: { ...modal(), version: undefined } })
    expect(w.get('[data-test="vm-version-confirm"]').text()).toBe('Publier la version 1')
  })

  it('Information : pas de champ lien YouTube, corps sans lien', async () => {
    const w = mountDialog({ modal: infoModal() })
    expect(w.find('[data-test="vm-version-url"]').exists()).toBe(false)
    await w.get('[data-test="vm-version-confirm"]').trigger('click')
    expect(w.emitted('confirm')![0]).toEqual([{ audience: 'NEVER_ANSWERED' }])
  })
})
