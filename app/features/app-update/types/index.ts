/** GET/PUT /admin/app-update : builds pilotés par Firebase Remote Config. */
export interface AppUpdateState {
  /** Build à partir duquel le bandeau « Nouvelle version disponible » ne s'affiche plus. 0 = jamais de bandeau. */
  recommendedBuild: number
  /** Verrou de version minimale : lecture seule dans l'admin. */
  minSupportedBuild: number
}

export interface AppUpdateWrite {
  /** Entier de 0 à 100000. */
  recommendedBuild: number
}
