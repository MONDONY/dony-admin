/**
 * Miroir de `com.yadony.api.matching.AnnouncementRemovalReason`.
 *
 * ⚠️ Les libellés ci-dessous sont ceux de l'INTERFACE d'administration. Le texte réellement
 * envoyé au voyageur est produit par le backend (`publicLabel()`) : il ne dépend pas de ce
 * fichier, et une divergence de formulation ici ne peut donc pas faire fuiter d'information.
 * Seules les **valeurs** doivent correspondre — une valeur inconnue est rejetée en 422.
 */
export const REMOVAL_REASONS = [
  { value: 'PROHIBITED_ITEM', label: 'Objet interdit au transport' },
  { value: 'SUSPECTED_FRAUD', label: 'Soupçon de fraude' },
  { value: 'INAPPROPRIATE_CONTENT', label: 'Contenu inapproprié' },
  { value: 'MISLEADING_INFO', label: 'Informations trompeuses ou inexactes' },
  { value: 'DUPLICATE', label: 'Annonce en double' },
  { value: 'OTHER', label: 'Non conforme aux conditions d’utilisation' },
] as const

export type AnnouncementRemovalReason = (typeof REMOVAL_REASONS)[number]['value']

/**
 * Même catalogue pour le retrait d'une demande d'envoi : le back réutilise les mêmes valeurs
 * (une valeur inconnue y est rejetée en 422). Seul le libellé du doublon change, pour parler
 * de demande et non d'annonce dans l'interface.
 */
export const PACKAGE_REQUEST_REMOVAL_REASONS: readonly { value: AnnouncementRemovalReason; label: string }[] =
  REMOVAL_REASONS.map((r) => (r.value === 'DUPLICATE' ? { ...r, label: 'Demande en double' } : r))
