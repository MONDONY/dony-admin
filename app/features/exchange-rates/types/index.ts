/**
 * Taux de change d'une devise, tel que servi par `GET /admin/exchange-rates`.
 *
 * `unitsPerEur` est le nombre d'unités de `currency` pour un euro (ex. `655.957` pour XOF).
 * `updatedBy` est l'UUID de l'admin ayant écrit le dernier changement (pas d'email résolu
 * côté back pour cet endpoint, contrairement à `PlatformSetting.updatedByEmail`) — `null`
 * tant que le taux n'a jamais été modifié depuis le seed de la migration V226.
 */
export interface ExchangeRate {
  currency: string
  unitsPerEur: number
  updatedAt: string | null
  updatedBy: string | null
}
