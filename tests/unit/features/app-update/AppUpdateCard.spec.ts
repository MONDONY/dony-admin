import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import type { AppUpdateState } from '@/features/app-update/types/index'

const m = {
  state: ref<AppUpdateState | null>(null),
  unavailable: ref(false),
  loading: ref(false),
  busy: ref(false),
  error: ref<string | null>(null),
  loadFailed: ref(false),
  load: vi.fn(),
  save: vi.fn(),
}
vi.mock('@/features/app-update/composables/useAppUpdate', () => ({
  BUILD_MIN: 0, BUILD_MAX: 100000, useAppUpdate: () => m,
}))
import AppUpdateCard from '@/features/app-update/components/AppUpdateCard.vue'

describe('AppUpdateCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.state.value = { recommendedBuild: 1070, minSupportedBuild: 1000 }
    m.unavailable.value = false
    m.loading.value = false
    m.busy.value = false
    m.error.value = null
    m.loadFailed.value = false
    m.save.mockResolvedValue(true)
  })

  it('charge au montage et affiche les deux builds', () => {
    const w = mount(AppUpdateCard)
    expect(m.load).toHaveBeenCalledTimes(1)
    expect(w.find('[data-test="app-update-current"]').text()).toBe('1070')
    expect(w.find('[data-test="app-update-min"]').text()).toBe('1000')
  })

  it('minSupportedBuild est en lecture seule : un seul champ de saisie', () => {
    const w = mount(AppUpdateCard)
    expect(w.findAll('input')).toHaveLength(1)
    expect(w.find('[data-test="app-update-input"]').element).toHaveProperty('value', '1070')
  })

  it('affiche le bloc d’aide', () => {
    const w = mount(AppUpdateCard)
    expect(w.find('[data-test="app-update-help"]').text()).toContain('APRÈS la publication')
    expect(w.find('[data-test="app-update-help"]').text()).toContain('60 minutes')
  })

  it('indique un bandeau désactivé quand la valeur est 0', () => {
    m.state.value = { recommendedBuild: 0, minSupportedBuild: 0 }
    expect(mount(AppUpdateCard).find('[data-test="app-update-disabled"]').exists()).toBe(true)
  })

  it('Enregistrer est inactif tant que la valeur est inchangée ou invalide', async () => {
    const w = mount(AppUpdateCard)
    const save = w.find('[data-test="app-update-save"]')
    expect(save.attributes('disabled')).toBeDefined()
    await w.find('[data-test="app-update-input"]').setValue('abc')
    expect(save.attributes('disabled')).toBeDefined()
    await w.find('[data-test="app-update-input"]').setValue('100001')
    expect(w.find('[data-test="app-update-invalid"]').exists()).toBe(true)
    expect(save.attributes('disabled')).toBeDefined()
    await w.find('[data-test="app-update-input"]').setValue('1.5')
    expect(save.attributes('disabled')).toBeDefined()
  })

  it('confirmation avec le message attendu puis envoi', async () => {
    const w = mount(AppUpdateCard)
    await w.find('[data-test="app-update-input"]').setValue('1082')
    expect(w.find('[data-test="app-update-lowering"]').exists()).toBe(false)
    await w.find('[data-test="app-update-save"]').trigger('click')
    expect(w.text()).toContain('Les utilisateurs dont le build installé est inférieur à 1082 verront le bandeau de mise à jour.')
    expect(m.save).not.toHaveBeenCalled()
    await w.find('[data-test="confirm"]').trigger('click')
    expect(m.save).toHaveBeenCalledWith(1082)
  })

  it('annuler la confirmation n’envoie rien', async () => {
    const w = mount(AppUpdateCard)
    await w.find('[data-test="app-update-input"]').setValue('1082')
    await w.find('[data-test="app-update-save"]').trigger('click')
    await w.find('[data-test="cancel"]').trigger('click')
    expect(m.save).not.toHaveBeenCalled()
    expect(w.find('[data-test="overlay"]').exists()).toBe(false)
  })

  it('avertit quand on baisse la valeur, confirmation quand même possible', async () => {
    const w = mount(AppUpdateCard)
    await w.find('[data-test="app-update-input"]').setValue('1050')
    expect(w.find('[data-test="app-update-lowering"]').text())
      .toBe('Tu baisses la valeur : le bandeau ne s’affichera plus pour les builds entre 1050 et 1070.')
    await w.find('[data-test="app-update-save"]').trigger('click')
    expect(w.find('[data-test="overlay"]').text()).toContain('entre 1050 et 1070')
    await w.find('[data-test="confirm"]').trigger('click')
    expect(m.save).toHaveBeenCalledWith(1050)
  })

  it('0 désactive le bandeau et le dit dans la confirmation', async () => {
    const w = mount(AppUpdateCard)
    await w.find('[data-test="app-update-input"]').setValue('0')
    await w.find('[data-test="app-update-save"]').trigger('click')
    expect(w.find('[data-test="overlay"]').text()).toContain('désactivé pour tout le monde')
    await w.find('[data-test="confirm"]').trigger('click')
    expect(m.save).toHaveBeenCalledWith(0)
  })

  it('affiche le message d’erreur', () => {
    m.error.value = 'La configuration a changé entre-temps, réessaie.'
    expect(mount(AppUpdateCard).find('[data-test="app-update-error"]').text()).toContain('changé entre-temps')
  })

  it('état de chargement puis échec avec bouton Réessayer', async () => {
    m.state.value = null
    m.loading.value = true
    const w = mount(AppUpdateCard)
    expect(w.find('[data-test="app-update-loading"]').exists()).toBe(true)
    m.loading.value = false
    m.loadFailed.value = true
    m.error.value = 'Impossible de charger la configuration de mise à jour'
    await w.vm.$nextTick()
    await w.find('[data-test="app-update-retry"]').trigger('click')
    expect(m.load).toHaveBeenCalledTimes(2)
  })

  it('indisponible sur un vieux serveur', () => {
    m.unavailable.value = true
    expect(mount(AppUpdateCard).text()).toContain('Indisponible sur cette version du serveur')
  })
})
