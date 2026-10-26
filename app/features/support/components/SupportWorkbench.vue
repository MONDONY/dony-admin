<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import KeyHint from '@/components/ui/KeyHint.vue'
import StartSupportConversationDialog from './StartSupportConversationDialog.vue'
import SupportTemplatesDialog from './SupportTemplatesDialog.vue'
import SupportQueue from './SupportQueue.vue'
import SupportConversation from './SupportConversation.vue'
import SupportContextPanel from './SupportContextPanel.vue'
import { useSupportTickets } from '@/features/support/composables/useSupportTickets'
import { useReplyDrafts } from '@/features/support/composables/useReplyDrafts'
import { useSupportContext } from '@/features/support/composables/useSupportContext'
import { useReplyTemplates } from '@/features/support/composables/useReplyTemplates'
import { useContextLoader } from '@/features/signalements/composables/useContextLoader'
import { useWorkbenchShortcuts } from '@/features/signalements/composables/useWorkbenchShortcuts'
import { supportService } from '@/features/support/services/supportService'
import {
  defaultTicketId, filterTickets, groupTickets, neighbourTicketId, queueOrder, scopeCounts, summarizeTickets, ticketCategories,
} from '@/features/support/lib/supportWorkbench'
import { categoryLabel } from '@/features/support/utils/format'
import type { AdminSupportTicketPage, SupportPriority, SupportTicketScope } from '@/features/support/types/index'
import type { AdminUserDetail } from '@/features/users/types/index'
import { extractProblemMessage } from '@/lib/problemDetail'
import { userDisplayName } from '@/features/broadcast/composables/useUserSearch'
import { usersService } from '@/features/users/services/usersService'
import { useAuthStore } from '@/stores/auth'

/**
 * Poste de traitement du support : la file (groupée par état) à gauche, la conversation au centre,
 * le contexte et les actions à droite. Le ticket ouvert vit dans l'URL (`?ticket=<id>`, lien des
 * notifications) ; `?userId=` limite la file aux conversations d'une personne (fiche utilisateur).
 */
const s = useSupportTickets()
const drafts = useReplyDrafts()
const ctx = useSupportContext()
const tpl = useReplyTemplates()
const templatesOpen = ref(false)
const notesBusy = ref(false)
const notesError = ref<string | null>(null)
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const scope = ref<SupportTicketScope>('unassigned')
const query = ref('')
const category = ref<string | null>(null)
const highOnly = ref(false)
const selectedId = ref<string | null>(null)
const openError = ref<string | null>(null)
const startOpen = ref(false)
const conversation = ref<InstanceType<typeof SupportConversation> | null>(null)
const now = ref(Date.now())
let ready = false

const myId = computed(() => auth.user?.id ?? null)
const SCOPES: { key: SupportTicketScope; label: string }[] = [
  { key: 'unassigned', label: 'Non assignés' },
  { key: 'mine', label: 'Mes tickets' },
  { key: 'all', label: 'Tous' },
]

// ---- File ----
// Avec ?userId= le back renvoie tout l'historique du compte et ignore le périmètre.
const filtered = computed(() => filterTickets(s.tickets.value, {
  scope: s.userId.value ? 'all' : scope.value, query: query.value, category: category.value, highPriorityOnly: highOnly.value, myId: myId.value,
}))
const groups = computed(() => groupTickets(filtered.value))
const order = computed(() => queueOrder(groups.value))
const counts = computed(() => scopeCounts(s.tickets.value, myId.value))
const summary = computed(() => summarizeTickets(s.tickets.value, now.value))
const categories = computed(() => ticketCategories(s.tickets.value))
const listTicket = computed(() => s.tickets.value.find((t) => t.id === selectedId.value) ?? null)
/** Le fil lu (avec ses messages) quand il est celui du ticket choisi, sinon la ligne de la file. */
const current = computed(() => (s.selected.value && s.selected.value.id === selectedId.value ? s.selected.value : listTicket.value))

// ---- Contexte de la personne ----
const isUser = (v: unknown): v is AdminUserDetail => typeof v === 'object' && v !== null && 'id' in v
const isTicketPage = (v: unknown): v is AdminSupportTicketPage => typeof v === 'object' && v !== null && Array.isArray((v as { content?: unknown }).content)
const userCtx = useContextLoader<AdminUserDetail>((id) => usersService.get(id), isUser)
const relatedCtx = useContextLoader<AdminSupportTicketPage>((id) => supportService.listByUser(id, 6), isTicketPage)
const related = computed(() => (relatedCtx.context.value?.content ?? []).filter((t) => t.id !== selectedId.value))
watch(() => current.value?.userId ?? null, (uid) => {
  void relatedCtx.load(uid)
  void userCtx.load(uid && auth.can('USER_VIEW') ? uid : null)
})

// ---- URL ----
const queryValue = (name: string) => {
  const v = route.query?.[name]
  return typeof v === 'string' && v ? v : null
}
/** Dernière valeur de `ticket` écrite par l'écran : son écho ne doit pas rouvrir le ticket. */
let lastWritten: string | null = null
function writeTicketParam(id: string | null) {
  if (id === queryValue('ticket')) return
  lastWritten = id
  const q: Record<string, string> = {}
  for (const [k, v] of Object.entries(route.query ?? {})) if (k !== 'ticket' && typeof v === 'string') q[k] = v
  if (id) q.ticket = id
  void router.replace({ query: q })
}

// ---- Sélection ----
function scrollTo(id: string) {
  void nextTick(() => document.querySelector(`[data-test="support-row-${CSS.escape(id)}"]`)?.scrollIntoView?.({ block: 'nearest' }))
}
/** Ouvre un ticket : sa ligne est choisie tout de suite, son fil se lit ensuite. */
function activate(id: string, { write = true }: { write?: boolean } = {}) {
  selectedId.value = id
  openError.value = null
  notesError.value = null
  void s.openTicket(id)
  void ctx.load(id)
  if (write) writeTicketParam(id)
}
function selectTicket(id: string) {
  if (id === selectedId.value) return
  activate(id)
  scrollTo(id)
}
// Un ticket est toujours ouvert quand la file en contient un ; un ticket ouvert par lien hors file reste.
watch(order, (list) => {
  if (!ready || s.isLoading.value) return
  // Un ticket ouvert par lien alors qu'il n'est pas dans la file chargée reste ; un filtre qui l'écarte le remplace.
  const pinned = !listTicket.value && s.selected.value?.id === selectedId.value
  if (selectedId.value && (pinned || list.some((t) => t.id === selectedId.value))) return
  const id = defaultTicketId(list)
  if (id) activate(id, { write: false })
})

/** Lien profond : ouvre le fil ; hors du périmètre affiché, bascule sur « Tous » pour le retrouver. */
async function openFromLink(id: string) {
  openError.value = null
  selectedId.value = id
  void ctx.load(id)
  await s.openTicket(id)
  if (s.selected.value?.id !== id) {
    openError.value = s.actionError.value ?? 'Ticket introuvable'
    selectedId.value = null
    return
  }
  if (!s.userId.value && scope.value !== 'all' && !filtered.value.some((t) => t.id === id)) scope.value = 'all'
}

// ---- Filtre ?userId= ----
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
  const q = { ...(route.query ?? {}) }
  delete q.userId
  void router.replace({ query: q })
}

// ---- Nouvelle conversation : filtre actif, elle vise cette personne ; sinon on la cherche ----
const startRecipient = computed(() => (s.userId.value ? { id: s.userId.value, name: filterName.value } : null))
function onStarted() {
  startOpen.value = false
  void s.fetchTickets()
}

// ---- Gestes ----
/** Le geste est tracé dans l'audit : l'historique du même ticket se relit. */
const reloadContext = () => { if (selectedId.value) void ctx.load(selectedId.value) }
async function onAssign(id: string) { await s.assign(id); reloadContext() }
async function onReassign(id: string, adminId: string) { await s.reassign(id, adminId); reloadContext() }
async function onSetPriority(id: string, priority: SupportPriority) { await s.setPriority(id, priority); reloadContext() }
async function onAddNote(id: string, content: string) {
  notesBusy.value = true
  notesError.value = null
  try {
    await supportService.addNote(id, content)
    await ctx.load(id)
  } catch (e) {
    notesError.value = extractProblemMessage(e, 'Note refusée')
  } finally {
    notesBusy.value = false
  }
}
async function onReply(id: string, content: string, keys: string[]) {
  if (await s.reply(id, content, keys)) drafts.clear(id)
  reloadContext()
}
/** Résolu, le ticket quitte « À répondre » : le suivant de la file s'ouvre. */
async function onResolve(id: string) {
  const ids = order.value.map((t) => t.id)
  const at = ids.indexOf(id)
  const nextId = ids[at + 1] ?? ids[at - 1] ?? null
  if (!(await s.resolve(id))) return
  const list = order.value
  const target = nextId && list.some((t) => t.id === nextId) ? nextId : defaultTicketId(list)
  if (target && target !== id) { activate(target); scrollTo(target) }
  else reloadContext()
}
const canManageTemplates = computed(() => tpl.loaded.value && !tpl.unavailable.value && auth.can('SUPPORT_TICKET_MANAGE'))
const draft = computed({
  get: () => (selectedId.value ? drafts.get(selectedId.value) : ''),
  set: (text: string) => { if (selectedId.value) drafts.set(selectedId.value, text) },
})

async function setScope(next: SupportTicketScope) { scope.value = next }
const chip = (on: boolean) => ['rounded-full px-3 py-1 text-sm transition-colors',
  on ? 'bg-primary text-white' : 'bg-surface-elevated text-text-muted hover:text-text']
const catChip = (on: boolean) => ['rounded-full border px-2.5 py-0.5 text-xs transition-colors',
  on ? 'border-primary font-medium text-primary' : 'border-border text-text-muted hover:text-text']

// ---- Raccourcis : J / K, 1 à 9 (réponse type), ⌘⏎ ----
useWorkbenchShortcuts({
  enabled: () => !startOpen.value && !templatesOpen.value,
  move: (step) => {
    const id = neighbourTicketId(order.value, selectedId.value, step)
    if (id) selectTicket(id)
  },
  pick: (n) => conversation.value?.quick(n),
  confirm: () => conversation.value?.submit(),
})

onMounted(async () => {
  void tpl.load()
  const uid = queryValue('userId')
  if (uid) await applyUserFilter(uid)
  else await s.fetchTickets()
  ready = true
  const id = queryValue('ticket')
  if (id) await openFromLink(id)
  else {
    const first = defaultTicketId(order.value)
    if (first) activate(first, { write: false })
  }
})
watch(() => queryValue('userId'), (id) => {
  if (id !== s.userId.value) void applyUserFilter(id)
})
// Page déjà ouverte : un clic sur une notification change seulement la query.
watch(() => queryValue('ticket'), (id) => {
  if (id === lastWritten) return
  if (id && id !== selectedId.value) void openFromLink(id)
})
</script>

<template>
  <div data-test="support-workbench">
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

    <!-- Synthèse -->
    <section aria-label="Synthèse" class="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4" data-test="support-summary">
      <div class="rounded-card border border-border bg-surface p-3">
        <span class="block text-xs font-semibold uppercase tracking-wide text-text-muted">À répondre</span>
        <span class="flex items-baseline gap-2">
          <span class="font-display text-3xl font-bold tabular-nums" data-test="summary-to-answer">{{ summary.toAnswer }}</span>
          <span class="text-xs text-text-muted">nouveaux et en attente du support</span>
        </span>
      </div>
      <div class="rounded-card border border-border bg-surface p-3">
        <span class="block text-xs font-semibold uppercase tracking-wide text-warning">Non assignés</span>
        <span class="flex items-baseline gap-2">
          <span class="font-display text-3xl font-bold tabular-nums" data-test="summary-unassigned">{{ summary.unassigned }}</span>
          <span class="text-xs text-text-muted">personne ne les a pris</span>
        </span>
      </div>
      <div class="rounded-card border border-border bg-surface p-3">
        <span class="block text-xs font-semibold uppercase tracking-wide text-danger">Plus ancien en attente</span>
        <span v-if="summary.oldest" class="flex items-baseline gap-2">
          <span class="font-display text-3xl font-bold tabular-nums" data-test="summary-oldest">{{ summary.oldest.label }}</span>
          <span class="min-w-0 truncate text-xs text-text-muted">{{ summary.oldest.subject }}</span>
        </span>
        <span v-else class="font-display text-3xl font-bold" data-test="summary-oldest">—</span>
      </div>
      <div class="rounded-card border border-border bg-surface p-3">
        <span class="block text-xs font-semibold uppercase tracking-wide text-success">Résolus cette semaine</span>
        <span class="font-display text-3xl font-bold tabular-nums" data-test="summary-resolved">{{ summary.resolvedThisWeek }}</span>
      </div>
    </section>

    <p
      v-if="openError" data-test="support-open-error" role="status"
      class="mb-3 rounded-btn border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning text-pretty"
    >{{ openError }}</p>

    <!-- Trois colonnes à toute largeur, comme Alertes et Incidents -->
    <div class="overflow-x-auto">
      <div class="grid min-w-[840px] grid-cols-[minmax(280px,1fr)_minmax(340px,1.9fr)_minmax(260px,0.95fr)] items-start gap-4">
        <!-- 1. File -->
        <section
          aria-label="File des tickets" data-test="support-queue-panel"
          class="flex max-h-[calc(100vh-18rem)] min-h-[24rem] flex-col overflow-hidden rounded-card border border-border bg-surface"
        >
          <div class="flex flex-col gap-2 border-b border-border p-3">
            <div class="flex items-center justify-between gap-2">
              <div v-if="!s.userId.value" data-test="support-scopes" class="flex flex-wrap gap-1">
                <button
                  v-for="sc in SCOPES" :key="sc.key" type="button" :data-test="`scope-${sc.key}`"
                  :aria-pressed="scope === sc.key ? 'true' : 'false'" :class="chip(scope === sc.key)"
                  @click="setScope(sc.key)"
                >{{ sc.label }} <span class="tabular-nums opacity-80">{{ counts[sc.key] }}</span></button>
              </div>
              <span v-else />
              <button
                v-if="auth.can('SUPPORT_TICKET_MANAGE')" type="button" data-test="support-new-conversation"
                class="shrink-0 rounded-btn bg-primary px-3 py-1.5 text-sm font-medium text-white transition-[background-color,scale] hover:bg-primary/90 active:scale-[0.96]"
                @click="startOpen = true"
              >Nouvelle conversation</button>
            </div>
            <input
              v-model="query" type="search" data-test="support-search" aria-label="Rechercher un ticket"
              placeholder="Rechercher : nom, sujet, catégorie…"
              class="w-full rounded-btn border border-border bg-bg px-3 py-1.5 text-sm"
            >
            <div class="flex flex-wrap gap-1" data-test="support-filters">
              <button
                type="button" data-test="filter-high" :aria-pressed="highOnly ? 'true' : 'false'"
                :class="catChip(highOnly)" @click="highOnly = !highOnly"
              >Priorité haute</button>
              <template v-if="categories.length > 1">
                <button
                  v-for="c in categories" :key="c" type="button" :data-test="`category-${c}`"
                  :aria-pressed="category === c ? 'true' : 'false'" :class="catChip(category === c)"
                  @click="category = category === c ? null : c"
                >{{ categoryLabel(c) }}</button>
              </template>
            </div>
          </div>

          <SupportQueue
            class="min-h-0 flex-1 overflow-hidden"
            :groups="groups" :loading="s.isLoading.value" :error="s.error.value" :selected-id="selectedId" :my-id="myId" :now="now"
            @select="selectTicket" @retry="s.fetchTickets"
          />

          <div class="flex flex-col gap-2 border-t border-border bg-bg/50 p-3">
            <p v-if="s.truncated.value" data-test="support-truncated" class="text-xs text-text-muted text-pretty">Affichage limité aux 100 conversations les plus récentes : la recherche porte sur celles-ci.</p>
            <p class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
              <span class="inline-flex items-center gap-1"><KeyHint>J</KeyHint><KeyHint>K</KeyHint> naviguer</span>
              <span class="inline-flex items-center gap-1"><KeyHint>1</KeyHint>–<KeyHint>5</KeyHint> réponse type</span>
            </p>
          </div>
        </section>

        <!-- 2. Conversation -->
        <SupportConversation
          ref="conversation" v-model:draft="draft"
          :ticket="current" :loading="s.isDetailLoading.value" :acting="s.isActing.value" :now="now"
          :quick-replies="tpl.options.value" :can-manage-templates="canManageTemplates"
          @assign="onAssign" @reply="onReply" @manage-templates="templatesOpen = true"
        />

        <!-- 3. Contexte et actions -->
        <SupportContextPanel
          :ticket="current" :user="userCtx.context.value" :related="related" :context="ctx.context.value" :acting="s.isActing.value"
          :action-error="s.actionError.value" :notes-busy="notesBusy" :notes-error="notesError"
          @assign="onAssign" @reassign="onReassign" @resolve="onResolve" @open-ticket="selectTicket"
          @set-priority="onSetPriority" @add-note="onAddNote"
        />
      </div>
    </div>

    <SupportTemplatesDialog
      :open="templatesOpen" :templates="tpl.templates.value" :busy="tpl.busy.value" :error="tpl.error.value"
      @close="templatesOpen = false" @create="tpl.create" @update="tpl.update" @remove="tpl.remove"
    />
    <StartSupportConversationDialog
      :open="startOpen" :recipient="startRecipient"
      @close="startOpen = false" @sent="onStarted"
    />
  </div>
</template>
