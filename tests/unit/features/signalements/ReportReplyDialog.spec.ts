import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { seedAuth } from '~/tests/helpers/auth'

const replyMock = vi.fn()
vi.mock('@/features/signalements/services/reportsService', () => ({
  reportsService: { reply: (...a: unknown[]) => replyMock(...a) },
}))

import ReportReplyDialog from '@/features/signalements/components/ReportReplyDialog.vue'
import type { AdminReport } from '@/features/signalements/types/index'

const NuxtLink = { name: 'NuxtLink', props: ['to'], template: '<a :href="to"><slot /></a>' }
const UploaderStub = {
  name: 'SupportAttachmentUploader',
  emits: ['change', 'busy'],
  template: '<div data-test="uploader-stub"><button data-test="uploader-ready" @click="$emit(\'change\', [\'k1\'])" /><button data-test="uploader-busy" @click="$emit(\'busy\', true)" /></div>',
}

const bug: AdminReport = {
  id: 'r1', targetType: 'APP', targetId: '', targetLabel: null, reason: 'SCREEN_BUG',
  description: 'Le bouton Payer ne répond pas', reporterName: 'Awa Diallo', status: 'OPEN', actionTaken: null,
  resolutionNote: null, resolvedAt: null, createdAt: '2026-09-20T10:00:00Z',
  photoUrls: ['https://cdn.test/a.png', 'https://cdn.test/b.png'], screenRoute: '/wallet', canReply: true,
}
const httpError = (status: number, data?: Record<string, unknown>) =>
  Object.assign(new Error(`${status}`), { statusCode: status, data })
const okResponse = { ticketId: 't9', created: true, ticket: { id: 't9', userDisplayName: 'Awa Diallo' } }

function mountDialog(report: AdminReport | null = bug) {
  return mount(ReportReplyDialog, {
    props: { report },
    global: { stubs: { SupportAttachmentUploader: UploaderStub, NuxtLink } },
  })
}

describe('ReportReplyDialog', () => {
  beforeEach(() => {
    seedAuth('ADMIN')
    replyMock.mockReset()
  })

  it('fermée sans signalement', () => {
    expect(mountDialog(null).find('[data-test="reply-dialog"]').exists()).toBe(false)
  })

  it('rappelle le signalement en lecture seule : message, écran, date, captures, signalant', () => {
    const w = mountDialog()
    const recap = w.find('[data-test="reply-recap"]')
    expect(recap.text()).toContain('Le bouton Payer ne répond pas')
    expect(recap.text()).toContain('/wallet')
    expect(recap.text()).toContain('Awa Diallo')
    expect(recap.text()).toContain(new Date(bug.createdAt).toLocaleString('fr-FR'))
    expect(recap.findAll('[data-test^="reply-recap-photo-"]')).toHaveLength(2)
    expect(recap.find('[data-test="reply-recap-photo-0"]').attributes('href')).toBe('https://cdn.test/a.png')
    expect(recap.find('textarea').exists()).toBe(false)
    expect(w.find('[data-test="reply-title"]').text()).toBe('Répondre au signalant')
    expect(w.find('[data-test="reply-notice"]').text()).toBe(
      'Le signalant recevra une notification. Le signalement reste ouvert : marquez-le traité quand le bug est corrigé.')
    expect(w.text()).not.toContain('—')
  })

  it('rappel sans description, sans écran ni captures', () => {
    const w = mountDialog({ ...bug, description: null, screenRoute: null, photoUrls: [], reporterName: null })
    const recap = w.find('[data-test="reply-recap"]')
    expect(recap.text()).toContain('Aucun message')
    expect(recap.text()).toContain('Inconnu')
    expect(recap.find('[data-test="reply-recap-screen"]').exists()).toBe(false)
    expect(recap.find('[data-test^="reply-recap-photo-"]').exists()).toBe(false)
  })

  it('Envoyer désactivé sans texte, puis actif ; compteur et dépassement', async () => {
    const w = mountDialog()
    const submit = w.find('[data-test="reply-submit"]')
    expect(submit.attributes('disabled')).toBeDefined()
    await w.find('[data-test="reply-message"]').setValue('   ')
    expect(submit.attributes('disabled')).toBeDefined()
    await w.find('[data-test="reply-message"]').setValue('Merci, corrigé')
    expect(submit.attributes('disabled')).toBeUndefined()
    expect(w.find('[data-test="reply-count"]').text()).toBe('14 / 4000')
    await w.find('[data-test="reply-message"]').setValue('x'.repeat(4001))
    expect(w.find('[data-test="reply-count"]').classes()).toContain('text-danger')
    expect(submit.attributes('disabled')).toBeDefined()
  })

  it('une image seule ne suffit pas : le texte est obligatoire', async () => {
    const w = mountDialog()
    await w.find('[data-test="uploader-ready"]').trigger('click')
    expect(w.find('[data-test="reply-submit"]').attributes('disabled')).toBeDefined()
  })

  it('pendant un envoi d’image, Envoyer reste désactivé', async () => {
    const w = mountDialog()
    await w.find('[data-test="reply-message"]').setValue('Bonjour')
    await w.find('[data-test="uploader-busy"]').trigger('click')
    expect(w.find('[data-test="reply-submit"]').attributes('disabled')).toBeDefined()
  })

  it('envoie texte nettoyé et pièces jointes, affiche « Envoi… », puis émet sent', async () => {
    let resolveIt: (_v: unknown) => void = () => {}
    replyMock.mockReturnValue(new Promise((r) => { resolveIt = r }))
    const w = mountDialog()
    await w.find('[data-test="reply-message"]').setValue('  Merci Awa  ')
    await w.find('[data-test="uploader-ready"]').trigger('click')
    await w.find('[data-test="reply-submit"]').trigger('click')
    expect(replyMock).toHaveBeenCalledWith('r1', { message: 'Merci Awa', attachmentKeys: ['k1'] })
    expect(w.find('[data-test="reply-submit"]').text()).toBe('Envoi…')
    expect(w.find('[data-test="reply-cancel"]').attributes('disabled')).toBeDefined()
    resolveIt(okResponse)
    await flushPromises()
    expect(w.emitted('sent')?.[0]).toEqual([okResponse])
  })

  it('sans pièce jointe, attachmentKeys est une liste vide', async () => {
    replyMock.mockResolvedValue(okResponse)
    const w = mountDialog()
    await w.find('[data-test="reply-message"]').setValue('Merci')
    await w.find('[data-test="reply-submit"]').trigger('click')
    await flushPromises()
    expect(replyMock.mock.calls[0][1]).toEqual({ message: 'Merci', attachmentKeys: [] })
  })

  it.each([
    [403, undefined, 'permission'],
    [404, { code: 'report-not-found' }, 'introuvable'],
    [422, { code: 'report-not-app-bug' }, 'rapports de bug'],
  ])('erreur %i affichée dans la fenêtre, qui reste ouverte', async (status, data, text) => {
    replyMock.mockRejectedValue(httpError(status, data))
    const w = mountDialog()
    await w.find('[data-test="reply-message"]').setValue('Merci')
    await w.find('[data-test="reply-submit"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="reply-error"]').text()).toContain(text)
    expect(w.emitted('sent')).toBeUndefined()
    expect(w.find('[data-test="reply-dialog"]').exists()).toBe(true)
    expect((w.find('[data-test="reply-message"]').element as HTMLTextAreaElement).value).toBe('Merci')
  })

  it('422 de validation : erreurs sous le champ et sous les images', async () => {
    replyMock.mockRejectedValue(httpError(422, { violations: { message: 'Trop long', attachmentKeys: 'Image refusée' } }))
    const w = mountDialog()
    await w.find('[data-test="reply-message"]').setValue('Merci')
    await w.find('[data-test="reply-submit"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="reply-field-error-message"]').text()).toBe('Trop long')
    expect(w.find('[data-test="reply-field-error-attachmentKeys"]').text()).toBe('Image refusée')
  })

  it('ancien back : message d’indisponibilité et Envoyer désactivé', async () => {
    replyMock.mockRejectedValue(httpError(404))
    const w = mountDialog()
    await w.find('[data-test="reply-message"]').setValue('Merci')
    await w.find('[data-test="reply-submit"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="reply-error"]').text()).toBe('Cette fonction n’est pas encore disponible sur le serveur.')
    expect(w.find('[data-test="reply-submit"]').attributes('disabled')).toBeDefined()
  })

  it('conversation déjà ouverte : « Répondre à nouveau » et lien vers le fil', () => {
    const w = mountDialog({ ...bug, supportTicketId: 't9' })
    expect(w.find('[data-test="reply-title"]').text()).toBe('Répondre à nouveau')
    const existing = w.find('[data-test="reply-existing"]')
    expect(existing.text()).toContain('conversation déjà ouverte')
    expect(existing.find('a').attributes('href')).toBe('/support?ticket=t9')
  })

  it('Annuler, Échap et clic hors fenêtre ferment ; un autre signalement repart de zéro', async () => {
    const w = mountDialog()
    await w.find('[data-test="reply-message"]').setValue('Brouillon')
    await w.find('[data-test="reply-cancel"]').trigger('click')
    expect(w.emitted('close')).toHaveLength(1)
    await w.find('[data-test="reply-dialog"]').trigger('keydown', { key: 'Escape' })
    expect(w.emitted('close')).toHaveLength(2)
    await w.find('[data-test="reply-dialog"]').trigger('keydown', { key: 'a' })
    expect(w.emitted('close')).toHaveLength(2)
    await w.find('[data-test="reply-overlay"]').trigger('click')
    expect(w.emitted('close')).toHaveLength(3)
    await w.setProps({ report: { ...bug, id: 'r2' } })
    expect((w.find('[data-test="reply-message"]').element as HTMLTextAreaElement).value).toBe('')
  })

  it('pendant l’envoi, fermer est ignoré', async () => {
    replyMock.mockReturnValue(new Promise(() => {}))
    const w = mountDialog()
    await w.find('[data-test="reply-message"]').setValue('Merci')
    await w.find('[data-test="reply-submit"]').trigger('click')
    await w.find('[data-test="reply-dialog"]').trigger('keydown', { key: 'Escape' })
    expect(w.emitted('close')).toBeUndefined()
  })
})
