import { HOME_ENTRY, resolveActiveEntry, resolveActiveGroup } from './navConfig'

export interface Crumb {
  label: string
  /** Absent : maillon non cliquable (le domaine n'a pas de page propre, ou c'est la page courante). */
  to?: string
}

/**
 * Fil d'Ariane de la page affichée : Accueil › Domaine › Page (› détail).
 * Vide sur l'accueil et sur les pages hors menu (login, mot de passe) : rien à remonter.
 * `detailLabel` (ex. le nom de l'utilisateur) prend la place du titre de page sur une page de détail.
 */
export function buildCrumbs(path: string | undefined, pageTitle?: string, detailLabel?: string | null): Crumb[] {
  const entry = resolveActiveEntry(path)
  const group = resolveActiveGroup(path)
  if (!entry || !group || entry.to === HOME_ENTRY.to) return []
  const deeper = path !== entry.to
  const crumbs: Crumb[] = [
    { label: 'Accueil', to: HOME_ENTRY.to },
    { label: group.label },
    deeper ? { label: entry.label, to: entry.to } : { label: entry.label },
  ]
  const last = detailLabel || pageTitle
  if (deeper && last) crumbs.push({ label: last })
  return crumbs
}

/**
 * Cible du bouton « Retour » : la liste dont la page est un détail. Absent sur une page de premier
 * niveau, où le menu suffit, et hors menu.
 */
export function backTarget(path: string | undefined): string | null {
  const entry = resolveActiveEntry(path)
  if (!entry || entry.to === HOME_ENTRY.to) return null
  return path === entry.to ? null : entry.to
}

/**
 * Le navigateur sait-il revenir à une page de l'admin ? `history.state.back` vaut null sur une
 * première visite (lien partagé, onglet rouvert) : router.back() sortirait alors de l'app.
 */
export function canGoBackInApp(state: unknown, currentPath: string | undefined): boolean {
  const back = (state as { back?: unknown } | null)?.back
  return typeof back === 'string' && back.startsWith('/') && back !== currentPath
}
