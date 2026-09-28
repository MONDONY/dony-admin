import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ReportResolveDialog from '@/features/signalements/components/ReportResolveDialog.vue'
import type { AdminReport } from '@/features/signalements/types/index'
import { seedAuth } from '~/tests/helpers/auth'

const base: AdminReport = {
  id: 'r1', targetType: 'MESSAGE', targetId: 'm1', targetLabel: 'Message', reason: 'HARASSMENT', description: null,
  reporterName: 'Awa', status: 'OPEN', actionTaken: null, resolutionNote: null, resolvedAt: null,
  createdAt: '2026-06-01T10:00:00Z', photoUrls: [],
}
const messageReport: AdminReport = {
  ...base,
  availableActions: ['DISMISS', 'SUSPEND_AUTHOR', 'DELETE_MESSAGE', 'WARN_AUTHOR', 'RESOLVE'],
  targetAuthor: { userId: 'u2', name: 'Moussa B.' },
}

function mountDialog(report: AdminReport | null, extra: Record<string, unknown> = {}) {
  return mount(ReportResolveDialog, { props: { report, ...extra } })
}
const confirmBtn = (w: ReturnType<typeof mountDialog>) => w.find('[data-test="resolve-confirm"]')
async function choose(w: ReturnType<typeof mountDialog>, action: string) {
  await w.find(`[data-test="resolve-action-${action}"] input`).setValue(true)
}

describe('ReportResolveDialog', () => {
  beforeEach(() => seedAuth('ADMIN'))

  it('fermé sans signalement', () => {
    expect(mountDialog(null).find('[data-test="resolve-overlay"]').exists()).toBe(false)
  })

  it('propose les actions du back dans l’ordre stable, avec le nom de l’auteur', () => {
    const w = mountDialog(messageReport)
    const labels = w.findAll('[data-test^="resolve-action-"] [data-test="resolve-action-label"]').map((x) => x.text())
    expect(labels).toEqual(['Marquer comme traité', 'Supprimer le message', 'Avertir Moussa B.', 'Suspendre Moussa B.', 'Rejeter le signalement'])
  })

  it('ancien back : repli local avec RESOLVE en tête', () => {
    const w = mountDialog({ ...base, targetType: 'APP' })
    const labels = w.findAll('[data-test="resolve-action-label"]').map((x) => x.text())
    expect(labels).toEqual(['Marquer comme traité', 'Rejeter le signalement'])
  })

  it('cible APP : aide « Bug corrigé ou pris en compte » sous Marquer comme traité', () => {
    const w = mountDialog({ ...base, targetType: 'APP', availableActions: ['RESOLVE', 'DISMISS'] })
    expect(w.find('[data-test="resolve-action-RESOLVE"]').text()).toContain('Bug corrigé ou pris en compte')
  })

  it('RESOLVE choisi par défaut, note facultative : confirmable sans note', async () => {
    const w = mountDialog(messageReport)
    expect((w.find('[data-test="resolve-action-RESOLVE"] input').element as HTMLInputElement).checked).toBe(true)
    expect(w.find('[data-test="resolve-note"]').attributes('placeholder')).toContain('facultative')
    expect(confirmBtn(w).attributes('disabled')).toBeUndefined()
    await confirmBtn(w).trigger('click')
    expect(w.emitted('confirm')![0]).toEqual(['RESOLVE', ''])
  })

  it('DISMISS : note facultative, pas de rappel au signalant', async () => {
    const w = mountDialog(messageReport)
    await choose(w, 'DISMISS')
    expect(w.find('[data-test="resolve-reporter-notice"]').exists()).toBe(false)
    expect(confirmBtn(w).attributes('disabled')).toBeUndefined()
  })

  it('rappel au signalant pour toute action sauf DISMISS', async () => {
    const w = mountDialog(messageReport)
    expect(w.find('[data-test="resolve-reporter-notice"]').text())
      .toBe('Le signalant sera prévenu que son signalement a été traité, sans détail.')
    await choose(w, 'WARN_AUTHOR')
    expect(w.find('[data-test="resolve-reporter-notice"]').exists()).toBe(true)
  })

  it('sanction : note obligatoire', async () => {
    const w = mountDialog(messageReport)
    await choose(w, 'WARN_AUTHOR')
    expect(w.find('[data-test="resolve-note"]').attributes('placeholder')).toContain('obligatoire')
    expect(confirmBtn(w).attributes('disabled')).toBeDefined()
    await w.find('[data-test="resolve-note"]').setValue('   ')
    expect(confirmBtn(w).attributes('disabled')).toBeDefined()
    await w.find('[data-test="resolve-note"]').setValue('insultes répétées')
    expect(confirmBtn(w).attributes('disabled')).toBeUndefined()
    await confirmBtn(w).trigger('click')
    expect(w.emitted('confirm')![0]).toEqual(['WARN_AUTHOR', 'insultes répétées'])
  })

  it('SUSPEND_AUTHOR : confirmation renforcée, conséquence explicite, case à cocher', async () => {
    const w = mountDialog(messageReport)
    await choose(w, 'SUSPEND_AUTHOR')
    expect(w.find('[data-test="resolve-consequence"]').text()).toContain('Moussa B.')
    await w.find('[data-test="resolve-note"]').setValue('menaces')
    expect(confirmBtn(w).attributes('disabled')).toBeDefined()
    await w.find('[data-test="resolve-acknowledge"]').setValue(true)
    expect(confirmBtn(w).attributes('disabled')).toBeUndefined()
    expect(confirmBtn(w).text()).toBe('Suspendre Moussa B.')
    await confirmBtn(w).trigger('click')
    expect(w.emitted('confirm')![0]).toEqual(['SUSPEND_AUTHOR', 'menaces'])
  })

  it('changer d’action réarme la case de confirmation', async () => {
    const w = mountDialog(messageReport)
    await choose(w, 'DELETE_MESSAGE')
    await w.find('[data-test="resolve-acknowledge"]').setValue(true)
    await choose(w, 'SUSPEND_AUTHOR')
    expect((w.find('[data-test="resolve-acknowledge"]').element as HTMLInputElement).checked).toBe(false)
  })

  it('DELETE_MESSAGE : conséquence explicite', async () => {
    const w = mountDialog(messageReport)
    await choose(w, 'DELETE_MESSAGE')
    expect(w.find('[data-test="resolve-consequence"]').text()).toContain('message')
  })

  it('pas de confirmation renforcée pour RESOLVE', () => {
    const w = mountDialog(messageReport)
    expect(w.find('[data-test="resolve-consequence"]').exists()).toBe(false)
    expect(confirmBtn(w).text()).toBe('Confirmer')
  })

  it('affiche l’erreur transmise (403, 422) dans le dialogue', () => {
    const w = mountDialog(messageReport, { error: 'La cible de ce signalement est introuvable.' })
    expect(w.find('[data-test="resolve-error"]').text()).toBe('La cible de ce signalement est introuvable.')
    expect(w.find('[data-test="resolve-error"]').attributes('role')).toBe('alert')
  })

  it('pendant l’envoi : bouton désactivé', () => {
    const w = mountDialog(messageReport, { busy: true })
    expect(confirmBtn(w).attributes('disabled')).toBeDefined()
    expect(confirmBtn(w).attributes('aria-busy')).toBe('true')
  })

  it('aucune action disponible : pas de confirmation possible', () => {
    const w = mountDialog({ ...messageReport, availableActions: [] })
    expect(w.find('[data-test="resolve-no-action"]').exists()).toBe(true)
    expect(confirmBtn(w).attributes('disabled')).toBeDefined()
  })

  it('seulement des sanctions : aucune choisie d’office', async () => {
    const w = mountDialog({ ...messageReport, availableActions: ['WARN_AUTHOR'] })
    expect(confirmBtn(w).attributes('disabled')).toBeDefined()
    await confirmBtn(w).trigger('click')
    expect(w.emitted('confirm')).toBeUndefined()
  })

  it('Annuler émet cancel', async () => {
    const w = mountDialog(messageReport)
    await w.find('[data-test="resolve-cancel"]').trigger('click')
    expect(w.emitted('cancel')).toHaveLength(1)
  })

  it('un nouveau signalement réinitialise action, note et case', async () => {
    const w = mountDialog(messageReport)
    await choose(w, 'WARN_AUTHOR')
    await w.find('[data-test="resolve-note"]').setValue('x')
    await w.setProps({ report: { ...messageReport, id: 'r2' } })
    expect((w.find('[data-test="resolve-action-RESOLVE"] input').element as HTMLInputElement).checked).toBe(true)
    expect((w.find('[data-test="resolve-note"]').element as HTMLTextAreaElement).value).toBe('')
  })
})
