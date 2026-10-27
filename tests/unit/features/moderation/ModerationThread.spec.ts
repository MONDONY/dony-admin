import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ModerationThread from '@/features/moderation/components/ModerationThread.vue'
import { buildQueue } from '@/features/moderation/lib/moderationWorkbench'
import { seedAuth } from '~/tests/helpers/auth'
import { conversation, message, NOW, queue, report } from './moderationFixtures'

const reported = () => queue()[0]!
const mountThread = (props: Record<string, unknown> = {}) =>
  mount(ModerationThread, { props: { conversation: reported(), messages: [], loading: false, now: NOW, ...props }, global: { stubs: { Teleport: true } } })

describe('ModerationThread', () => {
  beforeEach(() => seedAuth('ADMIN'))

  it('sans conversation : invite à en choisir une', () => {
    const w = mountThread({ conversation: null })
    expect(w.find('[data-test="thread-empty"]').exists()).toBe(true)
  })

  it('en-tête : titre, signalement ouvert, motif, date d’ouverture', () => {
    const w = mountThread()
    expect(w.find('[data-test="thread-title"]').text()).toBe('Aïcha ↔ Moussa')
    expect(w.find('[data-test="thread-reported"]').exists()).toBe(true)
    expect(w.text()).toContain('Spam')
    expect(w.text()).toContain('conversation ouverte le')
  })

  it('conversation calme fermée : pas de badge signalé, mention fermée', () => {
    const c = buildQueue([conversation('c9', { closedAt: '2026-10-25T09:00:00' })], [])[0]!
    const w = mountThread({ conversation: c })
    expect(w.find('[data-test="thread-reported"]').exists()).toBe(false)
    expect(w.text()).toContain('Conversation fermée')
  })

  it('groupe le fil par jour, à droite pour le second participant', () => {
    const w = mountThread({ messages: [
      message('m1', { createdAt: '2026-10-20T16:02:00Z' }),
      message('m2', { senderName: 'Moussa', createdAt: '2026-10-20T16:10:00Z', content: 'Oui' }),
      message('m3', { createdAt: '2026-10-23T07:40:00Z', content: 'Allô' }),
    ] })
    expect(w.findAll('[data-test^="thread-day-"]')).toHaveLength(2)
    expect(w.find('[data-test="message-m2"]').classes()).toContain('self-end')
    expect(w.find('[data-test="message-m1"]').classes()).toContain('self-start')
    expect(w.find('[data-test="message-m1"]').text()).toContain('18:02')
  })

  it('message de la plateforme : centré, sans bulle ni bouton', () => {
    const w = mountThread({ messages: [message('s1', { senderName: 'Systeme', type: 'SYSTEM', content: 'Remise confirmée' })] })
    const sys = w.find('[data-test="message-s1"]')
    expect(sys.text()).toBe('Remise confirmée')
    expect(sys.classes()).toContain('self-center')
    expect(w.find('[data-test="delete-msg-s1"]').exists()).toBe(false)
  })

  it('met en évidence le message désigné par le signalement', () => {
    const w = mountThread({ messages: [message('m1'), message('m2', { content: 'Gagnez 500 €' })], flaggedId: 'm2' })
    expect(w.find('[data-test="message-m2"]').attributes('data-flagged')).toBe('true')
    expect(w.find('[data-test="msg-flagged-m2"]').text()).toBe('Message signalé')
    expect(w.find('[data-test="message-m1"]').attributes('data-flagged')).toBeUndefined()
  })

  it('un message marqué signalé par le back est mis en évidence sans contexte', () => {
    const w = mountThread({ messages: [message('m2', { flagged: true })] })
    expect(w.find('[data-test="msg-flagged-m2"]').exists()).toBe(true)
  })

  it('émet delete pour un message visible, avec MESSAGE_DELETE seulement', async () => {
    const w = mountThread({ messages: [message('m1')] })
    await w.find('[data-test="delete-msg-m1"]').trigger('click')
    expect(w.emitted('delete')![0]).toEqual(['m1'])
    seedAuth('ADMIN', { MESSAGE_DELETE: false })
    expect(mountThread({ messages: [message('m1')] }).find('[data-test="delete-msg-m1"]').exists()).toBe(false)
  })

  it('supprimé par l’auteur : « Supprimé », sans restauration', () => {
    const w = mountThread({ messages: [message('m4', { deleted: true, content: '' })] })
    expect(w.find('[data-test="msg-deleted-m4"]').text()).toBe('Supprimé')
    expect(w.find('[data-test="message-m4"]').text()).toContain('Message supprimé')
    expect(w.find('[data-test="restore-msg-m4"]').exists()).toBe(false)
  })

  it('photo : vignette https, agrandissement, pas de lien non sûr', async () => {
    const w = mountThread({ messages: [
      message('p1', { type: 'IMAGE', content: '', imageUrl: 'https://cdn.example/p1.jpg', thumbUrl: 'https://cdn.example/p1-t.jpg' }),
      message('p2', { type: 'IMAGE', content: '', imageUrl: 'javascript:alert(1)', thumbUrl: 'javascript:alert(1)' }),
    ] })
    expect(w.find('[data-test="thread-image-p1"] img').attributes('src')).toBe('https://cdn.example/p1-t.jpg')
    expect(w.find('[data-test="thread-image-p2"]').exists()).toBe(false)
    expect(w.find('[data-test="thread-image-p2-missing"]').exists()).toBe(true)
    await w.find('[data-test="thread-image-p1"]').trigger('click')
    expect((w.vm as unknown as { $: { setupState: { viewerIndex: number | null } } }).$.setupState.viewerIndex).toBe(0)
  })

  it('photo purgée ou expirée : message et bouton Recharger qui émet reload', async () => {
    const w = mountThread({ messages: [message('p1', { type: 'IMAGE', content: '', imageUrl: null, thumbUrl: null })] })
    expect(w.find('[data-test="thread-image-p1-missing"]').text()).toContain('n’est plus disponible')
    await w.find('[data-test="thread-image-p1-reload"]').trigger('click')
    expect(w.emitted('reload')).toHaveLength(1)
  })

  it('une vignette qui ne charge pas passe en « plus disponible »', async () => {
    const w = mountThread({ messages: [message('p1', { type: 'IMAGE', content: '', imageUrl: 'https://cdn.example/p1.jpg', thumbUrl: 'https://cdn.example/p1.jpg' })] })
    await w.find('[data-test="thread-image-p1"] img').trigger('error')
    expect(w.find('[data-test="thread-image-p1-missing"]').exists()).toBe(true)
  })

  it('un message supprimé n’affiche plus sa photo', () => {
    const w = mountThread({ messages: [message('p1', { type: 'IMAGE', deleted: true, deletedAt: '2026-10-25T15:02:00Z', imageUrl: 'https://cdn.example/p1.jpg' })] })
    expect(w.find('[data-test="thread-image-p1"]').exists()).toBe(false)
  })

  it('états : chargement, vide, erreur avec relance', async () => {
    expect(mountThread({ messages: [] }).text()).toContain('Aucun message')
    expect(mountThread({ messages: [], loading: true }).text()).not.toContain('Aucun message')
    const w = mountThread({ messages: [], error: 'Panne Firestore' })
    expect(w.text()).toContain('Panne Firestore')
    await w.find('button').trigger('click')
    expect(w.emitted('retry')).toBeTruthy()
  })

  it('rappelle que la conversation est en lecture seule', () => {
    expect(mountThread().text()).toContain('Lecture seule')
  })

  it('sans signalement dans la file, aucun motif affiché', () => {
    const c = buildQueue([conversation('c1')], [report('r1', 'other')])[0]!
    expect(mountThread({ conversation: c }).find('[data-test="thread-reported"]').exists()).toBe(false)
  })
})
