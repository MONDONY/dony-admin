import { useApi } from '@/composables/useApi'

/**
 * Notification à UNE personne, depuis le mobile. Volontairement distinct du service de diffusion du poste
 * ordinateur : la cible est toujours un seul utilisateur (`type: 'USER'`), aucune audience de groupe,
 * aucun export de destinataires ni aperçu d'audience n'est joignable depuis les écrans mobiles.
 * Même envoi que sur l'ordinateur (`POST /admin/notifications/broadcast`, journalisé de la même façon par le back) ;
 * `push: true` comme le défaut du poste ordinateur pour un message adressé à une personne.
 */
export const mobileNotifyService = {
  sendToOne(input: { userId: string; title: string; body: string }): Promise<unknown> {
    return useApi()<unknown>('/admin/notifications/broadcast', {
      method: 'POST',
      body: { title: input.title, body: input.body, target: { type: 'USER', userId: input.userId }, push: true },
    })
  },
}
