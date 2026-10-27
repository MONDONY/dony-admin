<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import ReportTimeline from '@/features/signalements/components/ReportTimeline.vue'
import { conversationTimeline, isMessageDeleted, reportAge, type QueueConversation } from '@/features/moderation/lib/moderationWorkbench'
import type { AdminMessage, ConversationContext } from '@/features/moderation/types/index'
import { NOTE_MAX, noteError } from '@/features/support/lib/supportWorkbench'
import { reportReasonLabel } from '@/features/signalements/reportReasons'
import type { ReportContext } from '@/features/signalements/types/index'
import { gate, reportRoute, toHref, userRoute } from '@/lib/adminLinks'
import { serverDateIso } from '@/lib/serverDate'
import { useAuthStore } from '@/stores/auth'

/**
 * Colonne de décision : les signalements ouverts sur la conversation (le traitement et les sanctions de
 * l'auteur se font dans Signalements), le message visé avec son geste, les deux personnes, les notes
 * internes et l'historique de modération. Tout est facultatif : le contexte du signalement (droit, panne) et
 * celui de la conversation (ancien back) manquent sans que le panneau perde les signalements et les noms
 * de la file.
 */
const props = withDefaults(defineProps<{
  conversation: QueueConversation | null
  /** Contexte du premier signalement ouvert ; null tant qu'il charge ou s'il est indisponible. */
  context?: ReportContext | null
  /** Historique et notes de la conversation ; null tant que ça charge ou sur un ancien back (notes et historique masqués). */
  conversationContext?: ConversationContext | null
  /** Le message que le signalement désigne, s'il est dans le fil chargé. */
  flaggedMessage?: AdminMessage | null
  notesBusy?: boolean
  notesError?: string | null
  now?: number
}>(), { context: null, conversationContext: null, flaggedMessage: null, notesBusy: false, notesError: null, now: undefined })
const emit = defineEmits<{ delete: [id: string]; addNote: [content: string] }>()

const auth = useAuthStore()
const reports = computed(() => props.conversation?.reports ?? [])
const openCount = computed(() => props.conversation?.openReportCount ?? 0)
const reportHref = (id: string) => {
  const route = gate(auth.can, 'REPORT_VIEW', reportRoute(id))
  return route ? toHref(route) : null
}
const reportsHref = computed(() => (auth.can('REPORT_VIEW') ? '/signalements' : null))
const userHref = (id: string | null | undefined) => {
  const route = gate(auth.can, 'USER_VIEW', userRoute(id))
  return route ? toHref(route) : null
}
const canDelete = computed(() => auth.can('MESSAGE_DELETE'))
const quote = computed(() => {
  const body = props.flaggedMessage?.content?.trim() ?? ''
  return body.length > 140 ? `${body.slice(0, 139)}…` : body
})

const STATUS: Record<string, string> = { SUSPENDED: 'Suspendu', BANNED: 'Banni', PENDING_DELETION: 'Suppression demandée' }
interface Person { key: string; role: string | null; name: string; href: string | null; note: string | null; status: string | null }

/** Autre(s) signalement(s) ouvert(s) sur la personne visée, hors celui de cette conversation. */
function othersLabel(openReportsReceived: number): string | null {
  if (openReportsReceived <= 1) return null
  const n = openReportsReceived - 1
  return `${n} autre${n > 1 ? 's' : ''} signalement${n > 1 ? 's' : ''} ouvert${n > 1 ? 's' : ''}`
}

/**
 * Les deux participants, avec leur fiche : les comptes viennent de la liste (nouveau back). Le contexte du
 * signalement dit qui signale et qui est visé. Sans les comptes (ancien back), on retombe sur les deux
 * personnes du contexte du signalement.
 */
const people = computed<Person[]>(() => {
  const conv = props.conversation
  const c = props.context
  if (conv && !conv.partial && (conv.participantAId || conv.participantBId)) {
    return ([['a', conv.participantAId, conv.participantA], ['b', conv.participantBId, conv.participantB]] as const)
      .filter(([, id, name]) => !!id || !!name)
      .map(([key, id, name]) => {
        const isReporter = !!id && c?.reporter?.userId === id
        const isSubject = !!id && c?.subject?.userId === id
        return {
          key, name: name ?? 'Nom inconnu', href: userHref(id),
          role: isReporter ? 'signale' : isSubject ? 'auteur du message' : null,
          note: isSubject && c?.subject ? othersLabel(c.subject.openReportsReceived) : null,
          status: isSubject && c?.subject ? (STATUS[c.subject.accountStatus ?? ''] ?? null) : null,
        }
      })
  }
  const out: Person[] = []
  if (c?.reporter) out.push({ key: 'reporter', role: 'signale', name: c.reporter.displayName ?? 'Nom inconnu', href: userHref(c.reporter.userId), note: null, status: null })
  if (c?.subject) {
    out.push({
      key: 'subject', role: 'auteur du message', name: c.subject.displayName ?? 'Nom inconnu', href: userHref(c.subject.userId),
      note: othersLabel(c.subject.openReportsReceived), status: STATUS[c.subject.accountStatus ?? ''] ?? null,
    })
  }
  return out
})

// ---- Notes internes ----
const note = ref('')
const notes = computed(() => props.conversationContext?.notes ?? [])
const noteProblem = computed(() => (note.value.trim() ? noteError(note.value) : null))
const canAddNote = computed(() => canDelete.value && !props.notesBusy && !!note.value.trim() && !noteError(note.value))
// Une note enregistrée vide la zone ; refusée, elle reste pour être corrigée.
watch(() => props.notesBusy, (busy, was) => { if (was && !busy && !props.notesError) note.value = '' })
watch(() => props.conversation?.id, () => { note.value = '' })
function addNote() {
  if (canAddNote.value) emit('addNote', note.value.trim())
}
const dateOf = (iso: string) => new Date(serverDateIso(iso)).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })

const timeline = computed(() => conversationTimeline(props.conversationContext?.history))
</script>

<template>
  <aside aria-label="Décision" class="flex flex-col gap-3" data-test="moderation-decision">
    <template v-if="conversation">
      <section v-if="openCount > 0" class="rounded-card border border-border bg-surface p-4" data-test="decision-reports">
        <h3 class="text-xs font-semibold uppercase tracking-wide text-text-muted">{{ openCount > 1 ? 'Signalements liés' : 'Signalement lié' }}</h3>
        <ul v-if="reports.length" class="mt-2 flex flex-col gap-2">
          <li v-for="r in reports" :key="r.id" :data-test="`decision-report-${r.id}`" class="text-sm">
            <p class="font-semibold">{{ reportReasonLabel(r.reason) }}<span v-if="r.reporterName" class="font-normal text-text-muted"> · par {{ r.reporterName }}</span></p>
            <p v-if="reportAge(r.createdAt, now)" class="text-xs text-text-muted tabular-nums">Ouvert depuis {{ reportAge(r.createdAt, now)!.label }}</p>
            <a
              v-if="reportHref(r.id)" :href="reportHref(r.id)!" :data-test="`decision-report-link-${r.id}`"
              class="mt-1 inline-block text-sm font-semibold text-primary hover:underline"
            >Traiter dans Signalements ›</a>
          </li>
        </ul>
        <div v-else class="mt-2 text-sm" data-test="decision-reports-count">
          <p class="font-semibold">{{ openCount }} signalement{{ openCount > 1 ? 's' : '' }} ouvert{{ openCount > 1 ? 's' : '' }}</p>
          <a v-if="reportsHref" :href="reportsHref" class="mt-1 inline-block text-sm font-semibold text-primary hover:underline" data-test="decision-reports-link">Traiter dans Signalements ›</a>
        </div>
        <p class="mt-2 text-xs text-text-muted text-pretty">Avertir ou suspendre l’auteur se fait depuis le signalement.</p>
      </section>
      <section v-else class="rounded-card border border-border bg-surface p-4" data-test="decision-no-report">
        <h3 class="text-xs font-semibold uppercase tracking-wide text-text-muted">Signalement lié</h3>
        <p class="mt-2 text-sm text-text-muted text-pretty">Aucun signalement ouvert sur cette conversation. Un message peut tout de même être supprimé depuis le fil.</p>
      </section>

      <section v-if="openCount > 0 && flaggedMessage" class="rounded-card border border-border bg-surface p-4" data-test="decision-flagged">
        <h3 class="text-xs font-semibold uppercase tracking-wide text-text-muted">Message signalé</h3>
        <p v-if="quote && !isMessageDeleted(flaggedMessage)" class="mt-2 text-sm text-text-muted text-pretty" data-test="decision-flagged-quote">« {{ quote }} »</p>
        <p v-if="isMessageDeleted(flaggedMessage)" class="mt-2 text-sm text-success" data-test="decision-flagged-deleted">Ce message est déjà supprimé.</p>
        <button
          v-else-if="canDelete" type="button" data-test="decision-delete"
          class="mt-3 flex w-full items-center justify-between gap-2 rounded-btn border border-danger/40 bg-danger/5 px-3 py-2.5 text-left text-sm font-semibold text-danger transition-[background-color,scale] hover:bg-danger/10 active:scale-[0.98]"
          @click="emit('delete', flaggedMessage.id)"
        >
          <span>Supprimer le message<span class="block text-xs font-normal text-text-muted">Masqué des deux participants, motif demandé</span></span>
          <span aria-hidden="true">›</span>
        </button>
      </section>

      <section class="rounded-card border border-border bg-surface p-4" data-test="decision-people">
        <h3 class="text-xs font-semibold uppercase tracking-wide text-text-muted">Participants</h3>
        <ul v-if="people.length" class="mt-2 flex flex-col divide-y divide-border text-sm">
          <li v-for="p in people" :key="p.key" :data-test="`decision-person-${p.key}`" class="flex items-start justify-between gap-2 py-2 first:pt-0 last:pb-0">
            <span class="min-w-0">
              <span class="font-semibold">{{ p.name }}</span><span v-if="p.role" class="text-text-muted"> · {{ p.role }}</span>
              <StatusBadge v-if="p.status" class="ml-1" :label="p.status" tone="warning" />
              <span v-if="p.note" class="block text-xs text-text-muted">{{ p.note }}</span>
            </span>
            <a v-if="p.href" :href="p.href" :data-test="`decision-person-link-${p.key}`" class="shrink-0 text-sm font-semibold text-primary hover:underline">Fiche</a>
          </li>
        </ul>
        <p v-else class="mt-2 text-sm text-text-muted" data-test="decision-names">
          {{ conversation.participantA ?? '—' }}<template v-if="!conversation.partial"> et {{ conversation.participantB ?? '—' }}</template>
        </p>
      </section>

      <section v-if="conversationContext" class="rounded-card border border-border bg-surface p-4" data-test="decision-notes">
        <h3 class="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">Notes internes</h3>
        <p class="mb-2 text-xs text-text-muted text-pretty">Vues des seuls administrateurs, jamais des participants.</p>
        <ul v-if="notes.length" class="mb-3 flex flex-col gap-2">
          <li v-for="n in notes" :key="n.id" class="rounded-btn bg-surface-elevated px-3 py-2 text-sm" :data-test="`decision-note-${n.id}`">
            <p class="whitespace-pre-wrap text-pretty">{{ n.content }}</p>
            <p class="mt-1 text-xs text-text-muted tabular-nums">{{ n.adminEmail ?? 'Ancien compte' }} · {{ dateOf(n.createdAt) }}</p>
          </li>
        </ul>
        <p v-else class="mb-3 text-sm text-text-muted" data-test="decision-notes-empty">Aucune note.</p>
        <template v-if="canDelete">
          <label for="moderation-note" class="sr-only">Nouvelle note interne</label>
          <textarea
            id="moderation-note" v-model="note" data-test="decision-note-input" rows="2" :maxlength="NOTE_MAX" :disabled="notesBusy"
            placeholder="Ce qu'il faut savoir sur cette conversation…" class="w-full rounded-btn border border-border bg-bg p-2 text-sm"
          />
          <p v-if="noteProblem" data-test="decision-note-problem" class="mt-1 text-xs text-warning">{{ noteProblem }}</p>
          <p v-if="notesError" data-test="decision-note-error" role="alert" class="mt-1 text-xs text-danger text-pretty">{{ notesError }}</p>
          <button
            type="button" data-test="decision-note-add" :disabled="!canAddNote"
            class="mt-2 rounded-btn border border-border px-3 py-1.5 text-sm font-medium transition-[background-color,scale] hover:bg-surface-elevated active:scale-[0.97] disabled:opacity-40"
            @click="addNote"
          >Ajouter la note</button>
        </template>
      </section>

      <section v-if="conversationContext" class="rounded-card border border-border bg-surface p-4" data-test="decision-history">
        <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Historique</h3>
        <ReportTimeline v-if="timeline.length" :items="timeline" />
        <p v-else class="text-sm text-text-muted" data-test="decision-history-empty">Aucune action de modération.</p>
      </section>
    </template>
  </aside>
</template>
