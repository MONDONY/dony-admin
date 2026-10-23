import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { seedAuth } from '~/tests/helpers/auth'
import UserActionsMenu from '@/features/user-profile/components/UserActionsMenu.vue'
import type { AdminRole } from '@/stores/auth'

const SupportDialog = {
  props: ['open', 'recipient'], emits: ['close', 'sent'],
  template: '<div v-if="open" data-test="support-dialog">{{ recipient.id }}|{{ recipient.name }}<button data-test="support-close" @click="$emit(\'close\')" /></div>',
}
const USER = {
  id: 'u 1/é', firstName: 'Awa', lastName: 'Diallo', email: null, phoneNumber: '+33612345678', status: 'ACTIVE',
  publishingSuspended: false, messagingMutedUntil: null, heldPaymentsCount: 0,
}
let wrapper: VueWrapper | null = null

function mountMenu(user: Record<string, unknown> = {}, role: AdminRole = 'ADMIN', busy = false) {
  seedAuth(role)
  wrapper = mount(UserActionsMenu, {
    props: { user: { ...USER, ...user } as never, busy },
    attachTo: document.body,
    global: { stubs: { NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' }, StartSupportConversationDialog: SupportDialog } },
  })
  return wrapper
}
const trigger = (w: VueWrapper) => w.get('[data-test="actions-trigger"]')
const open = async (w: VueWrapper) => { await trigger(w).trigger('click'); await flushPromises() }
const item = (w: VueWrapper, id: string) => w.get(`[data-test="menu-${id}"]`)
async function choose(w: VueWrapper, id: string) { await open(w); await item(w, id).trigger('click'); await flushPromises() }
async function confirmWith(w: VueWrapper, reason?: string) {
  if (reason !== undefined) await w.get('[data-test="reason"]').setValue(reason)
  await w.get('[data-test="confirm"]').trigger('click')
  await flushPromises()
}

describe('UserActionsMenu', () => {
  beforeEach(() => { document.body.innerHTML = '' })
  afterEach(() => { wrapper?.unmount(); wrapper = null })

  it('bouton accessible, menu fermé par défaut', () => {
    const w = mountMenu()
    expect(trigger(w).text()).toBe('Actions du compte')
    expect(trigger(w).attributes('aria-haspopup')).toBe('menu')
    expect(trigger(w).attributes('aria-expanded')).toBe('false')
    expect(w.find('[role="menu"]').exists()).toBe(false)
  })

  it('ouvre le menu : groupes, éléments menuitem, aria-expanded', async () => {
    const w = mountMenu()
    await open(w)
    expect(trigger(w).attributes('aria-expanded')).toBe('true')
    expect(w.get('[role="menu"]').exists()).toBe(true)
    expect(w.findAll('[role="group"]').map(g => g.attributes('aria-label'))).toEqual(['Communiquer', 'Compte', 'Activité'])
    expect(w.findAll('[role="menuitem"]').length).toBe(6)
  })

  it('notifier : lien vers les communications avec l’identifiant encodé', async () => {
    const w = mountMenu()
    await open(w)
    const link = item(w, 'notify')
    expect(link.element.tagName).toBe('A')
    expect(link.attributes('role')).toBe('menuitem')
    expect(link.attributes('href')).toBe(`/communications?target=USER&userId=${encodeURIComponent('u 1/é')}`)
  })

  it('aucune action : pas de bouton du tout', () => {
    const w = mountMenu({}, 'SUPPORT', false)
    expect(trigger(w).exists()).toBe(true) // SUPPORT garde « Écrire »
    wrapper?.unmount()
    const w2 = mountMenu({ status: 'PENDING_DELETION' }, 'SUPPORT')
    expect(w2.find('[data-test="actions-trigger"]').exists()).toBe(false)
  })

  it('Échap ferme le menu et rend le focus au bouton', async () => {
    const w = mountMenu()
    await open(w)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    expect(w.find('[role="menu"]').exists()).toBe(false)
    expect(document.activeElement).toBe(trigger(w).element)
  })

  it('clic extérieur ferme le menu', async () => {
    const w = mountMenu()
    await open(w)
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await flushPromises()
    expect(w.find('[role="menu"]').exists()).toBe(false)
  })

  it('le bouton rouvre et referme le menu', async () => {
    const w = mountMenu()
    await open(w)
    await trigger(w).trigger('click')
    expect(w.find('[role="menu"]').exists()).toBe(false)
  })

  it('flèches : focus sur le premier élément à l’ouverture puis navigation', async () => {
    const w = mountMenu()
    await open(w)
    const items = w.findAll('[role="menuitem"]').map(i => i.element)
    expect(document.activeElement).toBe(items[0])
    await w.get('[role="menu"]').trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement).toBe(items[1])
    await w.get('[role="menu"]').trigger('keydown', { key: 'ArrowUp' })
    await w.get('[role="menu"]').trigger('keydown', { key: 'ArrowUp' })
    expect(document.activeElement).toBe(items[items.length - 1])
    await w.get('[role="menu"]').trigger('keydown', { key: 'Home' })
    expect(document.activeElement).toBe(items[0])
    await w.get('[role="menu"]').trigger('keydown', { key: 'End' })
    expect(document.activeElement).toBe(items[items.length - 1])
  })

  it.each([
    ['suspend', 'suspend', 'Suspendre ce compte'],
    ['ban', 'ban', 'Bannir ce compte'],
    ['suspendPublishing', 'suspendPublishing', 'Suspendre la publication'],
  ])('%s : dialogue avec motif puis événement', async (id, evt, title) => {
    const w = mountMenu()
    await choose(w, id)
    expect(w.find('[role="menu"]').exists()).toBe(false)
    expect(w.get('[role="dialog"]').text()).toContain(title)
    expect(w.get('[data-test="confirm"]').attributes('disabled')).toBeDefined()
    await confirmWith(w, 'Fraude avérée')
    expect(w.emitted(evt)![0]).toEqual(['Fraude avérée'])
    expect(w.find('[role="dialog"]').exists()).toBe(false)
  })

  it('Échap annule le dialogue sans émettre', async () => {
    const w = mountMenu()
    await choose(w, 'suspend')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(w.find('[role="dialog"]').exists()).toBe(false)
    expect(w.emitted('suspend')).toBeUndefined()
  })

  it('Annuler ferme sans émettre', async () => {
    const w = mountMenu()
    await choose(w, 'ban')
    await w.get('[data-test="cancel"]').trigger('click')
    expect(w.find('[role="dialog"]').exists()).toBe(false)
    expect(w.emitted('ban')).toBeUndefined()
  })

  it.each([
    ['24', 24, '24 heures'],
    ['168', 168, '7 jours'],
    ['indefinite', null, 'une durée indéterminée'],
  ])('couper la messagerie (%s) : durée transmise', async (value, hours, label) => {
    const w = mountMenu()
    await choose(w, 'mute')
    await w.get('[data-test="mute-duration"]').setValue(value)
    expect(w.get('[role="dialog"]').text()).toContain(`La messagerie de cet utilisateur sera coupée pour ${label}.`)
    await confirmWith(w, 'Harcèlement')
    expect(w.emitted('muteMessaging')![0]).toEqual([hours, 'Harcèlement'])
  })

  it('la durée repart à 24 heures à chaque ouverture', async () => {
    const w = mountMenu()
    await choose(w, 'mute')
    await w.get('[data-test="mute-duration"]').setValue('168')
    await w.get('[data-test="cancel"]').trigger('click')
    await choose(w, 'mute')
    expect((w.get('[data-test="mute-duration"]').element as HTMLSelectElement).value).toBe('24')
  })

  it.each([
    ['unsuspend', { status: 'SUSPENDED' }, 'unsuspend'],
    ['liftPublishing', { publishingSuspended: true }, 'liftPublishing'],
    ['unmute', { messagingMutedUntil: '2026-11-01T10:00:00Z' }, 'unmuteMessaging'],
  ])('%s : geste direct sans dialogue', async (id, user, evt) => {
    const w = mountMenu(user)
    await choose(w, id)
    expect(w.find('[role="dialog"]').exists()).toBe(false)
    expect(w.emitted(evt)).toHaveLength(1)
    expect(w.find('[role="menu"]').exists()).toBe(false)
  })

  it('lever le bannissement : confirmation sans motif, rappel des versements retenus, événement unsuspend', async () => {
    const w = mountMenu({ status: 'BANNED', heldPaymentsCount: 2 })
    await choose(w, 'unban')
    const dlg = w.get('[role="dialog"]').text()
    expect(dlg).toContain('Lever le bannissement de ce compte')
    expect(dlg).toContain('Le compte redeviendra actif')
    expect(dlg).toContain('2 paiements retenus')
    expect(w.find('[data-test="reason"]').exists()).toBe(false)
    await confirmWith(w)
    expect(w.emitted('unsuspend')).toHaveLength(1)
  })

  it('lever le bannissement sans paiement retenu : pas de rappel', async () => {
    const w = mountMenu({ status: 'BANNED', heldPaymentsCount: null })
    await choose(w, 'unban')
    expect(w.get('[role="dialog"]').text()).not.toContain('retenu')
  })

  it('écrire à l’utilisateur : ouvre la conversation avec le bon destinataire', async () => {
    const w = mountMenu()
    await choose(w, 'writeSupport')
    expect(w.get('[data-test="support-dialog"]').text()).toContain('u 1/é|Awa Diallo')
    await w.get('[data-test="support-close"]').trigger('click')
    expect(w.find('[data-test="support-dialog"]').exists()).toBe(false)
  })

  it('occupé : éléments aria-disabled (atteignables au clavier) et activation ignorée', async () => {
    const w = mountMenu({}, 'ADMIN', true)
    await open(w)
    const buttons = w.findAll('button[role="menuitem"]')
    expect(buttons.every(b => b.attributes('aria-disabled') === 'true' && b.attributes('disabled') === undefined)).toBe(true)
    expect(document.activeElement).toBe(w.findAll('[role="menuitem"]')[0]!.element)
    await item(w, 'suspend').trigger('click')
    expect(w.find('[role="dialog"]').exists()).toBe(false)
    expect(w.find('[role="menu"]').exists()).toBe(true)
    expect(trigger(w).attributes('disabled')).toBeUndefined()
  })

  it('Tab ferme le menu sans retenir le focus', async () => {
    const w = mountMenu()
    await open(w)
    const ev = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    w.get('[role="menu"]').element.dispatchEvent(ev)
    await flushPromises()
    expect(ev.defaultPrevented).toBe(false)
    expect(w.find('[role="menu"]').exists()).toBe(false)
    expect(document.activeElement).not.toBe(trigger(w).element)
  })

  it('le focus revient au bouton après un geste direct et après un dialogue (annulé ou confirmé)', async () => {
    let w = mountMenu({ status: 'SUSPENDED' })
    await choose(w, 'unsuspend')
    expect(document.activeElement).toBe(trigger(w).element)
    wrapper?.unmount()
    w = mountMenu()
    await choose(w, 'suspend')
    await w.get('[data-test="cancel"]').trigger('click')
    await flushPromises()
    expect(document.activeElement).toBe(trigger(w).element)
    ;(document.activeElement as HTMLElement).blur()
    await choose(w, 'suspend')
    await confirmWith(w, 'Fraude')
    expect(document.activeElement).toBe(trigger(w).element)
    ;(document.activeElement as HTMLElement).blur()
    await choose(w, 'writeSupport')
    await w.get('[data-test="support-close"]').trigger('click')
    await flushPromises()
    expect(document.activeElement).toBe(trigger(w).element)
  })

  it('le dialogue d’écriture survit à la disparition des actions (relecture de la fiche)', async () => {
    const w = mountMenu({}, 'SUPPORT')
    await choose(w, 'writeSupport')
    await w.setProps({ user: { ...USER, status: 'PENDING_DELETION' } as never })
    // SUPPORT : plus aucune action pour ce statut, mais le dialogue ouvert reste monté
    expect(w.find('[data-test="actions-trigger"]').exists()).toBe(false)
    expect(w.find('[data-test="support-dialog"]').exists()).toBe(true)
  })

  it('les éléments dangereux sont repérés par un texte, pas seulement une couleur', async () => {
    const w = mountMenu()
    await open(w)
    expect(item(w, 'ban').text()).toContain('Bannir')
    expect(item(w, 'ban').text()).toContain('Définitif')
  })
})
