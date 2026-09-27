type HttpErrorLike = {
  statusCode?: number
  status?: number
  response?: { status?: number }
  data?: { code?: unknown }
} | undefined

/** Slug métier du ProblemDetail (propriété `code`), ou null. */
export function problemCode(e: unknown): string | null {
  const code = (e as HttpErrorLike)?.data?.code
  return typeof code === 'string' ? code : null
}

/**
 * Endpoint absent (back pas encore déployé, règle des PR jumelles) : Spring répond 404
 * « No endpoint matches this path » ou 405, SANS `code` métier. Un 404 porteur d'un code
 * reste une vraie erreur à montrer.
 */
export function isEndpointMissing(e: unknown): boolean {
  const err = e as HttpErrorLike
  const status = err?.statusCode ?? err?.status ?? err?.response?.status
  if (status !== 404 && status !== 405) return false
  return !err?.data?.code
}
