/**
 * Le backend renvoie du RFC 7807 (`ProblemDetail`) : `detail` porte le message écrit pour
 * un humain, `code` le slug technique. `useApi()` (ofetch) expose le corps parsé via
 * `error.data`. On ne retombe sur `error.message` (générique, type « 422 Unprocessable
 * Entity ») que si `data.detail` est absent ou vide.
 */
export function extractProblemMessage(e: unknown, fallback: string): string {
  const data = (e as { data?: { detail?: string } } | undefined)?.data
  if (typeof data?.detail === 'string' && data.detail.trim().length > 0) return data.detail
  return (e as Error | undefined)?.message || fallback
}
