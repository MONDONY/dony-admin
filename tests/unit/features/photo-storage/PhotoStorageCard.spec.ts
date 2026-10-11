import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import type { PhotoPurgeRun, PhotoStorageStatus } from '@/features/photo-storage/types/index'

const state = {
  status: ref<PhotoStorageStatus | null>(null),
  unavailable: ref(false),
  loading: ref(false),
  error: ref<string | null>(null),
  notice: ref<string | null>(null),
  launching: ref(false),
  load: vi.fn(),
  runPurge: vi.fn(),
  reconcile: vi.fn(),
}
vi.mock('@/features/photo-storage/composables/usePhotoStorage', () => ({ usePhotoStorage: () => state }))
import PhotoStorageCard from '@/features/photo-storage/components/PhotoStorageCard.vue'

const run = (over: Partial<PhotoPurgeRun> = {}): PhotoPurgeRun => ({
  kind: 'PURGE', dryRun: false, triggerSource: 'SCHEDULE',
  startedAt: '2026-10-10T04:10:00', finishedAt: '2026-10-10T04:11:00',
  eligible: 10, deleted: 8, failed: 2, error: null, ...over,
})
const baseStatus = (over: Partial<PhotoStorageStatus> = {}): PhotoStorageStatus => ({
  purgeEnabled: false, retentionDays: 7, running: false,
  lastPurges: [], lastReconciles: [],
  uploads24h: 12, bytes24h: 1536, uploads7d: 80, bytes7d: 5 * 1024 ** 2,
  ...over,
})

function mountCard() {
  return mount(PhotoStorageCard)
}

describe('PhotoStorageCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.status.value = baseStatus()
    state.unavailable.value = false
    state.loading.value = false
    state.error.value = null
    state.notice.value = null
    state.launching.value = false
  })

  it('charge le statut au montage', () => {
    mountCard()
    expect(state.load).toHaveBeenCalledTimes(1)
  })

  it('affiche le badge À blanc quand la purge est inactive, Purge active sinon', () => {
    const w = mountCard()
    expect(w.text()).toContain('À blanc')
    expect(w.text()).not.toContain('Purge active')
    state.status.value = baseStatus({ purgeEnabled: true })
    return w.vm.$nextTick().then(() => {
      expect(w.text()).toContain('Purge active')
      expect(w.text()).toContain('Délai : 7 jours')
    })
  })

  it('affiche les volumes 24 h et 7 j', () => {
    const t = mountCard().find('[data-test="volumes"]').text()
    expect(t).toContain('Envoyées sur 24 h : 12 photos, 1,5 Ko')
    expect(t).toContain('Envoyées sur 7 j : 80 photos, 5 Mo')
  })

  it('affiche la durée du dernier passage, ou « en cours » sans fin', async () => {
    state.status.value = baseStatus({
      lastPurges: [run()],
      lastReconciles: [run({ kind: 'RECONCILE', finishedAt: null })],
    })
    const w = mountCard()
    expect(w.find('[data-test="last-purge"]').text()).toContain('durée 1 min')
    expect(w.find('[data-test="last-reconcile"]').text()).toContain('en cours')
  })

  it('désactive les boutons pendant un lancement', () => {
    state.launching.value = true
    const w = mountCard()
    expect(w.find('[data-test="run-purge"]').attributes('disabled')).toBeDefined()
    expect(w.find('[data-test="run-reconcile"]').attributes('disabled')).toBeDefined()
  })

  it('le bouton Actualiser recharge le statut, désactivé pendant un chargement', async () => {
    const w = mountCard()
    const btn = w.find('[data-test="refresh"]')
    expect(btn.text()).toContain('Actualiser')
    await btn.trigger('click')
    expect(state.load).toHaveBeenCalledTimes(2)
    state.loading.value = true
    await w.vm.$nextTick()
    expect(w.find('[data-test="refresh"]').attributes('disabled')).toBeDefined()
  })

  it('un passage à blanc affiche « seraient supprimées »', () => {
    state.status.value = baseStatus({ lastPurges: [run({ dryRun: true, eligible: 42, deleted: 0, failed: 0 })] })
    const t = mountCard().find('[data-test="last-purge"]').text()
    expect(t).toContain('42 photos seraient supprimées')
    expect(t).toContain('à blanc')
  })

  it('un passage réel affiche supprimées et échecs', () => {
    state.status.value = baseStatus({ lastPurges: [run()] })
    const t = mountCard().find('[data-test="last-purge"]').text()
    expect(t).toContain('8 supprimées, 2 échecs')
    expect(t).toContain('réel')
  })

  it('affiche l\'erreur d\'un passage et l\'erreur du composable', () => {
    state.status.value = baseStatus({ lastReconciles: [run({ kind: 'RECONCILE', error: 'R2 injoignable' })] })
    state.error.value = 'Lancement impossible'
    const w = mountCard()
    expect(w.find('[data-test="last-reconcile"]').text()).toContain('R2 injoignable')
    expect(w.find('[data-test="photo-storage-error"]').text()).toContain('Lancement impossible')
  })

  it('affiche la notice', () => {
    state.notice.value = 'Passage lancé, actualisez dans un instant.'
    expect(mountCard().find('[data-test="photo-storage-notice"]').text()).toContain('Passage lancé')
  })

  it('l\'historique se replie et se déplie avec 5 passages au plus', async () => {
    state.status.value = baseStatus({ lastPurges: Array.from({ length: 7 }, () => run()) })
    const w = mountCard()
    expect(w.find('[data-test="history"]').exists()).toBe(false)
    await w.find('[data-test="history-toggle"]').trigger('click')
    expect(w.findAll('[data-test="history-purge"]')).toHaveLength(5)
  })

  it('l\'historique affiche les erreurs des passages et « Aucune » sans purge', async () => {
    state.status.value = baseStatus({
      lastPurges: [],
      lastReconciles: [run({ kind: 'RECONCILE', error: 'R2 injoignable' }), run({ kind: 'RECONCILE' })],
    })
    const w = mountCard()
    expect(w.find('[data-test="last-purge"]').text()).toContain('Aucune')
    await w.find('[data-test="history-toggle"]').trigger('click')
    expect(w.find('[data-test="history-toggle"]').text()).toBe('Masquer l’historique')
    expect(w.findAll('[data-test="history-purge"]')).toHaveLength(0)
    expect(w.find('[data-test="history"]').text()).toContain('Aucune')
    const rec = w.findAll('[data-test="history-reconcile"]')
    expect(rec).toHaveLength(2)
    expect(rec[0].text()).toContain('R2 injoignable')
    expect(rec[1].text()).not.toContain('R2')
  })

  it('l\'historique affiche l\'erreur d\'une purge et « Aucun » sans rapprochement', async () => {
    state.status.value = baseStatus({ lastPurges: [run({ error: 'Délai dépassé' })] })
    const w = mountCard()
    expect(w.find('[data-test="last-purge"]').text()).toContain('Délai dépassé')
    expect(w.find('[data-test="last-reconcile"]').text()).toContain('Aucun')
    await w.find('[data-test="history-toggle"]').trigger('click')
    expect(w.find('[data-test="history-purge"]').text()).toContain('Délai dépassé')
    expect(w.find('[data-test="history"]').text()).toContain('Aucun')
  })

  it('désactive les boutons quand un passage est en cours ou en chargement', async () => {
    state.status.value = baseStatus({ running: true })
    const w = mountCard()
    expect(w.find('[data-test="run-purge"]').attributes('disabled')).toBeDefined()
    expect(w.find('[data-test="run-reconcile"]').attributes('disabled')).toBeDefined()
    state.status.value = baseStatus()
    state.loading.value = true
    await w.vm.$nextTick()
    expect(w.find('[data-test="run-purge"]').attributes('disabled')).toBeDefined()
  })

  it('lancer la purge ouvre une confirmation simple, relit le statut, puis un seul runPurge', async () => {
    const w = mountCard()
    await w.find('[data-test="run-purge"]').trigger('click')
    expect(state.runPurge).not.toHaveBeenCalled()
    expect(state.load).toHaveBeenCalledTimes(2)
    const dialog = w.find('[data-test="overlay"]')
    expect(dialog.text()).toContain('Passage à blanc : rien ne sera supprimé, seul le décompte sera mis à jour.')
    expect(w.find('[data-test="confirmation-input"]').exists()).toBe(false)
    expect(w.find('[data-test="confirm"]').classes()).toContain('bg-primary')
    await w.find('[data-test="confirm"]').trigger('click')
    expect(state.runPurge).toHaveBeenCalledTimes(1)
    expect(w.find('[data-test="overlay"]').exists()).toBe(false)
  })

  it('annuler la purge ne lance rien', async () => {
    const w = mountCard()
    await w.find('[data-test="run-purge"]').trigger('click')
    await w.find('[data-test="cancel"]').trigger('click')
    expect(w.find('[data-test="overlay"]').exists()).toBe(false)
    expect(state.runPurge).not.toHaveBeenCalled()
  })

  it('purge réelle : avertissement de suppression définitive, ton danger', async () => {
    state.status.value = baseStatus({ purgeEnabled: true })
    const w = mountCard()
    await w.find('[data-test="run-purge"]').trigger('click')
    expect(w.find('[data-test="overlay"]').text()).toContain('Les photos arrivées à échéance seront supprimées définitivement.')
    expect(w.find('[data-test="confirm"]').classes()).toContain('bg-danger')
  })

  it('statut inconnu : la purge est présentée à blanc', async () => {
    state.status.value = null
    const w = mountCard()
    await w.find('[data-test="run-purge"]').trigger('click')
    expect(w.find('[data-test="overlay"]').text()).toContain('Passage à blanc')
  })

  it('contrôle complet sans case cochée : confirmation simple puis reconcile(false)', async () => {
    state.status.value = baseStatus({ purgeEnabled: true })
    const w = mountCard()
    await w.find('[data-test="run-reconcile"]').trigger('click')
    expect(w.find('[data-test="confirmation-input"]').exists()).toBe(false)
    await w.find('[data-test="confirm"]').trigger('click')
    expect(state.reconcile).toHaveBeenCalledWith(false)
  })

  it('case cochée, purge à blanc : la phrase est quand même exigée (statut possiblement périmé)', async () => {
    const w = mountCard()
    await w.find('[data-test="run-reconcile"]').trigger('click')
    await w.find('[data-test="allow-bulk"]').setValue(true)
    expect(w.find('[data-test="confirmation-input"]').exists()).toBe(true)
    expect(w.find('[data-test="confirm"]').attributes('disabled')).toBeDefined()
    await w.find('[data-test="confirm"]').trigger('click')
    expect(state.reconcile).not.toHaveBeenCalled()
    await w.find('[data-test="confirmation-input"]').setValue('SUPPRESSION')
    expect(w.find('[data-test="confirm"]').attributes('disabled')).toBeDefined()
    await w.find('[data-test="confirmation-input"]').setValue('SUPPRESSION MASSIVE')
    await w.find('[data-test="confirm"]').trigger('click')
    expect(state.reconcile).toHaveBeenCalledWith(true)
  })

  it('décocher la case retire l\'exigence de phrase', async () => {
    const w = mountCard()
    await w.find('[data-test="run-reconcile"]').trigger('click')
    await w.find('[data-test="allow-bulk"]').setValue(true)
    await w.find('[data-test="allow-bulk"]').setValue(false)
    expect(w.find('[data-test="confirmation-input"]').exists()).toBe(false)
    await w.find('[data-test="confirm"]').trigger('click')
    expect(state.reconcile).toHaveBeenCalledWith(false)
  })

  it('ouvrir le contrôle complet recharge le statut', async () => {
    const w = mountCard()
    expect(state.load).toHaveBeenCalledTimes(1)
    await w.find('[data-test="run-reconcile"]').trigger('click')
    expect(state.load).toHaveBeenCalledTimes(2)
  })

  it('expose refresh, qui recharge le statut', async () => {
    const w = mountCard()
    await (w.vm as unknown as { refresh: () => Promise<void> }).refresh()
    expect(state.load).toHaveBeenCalledTimes(2)
  })

  it('case cochée ET purge active : exige SUPPRESSION MASSIVE puis reconcile(true)', async () => {
    state.status.value = baseStatus({ purgeEnabled: true })
    const w = mountCard()
    await w.find('[data-test="run-reconcile"]').trigger('click')
    await w.find('[data-test="allow-bulk"]').setValue(true)
    expect(w.find('[data-test="confirm"]').attributes('disabled')).toBeDefined()
    await w.find('[data-test="confirmation-input"]').setValue('SUPPRESSION MASSIVE')
    await w.find('[data-test="confirm"]').trigger('click')
    expect(state.reconcile).toHaveBeenCalledWith(true)
  })

  it('statut inconnu + case cochée : la phrase est exigée, aucun reconcile sans elle', async () => {
    state.status.value = null
    const w = mountCard()
    await w.find('[data-test="run-reconcile"]').trigger('click')
    await w.find('[data-test="allow-bulk"]').setValue(true)
    expect(w.find('[data-test="confirmation-input"]').exists()).toBe(true)
    expect(w.find('[data-test="confirm"]').attributes('disabled')).toBeDefined()
    await w.find('[data-test="confirm"]').trigger('click')
    expect(state.reconcile).not.toHaveBeenCalled()
    await w.find('[data-test="confirmation-input"]').setValue('SUPPRESSION MASSIVE')
    await w.find('[data-test="confirm"]').trigger('click')
    expect(state.reconcile).toHaveBeenCalledWith(true)
  })

  it('affiche « Passage en cours… » quand un passage tourne', () => {
    expect(mountCard().find('[data-test="running"]').exists()).toBe(false)
    state.status.value = baseStatus({ running: true })
    const el = mountCard().find('[data-test="running"]')
    expect(el.text()).toBe('Passage en cours…')
    expect(el.attributes('role')).toBe('status')
  })

  it('annuler ferme le dialogue sans lancer', async () => {
    const w = mountCard()
    await w.find('[data-test="run-reconcile"]').trigger('click')
    await w.find('[data-test="cancel"]').trigger('click')
    expect(w.find('[data-test="overlay"]').exists()).toBe(false)
    expect(state.reconcile).not.toHaveBeenCalled()
  })

  it('indisponible : seul le message est affiché', () => {
    state.unavailable.value = true
    const w = mountCard()
    expect(w.text()).toContain('Indisponible sur cette version du serveur')
    expect(w.find('[data-test="run-purge"]').exists()).toBe(false)
  })
})
