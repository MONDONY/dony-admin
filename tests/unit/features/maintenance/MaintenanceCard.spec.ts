import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import type { MaintenanceState } from '@/features/maintenance/types/index'

const m = {
  state: ref<MaintenanceState | null>(null),
  unavailable: ref(false),
  loading: ref(false),
  busy: ref(false),
  error: ref<string | null>(null),
  load: vi.fn(),
  update: vi.fn(),
  addExemption: vi.fn(),
  removeExemption: vi.fn(),
}
vi.mock('@/features/maintenance/composables/useMaintenance', () => ({ useMaintenance: () => m }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ can: () => true }) }))
import MaintenanceCard from '@/features/maintenance/components/MaintenanceCard.vue'
import { localInputToIso } from '@/features/maintenance/utils/datetime'

const base = (over: Partial<MaintenanceState> = {}): MaintenanceState => ({
  enabled: false, message: null, estimatedEndAt: null, startedAt: null,
  updatedAt: null, updatedByEmail: null, exemptions: [], ...over,
})

describe('MaintenanceCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.state.value = base()
    m.unavailable.value = false
    m.loading.value = false
    m.busy.value = false
    m.error.value = null
    m.update.mockResolvedValue(true)
    m.addExemption.mockResolvedValue(true)
  })

  it('charge l’état au montage et affiche « Application ouverte »', () => {
    const w = mount(MaintenanceCard)
    expect(m.load).toHaveBeenCalledTimes(1)
    expect(w.find('[data-test="maintenance-badge"]').text()).toBe('Application ouverte')
    expect(w.find('[data-test="maintenance-disable"]').exists()).toBe(false)
  })

  it('indisponible sur un vieux serveur', () => {
    m.unavailable.value = true
    expect(mount(MaintenanceCard).text()).toContain('Indisponible sur cette version du serveur')
  })

  it('activer exige la saisie de MAINTENANCE puis envoie message et heure de fin', async () => {
    const w = mount(MaintenanceCard)
    await w.find('[data-test="maintenance-message"]').setValue('  Mise à jour  ')
    await w.find('[data-test="maintenance-end"]').setValue('2026-10-16T14:30')
    await w.find('[data-test="maintenance-enable"]').trigger('click')
    const confirm = w.find('[data-test="confirm"]')
    expect(confirm.attributes('disabled')).toBeDefined()
    await w.find('[data-test="confirmation-input"]').setValue('MAINTENANCE')
    await w.find('[data-test="confirm"]').trigger('click')
    expect(m.update).toHaveBeenCalledWith({
      enabled: true, message: 'Mise à jour', estimatedEndAt: localInputToIso('2026-10-16T14:30'),
    })
  })

  it('en maintenance : bandeau, enregistrer le message et rouvrir', async () => {
    m.state.value = base({
      enabled: true, message: 'Pause', startedAt: '2026-10-16T10:00:00Z', estimatedEndAt: '2026-10-16T14:30:00Z',
    })
    const w = mount(MaintenanceCard)
    expect(w.find('[data-test="maintenance-badge"]').text()).toBe('En maintenance')
    expect(w.find('[data-test="maintenance-since"]').text()).toContain('retour prévu')
    expect((w.find('[data-test="maintenance-message"]').element as HTMLTextAreaElement).value).toBe('Pause')

    await w.find('[data-test="maintenance-save"]').trigger('click')
    expect(m.update).toHaveBeenLastCalledWith({
      enabled: true, message: 'Pause', estimatedEndAt: localInputToIso(w.find<HTMLInputElement>('[data-test="maintenance-end"]').element.value),
    })

    await w.find('[data-test="maintenance-disable"]').trigger('click')
    await w.find('[data-test="confirm"]').trigger('click')
    expect(m.update).toHaveBeenLastCalledWith({ enabled: false, message: 'Pause', estimatedEndAt: null })
  })

  it('message vide envoyé à null (texte par défaut de l’app)', async () => {
    const w = mount(MaintenanceCard)
    await w.find('[data-test="maintenance-enable"]').trigger('click')
    await w.find('[data-test="confirmation-input"]').setValue('MAINTENANCE')
    await w.find('[data-test="confirm"]').trigger('click')
    expect(m.update).toHaveBeenCalledWith({ enabled: true, message: null, estimatedEndAt: null })
  })

  it('annuler ferme le dialogue sans écrire', async () => {
    const w = mount(MaintenanceCard)
    await w.find('[data-test="maintenance-enable"]').trigger('click')
    await w.find('[data-test="cancel"]').trigger('click')
    expect(w.find('[data-test="overlay"]').exists()).toBe(false)
    expect(m.update).not.toHaveBeenCalled()
  })

  it('liste, ajoute et retire les comptes autorisés', async () => {
    m.state.value = base({
      exemptions: [{ userId: 'u1', displayName: 'Awa Diallo', note: 'Testeur', createdAt: '2026-10-16T10:00:00Z', createdByEmail: null }],
    })
    const w = mount(MaintenanceCard)
    expect(w.find('[data-test="maintenance-exemption-u1"]').text()).toContain('Awa Diallo')
    expect(w.find('[data-test="maintenance-exemption-u1"]').text()).toContain('Testeur')

    await w.find('[data-test="maintenance-exemption-remove-u1"]').trigger('click')
    expect(m.removeExemption).toHaveBeenCalledWith('u1')

    expect(w.find('[data-test="maintenance-exempt-add"]').attributes('disabled')).toBeDefined()
    const uuid = '0f5e1c2a-1111-2222-3333-444455556666'
    await w.find('[data-test="broadcast-user-search"]').setValue(uuid)
    await w.find('[data-test="maintenance-exempt-note"]').setValue('Propriétaire')
    await w.find('[data-test="maintenance-exempt-add"]').trigger('click')
    expect(m.addExemption).toHaveBeenCalledWith(uuid, 'Propriétaire')
  })

  it('aucun compte autorisé', () => {
    expect(mount(MaintenanceCard).find('[data-test="maintenance-exemptions-empty"]').exists()).toBe(true)
  })

  it('affiche l’erreur', () => {
    m.error.value = 'Mise à jour impossible'
    expect(mount(MaintenanceCard).find('[data-test="maintenance-error"]').text()).toBe('Mise à jour impossible')
  })
})
