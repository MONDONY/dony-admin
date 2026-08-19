import { test, expect } from '@playwright/test'

const ADMIN = { id: 'a1', email: 'admin.1@yadony.com', role: 'ADMIN', status: 'ACTIVE', mustChangePassword: false, permissionOverrides: {} }

// Un envoi déjà présent dans l'historique au chargement — sert d'ancrage d'hydratation :
// contrairement au message "Aucun envoi pour le moment", cette ligne ne peut apparaître
// qu'après le fetch réel (l'état initial côté serveur est toujours une liste vide), donc
// l'attendre garantit que Nuxt a bien hydraté avant le premier clic.
const EXISTING_BROADCAST = {
  id: 'br0',
  title: 'Ancienne annonce',
  body: 'Message déjà envoyé.',
  targetType: 'ALL',
  targetOrigin: null,
  targetDestination: null,
  targetUserId: null,
  recipientCount: 5,
  adminId: 'a1',
  createdAt: '2026-08-01T09:00:00Z',
}
const INITIAL_HISTORY = { content: [EXISTING_BROADCAST], totalElements: 1, totalPages: 1, number: 0, size: 20 }

const NEW_BROADCAST = {
  id: 'br1',
  title: 'Nouvelle offre corridor',
  body: 'Profitez du corridor Paris → Dakar cette semaine.',
  targetType: 'CORRIDOR',
  targetOrigin: 'Paris',
  targetDestination: 'Dakar',
  targetUserId: null,
  recipientCount: 42,
  adminId: 'a1',
  createdAt: '2026-08-19T10:00:00Z',
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript((u) => { (window as unknown as { __yadonyAuthSeed: typeof u }).__yadonyAuthSeed = u }, ADMIN)
})

test('admin compose un message ciblé sur un corridor, l’estime, l’envoie et le retrouve dans l’historique', async ({ page }) => {
  const previewCalls: unknown[] = []
  const sendCalls: unknown[] = []
  let historyPage = INITIAL_HISTORY

  // '/broadcast/preview' contient '/broadcast' : la branche preview passe en premier,
  // avant la branche générale d'envoi (POST sur '/broadcast' tout court).
  await page.route('**/api/v1/admin/notifications/**', (route) => {
    const req = route.request()
    const url = req.url()
    const method = req.method()

    if (method === 'POST' && url.includes('/broadcast/preview')) {
      previewCalls.push(req.postDataJSON())
      return route.fulfill({ json: { recipientCount: 42 } })
    }
    if (method === 'GET' && url.includes('/broadcasts')) {
      return route.fulfill({ json: historyPage })
    }
    if (method === 'POST' && url.includes('/broadcast')) {
      sendCalls.push(req.postDataJSON())
      historyPage = { content: [NEW_BROADCAST, EXISTING_BROADCAST], totalElements: 2, totalPages: 1, number: 0, size: 20 }
      return route.fulfill({ json: NEW_BROADCAST })
    }
    return route.fulfill({ json: historyPage })
  })

  await page.goto('/communications')

  // Point d'ancrage sur une ligne d'historique déjà chargée (donc réellement hydratée) —
  // sans lui, le premier clic part avant que Nuxt n'ait attaché les listeners.
  await expect(page.locator('[data-test="broadcast-row-br0"]')).toBeVisible()

  await page.locator('[data-test="broadcast-title"]').fill('Nouvelle offre corridor')
  await page.locator('[data-test="broadcast-body"]').fill('Profitez du corridor Paris → Dakar cette semaine.')
  await page.locator('[data-test="broadcast-target"]').selectOption('CORRIDOR')
  await page.locator('[data-test="broadcast-origin"]').fill('Paris')
  await page.locator('[data-test="broadcast-destination"]').fill('Dakar')

  await page.locator('[data-test="broadcast-preview"]').click()
  await expect(page.locator('[data-test="broadcast-recipient-count"]')).toContainText('42 destinataires estimés')
  await expect.poll(() => previewCalls.length).toBe(1)
  expect(previewCalls[0]).toEqual({ type: 'CORRIDOR', origin: 'Paris', destination: 'Dakar' })

  await page.locator('[data-test="broadcast-send"]').click()
  // La confirmation nomme le nombre de destinataires estimés avant l'envoi.
  await expect(page.getByText('Ce message sera envoyé à 42 destinataires.')).toBeVisible()
  await page.locator('[data-test="confirm"]').click()

  await expect.poll(() => sendCalls.length).toBe(1)
  expect(sendCalls[0]).toEqual({
    title: 'Nouvelle offre corridor',
    body: 'Profitez du corridor Paris → Dakar cette semaine.',
    target: { type: 'CORRIDOR', origin: 'Paris', destination: 'Dakar' },
  })

  await expect(page.locator('[data-test="broadcast-row-br1"]')).toBeVisible()
  await expect(page.locator('[data-test="broadcast-row-br1"]')).toContainText('Nouvelle offre corridor')
  await expect(page.locator('[data-test="broadcast-row-br1"]')).toContainText('Paris → Dakar')
  // L'ancien envoi reste présent : l'historique s'est mis à jour, pas remplacé.
  await expect(page.locator('[data-test="broadcast-row-br0"]')).toBeVisible()
})

test('changer le ciblage après une estimation la périme', async ({ page }) => {
  await page.route('**/api/v1/admin/notifications/**', (route) => {
    const req = route.request()
    const url = req.url()
    const method = req.method()
    if (method === 'POST' && url.includes('/broadcast/preview')) {
      return route.fulfill({ json: { recipientCount: 100 } })
    }
    return route.fulfill({ json: INITIAL_HISTORY })
  })

  await page.goto('/communications')
  await expect(page.locator('[data-test="broadcast-row-br0"]')).toBeVisible()

  await page.locator('[data-test="broadcast-target"]').selectOption('ALL')
  await page.locator('[data-test="broadcast-preview"]').click()
  await expect(page.locator('[data-test="broadcast-recipient-count"]')).toContainText('100 destinataires estimés')

  await page.locator('[data-test="broadcast-target"]').selectOption('SENDERS')
  await expect(page.locator('[data-test="broadcast-stale-estimate"]')).toBeVisible()
  await expect(page.locator('[data-test="broadcast-recipient-count"]')).toHaveCount(0)
})
