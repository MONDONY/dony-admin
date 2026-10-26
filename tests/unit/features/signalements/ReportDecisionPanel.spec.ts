import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ReportDecisionPanel from '@/features/signalements/components/ReportDecisionPanel.vue'
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

function mountPanel(report: AdminReport | null, extra: Record<string, unknown> = {}) {
  return mount(ReportDecisionPanel, { props: { report, ...extra } })
}
const confirmBtn = (w: ReturnType<typeof mountPanel>) => w.find('[data-test="resolve-confirm"]')
async function choose(w: ReturnType<typeof mountPanel>, action: string) {
  await w.find(`[data-test="resolve-action-${action}"] input`).setValue(true)
}

describe('ReportDecisionPanel', () => {
  beforeEach(() => seedAuth('ADMIN'))

  it('sans signalement sélectionné : invite à en choisir un, rien à confirmer', () => {
    const w = mountPanel(null)
    expect(w.find('[data-test="decision-empty"]').exists()).toBe(true)
    expect(confirmBtn(w).exists()).toBe(false)
  })

  it('numérote les actions pour les raccourcis 1 à N', () => {
    const w = mountPanel(messageReport)
    const keys = w.findAll('[data-test^="resolve-action-"] kbd').map((k) => k.text())
    expect(keys).toEqual(['1', '2', '3', '4', '5'])
    expect(w.text()).toContain('Touches 1 à 5')
  })

  it('propose les actions du back dans l’ordre stable, avec le nom de l’auteur', () => {
    const w = mountPanel(messageReport)
    const labels = w.findAll('[data-test^="resolve-action-"] [data-test="resolve-action-label"]').map((x) => x.text())
    expect(labels).toEqual(['Marquer comme traité', 'Supprimer le message', 'Avertir Moussa B.', 'Suspendre Moussa B.', 'Rejeter le signalement'])
  })

  it('ancien back : repli local avec RESOLVE en tête', () => {
    const w = mountPanel({ ...base, targetType: 'APP' })
    const labels = w.findAll('[data-test="resolve-action-label"]').map((x) => x.text())
    expect(labels).toEqual(['Marquer comme traité', 'Rejeter le signalement'])
  })

  it('cible APP : aide « Bug corrigé ou pris en compte » sous Marquer comme traité', () => {
    const w = mountPanel({ ...base, targetType: 'APP', availableActions: ['RESOLVE', 'DISMISS'] })
    expect(w.find('[data-test="resolve-action-RESOLVE"]').text()).toContain('Bug corrigé ou pris en compte')
  })

  it('RESOLVE choisi par défaut, note facultative : confirmable sans note', async () => {
    const w = mountPanel(messageReport)
    expect((w.find('[data-test="resolve-action-RESOLVE"] input').element as HTMLInputElement).checked).toBe(true)
    expect(w.find('[data-test="resolve-note"]').attributes('placeholder')).toContain('facultative')
    expect(confirmBtn(w).attributes('disabled')).toBeUndefined()
    await confirmBtn(w).trigger('click')
    expect(w.emitted('confirm')![0]).toEqual(['RESOLVE', '', '', ''])
  })

  it('DISMISS : note facultative, rien n’est envoyé au signalant', async () => {
    const w = mountPanel(messageReport)
    await choose(w, 'DISMISS')
    expect(w.find('[data-test="resolve-preview-reporter"]').exists()).toBe(false)
    expect(w.find('[data-test="resolve-preview-none"]').text()).toBe('Rien n’est envoyé : le signalant n’est pas prévenu d’un rejet.')
    expect(confirmBtn(w).attributes('disabled')).toBeUndefined()
  })

  describe('aperçu « Ce qui sera envoyé »', () => {
    it('toute action sauf DISMISS remercie le signalant, par son nom', async () => {
      const w = mountPanel(messageReport)
      expect(w.find('[data-test="resolve-preview-reporter"]').text()).toContain('Awa')
      expect(w.find('[data-test="resolve-preview-reporter"]').text()).toContain('Merci, votre signalement a été traité.')
      await choose(w, 'DELETE_MESSAGE')
      expect(w.find('[data-test="resolve-preview-reporter"]').exists()).toBe(true)
    })

    it('le mot au signalant s’ajoute à la suite du remerciement, comme côté back', async () => {
      const w = mountPanel(messageReport)
      await w.find('[data-test="resolve-reporter-message"]').setValue('  Le message a été supprimé.  ')
      expect(w.find('[data-test="resolve-preview-reporter"]').text())
        .toContain('Merci, votre signalement a été traité. Le message a été supprimé.')
    })

    it('un avertissement montre le texte standard, puis le message saisi', async () => {
      const w = mountPanel(messageReport)
      await choose(w, 'WARN_AUTHOR')
      const target = () => w.find('[data-test="resolve-preview-target"]')
      expect(target().text()).toContain('Moussa B.')
      expect(target().text()).toContain('Avertissement Yadony')
      expect(target().text()).toContain('Un comportement signalé sur votre compte a été examiné.')
      await w.find('[data-test="resolve-target-message"]').setValue('Merci de rester courtois')
      expect(target().text()).toContain('Merci de rester courtois')
      expect(target().text()).not.toContain('Un comportement signalé')
    })

    it('la note interne n’apparaît jamais dans l’aperçu', async () => {
      const w = mountPanel(messageReport)
      await choose(w, 'WARN_AUTHOR')
      await w.find('[data-test="resolve-note"]').setValue('signalé par Awa, sa voisine')
      expect(w.find('[data-test="resolve-preview"]').text()).not.toContain('sa voisine')
    })

    it('signalant inconnu : pas de notification fantôme', () => {
      const w = mountPanel({ ...messageReport, reporterName: null })
      expect(w.find('[data-test="resolve-preview-reporter"]').exists()).toBe(false)
      expect(w.find('[data-test="resolve-preview-none"]').text()).toBe('Aucune notification n’est envoyée.')
    })

    it('avertir un compte signalé directement le nomme par son libellé', async () => {
      const w = mountPanel({ ...base, targetType: 'USER', targetLabel: 'Ibrahima S.', availableActions: ['WARN', 'RESOLVE'] })
      await choose(w, 'WARN')
      expect(w.find('[data-test="resolve-preview-target"]').text()).toContain('Ibrahima S.')
    })
  })

  it('sanction : note obligatoire', async () => {
    const w = mountPanel(messageReport)
    await choose(w, 'WARN_AUTHOR')
    expect(w.find('[data-test="resolve-note"]').attributes('placeholder')).toContain('obligatoire')
    expect(confirmBtn(w).attributes('disabled')).toBeDefined()
    await w.find('[data-test="resolve-note"]').setValue('   ')
    expect(confirmBtn(w).attributes('disabled')).toBeDefined()
    await w.find('[data-test="resolve-note"]').setValue('insultes répétées')
    expect(confirmBtn(w).attributes('disabled')).toBeUndefined()
    await confirmBtn(w).trigger('click')
    expect(w.emitted('confirm')![0]).toEqual(['WARN_AUTHOR', 'insultes répétées', '', ''])
  })

  it('SUSPEND_AUTHOR : confirmation renforcée, conséquence explicite, case à cocher', async () => {
    const w = mountPanel(messageReport)
    await choose(w, 'SUSPEND_AUTHOR')
    expect(w.find('[data-test="resolve-consequence"]').text()).toContain('Moussa B.')
    await w.find('[data-test="resolve-note"]').setValue('menaces')
    expect(confirmBtn(w).attributes('disabled')).toBeDefined()
    await w.find('[data-test="resolve-acknowledge"]').setValue(true)
    expect(confirmBtn(w).attributes('disabled')).toBeUndefined()
    expect(confirmBtn(w).text()).toContain('Suspendre Moussa B.')
    await confirmBtn(w).trigger('click')
    expect(w.emitted('confirm')![0]).toEqual(['SUSPEND_AUTHOR', 'menaces', '', ''])
  })

  it('avertissement : message dédié lu par la personne avertie, distinct de la note interne', async () => {
    const w = mountPanel(messageReport)
    expect(w.find('[data-test="resolve-target-message"]').exists()).toBe(false)
    await choose(w, 'WARN_AUTHOR')
    await w.find('[data-test="resolve-note"]').setValue('signalé par Awa')
    await w.find('[data-test="resolve-target-message"]').setValue('  Merci de rester courtois  ')
    await w.find('[data-test="resolve-reporter-message"]').setValue('Auteur averti.')
    await confirmBtn(w).trigger('click')
    expect(w.emitted('confirm')![0]).toEqual(['WARN_AUTHOR', 'signalé par Awa', 'Merci de rester courtois', 'Auteur averti.'])
  })

  it('le message à la personne avertie n’existe que pour les avertissements', async () => {
    const w = mountPanel(messageReport)
    await choose(w, 'WARN_AUTHOR')
    await w.find('[data-test="resolve-target-message"]').setValue('Texte')
    await choose(w, 'RESOLVE')
    expect(w.find('[data-test="resolve-target-message"]').exists()).toBe(false)
    await confirmBtn(w).trigger('click')
    expect(w.emitted('confirm')![0]).toEqual(['RESOLVE', '', '', ''])
  })

  it('rejet : aucun mot pour le signalant, qui n’est pas prévenu', async () => {
    const w = mountPanel(messageReport)
    await w.find('[data-test="resolve-reporter-message"]').setValue('Texte')
    await choose(w, 'DISMISS')
    expect(w.find('[data-test="resolve-reporter-message"]').exists()).toBe(false)
    await confirmBtn(w).trigger('click')
    expect(w.emitted('confirm')![0]).toEqual(['DISMISS', '', '', ''])
  })

  it('un autre signalement repart de messages vides', async () => {
    const w = mountPanel(messageReport)
    await w.find('[data-test="resolve-reporter-message"]').setValue('Texte')
    await w.setProps({ report: { ...messageReport, id: 'r2' } })
    expect((w.find('[data-test="resolve-reporter-message"]').element as HTMLTextAreaElement).value).toBe('')
  })

  it('motifs rapides : un clic remplit la note, absents pour les sanctions', async () => {
    const w = mountPanel(messageReport)
    expect(w.find('[data-test="resolve-quick-Pris en compte"]').exists()).toBe(true)
    await choose(w, 'DISMISS')
    await w.find('[data-test="resolve-quick-Doublon"]').trigger('click')
    expect((w.find('[data-test="resolve-note"]').element as HTMLTextAreaElement).value).toBe('Doublon')
    await choose(w, 'WARN_AUTHOR')
    expect(w.find('[data-test="resolve-quick-notes"]').exists()).toBe(false)
  })

  it('changer d’action réarme la case de confirmation', async () => {
    const w = mountPanel(messageReport)
    await choose(w, 'DELETE_MESSAGE')
    await w.find('[data-test="resolve-acknowledge"]').setValue(true)
    await choose(w, 'SUSPEND_AUTHOR')
    expect((w.find('[data-test="resolve-acknowledge"]').element as HTMLInputElement).checked).toBe(false)
  })

  it('DELETE_MESSAGE : conséquence explicite', async () => {
    const w = mountPanel(messageReport)
    await choose(w, 'DELETE_MESSAGE')
    expect(w.find('[data-test="resolve-consequence"]').text()).toContain('message')
  })

  it('pas de confirmation renforcée pour RESOLVE', () => {
    const w = mountPanel(messageReport)
    expect(w.find('[data-test="resolve-consequence"]').exists()).toBe(false)
  })

  describe('bouton de confirmation et passage au suivant', () => {
    it('nomme l’action et annonce le dossier suivant', async () => {
      const w = mountPanel(messageReport)
      expect(confirmBtn(w).text()).toContain('Marquer comme traité et passer au suivant')
      await choose(w, 'DISMISS')
      expect(confirmBtn(w).text()).toContain('Rejeter le signalement et passer au suivant')
    })

    it('dernier dossier : plus de « passer au suivant »', () => {
      const w = mountPanel(messageReport, { hasNext: false })
      expect(confirmBtn(w).text()).not.toContain('passer au suivant')
      expect(confirmBtn(w).text()).toContain('Marquer comme traité')
    })
  })

  describe('raccourcis clavier (exposés à la page)', () => {
    it('pick(n) choisit la n-ième action affichée', async () => {
      const w = mountPanel(messageReport)
      ;(w.vm as unknown as { pick: (_n: number) => void }).pick(3)
      await w.vm.$nextTick()
      expect((w.find('[data-test="resolve-action-WARN_AUTHOR"] input').element as HTMLInputElement).checked).toBe(true)
    })

    it('pick hors plage : ne change rien', async () => {
      const w = mountPanel(messageReport)
      ;(w.vm as unknown as { pick: (_n: number) => void }).pick(9)
      await w.vm.$nextTick()
      expect((w.find('[data-test="resolve-action-RESOLVE"] input').element as HTMLInputElement).checked).toBe(true)
    })

    it('submit() confirme comme le bouton, et rien tant que la saisie est incomplète', async () => {
      const w = mountPanel(messageReport)
      const vm = w.vm as unknown as { pick: (_n: number) => void; submit: () => void }
      vm.pick(3)
      await w.vm.$nextTick()
      vm.submit()
      expect(w.emitted('confirm')).toBeUndefined()
      await w.find('[data-test="resolve-note"]').setValue('insultes')
      vm.submit()
      expect(w.emitted('confirm')![0]).toEqual(['WARN_AUTHOR', 'insultes', '', ''])
    })

    it('submit() sur une sanction forte exige la case cochée', async () => {
      const w = mountPanel(messageReport)
      const vm = w.vm as unknown as { pick: (_n: number) => void; submit: () => void }
      vm.pick(4)
      await w.vm.$nextTick()
      await w.find('[data-test="resolve-note"]').setValue('menaces')
      vm.submit()
      expect(w.emitted('confirm')).toBeUndefined()
      await w.find('[data-test="resolve-acknowledge"]').setValue(true)
      vm.submit()
      expect(w.emitted('confirm')).toHaveLength(1)
    })
  })

  describe('signalement déjà traité', () => {
    it('rappelle l’issue et ne propose plus aucune action', () => {
      const w = mountPanel({ ...messageReport, status: 'RESOLVED', actionTaken: 'WARN_AUTHOR', availableActions: [] })
      expect(w.find('[data-test="decision-closed"]').text()).toBe('Traité : Auteur averti.')
      expect(w.find('[data-test="resolve-confirm"]').exists()).toBe(false)
      expect(w.find('[data-test="resolve-no-action"]').exists()).toBe(false)
    })

    it('rejeté', () => {
      const w = mountPanel({ ...messageReport, status: 'DISMISSED', actionTaken: 'DISMISS', availableActions: [] })
      expect(w.find('[data-test="decision-closed"]').text()).toBe('Signalement rejeté.')
    })
  })

  it('affiche l’erreur transmise (403, 422) dans le dialogue', () => {
    const w = mountPanel(messageReport, { error: 'La cible de ce signalement est introuvable.' })
    expect(w.find('[data-test="resolve-error"]').text()).toBe('La cible de ce signalement est introuvable.')
    expect(w.find('[data-test="resolve-error"]').attributes('role')).toBe('alert')
  })

  it('pendant l’envoi : bouton désactivé', () => {
    const w = mountPanel(messageReport, { busy: true })
    expect(confirmBtn(w).attributes('disabled')).toBeDefined()
    expect(confirmBtn(w).attributes('aria-busy')).toBe('true')
  })

  it('aucune action disponible : pas de confirmation possible', () => {
    const w = mountPanel({ ...messageReport, availableActions: [] })
    expect(w.find('[data-test="resolve-no-action"]').exists()).toBe(true)
    expect(confirmBtn(w).exists()).toBe(false)
  })

  describe('permission REPORT_RESOLVE (ancien back sans availableActions)', () => {
    const legacy: AdminReport = { ...base, targetType: 'APP' }

    it('propose le traitement avec REPORT_RESOLVE', () => {
      seedAuth('ADMIN')
      expect(mountPanel(legacy).find('[data-test="resolve-action-RESOLVE"]').exists()).toBe(true)
    })

    it('rien sans REPORT_RESOLVE : le repli local ne contourne pas la permission', () => {
      seedAuth('SUPPORT', { REPORT_RESOLVE: false })
      const w = mountPanel(legacy)
      expect(w.find('[data-test="resolve-no-action"]').exists()).toBe(true)
      expect(w.find('[data-test="resolve-confirm"]').exists()).toBe(false)
    })

    it('availableActions du back : il a tranché, même sans REPORT_RESOLVE local', () => {
      seedAuth('SUPPORT', { REPORT_RESOLVE: false })
      const w = mountPanel({ ...legacy, availableActions: ['RESOLVE', 'DISMISS'] })
      expect(w.find('[data-test="resolve-action-RESOLVE"]').exists()).toBe(true)
    })
  })

  it('seulement des sanctions : aucune choisie d’office', async () => {
    const w = mountPanel({ ...messageReport, availableActions: ['WARN_AUTHOR'] })
    expect(confirmBtn(w).attributes('disabled')).toBeDefined()
    await confirmBtn(w).trigger('click')
    expect(w.emitted('confirm')).toBeUndefined()
  })

  it('cible APP avec targetAuthor null : libellés sans nom', () => {
    const w = mountPanel({ ...base, targetType: 'APP', targetId: null, targetAuthor: null, availableActions: ['RESOLVE', 'DISMISS'] })
    const labels = w.findAll('[data-test="resolve-action-label"]').map((x) => x.text())
    expect(labels).toEqual(['Marquer comme traité', 'Rejeter le signalement'])
    expect(w.text()).not.toContain('null')
  })

  it('MESSAGE sans messageId : le back ne propose que traiter ou rejeter, affiché tel quel', async () => {
    const w = mountPanel({ ...base, targetId: null, targetLabel: null, targetAuthor: null, availableActions: ['DISMISS', 'RESOLVE'] })
    const labels = w.findAll('[data-test="resolve-action-label"]').map((x) => x.text())
    expect(labels).toEqual(['Marquer comme traité', 'Rejeter le signalement'])
    expect(w.find('[data-test="resolve-consequence"]').exists()).toBe(false)
    await confirmBtn(w).trigger('click')
    expect(w.emitted('confirm')![0]).toEqual(['RESOLVE', '', '', ''])
  })

  it('un nouveau signalement réinitialise action, note et case', async () => {
    const w = mountPanel(messageReport)
    await choose(w, 'WARN_AUTHOR')
    await w.find('[data-test="resolve-note"]').setValue('x')
    await w.setProps({ report: { ...messageReport, id: 'r2' } })
    expect((w.find('[data-test="resolve-action-RESOLVE"] input').element as HTMLInputElement).checked).toBe(true)
    expect((w.find('[data-test="resolve-note"]').element as HTMLTextAreaElement).value).toBe('')
  })
})
