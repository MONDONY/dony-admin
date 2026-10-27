<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import KeyHint from '@/components/ui/KeyHint.vue'
import ConfirmActionDialog from '@/components/ui/ConfirmActionDialog.vue'
import RestoreReasonDialog from '@/components/ui/RestoreReasonDialog.vue'
import ModerationQueue from './ModerationQueue.vue'
import ModerationThread from './ModerationThread.vue'
import ModerationDecisionPanel from './ModerationDecisionPanel.vue'
import { useModerationQueue } from '@/features/moderation/composables/useModerationQueue'
import { useConversationThread } from '@/features/moderation/composables/useConversationThread'
import { useModerationReportContext } from '@/features/moderation/composables/useModerationReportContext'
import { useWorkbenchShortcuts } from '@/features/signalements/composables/useWorkbenchShortcuts'
import {
  defaultConversationId, filterQueue, flaggedMessageId, groupQueue, neighbourConversationId, queueOrder, scopeCounts,
  summarizeQueue, type ConversationScope, type QueueConversation,
} from '@/features/moderation/lib/moderationWorkbench'
import { firestoreIdParam } from '@/lib/safeInput'
import { useAuthStore } from '@/stores/auth'

/**
 * Poste de modération : la file (conversations signalées d'abord) à gauche, la conversation au centre,
 * la décision à droite. La conversation ouverte vit dans l'URL (`?open=<id Firestore>`, lien « Voir la
 * conversation » des fiches colis). Les signalements ouverts viennent de `/admin/reports` : la file reste
 * utilisable sans eux.
 */
const q = useModerationQueue()
const thread = useConversationThread()
const rctx = useModerationReportContext()
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const scope = ref<ConversationScope>('reported')
const query = ref('')
const selectedId = ref<string | null>(null)
/** Conversation ouverte par lien alors qu'elle n'est pas dans la page chargée : elle reste affichée. */
const pinned = ref<QueueConversation | null>(null)
const now = ref(Date.now())
let ready = false

const SCOPES: { key: ConversationScope; label: string }[] = [
  { key: 'reported', label: 'Signalées' },
  { key: 'all', label: 'Toutes' },
]

// ---- File ----
const filtered = computed(() => filterQueue(q.items.value, { scope: scope.value, query: query.value }))
const groups = computed(() => groupQueue(filtered.value))
const order = computed(() => queueOrder(groups.value))
const counts = computed(() => scopeCounts(q.items.value))
const summary = computed(() => summarizeQueue(q.items.value, now.value))
const current = computed<QueueConversation | null>(() => {
  const found = q.items.value.find((c) => c.id === selectedId.value)
  if (found) return found
  return pinned.value && pinned.value.id === selectedId.value ? pinned.value : null
})
const flaggedId = computed(() => flaggedMessageId(rctx.context.value?.messages))
const flaggedMessage = computed(() => thread.messages.value.find((m) => m.id === flaggedId.value) ?? null)

// ---- URL ----
const queryValue = (name: string) => {
  const v = route.query?.[name]
  return typeof v === 'string' && v ? v : null
}
/** Dernière valeur de `open` écrite par l'écran : son écho ne doit pas rouvrir la conversation. */
let lastWritten: string | null = null
function writeOpenParam(id: string | null) {
  if (id === queryValue('open')) return
  lastWritten = id
  const next: Record<string, string> = {}
  for (const [k, v] of Object.entries(route.query ?? {})) if (k !== 'open' && typeof v === 'string') next[k] = v
  if (id) next.open = id
  void router.replace({ query: next })
}

// ---- Sélection ----
function scrollTo(id: string) {
  void nextTick(() => document.querySelector(`[data-test="conv-row-${CSS.escape(id)}"]`)?.scrollIntoView?.({ block: 'nearest' }))
}
/** Ouvre une conversation : sa ligne est choisie tout de suite, son fil et le contexte de son signalement se lisent ensuite. */
function activate(id: string, { write = true }: { write?: boolean } = {}) {
  selectedId.value = id
  void thread.open(id)
  const firstReport = q.items.value.find((c) => c.id === id)?.reports[0]?.id ?? null
  void rctx.load(firstReport && auth.can('REPORT_VIEW') ? firstReport : null)
  if (write) writeOpenParam(id)
}
function selectConversation(id: string) {
  if (id === selectedId.value) return
  activate(id)
  scrollTo(id)
}
// Une conversation est toujours ouverte quand la file en contient une ; un lien hors file reste.
watch(order, (list) => {
  if (!ready || q.isLoading.value) return
  if (selectedId.value && (pinned.value?.id === selectedId.value || list.some((c) => c.id === selectedId.value))) return
  const id = defaultConversationId(list)
  if (id) activate(id, { write: false })
})

/** Lien profond : ouvre la conversation ; hors de la file affichée, bascule sur « Toutes » ou l'ajoute telle quelle. */
function openFromLink(raw: string | null) {
  const id = firestoreIdParam(raw)
  if (!id) return
  const known = q.items.value.find((c) => c.id === id)
  if (!known) {
    pinned.value = { id, participantA: null, participantB: null, lastMessageAt: null, createdAt: null, closedAt: null, reports: [], partial: true }
  } else if (known.reports.length === 0) scope.value = 'all'
  activate(id, { write: false })
  scrollTo(id)
}

// ---- Gestes : supprimer, annuler la suppression ----
const pendingDeleteId = ref<string | null>(null)
async function confirmDelete(reason: string) {
  const id = pendingDeleteId.value
  pendingDeleteId.value = null
  if (id) await thread.deleteMessage(id, reason)
}
const pendingRestoreId = ref<string | null>(null)
const restoreBusy = ref(false)
async function confirmRestore(reason: string) {
  if (!pendingRestoreId.value) return
  restoreBusy.value = true
  await thread.restoreMessage(pendingRestoreId.value, reason)
  restoreBusy.value = false
  // Motif refusé (422) : le dialogue reste ouvert, saisie conservée.
  if (thread.restoreReasonError.value) return
  pendingRestoreId.value = null
}

const chip = (on: boolean) => ['rounded-full px-3 py-1 text-sm transition-colors',
  on ? 'bg-primary text-white' : 'bg-surface-elevated text-text-muted hover:text-text']

// ---- Raccourcis : J / K ----
useWorkbenchShortcuts({
  enabled: () => pendingDeleteId.value === null && pendingRestoreId.value === null,
  move: (step) => {
    const id = neighbourConversationId(order.value, selectedId.value, step)
    if (id) selectConversation(id)
  },
  pick: () => {},
  confirm: () => {},
})

onMounted(async () => {
  await q.fetchQueue()
  ready = true
  // Un lien dont l'identifiant n'est pas valide est ignoré : la file s'ouvre comme sans lien.
  const link = firestoreIdParam(queryValue('open'))
  // Sans signalement ouvert, la file « Signalées » est vide : on montre toute l'activité.
  if (!link && counts.value.reported === 0) scope.value = 'all'
  if (link) {
    openFromLink(link)
    return
  }
  const first = defaultConversationId(order.value)
  if (first) activate(first, { write: false })
})
// Page déjà ouverte : un clic sur « Voir la conversation » change seulement la query.
watch(() => queryValue('open'), (id) => {
  if (id === lastWritten) return
  if (id && id !== selectedId.value) openFromLink(id)
})
</script>

<template>
  <div data-test="moderation-workbench">
    <!-- Synthèse -->
    <section aria-label="Synthèse" class="mb-4 grid grid-cols-2 gap-3" data-test="moderation-summary">
      <div class="rounded-card border border-border bg-surface p-3">
        <span class="block text-xs font-semibold uppercase tracking-wide text-danger">Signalements ouverts</span>
        <span class="flex items-baseline gap-2">
          <span class="font-display text-3xl font-bold tabular-nums" data-test="summary-open">{{ summary.openReports }}</span>
          <span class="text-xs text-text-muted">sur {{ summary.reportedConversations }} conversation{{ summary.reportedConversations > 1 ? 's' : '' }}</span>
        </span>
      </div>
      <div class="rounded-card border border-border bg-surface p-3">
        <span class="block text-xs font-semibold uppercase tracking-wide text-text-muted">Plus ancien signalement</span>
        <span v-if="summary.oldest" class="flex items-baseline gap-2">
          <span class="font-display text-3xl font-bold tabular-nums" data-test="summary-oldest">{{ summary.oldest.label }}</span>
          <span class="min-w-0 truncate text-xs text-text-muted">{{ summary.oldest.participants }}</span>
        </span>
        <span v-else class="font-display text-3xl font-bold" data-test="summary-oldest">—</span>
      </div>
    </section>

    <p
      v-if="q.reportsUnavailable.value" data-test="moderation-reports-unavailable" role="status"
      class="mb-3 rounded-btn border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning text-pretty"
    >Les signalements ne se sont pas chargés : la file n’indique pas les conversations signalées.</p>

    <div class="overflow-x-auto">
      <div class="grid min-w-[840px] grid-cols-[minmax(280px,1fr)_minmax(340px,1.9fr)_minmax(260px,0.95fr)] items-start gap-4">
        <!-- 1. File -->
        <section
          aria-label="File des conversations" data-test="moderation-queue-panel"
          class="flex max-h-[calc(100vh-18rem)] min-h-[24rem] flex-col overflow-hidden rounded-card border border-border bg-surface"
        >
          <div class="flex flex-col gap-2 border-b border-border p-3">
            <div data-test="moderation-scopes" class="flex flex-wrap gap-1">
              <button
                v-for="sc in SCOPES" :key="sc.key" type="button" :data-test="`scope-${sc.key}`"
                :aria-pressed="scope === sc.key ? 'true' : 'false'" :class="chip(scope === sc.key)"
                @click="scope = sc.key"
              >{{ sc.label }} <span class="tabular-nums opacity-80">{{ counts[sc.key] }}</span></button>
            </div>
            <input
              v-model="query" type="search" data-test="moderation-search" aria-label="Rechercher une conversation"
              placeholder="Nom d’un participant…"
              class="w-full rounded-btn border border-border bg-bg px-3 py-1.5 text-sm"
            >
          </div>

          <ModerationQueue
            class="min-h-0 flex-1 overflow-hidden"
            :groups="groups" :loading="q.isLoading.value" :error="q.error.value" :selected-id="selectedId" :now="now"
            @select="selectConversation" @retry="q.fetchQueue"
          />

          <div class="flex flex-col gap-2 border-t border-border bg-bg/50 p-3">
            <p v-if="q.truncated.value" data-test="moderation-truncated" class="text-xs text-text-muted text-pretty">Affichage limité aux 100 conversations les plus récentes : la recherche porte sur celles-ci.</p>
            <p class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
              <span class="inline-flex items-center gap-1"><KeyHint>J</KeyHint><KeyHint>K</KeyHint> naviguer</span>
            </p>
          </div>
        </section>

        <!-- 2. Conversation -->
        <div class="flex min-w-0 flex-col gap-2">
          <p
            v-if="thread.deleteError.value" data-test="thread-delete-error" role="alert"
            class="rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger text-pretty"
          >{{ thread.deleteError.value }}</p>
          <p
            v-if="thread.restoreError.value" data-test="thread-restore-error" role="alert"
            class="rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger text-pretty"
          >{{ thread.restoreError.value }}</p>
          <ModerationThread
            :conversation="current" :messages="thread.messages.value" :loading="thread.isLoading.value" :error="thread.error.value"
            :flagged-id="flaggedId" :restore-unavailable-ids="thread.restoreUnavailableIds.value" :now="now"
            @delete="(id) => pendingDeleteId = id" @restore="(id) => pendingRestoreId = id"
            @reload="thread.load" @retry="thread.load"
          />
        </div>

        <!-- 3. Décision -->
        <ModerationDecisionPanel
          :conversation="current" :context="rctx.context.value" :flagged-message="flaggedMessage" :now="now"
          @delete="(id) => pendingDeleteId = id"
        />
      </div>
    </div>

    <ConfirmActionDialog
      :open="pendingDeleteId !== null"
      title="Supprimer le message"
      message="Le message sera masqué des deux participants. Il reste lisible pour l’équipe et peut être restauré."
      confirm-label="Supprimer"
      :require-reason="true"
      @confirm="confirmDelete"
      @cancel="pendingDeleteId = null"
    />

    <RestoreReasonDialog
      :open="pendingRestoreId !== null"
      title="Annuler la suppression"
      message="Le message redevient visible pour les deux participants de la conversation."
      confirm-label="Rétablir le message"
      :busy="restoreBusy" :error="thread.restoreReasonError.value"
      @confirm="confirmRestore"
      @cancel="pendingRestoreId = null; thread.restoreReasonError.value = null"
    />
  </div>
</template>
