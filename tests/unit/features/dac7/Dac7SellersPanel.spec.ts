import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { seedAuth } from '~/tests/helpers/auth'

const svc = vi.hoisted(() => ({
  sellers: vi.fn(), diligence: vi.fn(), remind: vi.fn(), decision: vi.fn(),
}))
vi.mock('@/features/dac7/services/dac7Service', () => ({ dac7Service: svc }))

import Dac7SellersPanel from '@/features/dac7/components/Dac7SellersPanel.vue'

const U1 = '7a2e4b1c-0000-4a00-8000-0000000000a1'
const U2 = '7a2e4b1c-0000-4a00-8000-0000000000a2'
const S1 = {
  userId: U1, displayName: 'Awa Diop', residenceCountry: 'FR', residencyStatus: 'DECLARABLE', taxInfoProvided: false,
  identityStatus: 'COMPLETE', solicitation: 'SOLLICITER', remindersSent: 1, lastDiligenceAt: '2026-11-03T09:00:00Z',
  operations: 7, netEur: 1234.5, commissionEur: 150, eurComplete: true, commissionComplete: true,
}
const S2 = {
  userId: U2, displayName: 'Moussa Ba', residenceCountry: 'BE', residencyStatus: 'DECLARABLE', taxInfoProvided: true,
  identityStatus: 'INCOMPLETE', solicitation: 'DEJA_FOURNI', remindersSent: 0,
  operations: 2, netEur: 80, commissionEur: 9, eurComplete: false, commissionComplete: false,
}
const LOG = [
  { at: '2026-10-20T08:00:00Z', action: 'REQUEST', channel: 'PUSH' },
  { at: '2026-11-03T09:00:00Z', action: 'REMINDER_1', channel: 'PUSH' },
  { at: '2026-11-05T10:00:00Z', action: 'TEAM_DECISION', channel: 'ADMIN', actorName: 'Admin Yadony', note: 'Pièce vérifiée au téléphone' },
]
const norm = (t: string) => t.replace(/\s/g, ' ')

async function mountPanel(role: 'ADMIN' | 'SUPPORT' = 'ADMIN', overrides: Record<string, boolean> = {}) {
  seedAuth(role, { DAC7_REPORT: true, ...overrides })
  const w = mount(Dac7SellersPanel, {
    props: { year: 2026 },
    global: { stubs: { NuxtLink: { props: ['to'], template: '<a :data-to="to"><slot /></a>' } } },
  })
  await flushPromises()
  return w
}
const open = async (w: Awaited<ReturnType<typeof mountPanel>>, id = U1) => {
  await w.get(`[data-test="dac7-seller-open-${id}"]`).trigger('click')
  await flushPromises()
}

describe('Dac7SellersPanel : tableau', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    svc.sellers.mockResolvedValue([S1, S2])
    svc.diligence.mockResolvedValue(LOG)
    svc.remind.mockResolvedValue(undefined)
    svc.decision.mockResolvedValue(undefined)
  })

  it('charge l’année et le filtre « Tous » par défaut', async () => {
    await mountPanel()
    expect(svc.sellers).toHaveBeenCalledWith(2026, 'ALL')
  })

  it('une ligne par voyageur, avec les colonnes du contrat et jamais de numéro fiscal', async () => {
    const w = await mountPanel()
    const r1 = norm(w.get(`[data-test="dac7-seller-row-${U1}"]`).text())
    expect(r1).toContain('Awa Diop')
    expect(r1).toContain('FR')
    expect(r1).toContain('Déclarable')
    expect(r1).toContain('Manquant')
    expect(r1).toContain('Complète')
    expect(r1).toContain('À solliciter')
    expect(r1).toContain('1 / 2')
    expect(r1).toContain('7')
    expect(r1).toContain('1 234,50 €')
    expect(r1).toContain('150,00 €')
    const r2 = norm(w.get(`[data-test="dac7-seller-row-${U2}"]`).text())
    expect(r2).toContain('Fourni')
    expect(r2).toContain('À revoir')
    expect(r2).toContain('Déjà fourni')
    expect(r2).toMatch(/partiel/i)
    expect(w.find('thead').text()).not.toMatch(/NIF/)
  })

  it('un nom absent s’affiche comme tel', async () => {
    svc.sellers.mockResolvedValue([{ userId: U1 }])
    const w = await mountPanel()
    expect(w.get(`[data-test="dac7-seller-row-${U1}"]`).text()).toContain('Nom non renseigné')
    expect(w.text()).not.toContain('undefined')
  })

  it('montants absents (résidence inconnue ou non déclarable) : « non calculé », pas zéro', async () => {
    svc.sellers.mockResolvedValue([{ userId: U1, displayName: 'Awa Diop', residencyStatus: 'RESIDENCE_INCONNUE', taxInfoProvided: false }])
    const w = await mountPanel()
    const row = norm(w.get(`[data-test="dac7-seller-row-${U1}"]`).text())
    expect(row.match(/non calculé/g)).toHaveLength(3)
    expect(row).not.toContain('0,00')
    expect(row).not.toMatch(/partiel/i)
    expect(row).not.toMatch(/[–—]/)
  })

  it('un zéro envoyé par le serveur reste un zéro', async () => {
    svc.sellers.mockResolvedValue([{ userId: U1, operations: 0, netEur: 0, commissionEur: 0 }])
    const w = await mountPanel()
    const row = norm(w.get(`[data-test="dac7-seller-row-${U1}"]`).text())
    expect(row).toContain('0,00 €')
    expect(row).not.toContain('non calculé')
  })

  it('course : la réponse tardive d’un filtre abandonné est ignorée, et les anciennes lignes disparaissent', async () => {
    const pending: ((_v: unknown) => void)[] = []
    svc.sellers.mockReset()
    svc.sellers.mockImplementation(() => new Promise((resolve) => { pending.push(resolve) }))
    const w = mount(Dac7SellersPanel, { props: { year: 2026 }, global: { stubs: { NuxtLink: { props: ['to'], template: '<a><slot /></a>' } } } })
    await flushPromises()
    pending[0]([S1])
    await flushPromises()
    expect(w.text()).toContain('Awa Diop')
    await w.get('[data-test="dac7-filter-MISSING_TAX_INFO"]').trigger('click')
    await flushPromises()
    expect(w.text()).not.toContain('Awa Diop')
    expect(w.text()).toContain('Chargement')
    await w.get('[data-test="dac7-filter-ALL"]').trigger('click')
    await flushPromises()
    pending[2]([S2])
    await flushPromises()
    pending[1]([{ ...S1, userId: 'tardif', displayName: 'Filtre tardif' }])
    await flushPromises()
    expect(w.text()).toContain('Moussa Ba')
    expect(w.text()).not.toContain('Filtre tardif')
  })

  it('une erreur vide l’ancienne liste, « Non disponible » disparaît à la relecture réussie', async () => {
    const w = await mountPanel()
    expect(w.findAll('[data-test^="dac7-seller-row-"]')).toHaveLength(2)
    svc.sellers.mockRejectedValueOnce({ statusCode: 404, data: {} })
    await w.get('[data-test="dac7-filter-NON_DECLARABLE"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="dac7-unavailable"]').exists()).toBe(true)
    expect(w.findAll('[data-test^="dac7-seller-row-"]')).toHaveLength(0)
    await w.get('[data-test="dac7-filter-ALL"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="dac7-unavailable"]').exists()).toBe(false)
    expect(w.findAll('[data-test^="dac7-seller-row-"]')).toHaveLength(2)
  })

  it('identité UNAVAILABLE : badge « Indisponible » et phrase « réessayez plus tard »', async () => {
    svc.sellers.mockResolvedValue([{ userId: U1, displayName: 'Awa Diop', identityStatus: 'UNAVAILABLE' }])
    const w = await mountPanel()
    const row = w.get(`[data-test="dac7-seller-row-${U1}"]`).text()
    expect(row).toContain('Indisponible')
    expect(w.get(`[data-test="dac7-identity-hint-${U1}"]`).text()).toBe('Lecture d’identité indisponible, réessayez plus tard')
    expect(w.find(`[data-test="dac7-identity-hint-${U2}"]`).exists()).toBe(false)
  })

  it('pastille « Déjà exporté » seulement quand le serveur le dit', async () => {
    svc.sellers.mockResolvedValue([{ ...S1, alreadyExported: true }, S2])
    const w = await mountPanel()
    expect(w.get(`[data-test="dac7-seller-row-${U1}"]`).text()).toContain('Déjà exporté')
    expect(w.get(`[data-test="dac7-seller-row-${U2}"]`).text()).not.toContain('Déjà exporté')
  })

  it('prévient le parent de la liste chargée (pour nommer les voyageurs d’un refus d’export)', async () => {
    const w = await mountPanel()
    const loaded = w.emitted('loaded')!
    expect(loaded.at(-1)![0]).toEqual([S1, S2])
  })

  it('les cinq filtres relisent la liste', async () => {
    const w = await mountPanel()
    const labels = ['dac7-filter-ALL', 'dac7-filter-MISSING_TAX_INFO', 'dac7-filter-IDENTITY_REVIEW', 'dac7-filter-UNKNOWN_RESIDENCE', 'dac7-filter-NON_DECLARABLE']
    for (const l of labels) expect(w.find(`[data-test="${l}"]`).exists()).toBe(true)
    await w.get('[data-test="dac7-filter-MISSING_TAX_INFO"]').trigger('click')
    await flushPromises()
    expect(svc.sellers).toHaveBeenLastCalledWith(2026, 'MISSING_TAX_INFO')
    await w.get('[data-test="dac7-filter-NON_DECLARABLE"]').trigger('click')
    await flushPromises()
    expect(svc.sellers).toHaveBeenLastCalledWith(2026, 'NON_DECLARABLE')
  })

  it('changer d’année relit la liste', async () => {
    const w = await mountPanel()
    await w.setProps({ year: 2025 })
    await flushPromises()
    expect(svc.sellers).toHaveBeenLastCalledWith(2025, 'ALL')
  })

  it('liste vide : état vide, pas d’erreur', async () => {
    svc.sellers.mockResolvedValue([])
    const w = await mountPanel()
    expect(w.get('[data-test="dac7-sellers-empty"]').text()).toContain('Aucun voyageur')
    expect(w.find('[data-test="state-error"]').exists()).toBe(false)
  })

  it('vraie erreur : message et « Réessayer »', async () => {
    svc.sellers.mockRejectedValueOnce({ statusCode: 500, data: { detail: 'Base indisponible' } })
    const w = await mountPanel()
    expect(w.get('[data-test="state-error"]').text()).toContain('Base indisponible')
    svc.sellers.mockResolvedValueOnce([S1])
    await w.get('[data-test="state-retry"]').trigger('click')
    await flushPromises()
    expect(w.findAll('[data-test^="dac7-seller-row-"]')).toHaveLength(1)
  })

  it('ancien back (404 sans code) : « Non disponible sur cette version du serveur », pas d’erreur', async () => {
    svc.sellers.mockRejectedValue({ statusCode: 404, data: {} })
    const w = await mountPanel()
    expect(w.get('[data-test="dac7-unavailable"]').text()).toContain('Non disponible sur cette version du serveur')
    expect(w.find('[data-test="state-error"]').exists()).toBe(false)
  })

  it('405 aussi', async () => {
    svc.sellers.mockRejectedValue({ statusCode: 405, data: {} })
    const w = await mountPanel()
    expect(w.find('[data-test="dac7-unavailable"]').exists()).toBe(true)
  })
})

describe('Dac7SellersPanel : tiroir', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    svc.sellers.mockResolvedValue([S1, S2])
    svc.diligence.mockResolvedValue(LOG)
    svc.remind.mockResolvedValue(undefined)
    svc.decision.mockResolvedValue(undefined)
  })

  it('ouvre le registre des diligences du voyageur, le plus récent d’abord', async () => {
    const w = await mountPanel()
    await open(w)
    expect(svc.diligence).toHaveBeenCalledWith(U1)
    const items = w.findAll('[data-test="dac7-diligence-item"]')
    expect(items.map(i => i.text().split(/\s{2,}|\n/)[0])).toHaveLength(3)
    expect(items[0].text()).toContain('Décision de l’équipe')
    expect(items[0].text()).toContain('Admin Yadony')
    expect(items[0].text()).toContain('Pièce vérifiée au téléphone')
    expect(items[2].text()).toContain('Demande envoyée')
    expect(w.get('[data-test="dac7-drawer"]').text()).toContain('Awa Diop')
  })

  it('registre vide ou absent (ancien back) : message, pas d’erreur', async () => {
    svc.diligence.mockResolvedValueOnce([])
    const w = await mountPanel()
    await open(w)
    expect(w.get('[data-test="dac7-diligence-empty"]').text()).toContain('Aucune diligence')
    svc.diligence.mockRejectedValueOnce({ statusCode: 404, data: {} })
    await w.get('[data-test="dac7-drawer-close"]').trigger('click')
    await open(w, U2)
    expect(w.get('[data-test="dac7-drawer-unavailable"]').text()).toContain('Non disponible sur cette version du serveur')
  })

  it('erreur de lecture du registre : message et « Réessayer »', async () => {
    svc.diligence.mockRejectedValueOnce({ statusCode: 500, data: { detail: 'Panne' } })
    const w = await mountPanel()
    await open(w)
    expect(w.get('[data-test="dac7-drawer"] [data-test="state-error"]').text()).toContain('Panne')
    svc.diligence.mockResolvedValueOnce(LOG)
    await w.get('[data-test="dac7-drawer"] [data-test="state-retry"]').trigger('click')
    await flushPromises()
    expect(w.findAll('[data-test="dac7-diligence-item"]')).toHaveLength(3)
  })

  it('« Fermer » referme le tiroir', async () => {
    const w = await mountPanel()
    await open(w)
    await w.get('[data-test="dac7-drawer-close"]').trigger('click')
    expect(w.find('[data-test="dac7-drawer"]').exists()).toBe(false)
  })

  it('lien vers la fiche, seulement avec USER_VIEW', async () => {
    const w = await mountPanel()
    await open(w)
    expect(w.get('[data-test="dac7-drawer-user-link"]').attributes('data-to')).toBe(`/users/${U1}`)
    const sup = await mountPanel('SUPPORT')
    await open(sup)
    // SUPPORT a USER_VIEW : le lien existe aussi ; on retire le droit par override.
    const noView = await mountPanel('SUPPORT', { USER_VIEW: false })
    await open(noView)
    expect(noView.find('[data-test="dac7-drawer-user-link"]').exists()).toBe(false)
  })

  it('« Relancer » demande une confirmation, puis poste, relit et prévient le parent', async () => {
    const w = await mountPanel()
    await open(w)
    await w.get('[data-test="dac7-remind"]').trigger('click')
    expect(svc.remind).not.toHaveBeenCalled()
    expect(w.find('[data-test="overlay"]').exists()).toBe(true)
    svc.sellers.mockClear()
    await w.get('[data-test="confirm"]').trigger('click')
    await flushPromises()
    expect(svc.remind).toHaveBeenCalledWith(U1)
    expect(w.get('[data-test="dac7-drawer-notice"]').text()).toMatch(/relance/i)
    expect(svc.sellers).toHaveBeenCalledTimes(1)
    expect(w.emitted('changed')).toHaveLength(1)
    expect(svc.diligence).toHaveBeenCalledTimes(2)
  })

  it('« Annuler » ne relance pas', async () => {
    const w = await mountPanel()
    await open(w)
    await w.get('[data-test="dac7-remind"]').trigger('click')
    await w.get('[data-test="cancel"]').trigger('click')
    expect(svc.remind).not.toHaveBeenCalled()
    expect(w.find('[data-test="overlay"]').exists()).toBe(false)
  })

  it('un voyageur à ne pas solliciter : bouton « Relancer » désactivé, avec la raison', async () => {
    const w = await mountPanel()
    await open(w, U2)
    expect(w.get('[data-test="dac7-remind"]').attributes('disabled')).toBeDefined()
    expect(w.get('[data-test="dac7-remind-hint"]').text()).toMatch(/pas à solliciter|aucune relance/i)
  })

  it('409 dac7-not-solicitable : message clair, rien ne casse', async () => {
    svc.remind.mockRejectedValueOnce({ statusCode: 409, data: { code: 'dac7-not-solicitable', detail: 'x' } })
    const w = await mountPanel()
    await open(w)
    await w.get('[data-test="dac7-remind"]').trigger('click')
    await w.get('[data-test="confirm"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-test="dac7-drawer-error"]').text()).toMatch(/ne peut pas être sollicité/i)
    expect(w.emitted('changed')).toBeUndefined()
  })

  it('409 dac7-remind-too-soon : « moins de 7 jours »', async () => {
    svc.remind.mockRejectedValueOnce({ statusCode: 409, data: { code: 'dac7-remind-too-soon' } })
    const w = await mountPanel()
    await open(w)
    await w.get('[data-test="dac7-remind"]').trigger('click')
    await w.get('[data-test="confirm"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-test="dac7-drawer-error"]').text()).toMatch(/moins de 7 jours/)
  })

  it.each([
    ['dac7-reminders-exhausted', /Demande et deux rappels déjà envoyés/],
    ['dac7-collection-disabled', /La collecte est éteinte/],
  ])('409 %s : phrase claire', async (code, re) => {
    svc.remind.mockRejectedValueOnce({ statusCode: 409, data: { code, detail: 'brut' } })
    const w = await mountPanel()
    await open(w)
    await w.get('[data-test="dac7-remind"]').trigger('click')
    await w.get('[data-test="confirm"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-test="dac7-drawer-error"]').text()).toMatch(re)
  })

  it('422 dac7-note-sensitive : « retirez-le », la note reste saisie', async () => {
    svc.decision.mockRejectedValueOnce({ statusCode: 422, data: { code: 'dac7-note-sensitive' } })
    const w = await mountPanel()
    await open(w)
    await w.get('[data-test="dac7-decision-note"]').setValue('Une note')
    await w.get('[data-test="dac7-decision-submit"]').trigger('click')
    await w.get('[data-test="confirm"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-test="dac7-drawer-error"]').text()).toBe('La note semble contenir un numéro : retirez-le.')
    expect((w.get('[data-test="dac7-decision-note"]').element as HTMLTextAreaElement).value).toBe('Une note')
  })

  it('autre erreur de relance : le detail du serveur', async () => {
    svc.remind.mockRejectedValueOnce({ statusCode: 500, data: { detail: 'Messagerie indisponible' } })
    const w = await mountPanel()
    await open(w)
    await w.get('[data-test="dac7-remind"]').trigger('click')
    await w.get('[data-test="confirm"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-test="dac7-drawer-error"]').text()).toContain('Messagerie indisponible')
  })

  it('relance sur un ancien back (404 sans code) : non disponible, aucune erreur brute', async () => {
    svc.remind.mockRejectedValueOnce({ statusCode: 404, data: {} })
    const w = await mountPanel()
    await open(w)
    await w.get('[data-test="dac7-remind"]').trigger('click')
    await w.get('[data-test="confirm"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-test="dac7-drawer-error"]').text()).toContain('Non disponible sur cette version du serveur')
  })

  it('« Décision de l’équipe » : note obligatoire, 500 caractères au plus, compteur', async () => {
    const w = await mountPanel()
    await open(w)
    const submit = () => w.get('[data-test="dac7-decision-submit"]')
    expect(submit().attributes('disabled')).toBeDefined()
    expect(w.get('[data-test="dac7-decision-count"]').text()).toContain('0 / 500')
    await w.get('[data-test="dac7-decision-note"]').setValue('   ')
    expect(submit().attributes('disabled')).toBeDefined()
    await w.get('[data-test="dac7-decision-note"]').setValue('a'.repeat(501))
    expect(submit().attributes('disabled')).toBeDefined()
    expect(w.get('[data-test="dac7-decision-count"]').classes().join(' ')).toContain('text-danger')
    await w.get('[data-test="dac7-decision-note"]').setValue('Identité vérifiée à la main')
    expect(submit().attributes('disabled')).toBeUndefined()
  })

  it('enregistre la décision après confirmation, vide la note, relit le registre', async () => {
    const w = await mountPanel()
    await open(w)
    await w.get('[data-test="dac7-decision-note"]').setValue('Identité vérifiée à la main')
    await w.get('[data-test="dac7-decision-submit"]').trigger('click')
    expect(svc.decision).not.toHaveBeenCalled()
    await w.get('[data-test="confirm"]').trigger('click')
    await flushPromises()
    expect(svc.decision).toHaveBeenCalledWith(U1, 'Identité vérifiée à la main')
    expect((w.get('[data-test="dac7-decision-note"]').element as HTMLTextAreaElement).value).toBe('')
    expect(w.get('[data-test="dac7-drawer-notice"]').text()).toMatch(/décision/i)
    expect(svc.diligence).toHaveBeenCalledTimes(2)
    expect(w.emitted('changed')).toHaveLength(1)
  })

  it('décision refusée : message, la note reste saisie', async () => {
    svc.decision.mockRejectedValueOnce({ statusCode: 422, data: { detail: 'Note trop longue' } })
    const w = await mountPanel()
    await open(w)
    await w.get('[data-test="dac7-decision-note"]').setValue('Une note')
    await w.get('[data-test="dac7-decision-submit"]').trigger('click')
    await w.get('[data-test="confirm"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-test="dac7-drawer-error"]').text()).toContain('Note trop longue')
    expect((w.get('[data-test="dac7-decision-note"]').element as HTMLTextAreaElement).value).toBe('Une note')
  })

  it('le tiroir prévient de ne jamais écrire de donnée sensible dans la note', async () => {
    const w = await mountPanel()
    await open(w)
    expect(w.get('[data-test="dac7-drawer"]').text()).toMatch(/numéro fiscal/i)
  })
})
