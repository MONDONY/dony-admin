import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BroadcastSegmentsPanel from '@/features/broadcast/components/BroadcastSegmentsPanel.vue'
import type { BroadcastSegment } from '@/features/broadcast/types/index'

const seg: BroadcastSegment = { id: 's1', name: 'Comptes Pro', description: 'Tous les Pro', rule: { op: 'AND', children: [] }, recipientCount: -1, updatedAt: '2026-11-01T10:00:00' }
const mountPanel = (props: Record<string, unknown> = {}) =>
  mount(BroadcastSegmentsPanel, { props: { segments: [seg], loading: false, error: null, ...props } })

describe('BroadcastSegmentsPanel', () => {
  it('liste les segments sans afficher le compteur -1', () => {
    const w = mountPanel()
    expect(w.find('[data-test="segment-row-s1"]').text()).toContain('Comptes Pro')
    expect(w.find('[data-test="segment-row-s1"]').text()).toContain('Tous les Pro')
    expect(w.text()).not.toContain('-1')
  })

  it('états vide, chargement et erreur', () => {
    expect(mountPanel({ segments: [] }).find('[data-test="segments-empty"]').exists()).toBe(true)
    expect(mountPanel({ segments: [], loading: true }).text()).toContain('Chargement')
    expect(mountPanel({ error: 'Boom' }).find('[data-test="segments-error"]').text()).toContain('Boom')
  })

  it('renommer émet le nouveau nom', async () => {
    const w = mountPanel()
    await w.find('[data-test="rename-s1"]').trigger('click')
    await w.find('[data-test="rename-input-s1"]').setValue('  Pro actifs ')
    await w.find('[data-test="rename-save-s1"]').trigger('click')
    expect(w.emitted('rename')![0]).toEqual([seg, 'Pro actifs'])
    expect(w.find('[data-test="rename-input-s1"]').exists()).toBe(false)
  })

  it('un nom vide ou inchangé n’émet rien, annuler referme', async () => {
    const w = mountPanel()
    await w.find('[data-test="rename-s1"]').trigger('click')
    await w.find('[data-test="rename-input-s1"]').setValue('  ')
    expect((w.find('[data-test="rename-save-s1"]').element as HTMLButtonElement).disabled).toBe(true)
    await w.find('[data-test="rename-cancel-s1"]').trigger('click')
    expect(w.emitted('rename')).toBeUndefined()
    expect(w.find('[data-test="rename-input-s1"]').exists()).toBe(false)
  })

  it('modifier la règle émet le segment', async () => {
    const w = mountPanel()
    await w.find('[data-test="edit-rule-s1"]').trigger('click')
    expect(w.emitted('edit-rule')![0]).toEqual([seg])
  })

  it('panneau_suppressionDemandeConfirmation', async () => {
    const w = mountPanel()
    await w.find('[data-test="delete-s1"]').trigger('click')
    expect(w.emitted('remove')).toBeUndefined()
    expect(w.find('[data-test="overlay"]').exists()).toBe(true)
    expect(w.text()).toContain('Comptes Pro')
    await w.find('[data-test="confirm"]').trigger('click')
    expect(w.emitted('remove')![0]).toEqual(['s1'])
    expect(w.find('[data-test="overlay"]').exists()).toBe(false)
  })

  it('annuler la confirmation ne supprime rien', async () => {
    const w = mountPanel()
    await w.find('[data-test="delete-s1"]').trigger('click')
    await w.find('[data-test="cancel"]').trigger('click')
    expect(w.emitted('remove')).toBeUndefined()
    expect(w.find('[data-test="overlay"]').exists()).toBe(false)
  })

  it('le champ de renommage est limité à 80 caractères (comme le back)', async () => {
    const w = mountPanel()
    await w.find('[data-test="rename-s1"]').trigger('click')
    expect(w.find('[data-test="rename-input-s1"]').attributes('maxlength')).toBe('80')
  })
})
