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

const FIELDS = [
  { key: 'created_request', family: 'ACTIVITY', label: 'A créé une demande', operators: [{ key: 'EVER', label: 'au moins une fois', valueType: 'NONE' }], values: [] },
  { key: 'published_trip', family: 'ACTIVITY', label: 'A publié un trajet', operators: [{ key: 'EVER', label: 'au moins une fois', valueType: 'NONE' }], values: [] },
]
const NO_SEGMENTS = { content: [], totalElements: 0, totalPages: 0, number: 0, size: 100 }

const NEW_BROADCAST = {
  id: 'br1',
  title: 'Rappel expéditeurs',
  body: 'Pensez à publier votre demande cette semaine.',
  targetType: 'RULE',
  targetOrigin: null,
  targetDestination: null,
  targetUserId: null,
  recipientCount: 42,
  adminId: 'a1',
  createdAt: '2026-08-19T10:00:00Z',
  audienceRule: { op: 'AND', children: [{ field: 'created_request', operator: 'EVER', value: null }] },
  segmentId: null,
  segmentName: null,
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript((u) => { (window as unknown as { __yadonyAuthSeed: typeof u }).__yadonyAuthSeed = u }, ADMIN)
  await page.route('**/api/v1/admin/broadcast-segments**', (route) => route.fulfill({ json: NO_SEGMENTS }))
})

test('admin construit une cible « Expéditeurs », voit l’aperçu, envoie et retrouve la règle dans l’historique', async ({ page }) => {
  const previewCalls: unknown[] = []
  const sendCalls: unknown[] = []
  let historyPage = INITIAL_HISTORY

  // '/broadcast/fields' et '/broadcast/preview' contiennent '/broadcast' : on les traite avant
  // la branche générale d'envoi (POST sur '/broadcast' tout court).
  await page.route('**/api/v1/admin/notifications/**', (route) => {
    const req = route.request()
    const url = req.url()
    const method = req.method()

    if (method === 'GET' && url.includes('/broadcast/fields')) return route.fulfill({ json: FIELDS })
    if (method === 'POST' && url.includes('/broadcast/preview')) {
      previewCalls.push(req.postDataJSON())
      return route.fulfill({ json: { recipientCount: 42, pushReachableCount: 30 } })
    }
    if (method === 'GET' && url.includes('/broadcasts')) return route.fulfill({ json: historyPage })
    if (method === 'POST' && url.includes('/broadcast')) {
      sendCalls.push(req.postDataJSON())
      historyPage = { content: [NEW_BROADCAST, EXISTING_BROADCAST], totalElements: 2, totalPages: 1, number: 0, size: 20 }
      return route.fulfill({ json: NEW_BROADCAST })
    }
    return route.fulfill({ json: historyPage })
  })

  await page.goto('/communications')

  // Ancre d'hydratation : une ligne d'historique ne peut venir que du fetch réel.
  await expect(page.locator('[data-test="broadcast-row-br0"]')).toBeVisible()

  await page.locator('[data-test="broadcast-title"]').fill('Rappel expéditeurs')
  await page.locator('[data-test="broadcast-body"]').fill('Pensez à publier votre demande cette semaine.')
  await page.locator('[data-test="shortcut-senders"]').click()

  // L'aperçu part tout seul, 400 ms après la dernière modification.
  await expect(page.locator('[data-test="broadcast-recipient-count"]')).toContainText('42 personnes ciblées, dont 30 joignables en push')
  await expect.poll(() => previewCalls.length).toBeGreaterThan(0)
  expect(previewCalls.at(-1)).toEqual({
    type: 'RULE',
    rule: { op: 'AND', children: [{ field: 'created_request', operator: 'EVER', value: null }] },
  })

  await page.locator('[data-test="broadcast-send"]').click()
  await expect(page.getByText('Envoyer à 42 personnes (30 en push)')).toBeVisible()
  await page.locator('[data-test="confirm"]').click()

  await expect.poll(() => sendCalls.length).toBe(1)
  expect(sendCalls[0]).toEqual({
    title: 'Rappel expéditeurs',
    body: 'Pensez à publier votre demande cette semaine.',
    target: {
      type: 'RULE',
      rule: { op: 'AND', children: [{ field: 'created_request', operator: 'EVER', value: null }] },
    },
    // Diffusion large : sans sonnerie par défaut, la case « push » n'a pas été cochée.
    push: false,
  })

  await expect(page.locator('[data-test="broadcast-row-br1"]')).toContainText('Rappel expéditeurs')
  await expect(page.locator('[data-test="broadcast-row-br1"]')).toContainText('Règle (1 condition)')
  // L'ancien envoi reste présent : l'historique s'est mis à jour, pas remplacé.
  await expect(page.locator('[data-test="broadcast-row-br0"]')).toBeVisible()
})

test('changer le ciblage après une estimation la périme', async ({ page }) => {
  let previews = 0
  await page.route('**/api/v1/admin/notifications/**', async (route) => {
    const req = route.request()
    const url = req.url()
    const method = req.method()
    if (method === 'GET' && url.includes('/broadcast/fields')) return route.fulfill({ json: FIELDS })
    if (method === 'POST' && url.includes('/broadcast/preview')) {
      previews += 1
      // Le second aperçu ne répond jamais : le compteur du premier ciblage reste périmé.
      if (previews > 1) return new Promise(() => {})
      return route.fulfill({ json: { recipientCount: 100, pushReachableCount: 60 } })
    }
    return route.fulfill({ json: INITIAL_HISTORY })
  })

  await page.goto('/communications')
  await expect(page.locator('[data-test="broadcast-row-br0"]')).toBeVisible()

  await page.locator('[data-test="shortcut-senders"]').click()
  await expect(page.locator('[data-test="broadcast-recipient-count"]')).toContainText('100 personnes ciblées')

  await page.locator('[data-test="shortcut-travelers"]').click()
  await expect(page.locator('[data-test="broadcast-stale-estimate"]')).toBeVisible()
  await expect(page.locator('[data-test="broadcast-recipient-count"]')).toHaveCount(0)
})
