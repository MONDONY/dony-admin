import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { seedAuth } from '~/tests/helpers/auth'
import SupportConversation from '@/features/support/components/SupportConversation.vue'
import { QUICK_REPLIES, REPLY_MAX } from '@/features/support/lib/supportWorkbench'
import { ago, message, NOW, ticket } from './supportFixtures'

const NuxtLink = { name: 'NuxtLink', props: ['to'], template: '<a :href="to"><slot /></a>' }
const Uploader = {
  name: 'SupportAttachmentUploader', emits: ['change', 'busy'],
  template: '<div data-test="uploader"><button data-test="uploader-add" @click="$emit(\'change\', [\'k1\'])" /><button data-test="uploader-busy" @click="$emit(\'busy\', true)" /></div>',
}
function mountConv(props: Record<string, unknown> = {}) {
  return mount(SupportConversation, { props: { now: NOW, ...props }, global: { stubs: { NuxtLink, SupportAttachmentUploader: Uploader } } })
}
// seedAuth pose l'administrateur « u1 ».
const mine = (over = {}) => ticket({ assignedAdminId: 'u1', assignedAdminEmail: 'admin@yadony.com', status: 'WAITING_SUPPORT', messages: [], ...over })

describe('SupportConversation', () => {
  beforeEach(() => { seedAuth('ADMIN') })

  it('rien de choisi : invitation', () => {
    expect(mountConv({ ticket: null }).get('[data-test="support-conversation-empty"]').text()).toContain('Sélectionne un ticket')
  })

  it('en-tête : état, catégorie, priorité, propriétaire, sujet', () => {
    const w = mountConv({ ticket: mine({ priority: 'HIGH' }) })
    expect(w.get('[data-test="support-subject"]').text()).toBe('Où est mon colis ?')
    const text = w.text()
    expect(text).toContain('Attente support')
    expect(text).toContain('Colis')
    expect(text).toContain('Priorité haute')
    expect(text).toContain('Assigné à moi')
  })

  it('propriétaire : un collègue, ou personne', () => {
    expect(mountConv({ ticket: mine({ assignedAdminId: 'x', assignedAdminEmail: 'x@yadony.com' }) }).text()).toContain('Assigné : x@yadony.com')
    expect(mountConv({ ticket: ticket({ messages: [] }) }).text()).toContain('Non assigné')
  })

  it('fil par jour, messages de chaque côté, avec heure et sans pièce jointe vide', () => {
    const w = mountConv({ ticket: mine({ messages: [
      message('m1', 'USER', '2026-10-17T13:19:00Z', 'Où est mon colis ?'),
      message('m2', 'ADMIN', '2026-10-18T07:02:00Z', 'Je regarde.'),
      { ...message('m3', 'USER', '2026-10-18T08:00:00Z', null), attachments: [{ id: 'a1', url: 'https://x/y.jpg', contentType: 'image/jpeg' }] },
    ] }) })
    expect(w.get('[data-test="support-day-2026-10-17"]').text()).toBe('17 octobre')
    expect(w.get('[data-test="support-message-m1"]').text()).toContain('user D · 15:19')
    expect(w.get('[data-test="support-message-m2"]').text()).toContain('Support · 09:02')
    expect(w.get('[data-test="support-message-m2"]').classes()).toContain('self-end')
    expect(w.get('[data-test="support-message-m3"]').find('p.whitespace-pre-wrap').exists()).toBe(false)
  })

  it('bandeau « Sans réponse depuis… » seulement quand le support doit agir', () => {
    expect(mountConv({ ticket: mine({ lastMessageAt: ago(9 * 24) }) }).get('[data-test="support-silence"]').text()).toBe('Sans réponse depuis 9 j')
    expect(mountConv({ ticket: mine({ lastMessageAt: ago(2) }) }).find('[data-test="support-silence"]').exists()).toBe(false)
  })

  it('chargement du fil, ou aucun message', () => {
    expect(mountConv({ ticket: ticket({ messages: null }), loading: true }).find('[data-test="support-loading"]').exists()).toBe(true)
    expect(mountConv({ ticket: mine() }).text()).toContain('Aucun message')
  })

  it('issu d’un signalement : lien avec REPORT_VIEW, texte sans', () => {
    const t = mine({ sourceReportId: 'r1' })
    expect(mountConv({ ticket: t }).get('[data-test="ticket-source-report"] a').attributes('href')).toMatch(/r1/)
    seedAuth('SUPPORT', { REPORT_VIEW: false })
    const w = mountConv({ ticket: t })
    expect(w.get('[data-test="ticket-source-report"]').text()).toContain('d’un rapport de bug')
    expect(w.find('[data-test="ticket-source-report"] a').exists()).toBe(false)
  })

  describe('zone de réponse', () => {
    it('à moi : réponses types, zone de texte, bouton inactif sans texte', async () => {
      const w = mountConv({ ticket: mine() })
      expect(w.findAll('button[data-test^="support-quick-"]')).toHaveLength(QUICK_REPLIES.length)
      expect(w.get('[data-test="support-send"]').attributes('disabled')).toBeDefined()
      await w.setProps({ draft: 'Bonjour' })
      expect(w.get('[data-test="support-send"]').attributes('disabled')).toBeUndefined()
      expect(w.text()).toContain('Brouillon conservé')
    })

    it('la saisie remonte le brouillon', async () => {
      const w = mountConv({ ticket: mine() })
      await w.get('[data-test="support-reply"]').setValue('Bonjour')
      expect(w.emitted('update:draft')![0]).toEqual(['Bonjour'])
    })

    it('une réponse type s’ajoute au brouillon, par clic ou par raccourci', async () => {
      const w = mountConv({ ticket: mine(), draft: 'Début' })
      await w.get('[data-test="support-quick-1"]').trigger('click')
      expect(w.emitted('update:draft')![0]).toEqual([`Début\n\n${QUICK_REPLIES[0]!.text}`])
      ;(w.vm as unknown as { quick: (_n: number) => void }).quick(2)
      ;(w.vm as unknown as { quick: (_n: number) => void }).quick(9)
      expect(w.emitted('update:draft')).toHaveLength(2)
    })

    it('envoi : brouillon nettoyé et pièces jointes, zone d’images remise à zéro', async () => {
      const w = mountConv({ ticket: mine(), draft: '  Bonjour  ' })
      await w.get('[data-test="uploader-add"]').trigger('click')
      await w.get('[data-test="support-send"]').trigger('click')
      expect(w.emitted('reply')![0]).toEqual(['t1', 'Bonjour', ['k1']])
      // Un nouvel envoi ne repart pas avec les images déjà parties.
      await w.get('[data-test="support-send"]').trigger('click')
      expect(w.emitted('reply')![1]).toEqual(['t1', 'Bonjour', []])
    })

    it('des images sans texte suffisent ; pas d’envoi pendant un téléversement', async () => {
      const w = mountConv({ ticket: mine(), draft: '' })
      await w.get('[data-test="uploader-add"]').trigger('click')
      expect(w.get('[data-test="support-send"]').attributes('disabled')).toBeUndefined()
      await w.get('[data-test="uploader-busy"]').trigger('click')
      expect(w.get('[data-test="support-send"]').attributes('disabled')).toBeDefined()
    })

    it('réponse trop longue : message et bouton inactif', () => {
      const w = mountConv({ ticket: mine(), draft: 'x'.repeat(REPLY_MAX + 1) })
      expect(w.get('[data-test="support-reply-problem"]').text()).toContain(String(REPLY_MAX))
      expect(w.get('[data-test="support-send"]').attributes('disabled')).toBeDefined()
    })

    it('envoi en cours : bouton inactif et libellé', () => {
      const w = mountConv({ ticket: mine(), draft: 'Bonjour', acting: true })
      expect(w.get('[data-test="support-send"]').text()).toBe('Envoi…')
      expect(w.get('[data-test="support-send"]').attributes('disabled')).toBeDefined()
    })

    it('raccourci d’envoi : même règle que le bouton', async () => {
      const w = mountConv({ ticket: mine(), draft: 'Bonjour' })
      ;(w.vm as unknown as { submit: () => void }).submit()
      expect(w.emitted('reply')).toHaveLength(1)
      const empty = mountConv({ ticket: mine(), draft: '' })
      ;(empty.vm as unknown as { submit: () => void }).submit()
      expect(empty.emitted('reply')).toBeUndefined()
      const none = mountConv({ ticket: null, draft: 'x' })
      ;(none.vm as unknown as { submit: () => void }).submit()
      expect(none.emitted('reply')).toBeUndefined()
    })
  })

  describe('sans zone de réponse', () => {
    it('non assigné : invitation et bouton « M’assigner »', async () => {
      const w = mountConv({ ticket: ticket({ messages: [] }) })
      expect(w.find('[data-test="support-composer"]').exists()).toBe(false)
      expect(w.get('[data-test="support-assign-cta"]').text()).toContain('Assignez-vous ce ticket')
      await w.get('[data-test="support-assign"]').trigger('click')
      expect(w.emitted('assign')![0]).toEqual(['t1'])
      ;(w.vm as unknown as { quick: (_n: number) => void }).quick(1)
      expect(w.emitted('update:draft')).toBeUndefined()
    })

    it('assigné à un collègue : on invite à le reprendre, sans bouton d’assignation', () => {
      const w = mountConv({ ticket: mine({ assignedAdminId: 'x', assignedAdminEmail: 'x@yadony.com' }) })
      expect(w.get('[data-test="support-assign-cta"]').text()).toContain('reprenez-le')
      expect(w.find('[data-test="support-assign"]').exists()).toBe(false)
    })

    it('résolu : constat, plus de réponse', () => {
      const w = mountConv({ ticket: mine({ status: 'RESOLVED', resolvedAt: '2026-10-24T10:12:00Z' }) })
      expect(w.get('[data-test="support-resolved"]').text()).toContain('plus de réponse possible')
      expect(w.find('[data-test="support-composer"]').exists()).toBe(false)
    })

    it('sans SUPPORT_TICKET_MANAGE : consultation seule', () => {
      seedAuth('SUPPORT', { SUPPORT_TICKET_MANAGE: false })
      const w = mountConv({ ticket: ticket({ messages: [] }) })
      expect(w.find('[data-test="support-composer"]').exists()).toBe(false)
      expect(w.find('[data-test="support-assign-cta"]').exists()).toBe(false)
    })
  })

  it('une pièce jointe s’ouvre dans un nouvel onglet', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    const w = mountConv({ ticket: mine({ messages: [{ ...message('m1', 'USER', '2026-10-17T13:19:00Z', 'Photo'), attachments: [{ id: 'a1', url: 'https://x/y.jpg', contentType: 'image/jpeg' }] }] }) })
    await w.findComponent({ name: 'SupportAttachmentGrid' }).vm.$emit('open', 'https://x/y.jpg')
    expect(open).toHaveBeenCalledWith('https://x/y.jpg', '_blank', 'noopener')
    open.mockRestore()
  })
})
