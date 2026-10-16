/** Erreurs de champ d'un ProblemDetail 422 : `data.violations` = objet champ → message. */
export function violationsByField(e: unknown): Record<string, string> {
  const v = (e as { data?: { violations?: unknown } } | undefined)?.data?.violations
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
  const out: Record<string, string> = {}
  for (const [field, message] of Object.entries(v as Record<string, unknown>)) {
    if (typeof message === 'string' && message.trim()) out[field] = message.trim()
  }
  return out
}

export function httpStatus(e: unknown): number | undefined {
  const x = e as { statusCode?: number; status?: number; response?: { status?: number } } | undefined
  return x?.statusCode ?? x?.status ?? x?.response?.status
}
