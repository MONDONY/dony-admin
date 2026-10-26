<script setup lang="ts">
import { computed } from 'vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import ReportRatingPreview from './ReportRatingPreview.vue'
import ReportContextMessages from './ReportContextMessages.vue'
import ReportTimeline from './ReportTimeline.vue'
import { reportStatusMeta } from './reportStatus'
import { reportDescriptionText, reportKind, reportKindLabel } from '@/features/signalements/reportKind'
import { reportActionTakenLabel, reportTargetTypeLabel } from '@/features/signalements/reportActionLabels'
import { reportReasonTitle, reportTargetLabel } from '@/features/signalements/reportDisplay'
import { canReplyToReport, hasSupportConversation, supportConversationLink } from '@/features/signalements/reportReply'
import {
  accountStatusMeta,
  buildTimeline,
  memberSinceLabel,
  receivedReportsText,
  reporterHistoryText,
  reporterTrust,
} from '@/features/signalements/reportContext'
import { reportReasonLabel } from '@/features/signalements/reportReasons'
import type { AdminReport, ReportContext } from '@/features/signalements/types/index'
import { useAuthStore } from '@/stores/auth'
import { gate, toHref, unchecked, userRoute } from '@/lib/adminLinks'

const props = withDefaults(defineProps<{
  report: AdminReport | null
  /** Endpoints de restauration absents (ancien back) : le bouton Restaurer disparaît. */
  restoreUnavailable?: boolean
  /** Contexte du dossier (fiches, message, historique) ; null tant qu'il charge ou sur un ancien back. */
  context?: ReportContext | null
  contextLoading?: boolean
  /** Échec inattendu de la lecture du contexte : le dossier reste lisible sans lui. */
  contextError?: string | null
}>(), { restoreUnavailable: false, context: null, contextLoading: false, contextError: null })
const emit = defineEmits<{
  viewPhotos: [urls: string[]]
  reply: [id: string]
  delete: [id: string]
  restore: [id: string]
  /** Un autre signalement sur la même cible : la page l'ouvre. */
  openRelated: [id: string]
}>()

const auth = useAuthStore()
const canDelete = computed(() => auth.can('REPORT_DELETE'))
const canOpenSupport = computed(() => auth.can('SUPPORT_TICKET_VIEW'))
const canReply = computed(() => !!props.report && canReplyToReport(props.report, auth.permissions))

function fmt(d: string) { return new Date(d).toLocaleString('fr-FR') }
/** Demande d'envoi signalée : lien profond vers sa fiche de modération dans /colis. */
const requestLink = computed(() => {
  const r = props.report
  if (!r || r.targetType !== 'PACKAGE_REQUEST') return null
  const route = gate(auth.can, 'BID_VIEW', unchecked.packageRequestRoute(r.targetId))
  return route ? toHref(route) : null
})
/** Action prise, sauf le rejet que le statut « Rejeté » dit déjà. */
const actionTaken = computed(() => {
  const a = props.report?.actionTaken
  return a && a !== 'DISMISS' ? reportActionTakenLabel(a) : null
})
/** « Supprimé le … par … » : qui et quand, pour décider d'une restauration. */
const deletedInfo = computed(() => {
  const r = props.report
  if (!r?.deletedAt) return null
  const when = `Supprimé le ${fmt(r.deletedAt)}`
  return r.deletedByAdminEmail ? `${when} par ${r.deletedByAdminEmail}` : when
})
const description = computed(() => (props.report ? reportDescriptionText(props.report) : null))
const kind = computed(() => (props.report ? reportKind(props.report) : null))

// ---- Contexte ----
const reporter = computed(() => props.context?.reporter ?? null)
const subject = computed(() => props.context?.subject ?? null)
const trust = computed(() => (reporter.value ? reporterTrust(reporter.value) : null))
const subjectStatus = computed(() => accountStatusMeta(subject.value?.accountStatus))
/** Déjà signalé : au moins un autre signalement visait ce compte (celui-ci compris sur une cible USER). */
const alreadyReported = computed(() => {
  const s = subject.value
  if (!s) return false
  return s.reportsReceived - (props.report?.targetType === 'USER' ? 1 : 0) >= 1
})
const timeline = computed(() => (props.report && props.context ? buildTimeline(props.report, props.context.history) : []))
const related = computed(() => props.context?.relatedReports ?? [])
/** Fiche du compte, si l'admin a le droit de la voir. */
function accountLink(userId: string): string | null {
  const route = gate(auth.can, 'USER_VIEW', userRoute(userId))
  return route ? toHref(route) : null
}
function relatedAge(iso?: string | null): string { return iso ? fmt(iso) : '' }
</script>

<template>
  <article aria-label="Dossier du signalement" data-test="report-case" class="flex flex-col gap-3">
    <p
      v-if="!report" data-test="case-empty"
      class="rounded-card border border-border bg-surface px-5 py-8 text-center text-sm text-text-muted"
    >Aucun signalement sélectionné.</p>

    <template v-else>
      <!-- En-tête -->
      <header class="flex flex-col gap-3 rounded-card border border-border bg-surface p-5">
        <div class="flex flex-wrap items-center gap-2">
          <StatusBadge v-bind="reportStatusMeta(report.status)" />
          <StatusBadge
            v-if="kind" :data-test="`report-kind-${report.id}`"
            :label="reportKindLabel(kind)" :tone="kind === 'BUG' ? 'danger' : kind === 'AVIS' ? 'info' : 'success'"
          />
          <StatusBadge v-else :label="reportTargetTypeLabel(report.targetType)" />
          <span class="text-xs text-text-muted tabular-nums">Reçu le {{ fmt(report.createdAt) }} · n° {{ report.id.slice(0, 8) }}</span>
        </div>
        <h2 class="font-display text-xl font-semibold text-balance">{{ reportReasonTitle(report) }}</h2>

        <blockquote
          v-if="description" data-test="case-description"
          class="m-0 rounded-btn bg-surface-elevated px-4 py-3 text-sm text-pretty"
        >
          <span class="mb-1 block text-xs font-medium uppercase tracking-wide text-text-muted">Ce qu’a écrit {{ report.reporterName ?? 'le signalant' }}</span>
          {{ description }}
        </blockquote>

        <div v-if="report.photoUrls?.length" class="flex flex-wrap gap-2">
          <button
            v-for="(url, i) in report.photoUrls" :key="i" type="button"
            :data-test="`report-photo-${report.id}-${i}`" :aria-label="`Agrandir la capture ${i + 1}`"
            class="h-20 w-20 overflow-hidden rounded-btn border border-border transition-[box-shadow,scale] hover:ring-2 hover:ring-primary active:scale-[0.96]"
            @click="emit('viewPhotos', report.photoUrls)"
          >
            <img :src="url" alt="Capture jointe" class="h-full w-full object-cover">
          </button>
        </div>
      </header>

      <p v-if="contextLoading" data-test="context-loading" role="status" class="px-1 text-xs text-text-muted">Chargement du contexte…</p>
      <p v-else-if="contextError" data-test="context-error" role="status" class="px-1 text-xs text-text-muted">{{ contextError }}</p>

      <!-- Le message dans sa conversation -->
      <section
        v-if="context?.messages?.length" aria-label="Le message en contexte" data-test="case-context-messages"
        class="rounded-card border border-border bg-surface p-5"
      >
        <h3 class="mb-3 font-display text-sm font-semibold">Le message en contexte</h3>
        <ReportContextMessages :messages="context.messages" />
      </section>
      <p
        v-else-if="context?.messagesRestricted" data-test="context-messages-restricted"
        class="rounded-card border border-border bg-surface px-5 py-3 text-xs text-text-muted text-pretty"
      >Les messages autour de celui-ci ne sont pas visibles avec votre rôle.</p>

      <!-- Cible et signalant -->
      <div class="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        <section class="rounded-card border border-border bg-surface p-5" aria-label="Cible">
          <p class="mb-1 text-xs font-medium uppercase tracking-wide text-text-muted">Cible</p>
          <p class="text-sm font-semibold text-pretty">{{ reportTargetLabel(report) }}</p>
          <p class="text-xs text-text-muted">{{ reportTargetTypeLabel(report.targetType) }}</p>
          <!-- Personne visée : le compte signalé, ou l'auteur du contenu signalé -->
          <div v-if="subject" data-test="case-subject" class="mt-3 border-t border-border pt-3">
            <p class="text-xs text-text-muted">{{ report.targetType === 'USER' ? 'Compte signalé' : 'Auteur' }}</p>
            <p class="text-sm font-semibold">
              <NuxtLink
                v-if="accountLink(subject.userId)" :to="accountLink(subject.userId)!" data-test="case-subject-link"
                class="text-primary underline-offset-2 hover:underline"
              >{{ subject.displayName ?? 'Compte' }}</NuxtLink>
              <template v-else>{{ subject.displayName ?? 'Compte' }}</template>
            </p>
            <div class="mt-1.5 flex flex-wrap gap-1.5">
              <StatusBadge v-if="subjectStatus" data-test="case-subject-status" v-bind="subjectStatus" />
              <StatusBadge v-if="subject.identityVerified" data-test="case-subject-identity" label="Identité vérifiée" tone="success" />
              <StatusBadge v-if="alreadyReported" data-test="case-subject-repeat" label="Déjà signalé" tone="warning" />
            </div>
            <ul class="mt-2 space-y-0.5 text-xs text-text-muted">
              <li v-if="memberSinceLabel(subject.memberSince)">{{ memberSinceLabel(subject.memberSince) }}</li>
              <li data-test="case-subject-received">{{ receivedReportsText(subject) }}</li>
              <li v-if="subject.cancellationCount > 0" data-test="case-subject-cancellations">
                {{ subject.cancellationCount }} annulation{{ subject.cancellationCount > 1 ? 's' : '' }}
              </li>
            </ul>
          </div>
          <p v-else-if="report.targetAuthor?.name" class="mt-1 text-xs text-text-muted">Auteur : {{ report.targetAuthor.name }}</p>
          <NuxtLink
            v-if="requestLink" :to="requestLink" :data-test="`report-open-request-${report.id}`"
            class="mt-2 inline-block text-xs text-primary underline-offset-2 hover:underline"
          >Voir la demande</NuxtLink>
          <ReportRatingPreview
            v-if="report.ratingPreview" :report-id="report.id" :preview="report.ratingPreview" :author="report.targetAuthor"
          />
          <!-- Rapport du scarabée : la route de l’écran dit où regarder -->
          <div
            v-if="report.screenRoute" :data-test="`report-screen-${report.id}`"
            class="mt-2 inline-block rounded bg-surface-elevated px-1.5 py-0.5 font-mono text-xs text-text-muted"
          >Écran {{ report.screenRoute }}</div>
        </section>

        <section class="rounded-card border border-border bg-surface p-5" aria-label="Signalant">
          <p class="mb-1 text-xs font-medium uppercase tracking-wide text-text-muted">Signalant</p>
          <p class="text-sm font-semibold">
            <NuxtLink
              v-if="reporter && accountLink(reporter.userId)" :to="accountLink(reporter.userId)!" data-test="case-reporter-link"
              class="text-primary underline-offset-2 hover:underline"
            >{{ report.reporterName ?? reporter.displayName ?? 'Inconnu' }}</NuxtLink>
            <template v-else>{{ report.reporterName ?? 'Inconnu' }}</template>
          </p>
          <div v-if="reporter && trust" data-test="case-reporter" class="mt-1.5">
            <StatusBadge data-test="case-reporter-trust" :label="trust.label" :tone="trust.tone" />
            <ul class="mt-2 space-y-0.5 text-xs text-text-muted">
              <li v-if="memberSinceLabel(reporter.memberSince)">{{ memberSinceLabel(reporter.memberSince) }}</li>
              <li data-test="case-reporter-history">{{ reporterHistoryText(reporter) }}</li>
            </ul>
          </div>
          <!-- Réponse au signalant : la conversation support reste accessible d'ici -->
          <div v-if="hasSupportConversation(report)" :data-test="`report-conversation-${report.id}`" class="mt-2">
            <StatusBadge label="Conversation ouverte" tone="info" />
            <NuxtLink
              v-if="canOpenSupport" :to="supportConversationLink(report.supportTicketId!)"
              :data-test="`report-conversation-link-${report.id}`"
              class="mt-1 block text-xs text-primary underline-offset-2 hover:underline"
            >Ouvrir la conversation</NuxtLink>
          </div>
        </section>
      </div>

      <!-- Autres signalements sur la même cible -->
      <section
        v-if="related.length" aria-label="Autres signalements sur cette cible" data-test="case-related"
        class="rounded-card border border-border bg-surface p-5"
      >
        <h3 class="mb-2 font-display text-sm font-semibold">Autres signalements sur cette cible</h3>
        <ul class="divide-y divide-border">
          <li v-for="o in related" :key="o.id">
            <button
              type="button" :data-test="`related-${o.id}`"
              class="flex w-full items-center justify-between gap-3 py-2 text-left text-sm transition-[background-color,scale] hover:bg-surface-elevated active:scale-[0.99]"
              @click="emit('openRelated', o.id)"
            >
              <span class="min-w-0">
                <span class="block truncate font-medium">{{ o.reason ? reportReasonLabel(o.reason) : 'Motif inconnu' }}</span>
                <span class="block truncate text-xs text-text-muted">{{ o.reporterName ?? 'Signalant inconnu' }} · {{ relatedAge(o.createdAt) }}</span>
              </span>
              <StatusBadge v-if="o.status" v-bind="reportStatusMeta(o.status as 'OPEN' | 'RESOLVED' | 'DISMISSED')" />
            </button>
          </li>
        </ul>
      </section>

      <!-- Historique du dossier -->
      <section
        v-if="context" aria-label="Historique" data-test="case-history"
        class="rounded-card border border-border bg-surface p-5"
      >
        <h3 class="mb-3 font-display text-sm font-semibold">Historique</h3>
        <ReportTimeline :items="timeline" />
      </section>

      <!-- Issue (déjà traité) et suppression : la chronologie la porte quand elle est là -->
      <section
        v-if="(!context && (actionTaken || report.resolutionNote)) || deletedInfo" aria-label="Issue"
        class="rounded-card border border-border bg-surface p-5 text-sm"
      >
        <p class="mb-1 text-xs font-medium uppercase tracking-wide text-text-muted">Issue</p>
        <p v-if="actionTaken && !context" :data-test="`report-action-taken-${report.id}`" class="font-medium text-pretty">{{ actionTaken }}</p>
        <p v-if="report.resolutionNote && !context" class="mt-1 text-text-muted text-pretty">Note interne : {{ report.resolutionNote }}</p>
        <p v-if="report.resolvedAt && !context" class="mt-1 text-xs text-text-muted tabular-nums">Le {{ fmt(report.resolvedAt) }}</p>
        <p
          v-if="deletedInfo" :data-test="`report-deleted-info-${report.id}`"
          class="mt-1 text-xs text-text-muted text-pretty tabular-nums"
        >{{ deletedInfo }}</p>
      </section>

      <!-- Gestes hors décision -->
      <div class="flex flex-wrap items-center gap-2">
        <button
          v-if="report.deletedAt && canDelete && !restoreUnavailable" type="button" :data-test="`restore-${report.id}`"
          class="rounded-btn bg-primary/15 px-3 py-1.5 text-sm text-primary transition-[background-color,scale] hover:bg-primary/25 active:scale-[0.96]"
          @click="emit('restore', report.id)"
        >Restaurer</button>
        <template v-if="!report.deletedAt">
          <button
            v-if="canReply" type="button" :data-test="`reply-${report.id}`"
            class="rounded-btn border border-border px-3 py-1.5 text-sm transition-[background-color,scale] hover:bg-surface-elevated active:scale-[0.96]"
            @click="emit('reply', report.id)"
          >{{ hasSupportConversation(report) ? 'Répondre à nouveau' : 'Répondre au signalant' }}</button>
          <button
            v-if="canDelete" type="button" :data-test="`delete-${report.id}`"
            class="ml-auto rounded-btn px-3 py-1.5 text-sm text-danger transition-[background-color,scale] hover:bg-danger/10 active:scale-[0.96]"
            @click="emit('delete', report.id)"
          >Supprimer</button>
        </template>
      </div>
    </template>
  </article>
</template>
