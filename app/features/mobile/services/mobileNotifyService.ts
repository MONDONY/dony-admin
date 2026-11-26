import { useApi } from '@/composables/useApi'
import { isUuid } from '@/lib/safeInput'

/** Réponse du back (202) : seul le compteur de destinataires joignables nous intéresse. */
export interface NotifyResult { recipientCount?: number }

/**
 * Notification à UNE personne, depuis le mobile. Volontairement distinct du service de diffusion du poste
 * ordinateur : la cible est toujours un seul utilisateur (`type: 'USER'`), aucune audience de groupe,
 * aucun export de destinataires ni aperçu d'audience n'est joignable depuis les écrans mobiles.
 * Même envoi que sur l'ordinateur (`POST /admin/notifications/broadcast`, journalisé de la même façon par le back) ;
 * `push: true` comme le défaut du poste ordinateur pour un message adressé à une personne.
 */
export const mobileNotifyService = {
  sendToOne(input: { userId: string; title: string; body: string }): Promise<NotifyResult> {
    const title = input.title.trim()
    const body = input.body.trim()
    // Défense en profondeur : même si l'écran est contourné, rien ne part sans UUID, titre et message.
    if (!isUuid(input.userId)) return Promise.reject(new Error('Identifiant du destinataire invalide'))
    if (!title || !body) return Promise.reject(new Error('Titre et message obligatoires'))
    return useApi()<NotifyResult>('/admin/notifications/broadcast', {
      method: 'POST',
      body: { title, body, target: { type: 'USER', userId: input.userId }, push: true },
    })
  },
}
