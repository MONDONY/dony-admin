import { Activity, Compass, MessagesSquare, SlidersHorizontal, UsersRound, Wallet } from 'lucide-vue-next'
import type { Component } from 'vue'

/** Icône de chaque rubrique : la même que le domaine correspondant du menu. */
const ICONS: Record<string, Component> = {
  'premiers-pas': Compass,
  comptes: UsersRound,
  argent: Wallet,
  activite: Activity,
  support: MessagesSquare,
  systeme: SlidersHorizontal,
}

export function categoryIcon(id: string): Component {
  return ICONS[id] ?? Compass
}

/** Lien vers une fiche du centre d'aide. */
export const articleRoute = (id: string) => `/aide/${encodeURIComponent(id)}`

/** Lien vers la recherche de la doc, pré-remplie. */
export const searchRoute = (q: string) => ({ path: '/aide', query: { q } })
