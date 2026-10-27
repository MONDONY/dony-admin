import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ModerationQueue from '@/features/moderation/components/ModerationQueue.vue'
import { groupQueue, buildQueue } from '@/features/moderation/lib/moderationWorkbench'
import { conversation, NOW, queue, report } from './moderationFixtures'

const mountQueue = (props: Record<string, unknown> = {}) =>
  mount(ModerationQueue, { props: { groups: groupQueue(queue()), loading: false, now: NOW, ...props } })

describe('ModerationQueue', () => {
  it('liste les groupes : signalée avec son motif et son ancienneté, puis activité récente', () => {
    const w = mountQueue()
    expect(w.find('[data-test="moderation-group-REPORTED"]').text()).toContain('Signalement ouvert')
    const row = w.find('[data-test="conv-row-c1"]')
    expect(row.text()).toContain('Aïcha ↔ Moussa')
    expect(row.find('[data-test="conv-flagged-c1"]').text()).toBe('Spam')
    expect(w.find('[data-test="conv-age-c1"]').text()).toBe('4 j')
    expect(w.find('[data-test="moderation-group-RECENT"]').text()).toContain('Mariam ↔ Ousmane')
  })

  it('une conversation calme montre sa dernière activité, pas d’âge de signalement', () => {
    const w = mountQueue()
    const row = w.find('[data-test="conv-row-c2"]')
    expect(row.find('[data-test="conv-age-c2"]').exists()).toBe(false)
    expect(row.text()).toMatch(/\d{2}/)
  })

  it('plusieurs signalements : motifs distincts et compte', () => {
    const items = buildQueue([conversation('c1', { openReportCount: 3 })], [report('r1', 'c1'), report('r2', 'c1'), report('r3', 'c1', { reason: 'HARASSMENT' })])
    const w = mountQueue({ groups: groupQueue(items) })
    const row = w.find('[data-test="conv-row-c1"]')
    expect(row.findAll('[data-test="conv-flagged-c1"]').map((b) => b.text())).toEqual(['Spam', 'Harcèlement ou comportement abusif'])
    expect(row.text()).toContain('3 signalements')
  })

  it('sans détail de signalement (sans REPORT_VIEW) : badge « Signalée » et compte du serveur, pas d’âge', () => {
    const items = buildQueue([conversation('c1', { openReportCount: 3 })], [])
    const w = mountQueue({ groups: groupQueue(items) })
    expect(w.find('[data-test="conv-flagged-c1"]').text()).toBe('Signalée')
    expect(w.find('[data-test="conv-row-c1"]').text()).toContain('3 signalements')
    expect(w.find('[data-test="conv-age-c1"]').exists()).toBe(false)
  })

  it('aperçu du dernier message sous le titre', () => {
    const items = buildQueue([conversation('c1', { lastMessagePreview: 'C’est quoi ce message ?' }), conversation('c2')], [])
    const w = mountQueue({ groups: groupQueue(items) })
    expect(w.find('[data-test="conv-preview-c1"]').text()).toBe('C’est quoi ce message ?')
    expect(w.find('[data-test="conv-preview-c2"]').exists()).toBe(false)
  })

  it('mentionne une conversation fermée', () => {
    const items = buildQueue([conversation('c1', { closedAt: '2026-10-25T09:00:00' })], [])
    expect(mountQueue({ groups: groupQueue(items) }).text()).toContain('Conversation fermée')
  })

  it('marque la ligne ouverte et émet select au clic', async () => {
    const w = mountQueue({ selectedId: 'c1' })
    expect(w.find('[data-test="conv-row-c1"]').attributes('data-selected')).toBe('true')
    expect(w.find('[data-test="open-c1"]').attributes('aria-current')).toBe('true')
    expect(w.find('[data-test="open-c2"]').attributes('aria-current')).toBeUndefined()
    await w.find('[data-test="open-c2"]').trigger('click')
    expect(w.emitted('select')![0]).toEqual(['c2'])
  })

  it('états vide, chargement, erreur avec relance', async () => {
    expect(mountQueue({ groups: [] }).text()).toContain('Aucune conversation')
    expect(mountQueue({ groups: [], loading: true }).text()).not.toContain('Aucune conversation')
    const w = mountQueue({ groups: [], error: 'Panne' })
    expect(w.text()).toContain('Panne')
    await w.find('button').trigger('click')
    expect(w.emitted('retry')).toBeTruthy()
  })
})
