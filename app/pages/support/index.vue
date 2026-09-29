<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import PaginationControls from '@/components/ui/PaginationControls.vue'
import StartSupportConversationDialog from '@/features/support/components/StartSupportConversationDialog.vue'
import SupportTicketThread from '@/features/support/components/SupportTicketThread.vue'
import SupportTicketsTable from '@/features/support/components/SupportTicketsTable.vue'
import { useSupportTickets } from '@/features/support/composables/useSupportTickets'
import type { SupportStatusFilter, SupportTicketScope } from '@/features/support/types/index'
import { STATUS_LABELS } from '@/features/support/utils/format'
import { userDisplayName } from '@/features/broadcast/composables/useUserSearch'
import { usersService } from '@/features/users/services/usersService'
import { useAuthStore } from '@/stores/auth'

definePageMeta({
  middleware: 'admin-only',
  permission: 'SUPPORT_TICKET_VIEW',
  pageTitle: 'Support',
  pageSubtitle: 'Tickets utilisateurs & réponses',
})

const SCOPES: { key: SupportTicketScope, label: string }[] = [
  { key: 'unassigned', label: 'Non assignés' },
  { key: 'mine', label: 'Mes tickets' },
  { key: 'all', label: 'Tous' },
]

const s = useSupportTickets()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

/**
 * Lien profond ?ticket=<id> (notifications de ticket ou de message) : ouvre le fil. Le ticket
 * peut ne pas figurer dans le périmètre affiché (déjà assigné à un collègue, résolu) : on
 * bascule alors sur « Tous » pour qu'il apparaisse aussi dans la liste.
 */
async function openFromLink(id: string) {
  await s.openTicket(id)
  if (s.selected.value?.id !== id) return
  if (s.scope.value !== 'all' && !s.tickets.value.some((t) => t.id === id)) await s.setScope('all')
}

function ticketParam(): string | null {
  const v = route.query?.ticket
  return typeof v === 'string' && v ? v : null
}

/** Fermer retire ?ticket= : un nouveau clic sur la même notification rouvrira le fil. */
function closeTicket() {
  s.closeTicket()
  if (!ticketParam()) return
  const query = { ...(route.query ?? {}) }
  delete query.ticket
  void router.replace({ query })
}

function userIdParam(): string | null {
  const v = route.query?.userId
  return typeof v === 'string' && v ? v : null
}

/**
 * Nom de l'utilisateur filtré : lu sur ses tickets, sinon sur sa fiche (droit USER_VIEW),
 * sinon l'identifiant court.
 */
const resolvedName = ref<string | null>(null)
async function resolveFilterName(id: string) {
  resolvedName.value = null
  if (s.tickets.value.some((t) => t.userId === id) || !auth.can('USER_VIEW')) return
  try {
    const u = await usersService.get(id)
    if (s.userId.value === id) resolvedName.value = userDisplayName(u)
  } catch { /* identifiant court */ }
}
const filterName = computed(() => {
  const id = s.userId.value
  if (!id) return ''
  return s.tickets.value.find((t) => t.userId === id)?.userDisplayName || resolvedName.value || id.slice(0, 8)
})

async function applyUserFilter(id: string | null) {
  await s.setUserFilter(id)
  if (id) await resolveFilterName(id)
}

function clearUserFilter() {
  const query = { ...(route.query ?? {}) }
  delete query.userId
  void router.replace({ query })
}

// Nouvelle conversation : filtre actif, elle vise cet utilisateur ; sinon on le cherche.
const startOpen = ref(false)
const startRecipient = computed(() =>
  s.userId.value ? { id: s.userId.value, name: filterName.value } : null)
function onStarted() {
  startOpen.value = false
  void s.fetchTickets()
}

onMounted(async () => {
  const userId = userIdParam()
  if (userId) await applyUserFilter(userId)
  else await s.fetchTickets()
  const id = ticketParam()
  if (id) await openFromLink(id)
})
watch(() => route.query?.userId, () => {
  const id = userIdParam()
  if (id !== s.userId.value) void applyUserFilter(id)
})
// Page déjà ouverte : un clic sur une notification ne remonte pas le composant.
watch(() => route.query?.ticket, (v) => {
  if (typeof v === 'string' && v && v !== s.selected.value?.id) void openFromLink(v)
})
</script>

<template>
  <div>
    <div
      v-if="s.userId.value" data-test="support-user-filter" role="status"
      class="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-card border border-primary/30 bg-primary/5 px-4 py-3 text-sm"
    >
      <div class="min-w-0">
        <p class="font-medium text-text">Conversations de {{ filterName }}</p>
        <p v-if="s.userFilterIgnored.value" data-test="support-user-filter-ignored" class="mt-0.5 text-xs text-text-muted text-pretty">
          Le serveur ne sait pas encore filtrer par utilisateur : seules ses conversations de cette page sont affichées.
        </p>
      </div>
      <button
        type="button" data-test="support-user-filter-clear"
        class="shrink-0 rounded-btn border border-border px-3 py-1.5 text-sm transition-colors hover:bg-surface-elevated"
        @click="clearUserFilter"
      >Retirer le filtre</button>
    </div>

    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <!-- Avec ?userId= le back renvoie tout l'historique du compte et ignore le périmètre. -->
      <div v-if="!s.userId.value" data-test="support-scopes" class="flex gap-1 rounded-md border border-border bg-surface p-1">
        <button
          v-for="scope in SCOPES"
          :key="scope.key"
          type="button"
          :class="[
            'rounded px-3 py-1.5 text-sm font-medium',
            s.scope.value === scope.key
              ? 'bg-primary text-white'
              : 'text-text-muted hover:text-text',
          ]"
          @click="s.setScope(scope.key)"
        >
          {{ scope.label }}
        </button>
      </div>
      <span v-else />
      <div class="flex flex-wrap items-center gap-2">
        <select
          :value="s.statusFilter.value"
          class="rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
          aria-label="Filtrer par statut"
          @change="s.setStatusFilter(($event.target as HTMLSelectElement).value as SupportStatusFilter)"
        >
          <option value="TOUS">Tous les statuts</option>
          <option v-for="(label, code) in STATUS_LABELS" :key="code" :value="code">
            {{ label }}
          </option>
        </select>
        <button
          v-if="auth.can('SUPPORT_TICKET_MANAGE')" type="button" data-test="support-new-conversation"
          class="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white transition-[background-color,scale] hover:bg-primary/90 active:scale-[0.96]"
          @click="startOpen = true"
        >Nouvelle conversation</button>
      </div>
    </div>

    <p v-if="s.error.value" class="mb-3 text-sm text-danger">{{ s.error.value }}</p>

    <SupportTicketsTable
      :tickets="s.tickets.value"
      :loading="s.isLoading.value"
      @select="s.openTicket"
    />
    <div class="mt-4">
      <PaginationControls
        :page="s.currentPage.value"
        :total-pages="s.totalPages.value"
        @change="s.goToPage"
      />
    </div>

    <StartSupportConversationDialog
      :open="startOpen" :recipient="startRecipient"
      @close="startOpen = false" @sent="onStarted"
    />

    <!-- Panneau détail -->
    <div
      v-if="s.selected.value || s.isDetailLoading.value"
      class="fixed inset-0 z-40 bg-black/30"
      @click.self="closeTicket()"
    >
      <aside class="absolute inset-y-0 right-0 w-full max-w-xl border-l border-border bg-surface shadow-xl">
        <p v-if="s.isDetailLoading.value" class="p-6 text-center text-sm text-text-muted">
          Chargement…
        </p>
        <SupportTicketThread
          v-else-if="s.selected.value"
          :ticket="s.selected.value"
          :acting="s.isActing.value"
          :action-error="s.actionError.value"
          @close="closeTicket()"
          @assign="s.assign"
          @reassign="s.reassign"
          @reply="(id, content, keys) => s.reply(id, content, keys)"
          @resolve="s.resolve"
        />
      </aside>
    </div>
  </div>
</template>
