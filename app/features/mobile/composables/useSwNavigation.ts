import { onBeforeUnmount, onMounted } from 'vue'

/**
 * Message `{ type: 'navigate', url }` posté par le service worker quand il ne peut pas
 * naviguer lui-même. Retourne le chemin relatif à l'app (sans baseURL), ou null si le
 * message est mal formé ou pointe hors de l'origine courante.
 */
export function resolveSwNavigation(data: unknown, baseURL: string): string | null {
  const msg = data as { type?: unknown, url?: unknown } | null
  if (!msg || msg.type !== 'navigate' || typeof msg.url !== 'string') return null
  let u: URL
  try { u = new URL(msg.url, window.location.origin) } catch { return null }
  if (u.origin !== window.location.origin) return null
  const base = baseURL.replace(/\/?$/, '/')
  const path = u.pathname.startsWith(base) ? `/${u.pathname.slice(base.length)}` : u.pathname
  return `${path}${u.search}${u.hash}`
}

export function useSwNavigation(): void {
  const baseURL = useRuntimeConfig().app.baseURL
  const handler = (event: MessageEvent) => {
    const to = resolveSwNavigation(event.data, baseURL)
    if (to) void navigateTo(to)
  }
  onMounted(() => {
    if (typeof navigator !== 'undefined' && navigator.serviceWorker) navigator.serviceWorker.addEventListener('message', handler)
  })
  onBeforeUnmount(() => {
    if (typeof navigator !== 'undefined' && navigator.serviceWorker) navigator.serviceWorker.removeEventListener('message', handler)
  })
}
