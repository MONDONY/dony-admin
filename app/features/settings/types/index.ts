export type PlatformSettingType = 'INT' | 'DECIMAL' | 'BOOLEAN'

/**
 * Réglage plateforme, forme générique clé/valeur : le back sérialise chaque valeur en
 * `string` quel que soit son type réel (`type` sert d'indice d'affichage/validation côté
 * front, pas de coercition automatique).
 *
 * ⚠️ `urgency_threshold_days` (l'une des quatre clés actuelles) est exprimé en **jours**,
 * pas en heures — piège documenté de ce lot, à ne pas réintroduire côté affichage (T15).
 *
 * `updatedAt`/`updatedByEmail` sont `null` tant qu'aucun administrateur n'a modifié le
 * réglage depuis son seed initial.
 */
export interface PlatformSetting {
  key: string
  value: string
  type: PlatformSettingType
  updatedAt: string | null
  updatedByEmail: string | null
}
