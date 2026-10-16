export interface AdminProviderStats {
  requestsToday: number
  successesToday: number
  lastStatus: number | null
  lastError: string | null
  cooldownUntil: string | null
}

export interface AdminProvider {
  id: string
  name: string
  slug: string
  baseUrl: string
  model: string
  apiKeyLast4: string
  supportsJsonMode: boolean
  dailyRequestLimit: number | null
  priority: number
  enabled: boolean
  stats: AdminProviderStats
}

export interface ProviderPayload {
  name: string
  baseUrl: string
  model: string
  apiKey?: string
  supportsJsonMode: boolean
  dailyRequestLimit: number | null
  enabled: boolean
}

export interface ProviderTestResult {
  ok: boolean
  status: number | null
  latencyMs: number
  sample: string | null
  error: string | null
}

export interface ProviderTemplate { label: string; name: string; baseUrl: string; model: string; supportsJsonMode: boolean }

// Adresses à confirmer dans la console de chaque fournisseur (spec §3.4).
export const PROVIDER_TEMPLATES: readonly ProviderTemplate[] = [
  { label: 'Groq', name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile', supportsJsonMode: true },
  { label: 'Gemini', name: 'Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash', supportsJsonMode: true },
  { label: 'Mistral', name: 'Mistral', baseUrl: 'https://api.mistral.ai/v1', model: 'mistral-small-latest', supportsJsonMode: true },
  { label: 'OpenRouter', name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: '', supportsJsonMode: false },
  // Appelé par le SDK Anthropic natif du back (aiguillage sur l'hôte exact api.anthropic.com) ; le modèle reste modifiable.
  { label: 'Anthropic (Claude)', name: 'Claude', baseUrl: 'https://api.anthropic.com', model: 'claude-haiku-5-5', supportsJsonMode: false },
] as const
