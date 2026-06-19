import { test, expect } from '@playwright/test'

const ADMIN = { id: 'a1', phoneNumber: '+33600000000', displayName: 'Admin Dony', isProAccount: false, roles: ['ADMIN'], avatarUrl: null }

const CONV_PAGE = {
  content: [
    { id: 'c1', bidId: 'b1', participantA: 'Awa', participantB: 'Karim', lastMessageAt: '2026-06-02T10:00:00Z', messageCount: 3, flagged: true, createdAt: '2026-06-01T10:00:00Z' },
  ],
  totalElements: 1, totalPages: 1, number: 0, size: 20,
}
const MESSAGES = [
  { id: 'm1', conversationId: 'c1', senderName: 'Awa', content: 'Bonjour', flagged: false, deleted: false, createdAt: '2026-06-01T10:00:00Z' },
  { id: 'm2', conversationId: 'c1', senderName: 'Karim', content: 'message insultant', flagged: true, deleted: false, createdAt: '2026-06-01T10:05:00Z' },
]

test.beforeEach(async ({ page }) => {
  await page.addInitScript((u) => { (window as unknown as { __donyAuthSeed: typeof u }).__donyAuthSeed = u }, ADMIN)
  await page.route('**/api/v1/admin/conversations**', (route) => {
    if (route.request().url().includes('/messages')) return route.fulfill({ json: MESSAGES })
    return route.fulfill({ json: CONV_PAGE })
  })
})

test('admin sees conversations', async ({ page }) => {
  await page.goto('/moderation')
  await expect(page.locator('h1').first()).toContainText('Modération')
  await expect(page.locator('[data-test="conv-row-c1"]')).toContainText('Awa')
  await expect(page.locator('[data-test="conv-flagged-c1"]')).toBeVisible()
})

test('admin opens a conversation thread', async ({ page }) => {
  await page.goto('/moderation')
  await expect(page.locator('[data-test="conv-row-c1"]')).toBeVisible()
  await page.locator('[data-test="open-c1"]').click()
  await expect(page.locator('[data-test="thread-overlay"]')).toBeVisible()
  await expect(page.locator('[data-test="message-m2"]')).toContainText('message insultant')
})

test('admin deletes a message', async ({ page }) => {
  const deletes: string[] = []
  await page.route('**/api/v1/admin/messages/**', (route) => {
    if (route.request().method() === 'DELETE') deletes.push(route.request().url())
    return route.fulfill({ status: 204, body: '' })
  })
  await page.goto('/moderation')
  await expect(page.locator('[data-test="conv-row-c1"]')).toBeVisible()
  await page.locator('[data-test="open-c1"]').click()
  await page.locator('[data-test="delete-msg-m2"]').click()
  await page.locator('[data-test="reason"]').fill('propos haineux')
  await page.locator('[data-test="confirm"]').click()
  await expect.poll(() => deletes.some((u) => u.includes('/messages/m2'))).toBe(true)
})
