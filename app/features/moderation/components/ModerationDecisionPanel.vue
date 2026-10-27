<script setup lang="ts">
import { computed } from 'vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { isMessageDeleted, reportAge, type QueueConversation } from '@/features/moderation/lib/moderationWorkbench'
import type { AdminMessage } from '@/features/moderation/types/index'
import { reportReasonLabel } from '@/features/signalements/reportReasons'
import type { ReportContext } from '@/features/signalements/types/index'
import { gate, reportRoute, toHref, userRoute } from '@/lib/adminLinks'
import { useAuthStore } from '@/stores/auth'

/**
 * Colonne de décision : les signalements ouverts sur la conversation (le traitement et les sanctions de
 * l'auteur se font dans Signalements), le message visé avec son geste, et les deux personnes. Le
 * contexte du signalement est facultatif : sans lui (droit, ancien back, panne) le panneau garde les
 * signalements et les noms de la file.
 */
const props = withDefaults(defineProps<{
  conversation: QueueConversation | null
  /** Contexte du premier signalement ouvert ; null tant qu'il charge ou s'il est indisponible. */
  context?: ReportContext | null
  /** Le message que le signalement désigne, s'il est dans le fil chargé. */
  flaggedMessage?: AdminMessage | null
  now?: number
}>(), { context: null, flaggedMessage: null, now: undefined })
const emit = defineEmits<{ delete: [id: string] }>()

const auth = useAuthStore()
const reports = computed(() => props.conversation?.reports ?? [])
const reportHref = (id: string) => {
  const route = gate(auth.can, 'REPORT_VIEW', reportRoute(id))
  return route ? toHref(route) : null
}
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
const people = computed(() => {
  const c = props.context
  const out: { key: string; role: string; name: string; href: string | null; note: string | null; status: string | null }[] = []
  if (c?.reporter) out.push({ key: 'reporter', role: 'Signale', name: c.reporter.displayName ?? 'Nom inconnu', href: userHref(c.reporter.userId), note: null, status: null })
  if (c?.subject) {
    const others = c.subject.openReportsReceived > 1 ? `${c.subject.openReportsReceived - 1} autre${c.subject.openReportsReceived > 2 ? 's' : ''} signalement${c.subject.openReportsReceived > 2 ? 's' : ''} ouvert${c.subject.openReportsReceived > 2 ? 's' : ''}` : null
    out.push({ key: 'subject', role: 'Auteur du message', name: c.subject.displayName ?? 'Nom inconnu', href: userHref(c.subject.userId), note: others, status: STATUS[c.subject.accountStatus ?? ''] ?? null })
  }
  return out
})
</script>

<template>
  <aside aria-label="Décision" class="flex flex-col gap-3" data-test="moderation-decision">
    <template v-if="conversation">
      <section v-if="reports.length" class="rounded-card border border-border bg-surface p-4" data-test="decision-reports">
        <h3 class="text-xs font-semibold uppercase tracking-wide text-text-muted">{{ reports.length > 1 ? 'Signalements liés' : 'Signalement lié' }}</h3>
        <ul class="mt-2 flex flex-col gap-2">
          <li v-for="r in reports" :key="r.id" :data-test="`decision-report-${r.id}`" class="text-sm">
            <p class="font-semibold">{{ reportReasonLabel(r.reason) }}<span v-if="r.reporterName" class="font-normal text-text-muted"> · par {{ r.reporterName }}</span></p>
            <p v-if="reportAge(r.createdAt, now)" class="text-xs text-text-muted tabular-nums">Ouvert depuis {{ reportAge(r.createdAt, now)!.label }}</p>
            <a
              v-if="reportHref(r.id)" :href="reportHref(r.id)!" :data-test="`decision-report-link-${r.id}`"
              class="mt-1 inline-block text-sm font-semibold text-primary hover:underline"
            >Traiter dans Signalements ›</a>
          </li>
        </ul>
        <p class="mt-2 text-xs text-text-muted text-pretty">Avertir ou suspendre l’auteur se fait depuis le signalement.</p>
      </section>
      <section v-else class="rounded-card border border-border bg-surface p-4" data-test="decision-no-report">
        <h3 class="text-xs font-semibold uppercase tracking-wide text-text-muted">Signalement lié</h3>
        <p class="mt-2 text-sm text-text-muted text-pretty">Aucun signalement ouvert sur cette conversation. Un message peut tout de même être supprimé depuis le fil.</p>
      </section>

      <section v-if="reports.length && flaggedMessage" class="rounded-card border border-border bg-surface p-4" data-test="decision-flagged">
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
              <span class="font-semibold">{{ p.name }}</span><span class="text-text-muted"> · {{ p.role }}</span>
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
    </template>
  </aside>
</template>
