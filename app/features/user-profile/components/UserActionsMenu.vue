<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import ConfirmActionDialog from '@/components/ui/ConfirmActionDialog.vue'
import StartSupportConversationDialog from '@/features/support/components/StartSupportConversationDialog.vue'
import { userDisplayName } from '@/features/broadcast/composables/useUserSearch'
import { heldPaymentsReminder } from '@/features/payments/types/index'
import { availableActions, groupActions, type AccountActionId } from '@/features/user-profile/lib/accountActions'
import { useAuthStore } from '@/stores/auth'
import type { AdminUserDetail } from '@/features/users/types/index'

const props = defineProps<{ user: AdminUserDetail, busy?: boolean }>()
const emit = defineEmits<{
  suspend: [reason: string]; ban: [reason: string]; unsuspend: []
  suspendPublishing: [reason: string]; liftPublishing: []
  muteMessaging: [durationHours: number | null, reason: string]; unmuteMessaging: []
}>()

const auth = useAuthStore()
const groups = computed(() => groupActions(availableActions(props.user, p => auth.can(p))))
const notifyLink = computed(() => `/communications?target=USER&userId=${encodeURIComponent(props.user.id)}`)
const supportRecipient = computed(() => ({ id: props.user.id, name: userDisplayName(props.user) }))

// --- Menu : ouverture, focus, fermeture (Échap, clic extérieur) ---
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const menu = ref<HTMLElement | null>(null)
const menuOpen = ref(false)

const items = () => Array.from(menu.value?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
async function openMenu() {
  menuOpen.value = true
  await nextTick()
  items()[0]?.focus()
}
function closeMenu(refocus = true) {
  if (!menuOpen.value) return
  menuOpen.value = false
  if (refocus) void nextTick(() => trigger.value?.focus())
}
function toggleMenu() { if (menuOpen.value) closeMenu(); else void openMenu() }

function onDocKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && menuOpen.value) { e.preventDefault(); closeMenu() }
}
function onDocPointer(e: Event) {
  if (menuOpen.value && root.value && !root.value.contains(e.target as Node)) closeMenu(false)
}
function onMenuKeydown(e: KeyboardEvent) {
  // Tab quitte le menu : on le ferme sans retenir le focus, qui continue naturellement.
  if (e.key === 'Tab') { closeMenu(false); return }
  const list = items()
  if (list.length === 0) return
  const at = list.indexOf(document.activeElement as HTMLElement)
  let next: number | null = null
  if (e.key === 'ArrowDown') next = (at + 1) % list.length
  else if (e.key === 'ArrowUp') next = at <= 0 ? list.length - 1 : at - 1
  else if (e.key === 'Home') next = 0
  else if (e.key === 'End') next = list.length - 1
  if (next === null) return
  e.preventDefault()
  list[next]!.focus()
}
onMounted(() => {
  document.addEventListener('keydown', onDocKeydown)
  document.addEventListener('mousedown', onDocPointer)
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onDocKeydown)
  document.removeEventListener('mousedown', onDocPointer)
})

const focusTrigger = () => { void nextTick(() => trigger.value?.focus()) }

// --- Gestes : directs, ou confirmés (textes identiques à l'ancien tiroir) ---
type Pending = 'suspend' | 'ban' | 'unban' | 'suspendPublishing' | 'mute' | null
const pending = ref<Pending>(null)
const writeSupportOpen = ref(false)
type MuteDuration = '24' | '168' | 'indefinite'
const muteDuration = ref<MuteDuration>('24')
const muteHours = () => muteDuration.value === '24' ? 24 : muteDuration.value === '168' ? 168 : null
const muteLabel = () => muteDuration.value === '24' ? '24 heures' : muteDuration.value === '168' ? '7 jours' : 'une durée indéterminée'
const heldReminder = computed(() => {
  const n = props.user.heldPaymentsCount ?? 0
  return n > 0 ? ` ${heldPaymentsReminder(n)}` : ''
})

function choose(id: AccountActionId) {
  if (props.busy) return
  closeMenu(false)
  switch (id) {
    case 'writeSupport': writeSupportOpen.value = true; break
    case 'suspend': case 'ban': case 'unban': case 'suspendPublishing': pending.value = id; break
    case 'mute': muteDuration.value = '24'; pending.value = 'mute'; break
    case 'unsuspend': emit('unsuspend'); focusTrigger(); break
    case 'liftPublishing': emit('liftPublishing'); focusTrigger(); break
    case 'unmute': emit('unmuteMessaging'); focusTrigger(); break
    default: break // notify : lien
  }
}

const dialog = computed(() => {
  switch (pending.value) {
    case 'suspend': return { title: 'Suspendre ce compte', message: 'Le compte sera suspendu.', confirmLabel: 'Suspendre', requireReason: true }
    case 'ban': return { title: 'Bannir ce compte', message: 'Le compte sera banni définitivement.', confirmLabel: 'Bannir', requireReason: true }
    case 'unban': return {
      title: 'Lever le bannissement de ce compte',
      message: 'Le compte redeviendra actif : l\'utilisateur pourra de nouveau se connecter, publier et échanger.' + heldReminder.value,
      confirmLabel: 'Lever le bannissement', requireReason: false,
    }
    case 'suspendPublishing': return {
      title: 'Suspendre la publication', message: 'L\'utilisateur ne pourra plus publier ni trajets ni colis.',
      confirmLabel: 'Suspendre la publication', requireReason: true,
    }
    case 'mute': return {
      title: 'Couper la messagerie', message: `La messagerie de cet utilisateur sera coupée pour ${muteLabel()}.`,
      confirmLabel: 'Couper la messagerie', requireReason: true,
    }
    default: return { title: '', message: '', confirmLabel: '', requireReason: false }
  }
})

function confirm(reason: string) {
  const p = pending.value
  pending.value = null
  focusTrigger()
  if (p === 'suspend') emit('suspend', reason)
  else if (p === 'ban') emit('ban', reason)
  else if (p === 'suspendPublishing') emit('suspendPublishing', reason)
  else if (p === 'mute') emit('muteMessaging', muteHours(), reason)
  // Même endpoint que la levée de suspension : le back l'accepte pour SUSPENDED et BANNED.
  else if (p === 'unban') emit('unsuspend')
}
</script>

<template>
  <div ref="root" class="relative">
    <div v-if="groups.length > 0" data-test="actions-menu">
    <button
      ref="trigger" type="button" data-test="actions-trigger" aria-haspopup="menu" :aria-expanded="menuOpen"
      class="inline-flex items-center gap-2 rounded-btn bg-primary px-4 py-2 text-sm font-medium text-white transition-[background-color,scale] hover:bg-primary/90 active:scale-[0.96]"
      @click="toggleMenu"
    >Actions du compte</button>

    <div
      v-if="menuOpen" ref="menu" role="menu" aria-label="Actions du compte" data-test="actions-list"
      class="absolute right-0 z-30 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-card border border-border bg-surface p-1 shadow-xl"
      @keydown="onMenuKeydown"
    >
      <div v-for="g in groups" :key="g.group" role="group" :aria-label="g.group" class="py-1">
        <p class="px-3 pb-1 pt-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted" aria-hidden="true">{{ g.group }}</p>
        <template v-for="a in g.actions" :key="a.id">
          <NuxtLink
            v-if="a.id === 'notify'" :to="notifyLink" role="menuitem" tabindex="-1" :data-test="`menu-${a.id}`"
            class="block rounded-btn px-3 py-2 text-sm hover:bg-surface-elevated focus-visible:bg-surface-elevated"
            @click="closeMenu(false)"
          >
            <span class="block font-medium">{{ a.label }}</span>
            <span class="block text-xs text-text-muted text-pretty">{{ a.hint }}</span>
          </NuxtLink>
          <button
            v-else type="button" role="menuitem" tabindex="-1" :data-test="`menu-${a.id}`" :aria-disabled="busy ? 'true' : undefined"
            class="block w-full rounded-btn px-3 py-2 text-left text-sm hover:bg-surface-elevated focus-visible:bg-surface-elevated aria-disabled:opacity-40"
            @click="choose(a.id)"
          >
            <span class="block font-medium" :class="a.danger ? 'text-danger' : ''">{{ a.label }}</span>
            <span class="block text-xs text-text-muted text-pretty">{{ a.hint }}</span>
          </button>
        </template>
      </div>
    </div>
    </div>

    <ConfirmActionDialog
      :open="pending !== null" :title="dialog.title" :message="dialog.message"
      :confirm-label="dialog.confirmLabel" :require-reason="dialog.requireReason"
      @confirm="confirm" @cancel="pending = null; focusTrigger()"
    >
      <div v-if="pending === 'mute'" class="mb-4">
        <label for="mute-duration" class="mb-1 block text-xs text-text-muted">Durée de la coupure</label>
        <select
          id="mute-duration" v-model="muteDuration" data-test="mute-duration"
          class="w-full rounded-btn border border-border bg-bg p-2 text-sm"
        >
          <option value="24">24 heures</option>
          <option value="168">7 jours</option>
          <option value="indefinite">Indéfini</option>
        </select>
      </div>
    </ConfirmActionDialog>

    <StartSupportConversationDialog
      :open="writeSupportOpen" :recipient="supportRecipient"
      @close="writeSupportOpen = false; focusTrigger()" @sent="writeSupportOpen = false; focusTrigger()"
    />
  </div>
</template>
