/**
 * Clé d'idempotence (UUID v4) pour une écriture qu'on peut devoir rejouer après une coupure
 * réseau. `crypto.randomUUID` n'existe qu'en contexte sécurisé (HTTPS ou localhost) : le repli
 * sur `getRandomValues` évite qu'un accès par IP en recette casse le geste.
 */
export function newIdempotencyKey(): string {
  const c = globalThis.crypto
  if (typeof c.randomUUID === 'function') return c.randomUUID()
  const b = c.getRandomValues(new Uint8Array(16))
  b[6] = (b[6]! & 0x0f) | 0x40
  b[8] = (b[8]! & 0x3f) | 0x80
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
