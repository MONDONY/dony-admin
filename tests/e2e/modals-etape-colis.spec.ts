import { test, expect } from '@playwright/test'

const ADMIN = { id: 'a1', email: 'admin.1@yadony.com', role: 'ADMIN', status: 'ACTIVE', mustChangePassword: false, permissionOverrides: {} }

const CREATED = {
  id: 'vm1', name: 'Colis arrivé', type: 'INFO', active: false, version: 1, audience: 'EVERYONE',
  titleFr: 'Retirez votre colis', titleEn: '', subtitleFr: '', subtitleEn: '', bodyFr: '{voyageur} est arrivé à {ville_arrivee}.', bodyEn: '',
  triggers: ['PARCEL_ARRIVED'], parcelRoles: ['TRAVELER'], frequency: 'ONCE', stats: null,
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript((u) => { (window as unknown as { __yadonyAuthSeed: typeof u }).__yadonyAuthSeed = u }, ADMIN)
})

test('admin crée un modal d’étape : Colis arrivé, rôle Voyageur, aperçu, enregistrement', async ({ page }) => {
  const posts: string[] = []
  await page.route('**/api/v1/admin/video-modals**', (route) => {
    const req = route.request()
    const url = req.url()
    if (req.method() === 'POST' && url.endsWith('/audience-estimate')) return route.fulfill({ json: { accounts: 10, afterSample: 10 } })
    if (req.method() === 'POST') { posts.push(req.postData() ?? ''); return route.fulfill({ json: CREATED }) }
    if (url.endsWith('/vm1')) return route.fulfill({ json: CREATED })
    return route.fulfill({ json: [CREATED] })
  })
  await page.route('**/api/v1/admin/broadcast/**', route => route.fulfill({ json: [] }))

  await page.goto('/modals-video/nouveau')
  // La page est rendue côté serveur : on reclique tant que l'hydratation n'a pas branché le bouton.
  await expect(async () => {
    await page.locator('[data-test="vm-type-INFO"]').click()
    await expect(page.locator('[data-test="vm-name"]')).toBeVisible({ timeout: 1000 })
  }).toPass({ timeout: 20000 })
  await page.locator('[data-test="vm-name"]').fill('Colis arrivé')
  await page.locator('[data-test="vm-title-fr"]').fill('Retirez votre colis')
  await page.locator('[data-test="vm-body-fr"]').fill('{voyageur} est arrivé à {ville_arrivee}.')

  // Le champ du rôle n'existe qu'avec une étape du colis.
  await expect(page.locator('[data-test="vm-parcel-roles"]')).toHaveCount(0)
  await page.locator('[data-test="vm-trigger-PARCEL_ARRIVED"]').click()
  await page.locator('[data-test="vm-trigger-SEARCH_TAB"]').click()
  await expect(page.locator('[data-test="vm-parcel-roles"]')).toBeVisible()
  await page.locator('[data-test="vm-parcel-role-TRAVELER"]').click()

  await expect(page.locator('[data-test="vm-preview-body"]')).toHaveText('Awa est arrivé à Abidjan.')
  await page.locator('[data-test="vm-submit"]').click()

  await expect.poll(() => posts.length).toBe(1)
  const body = JSON.parse(posts[0])
  expect(body.triggers).toEqual(['PARCEL_ARRIVED'])
  expect(body.parcelRoles).toEqual(['TRAVELER'])
})
