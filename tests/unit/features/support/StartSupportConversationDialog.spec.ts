import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { seedAuth } from '~/tests/helpers/auth'

const startMock = vi.fn()
vi.mock('@/features/support/services/supportService', () => ({
  supportService: { startTicket: (...a: unknown[]) => startMock(...a) },
}))
const navigateToMock = vi.fn()
vi.stubGlobal('navigateTo', navigateToMock)

import StartSupportConversationDialog from '@/features/support/components/StartSupportConversationDialog.vue'

const UploaderStub = {
  name: 'SupportAttachmentUploader',
  emits: ['change', 'busy'],
  template: '<div data-test="uploader-stub"><button data-test="uploader-ready" @click="$emit(\'change\', [\'k1\'])" /><button data-test="uploader-busy" @click="$emit(\'busy\', true)" /></div>',
}
const PickerStub = {
  name: 'BroadcastUserPicker',
  props: ['modelValue', 'canSearch', 'disabled'],
  emits: ['update:modelValue'],
  template: '<div data-test="picker-stub" :data-can-search="String(canSearch)"><button data-test="picker-choose" @click="$emit(\'update:modelValue\', \'u7\')" /></div>',
}

const recipient = { id: 'u1', name: 'Awa Diallo' }
const httpError = (status: number, data?: Record<string, unknown>) =>
  Object.assign(new Error(`${status}`), { statusCode: status, data })

function mountDialog(props: Record<string, unknown> = {}) {
  return mount(StartSupportConversationDialog, {
    props: { open: true, recipient, ...props },
    global: { stubs: { SupportAttachmentUploader: UploaderStub, BroadcastUserPicker: PickerStub } },
  })
}

async function fill(w: ReturnType<typeof mountDialog>, subject = 'Votre colis', message = 'Bonjour Awa') {
  await w.find('[data-test="start-subject"]').setValue(subject)
  await w.find('[data-test="start-message"]').setValue(message)
}

describe('StartSupportConversationDialog', () => {
  beforeEach(() => {
    seedAuth('ADMIN')
    startMock.mockReset()
    navigateToMock.mockReset()
  })

  it('fermée : rien n’est rendu', () => {
    const w = mountDialog({ open: false })
    expect(w.find('[data-test="start-dialog"]').exists()).toBe(false)
  })

  it('affiche le destinataire, la catégorie « Autre » par défaut et le rappel', () => {
    const w = mountDialog()
    expect(w.find('[data-test="start-recipient"]').text()).toContain('Awa Diallo')
    const select = w.find('[data-test="start-category"]').element as HTMLSelectElement
    expect(select.value).toBe('OTHER')
    expect(select.options).toHaveLength(7)
    expect(w.find('[data-test="start-category"]').text()).toContain('Paiement')
    expect(w.find('[data-test="start-notice"]').text()).toContain('onglet Messages')
    expect(w.text()).not.toContain('—')
    expect(w.find('[data-test="picker-stub"]').exists()).toBe(false)
  })

  it('Envoyer reste désactivé tant que sujet et message sont vides', async () => {
    const w = mountDialog()
    const submit = w.find('[data-test="start-submit"]')
    expect(submit.attributes('disabled')).toBeDefined()
    await w.find('[data-test="start-subject"]').setValue('Sujet')
    expect(submit.attributes('disabled')).toBeDefined()
    await w.find('[data-test="start-message"]').setValue('   ')
    expect(submit.attributes('disabled')).toBeDefined()
    await w.find('[data-test="start-message"]').setValue('Bonjour')
    expect(submit.attributes('disabled')).toBeUndefined()
  })

  it('compteurs et dépassement des bornes', async () => {
    const w = mountDialog()
    await fill(w, 'x'.repeat(201), 'y'.repeat(4001))
    expect(w.find('[data-test="start-subject-count"]').text()).toBe('201 / 200')
    expect(w.find('[data-test="start-message-count"]').text()).toBe('4001 / 4000')
    expect(w.find('[data-test="start-subject-count"]').classes()).toContain('text-danger')
    expect(w.find('[data-test="start-submit"]').attributes('disabled')).toBeDefined()
  })

  it('envoie la conversation puis ouvre le fil', async () => {
    startMock.mockResolvedValue({ id: 't9' })
    const w = mountDialog()
    await w.find('[data-test="start-category"]').setValue('PAYMENT')
    await fill(w, '  Votre paiement  ', '  Bonjour Awa  ')
    await w.find('[data-test="uploader-ready"]').trigger('click')
    await w.find('[data-test="start-submit"]').trigger('click')
    await flushPromises()
    expect(startMock).toHaveBeenCalledWith({
      userId: 'u1', category: 'PAYMENT', subject: 'Votre paiement', message: 'Bonjour Awa', attachmentKeys: ['k1'],
    })
    expect(w.emitted('sent')![0]).toEqual([{ id: 't9' }])
    expect(navigateToMock).toHaveBeenCalledWith('/support?ticket=t9')
  })

  it('image seule : message facultatif, envoyé à null', async () => {
    startMock.mockResolvedValue({ id: 't4' })
    const w = mountDialog()
    await w.find('[data-test="start-subject"]').setValue('Photo du colis')
    expect(w.find('[data-test="start-submit"]').attributes('disabled')).toBeDefined()
    expect(w.find('[data-test="start-message-hint"]').text()).toContain('au moins une image')
    await w.find('[data-test="uploader-ready"]').trigger('click')
    expect(w.find('[data-test="start-submit"]').attributes('disabled')).toBeUndefined()
    await w.find('[data-test="start-submit"]').trigger('click')
    await flushPromises()
    expect(startMock.mock.calls[0]![0]).toMatchObject({ message: null, attachmentKeys: ['k1'] })
    expect(navigateToMock).toHaveBeenCalledWith('/support?ticket=t4')
  })

  it('422 « ni texte ni pièce jointe » : message sous le champ, indication masquée', async () => {
    startMock.mockRejectedValue(httpError(422, { violations: { message: 'Ecrivez un message ou joignez une image' } }))
    const w = mountDialog()
    await fill(w)
    await w.find('[data-test="start-submit"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="start-field-error-message"]').text()).toBe('Ecrivez un message ou joignez une image')
    expect(w.find('[data-test="start-message-hint"]').exists()).toBe(false)
  })

  it('422 sur les pièces jointes : message sous les images', async () => {
    startMock.mockRejectedValue(httpError(422, { violations: { attachmentKeys: 'Image inconnue' } }))
    const w = mountDialog()
    await fill(w)
    await w.find('[data-test="start-submit"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="start-field-error-attachmentKeys"]').text()).toBe('Image inconnue')
  })

  it('pendant l’envoi : bouton « Envoi… » désactivé', async () => {
    let resolve!: (_v: unknown) => void
    startMock.mockReturnValue(new Promise((r) => { resolve = r }))
    const w = mountDialog()
    await fill(w)
    await w.find('[data-test="start-submit"]').trigger('click')
    const submit = w.find('[data-test="start-submit"]')
    expect(submit.text()).toBe('Envoi…')
    expect(submit.attributes('disabled')).toBeDefined()
    resolve({ id: 't1' })
    await flushPromises()
  })

  it('pièce jointe en cours d’envoi : Envoyer désactivé', async () => {
    const w = mountDialog()
    await fill(w)
    await w.find('[data-test="uploader-busy"]').trigger('click')
    expect(w.find('[data-test="start-submit"]').attributes('disabled')).toBeDefined()
  })

  it('403 : erreur affichée dans la fenêtre, qui reste ouverte', async () => {
    startMock.mockRejectedValue(httpError(403))
    const w = mountDialog()
    await fill(w)
    await w.find('[data-test="start-submit"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="start-error"]').text()).toBe('Vous n’avez pas la permission d’écrire aux utilisateurs.')
    expect(navigateToMock).not.toHaveBeenCalled()
    expect(w.emitted('close')).toBeUndefined()
  })

  it('404 user-not-found : message du back', async () => {
    startMock.mockRejectedValue(httpError(404, { code: 'user-not-found', detail: 'Utilisateur introuvable.' }))
    const w = mountDialog()
    await fill(w)
    await w.find('[data-test="start-submit"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="start-error"]').text()).toBe('Utilisateur introuvable.')
  })

  it('422 : erreurs rattachées aux champs, saisie conservée', async () => {
    startMock.mockRejectedValue(httpError(422, { violations: { subject: 'Sujet refusé', message: 'Message refusé' } }))
    const w = mountDialog()
    await fill(w)
    await w.find('[data-test="start-submit"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="start-field-error-subject"]').text()).toBe('Sujet refusé')
    expect(w.find('[data-test="start-field-error-message"]').text()).toBe('Message refusé')
    expect((w.find('[data-test="start-subject"]').element as HTMLInputElement).value).toBe('Votre colis')
  })

  it('ancien back : fonction indisponible, Envoyer désactivé', async () => {
    startMock.mockRejectedValue(httpError(405))
    const w = mountDialog()
    await fill(w)
    await w.find('[data-test="start-submit"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="start-error"]').text()).toBe('Cette fonction n’est pas encore disponible sur le serveur.')
    expect(w.find('[data-test="start-submit"]').attributes('disabled')).toBeDefined()
  })

  it('Annuler et Échap ferment la fenêtre', async () => {
    const w = mountDialog()
    await w.find('[data-test="start-cancel"]').trigger('click')
    await w.find('[data-test="start-dialog"]').trigger('keydown', { key: 'Escape' })
    expect(w.emitted('close')).toHaveLength(2)
  })

  it('Échap ignoré pendant l’envoi', async () => {
    startMock.mockReturnValue(new Promise(() => {}))
    const w = mountDialog()
    await fill(w)
    await w.find('[data-test="start-submit"]').trigger('click')
    await w.find('[data-test="start-dialog"]').trigger('keydown', { key: 'Escape' })
    expect(w.emitted('close')).toBeUndefined()
  })

  it('sans destinataire imposé : sélecteur d’utilisateur, envoi vers le compte choisi', async () => {
    startMock.mockResolvedValue({ id: 't3' })
    const w = mountDialog({ recipient: null })
    expect(w.find('[data-test="start-recipient"]').exists()).toBe(false)
    expect(w.find('[data-test="picker-stub"]').attributes('data-can-search')).toBe('true')
    await fill(w)
    expect(w.find('[data-test="start-submit"]').attributes('disabled')).toBeDefined()
    await w.find('[data-test="picker-choose"]').trigger('click')
    await w.find('[data-test="start-submit"]').trigger('click')
    await flushPromises()
    expect(startMock.mock.calls[0]![0].userId).toBe('u7')
    expect(navigateToMock).toHaveBeenCalledWith('/support?ticket=t3')
  })

  it('sans droit USER_VIEW : sélecteur limité à l’identifiant', () => {
    seedAuth('ADMIN', { USER_VIEW: false })
    const w = mountDialog({ recipient: null })
    expect(w.find('[data-test="picker-stub"]').attributes('data-can-search')).toBe('false')
  })

  it('réouverture : formulaire remis à zéro', async () => {
    startMock.mockRejectedValue(httpError(403))
    const w = mountDialog()
    await fill(w)
    await w.find('[data-test="start-submit"]').trigger('click')
    await flushPromises()
    await w.setProps({ open: false })
    await w.setProps({ open: true })
    expect((w.find('[data-test="start-subject"]').element as HTMLInputElement).value).toBe('')
    expect(w.find('[data-test="start-error"]').exists()).toBe(false)
  })
})
