/**
 * Vue d'une liste finance (onglets soulignés avec nombres) : `FinanceViewTabs` les affiche, chaque
 * liste (mobile money, puis soldes) déclare les siennes.
 */
export interface FinanceViewDef<Id extends string = string> {
  id: Id
  label: string
  /** Clé du nombre affiché sur l'onglet dans `counts`. */
  countKey: string
  /** Vue qui appelle à agir : rouge quand son compteur d'alerte est > 0, et son 0 reste visible. */
  alert?: boolean
  /** Clé du compteur qui décide du rouge si différente de `countKey` (ex. échecs : nombre `failed`, alerte sur `attention`). */
  alertKey?: string
}
