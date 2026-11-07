import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
vi.mock('@/features/broadcast/services/broadcastService')
import BroadcastComposer from '@/features/broadcast/components/BroadcastComposer.vue'
import { broadcastService } from '@/features/broadcast/services/broadcastService'
import type { AudienceField, BroadcastAudience, BroadcastSegment } from '@/features/broadcast/types/index'

const svc = broadcastService as unknown as Record<string, ReturnType<typeof vi.fn>>

export const FIELDS: AudienceField[] = [
  { key: 'created_request', family: 'ACTIVITY', label: 'A créé une demande', operators: [{ key: 'EVER', label: 'au moins une fois', valueType: 'NONE' }], values: [] },
  { key: 'published_trip', family: 'ACTIVITY', label: 'A publié un trajet', operators: [{ key: 'EVER', label: 'au moins une fois', valueType: 'NONE' }], values: [] },
  { key: 'is_pro', family: 'STATUS', label: 'Compte Pro', operators: [{ key: 'IS', label: 'est', valueType: 'BOOLEAN' }], values: [] },
  { key: 'corridor_interest', family: 'GEO', label: 'Corridor', operators: [{ key: 'MATCHES', label: 'correspond à', valueType: 'CORRIDOR' }], values: [] },
]
const SEGMENT: BroadcastSegment = {
  id: 's1', name: 'Comptes Pro', description: null, recipientCount: -1, updatedAt: '2026-11-01T10:00:00',
  rule: { op: 'OR', children: [{ field: 'is_pro', operator: 'IS', value: true }] },
}
const aud = (n: number, m = 0): BroadcastAudience => ({ recipientCount: n, pushReachableCount: m })

function mountComposer(props: Record<string, unknown> = {}) {
  return mount(BroadcastComposer, {
    props: { audience: null, busy: false, previewing: false, fields: FIELDS, segments: [SEGMENT], canViewRecipients: true, ...props },
  })
}
const find = (w: ReturnType<typeof mountComposer>, id: string) => w.find(`[data-test="${id}"]`)
const sendButton = (w: ReturnType<typeof mountComposer>) => find(w, 'broadcast-send').element as HTMLButtonElement

async function fillMessage(w: ReturnType<typeof mountComposer>) {
  await find(w, 'broadcast-title').setValue('Titre')
  await find(w, 'broadcast-body').setValue('Corps')
}

describe('BroadcastComposer', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('désactive l’envoi tant que le titre ou le corps est vide', async () => {
    const w = mountComposer({ audience: aud(12) })
    expect(sendButton(w).disabled).toBe(true)
    await find(w, 'broadcast-title').setValue('Maintenance prévue')
    expect(sendButton(w).disabled).toBe(true)
    await find(w, 'broadcast-body').setValue('Le service sera coupé ce soir.')
    expect(sendButton(w).disabled).toBe(false)
  })

  it('le mode par défaut est « Construire une cible » et affiche le constructeur', () => {
    const w = mountComposer()
    const select = find(w, 'broadcast-target').element as HTMLSelectElement
    expect(select.value).toBe('RULES')
    expect(Array.from(select.options).map((o) => o.text)).toEqual(['Construire une cible', 'Segment enregistré', 'Un utilisateur précis'])
    expect(find(w, 'rule-group').exists()).toBe(true)
  })

  it('bascule entre règles, segment et utilisateur', async () => {
    const w = mountComposer()
    await find(w, 'broadcast-target').setValue('SEGMENT')
    expect(find(w, 'segment-select').exists()).toBe(true)
    expect(find(w, 'rule-group').exists()).toBe(false)
    await find(w, 'broadcast-target').setValue('USER')
    expect(find(w, 'broadcast-user-search').exists()).toBe(true)
    expect(find(w, 'segment-select').exists()).toBe(false)
  })

  it('un pré-remplissage utilisateur ouvre le mode utilisateur', () => {
    const w = mountComposer({ initialUserId: '3f2b8c1e-4a5d-4e6f-8a9b-0c1d2e3f4a5b' })
    expect((find(w, 'broadcast-target').element as HTMLSelectElement).value).toBe('USER')
    expect((find(w, 'broadcast-push').element as HTMLInputElement).checked).toBe(true)
  })

  it('les raccourcis chargent les préréglages', async () => {
    const w = mountComposer()
    await find(w, 'shortcut-senders').trigger('click')
    expect(w.findAll('[data-test="condition-row"]')).toHaveLength(1)
    await find(w, 'shortcut-travelers').trigger('click')
    expect(w.findAll('[data-test="condition-row"]')).toHaveLength(1)
    await find(w, 'shortcut-corridor').trigger('click')
    expect(w.findAll('[data-test="condition-row"]')).toHaveLength(1)
    await find(w, 'shortcut-all').trigger('click')
    expect(w.findAll('[data-test="condition-row"]')).toHaveLength(0)
  })

  it('apercu_debounce400_etIgnoreReponseObsolete : un seul aperçu 400 ms après la dernière modification', async () => {
    const w = mountComposer()
    await vi.advanceTimersByTimeAsync(400)
    expect(w.emitted('preview')).toHaveLength(1) // règle vide = tous les comptes

    await find(w, 'shortcut-senders').trigger('click')
    await vi.advanceTimersByTimeAsync(300)
    await find(w, 'shortcut-travelers').trigger('click')
    await vi.advanceTimersByTimeAsync(399)
    expect(w.emitted('preview')).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(w.emitted('preview')).toHaveLength(2)
    const sent = (w.emitted('preview')![1] as [{ type: string; rule: { children: Array<{ field: string }> } }])[0]
    expect(sent.type).toBe('RULE')
    expect(sent.rule.children[0]!.field).toBe('published_trip')
  })

  it('apercu_pasAppeleSiRegleIncomplete', async () => {
    const w = mountComposer()
    await find(w, 'add-condition').trigger('click')
    await find(w, 'pick-field-is_pro').trigger('click') // valeur manquante
    await vi.advanceTimersByTimeAsync(2000)
    expect(w.emitted('preview')).toBeUndefined()
    expect(find(w, 'broadcast-incomplete').exists()).toBe(true)
    expect((find(w, 'broadcast-preview').element as HTMLButtonElement).disabled).toBe(true)
  })

  it('affiche « N personnes ciblées, dont M joignables en push »', async () => {
    const w = mountComposer({ audience: aud(1234, 800) })
    expect(find(w, 'broadcast-recipient-count').text()).toBe('1234 personnes ciblées, dont 800 joignables en push')
    const one = mountComposer({ audience: aud(1, 1) })
    expect(find(one, 'broadcast-recipient-count').text()).toBe('1 personne ciblée, dont 1 joignable en push')
  })

  it('n’affiche rien quand le nombre est inconnu', () => {
    expect(find(mountComposer(), 'broadcast-recipient-count').exists()).toBe(false)
  })

  it('une audience sans détail push (ancien back) n’affiche que le total', () => {
    const w = mountComposer({ audience: { recipientCount: 5 } })
    expect(find(w, 'broadcast-recipient-count').text()).toBe('5 personnes ciblées')
  })

  it('l’estimation arrive après l’émission : fraîche, même si le total est identique', async () => {
    const w = mountComposer({ audience: aud(5, 2) })
    await find(w, 'shortcut-senders').trigger('click')
    expect(find(w, 'broadcast-stale-estimate').exists()).toBe(true)
    await vi.advanceTimersByTimeAsync(400)
    await w.setProps({ audience: aud(5, 2) }) // nouvel objet, mêmes chiffres
    expect(find(w, 'broadcast-recipient-count').exists()).toBe(true)
    expect(find(w, 'broadcast-stale-estimate').exists()).toBe(false)
  })

  it('une réponse arrivée pour l’ancien ciblage reste périmée', async () => {
    const w = mountComposer()
    await vi.advanceTimersByTimeAsync(400) // aperçu « tous »
    await find(w, 'shortcut-senders').trigger('click') // modifié avant la réponse
    await w.setProps({ audience: aud(100, 10) })
    expect(find(w, 'broadcast-recipient-count').exists()).toBe(false)
    expect(find(w, 'broadcast-stale-estimate').exists()).toBe(true)
  })

  it('envoi_modeRegles_envoieTypeRULE', async () => {
    const w = mountComposer()
    await find(w, 'shortcut-senders').trigger('click')
    await vi.advanceTimersByTimeAsync(400)
    await w.setProps({ audience: aud(42, 30) })
    await fillMessage(w)
    await find(w, 'broadcast-send').trigger('click')
    expect(w.text()).toContain('Envoyer à 42 personnes (30 en push)')
    await find(w, 'confirm').trigger('click')
    const [title, body, target, push] = w.emitted('send')![0] as [string, string, { type: string; rule: { children: Array<{ field: string }> } }, boolean]
    expect([title, body, push]).toEqual(['Titre', 'Corps', false])
    expect(target.type).toBe('RULE')
    expect(target.rule.children[0]!.field).toBe('created_request')
  })

  it('une règle vide (tous les comptes) exige la phrase de contrôle', async () => {
    const w = mountComposer()
    await vi.advanceTimersByTimeAsync(400)
    await w.setProps({ audience: aud(1200, 900) })
    await fillMessage(w)
    await find(w, 'broadcast-send').trigger('click')
    expect((find(w, 'confirm').element as HTMLButtonElement).disabled).toBe(true)
    await find(w, 'confirmation-input').setValue('DIFFUSER A TOUS')
    await find(w, 'confirm').trigger('click')
    expect(w.emitted('send')).toBeTruthy()
  })

  it('envoi_modeSegment_envoieSegmentId', async () => {
    const w = mountComposer()
    await find(w, 'broadcast-target').setValue('SEGMENT')
    await find(w, 'segment-select').setValue('s1')
    await vi.advanceTimersByTimeAsync(400)
    const last = w.emitted('preview')!.at(-1) as [unknown]
    expect(last[0]).toEqual({ type: 'RULE', segmentId: 's1' })
    await w.setProps({ audience: aud(8, 4) })
    await fillMessage(w)
    await find(w, 'broadcast-send').trigger('click')
    expect(find(w, 'confirmation-input').exists()).toBe(false)
    await find(w, 'confirm').trigger('click')
    expect(w.emitted('send')![0]).toEqual(['Titre', 'Corps', { type: 'RULE', segmentId: 's1' }, false])
  })

  it('un segment à règle vide (tous les comptes) exige la phrase de contrôle', async () => {
    const empty = { ...SEGMENT, id: 's0', name: 'Tous', rule: { op: 'AND', children: [] } }
    const w = mountComposer({ segments: [empty] })
    await find(w, 'broadcast-target').setValue('SEGMENT')
    await find(w, 'segment-select').setValue('s0')
    await vi.advanceTimersByTimeAsync(400)
    await w.setProps({ audience: aud(500, 300) })
    await fillMessage(w)
    await find(w, 'broadcast-send').trigger('click')
    expect(find(w, 'confirmation-input').exists()).toBe(true)
    expect((find(w, 'confirm').element as HTMLButtonElement).disabled).toBe(true)
  })

  it('un segment supprimé de la liste est oublié et l’envoi se bloque', async () => {
    const w = mountComposer()
    await find(w, 'broadcast-target').setValue('SEGMENT')
    await find(w, 'segment-select').setValue('s1')
    await vi.advanceTimersByTimeAsync(400)
    await w.setProps({ audience: aud(8, 4) })
    await fillMessage(w)
    expect(sendButton(w).disabled).toBe(false)
    await w.setProps({ segments: [] })
    expect((find(w, 'segment-select').element as HTMLSelectElement).value).toBe('')
    expect(sendButton(w).disabled).toBe(true)
  })

  it('en mode segment, rien n’est estimé tant qu’aucun segment n’est choisi', async () => {
    const w = mountComposer()
    await vi.advanceTimersByTimeAsync(400)
    const before = w.emitted('preview')!.length
    await find(w, 'broadcast-target').setValue('SEGMENT')
    await vi.advanceTimersByTimeAsync(1000)
    expect(w.emitted('preview')!.length).toBe(before)
    expect(find(w, 'segment-edit-rules').exists()).toBe(false)
  })

  it('« Modifier les règles » copie la règle du segment et repasse en mode règles', async () => {
    const w = mountComposer()
    await find(w, 'broadcast-target').setValue('SEGMENT')
    await find(w, 'segment-select').setValue('s1')
    await find(w, 'segment-edit-rules').trigger('click')
    expect((find(w, 'broadcast-target').element as HTMLSelectElement).value).toBe('RULES')
    expect(w.findAll('[data-test="condition-row"]')).toHaveLength(1)
    expect((find(w, 'group-op').element as HTMLSelectElement).value).toBe('OR')
  })

  it('mode utilisateur : estimation manuelle et envoi USER', async () => {
    const w = mountComposer()
    await find(w, 'broadcast-target').setValue('USER')
    await find(w, 'broadcast-user-search').setValue('3f2b8c1e-4a5d-4e6f-8a9b-0c1d2e3f4a5b')
    await vi.advanceTimersByTimeAsync(1000)
    expect(w.emitted('preview')).toBeUndefined() // jamais d'aperçu automatique en mode utilisateur
    await find(w, 'broadcast-preview').trigger('click')
    const last = w.emitted('preview')!.at(-1) as [unknown]
    expect(last[0]).toEqual({ type: 'USER', userId: '3f2b8c1e-4a5d-4e6f-8a9b-0c1d2e3f4a5b' })
    await w.setProps({ audience: aud(1, 1) })
    await fillMessage(w)
    await find(w, 'broadcast-send').trigger('click')
    await find(w, 'confirm').trigger('click')
    expect(w.emitted('send')![0]).toEqual(['Titre', 'Corps', { type: 'USER', userId: '3f2b8c1e-4a5d-4e6f-8a9b-0c1d2e3f4a5b' }, true])
  })

  it('affiche le nom du destinataire et bloque un compte injoignable', async () => {
    const w = mountComposer({ initialUserId: 'u1' })
    await find(w, 'broadcast-preview').trigger('click')
    await w.setProps({ audience: aud(1, 0), targetUserName: 'Awa D.', targetUserUnreachable: true })
    expect(find(w, 'broadcast-target-user-name').text()).toContain('Awa D.')
    expect(find(w, 'broadcast-user-unreachable').exists()).toBe(true)
    await fillMessage(w)
    expect(sendButton(w).disabled).toBe(true)
  })

  it('la case push est décochée par défaut en diffusion large, le choix de l’admin prime ensuite', async () => {
    const w = mountComposer()
    const box = () => find(w, 'broadcast-push').element as HTMLInputElement
    expect(box().checked).toBe(false)
    await find(w, 'broadcast-target').setValue('USER')
    expect(box().checked).toBe(true)
    await find(w, 'broadcast-target').setValue('RULES')
    expect(box().checked).toBe(false)
    await find(w, 'broadcast-push').setValue(true)
    await find(w, 'broadcast-target').setValue('USER')
    await find(w, 'broadcast-target').setValue('RULES')
    expect(box().checked).toBe(true)
  })

  it('la modale dit « sans sonnerie » quand le push est décoché, et annuler n’émet rien', async () => {
    const w = mountComposer({ audience: aud(87, 10) })
    await fillMessage(w)
    await find(w, 'broadcast-send').trigger('click')
    expect(w.text()).toContain('sans sonnerie')
    await find(w, 'cancel').trigger('click')
    expect(w.emitted('send')).toBeUndefined()
  })

  it('la confirmation sans détail push ne parle pas de push', async () => {
    const w = mountComposer({ audience: { recipientCount: 3 } })
    await find(w, 'shortcut-senders').trigger('click')
    await vi.advanceTimersByTimeAsync(400)
    await w.setProps({ audience: { recipientCount: 3 } })
    await fillMessage(w)
    await find(w, 'broadcast-send').trigger('click')
    expect(w.text()).toContain('Envoyer à 3 personnes.')
    expect(w.text()).not.toContain('en push)')
  })

  it('désactive les commandes pendant l’envoi (busy)', () => {
    const w = mountComposer({ busy: true })
    for (const id of ['broadcast-title', 'broadcast-body', 'broadcast-target', 'broadcast-preview', 'broadcast-send']) {
      expect((find(w, id).element as HTMLInputElement).disabled).toBe(true)
    }
  })

  it('perime l’estimation quand le ciblage change et rebloque l’envoi', async () => {
    const w = mountComposer({ audience: aud(128, 5) })
    await fillMessage(w)
    expect(sendButton(w).disabled).toBe(false)
    await find(w, 'shortcut-senders').trigger('click')
    expect(find(w, 'broadcast-recipient-count').exists()).toBe(false)
    expect(find(w, 'broadcast-stale-estimate').exists()).toBe(true)
    expect(sendButton(w).disabled).toBe(true)
  })

  it('« Voir la liste » ouvre le tiroir des destinataires', async () => {
    svc.recipients = vi.fn().mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 50 })
    const w = mountComposer({ audience: aud(10, 5) })
    await find(w, 'view-recipients').trigger('click')
    await flushPromises()
    expect(find(w, 'recipients-drawer').exists()).toBe(true)
    expect(svc.recipients).toHaveBeenCalledWith(expect.objectContaining({ type: 'RULE' }), 0, 50)
    await find(w, 'close-drawer').trigger('click')
    expect(find(w, 'recipients-drawer').exists()).toBe(false)
  })

  it('« Voir la liste » exige le droit USER_VIEW', () => {
    const w = mountComposer({ audience: aud(10, 5), canViewRecipients: false })
    expect(find(w, 'view-recipients').exists()).toBe(false)
  })

  it('« Voir la liste » est masqué en mode utilisateur', async () => {
    const w = mountComposer({ initialUserId: 'u1' })
    await find(w, 'broadcast-preview').trigger('click')
    await w.setProps({ audience: aud(1, 1) })
    expect(find(w, 'view-recipients').exists()).toBe(false)
  })

  it('le focus revient sur « Voir la liste » à la fermeture du tiroir', async () => {
    svc.recipients = vi.fn().mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 50 })
    const w = mount(BroadcastComposer, {
      attachTo: document.body,
      props: { audience: aud(10, 5), busy: false, previewing: false, fields: FIELDS, segments: [], canViewRecipients: true },
    })
    await find(w, 'view-recipients').trigger('click')
    await flushPromises()
    await find(w, 'close-drawer').trigger('click')
    await flushPromises()
    expect(document.activeElement).toBe(find(w, 'view-recipients').element)
    w.unmount()
  })

  it('« Voir la liste » est masqué sans destinataires', () => {
    expect(find(mountComposer({ audience: aud(0, 0) }), 'view-recipients').exists()).toBe(false)
  })

  describe('segments', () => {
    it('« Enregistrer comme segment » demande un nom et une description facultative', async () => {
      const saveSegmentFn = vi.fn().mockResolvedValue(null)
      const w = mountComposer({ saveSegmentFn })
      await find(w, 'shortcut-senders').trigger('click')
      await find(w, 'save-segment-open').trigger('click')
      await find(w, 'segment-name').setValue(' Expéditeurs ')
      await find(w, 'segment-description').setValue('Pour les rappels')
      await find(w, 'segment-save').trigger('click')
      await flushPromises()
      expect(saveSegmentFn).toHaveBeenCalledWith('Expéditeurs', 'Pour les rappels', expect.objectContaining({ kind: 'group' }))
      expect(find(w, 'segment-name').exists()).toBe(false)
    })

    it('description vide : null ; nom vide : bouton désactivé', async () => {
      const saveSegmentFn = vi.fn().mockResolvedValue(null)
      const w = mountComposer({ saveSegmentFn })
      await find(w, 'save-segment-open').trigger('click')
      expect((find(w, 'segment-save').element as HTMLButtonElement).disabled).toBe(true)
      await find(w, 'segment-name').setValue('Tous')
      await find(w, 'segment-save').trigger('click')
      await flushPromises()
      expect(saveSegmentFn).toHaveBeenCalledWith('Tous', null, expect.anything())
    })

    it('enregistrerSegment_409_afficheNomPris', async () => {
      const saveSegmentFn = vi.fn().mockResolvedValue('Ce nom est déjà pris')
      const w = mountComposer({ saveSegmentFn })
      await find(w, 'save-segment-open').trigger('click')
      await find(w, 'segment-name').setValue('Pro')
      await find(w, 'segment-save').trigger('click')
      await flushPromises()
      expect(find(w, 'segment-save-error').text()).toBe('Ce nom est déjà pris')
      expect(find(w, 'segment-name').exists()).toBe(true)
    })

    it('annuler referme le formulaire', async () => {
      const w = mountComposer({ saveSegmentFn: vi.fn() })
      await find(w, 'save-segment-open').trigger('click')
      await find(w, 'segment-cancel').trigger('click')
      expect(find(w, 'segment-name').exists()).toBe(false)
    })

    it('le bouton d’enregistrement est masqué sans fonction et désactivé si la règle est incomplète', async () => {
      expect(find(mountComposer(), 'save-segment-open').exists()).toBe(false)
      const w = mountComposer({ saveSegmentFn: vi.fn() })
      await find(w, 'add-condition').trigger('click')
      await find(w, 'pick-field-is_pro').trigger('click')
      expect((find(w, 'save-segment-open').element as HTMLButtonElement).disabled).toBe(true)
    })

    it('modifier un segment : charge la règle, met à jour, puis signale la fin', async () => {
      const updateSegmentFn = vi.fn().mockResolvedValue(null)
      const w = mountComposer({ editSegment: SEGMENT, updateSegmentFn, saveSegmentFn: vi.fn() })
      expect(find(w, 'editing-segment').text()).toContain('Comptes Pro')
      expect(w.findAll('[data-test="condition-row"]')).toHaveLength(1)
      expect(find(w, 'save-segment-open').exists()).toBe(false)
      await find(w, 'segment-update').trigger('click')
      await flushPromises()
      expect(updateSegmentFn).toHaveBeenCalledWith('s1', 'Comptes Pro', null, expect.objectContaining({ kind: 'group', op: 'OR' }))
      expect(w.emitted('edit-done')).toHaveLength(1)
    })

    it('une erreur de mise à jour reste affichée et on peut quitter la modification', async () => {
      const updateSegmentFn = vi.fn().mockResolvedValue('Règle invalide')
      const w = mountComposer({ editSegment: SEGMENT, updateSegmentFn })
      await find(w, 'segment-update').trigger('click')
      await flushPromises()
      expect(find(w, 'segment-save-error').text()).toBe('Règle invalide')
      expect(w.emitted('edit-done')).toBeUndefined()
      await find(w, 'segment-edit-quit').trigger('click')
      expect(w.emitted('edit-done')).toHaveLength(1)
    })
  })
})
