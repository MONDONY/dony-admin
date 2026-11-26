import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
// @ts-expect-error fichier JS classique du service worker (module.exports gardé)
import lib from '../../../../public/m/sw-lib.js'

// Le vrai firebase-messaging-sw.js, exécuté avec un faux `self` : vérifie le câblage des événements.
type Handler = (_e: Record<string, unknown>) => void
function loadSw() {
  const handlers: Record<string, Handler> = {}
  const self = {
    YadonySw: undefined as unknown,
    registration: { scope: 'https://x.test/siragbe/m/', showNotification: vi.fn(async () => {}) },
    clients: { claim: vi.fn(), matchAll: vi.fn(async () => []), openWindow: vi.fn(async () => null) },
    skipWaiting: vi.fn(),
    addEventListener: (name: string, fn: Handler) => { handlers[name] = fn },
  }
  const importScripts = () => { self.YadonySw = lib }
  const src = readFileSync(resolve(process.cwd(), 'public/m/firebase-messaging-sw.js'), 'utf8')
  new Function('self', 'importScripts', src)(self, importScripts)
  return { self, handlers }
}

describe('firebase-messaging-sw.js wiring', () => {
  it('push: shows the notification with renotify when tagged', async () => {
    const { self, handlers } = loadSw()
    const waits: Promise<unknown>[] = []
    handlers.push!({
      data: { json: () => ({ notification: { title: 'Nouvelle alerte', body: 'x' }, data: { type: 'ADMIN_ALERT', route: '/m/alertes/1' } }) },
      waitUntil: (p: Promise<unknown>) => waits.push(p),
    })
    await Promise.all(waits)
    expect(self.registration.showNotification).toHaveBeenCalledWith('Nouvelle alerte', expect.objectContaining({ tag: 'ADMIN_ALERT', renotify: true }))
  })

  it('notificationclick: closes the notification and opens the target through openTarget', async () => {
    const { self, handlers } = loadSw()
    const close = vi.fn()
    const waits: Promise<unknown>[] = []
    handlers.notificationclick!({
      notification: { close, data: { route: '/m/alertes/1' } },
      waitUntil: (p: Promise<unknown>) => waits.push(p),
    })
    await Promise.all(waits)
    expect(close).toHaveBeenCalled()
    expect(self.clients.openWindow).toHaveBeenCalledWith('https://x.test/siragbe/m/alertes/1')
  })

  it('notificationclick with a route to a desktop page opens the mobile app instead', async () => {
    const { self, handlers } = loadSw()
    const waits: Promise<unknown>[] = []
    handlers.notificationclick!({
      notification: { close: vi.fn(), data: { route: '/users/abc' } },
      waitUntil: (p: Promise<unknown>) => waits.push(p),
    })
    await Promise.all(waits)
    expect(self.clients.openWindow).toHaveBeenCalledWith('https://x.test/siragbe/m/')
  })
})
