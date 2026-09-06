import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SupportAttachmentGrid from '@/features/support/components/SupportAttachmentGrid.vue'

const attachments = [
  { id: 'a1', url: 'https://signed/1', contentType: 'image/jpeg' },
  { id: 'a2', url: 'https://signed/2', contentType: 'image/png' },
]

describe('SupportAttachmentGrid', () => {
  it('rend une vignette par pièce jointe', () => {
    const w = mount(SupportAttachmentGrid, { props: { attachments } })
    expect(w.findAll('img')).toHaveLength(2)
    expect(w.findAll('img')[0].attributes('src')).toBe('https://signed/1')
  })

  it('ne rend rien quand il n\'y a aucune pièce jointe', () => {
    const w = mount(SupportAttachmentGrid, { props: { attachments: [] } })
    expect(w.findAll('img')).toHaveLength(0)
  })

  it('émet open avec l\'URL de la vignette cliquée', async () => {
    const w = mount(SupportAttachmentGrid, { props: { attachments } })
    await w.findAll('img')[1].trigger('click')
    expect(w.emitted('open')![0]).toEqual(['https://signed/2'])
  })

  it('donne un texte alternatif à chaque image', () => {
    const w = mount(SupportAttachmentGrid, { props: { attachments } })
    expect(w.findAll('img')[0].attributes('alt')).toBeTruthy()
  })
})
