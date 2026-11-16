/** Bouton vers une page de la console ; `path` peut porter une requête (`/colis?view=ACTIVE`). */
export interface HelpRoute {
  path: string
  label: string
}

export interface HelpCategory {
  id: string
  label: string
}

export interface HelpArticleSummary {
  id: string
  title: string
  category: string
  summary: string
  permission: string | null
  /** Faux quand la page décrite demande une permission que l'admin n'a pas : la fiche reste lisible. */
  accessible: boolean
  /** Seulement les pages que l'admin peut ouvrir. */
  routes: HelpRoute[]
}

export interface HelpContents {
  categories: HelpCategory[]
  articles: HelpArticleSummary[]
  assistantEnabled: boolean
}

export interface HelpArticle extends HelpArticleSummary {
  categoryLabel: string
  /** Markdown restreint, rendu par HelpMarkdown. */
  body: string
  related: HelpArticleSummary[]
}

export interface HelpSearchResult {
  id: string
  title: string
  category: string
  summary: string
  snippet: string
  accessible: boolean
}

export interface HelpSearchResponse {
  query: string
  results: HelpSearchResult[]
}

export interface HelpSource {
  id: string
  title: string
}

export interface HelpAskResponse {
  answer: string
  answered: boolean
  actions: HelpRoute[]
  sources: HelpSource[]
  provider: string
  remaining: number
}

export interface HelpTurn {
  role: 'user' | 'assistant'
  text: string
}

export const HELP_UNAVAILABLE = 'Le centre d’aide n’est pas encore disponible sur ce serveur.'
