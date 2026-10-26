<script setup lang="ts">
import { computed } from 'vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import ReportRatingPreview from './ReportRatingPreview.vue'
import { reportStatusMeta } from './reportStatus'
import { reportDescriptionText, reportKind, reportKindLabel } from '@/features/signalements/reportKind'
import { reportActionTakenLabel, reportTargetTypeLabel } from '@/features/signalements/reportActionLabels'
import { reportReasonTitle, reportTargetLabel } from '@/features/signalements/reportDisplay'
import { canReplyToReport, hasSupportConversation, supportConversationLink } from '@/features/signalements/reportReply'
import type { AdminReport } from '@/features/signalements/types/index'
import { useAuthStore } from '@/stores/auth'
import { gate, toHref, unchecked } from '@/lib/adminLinks'

const props = withDefaults(defineProps<{
  report: AdminReport | null
  /** Endpoints de restauration absents (ancien back) : le bouton Restaurer disparaît. */
  restoreUnavailable?: boolean
}>(), { restoreUnavailable: false })
const emit = defineEmits<{
  viewPhotos: [urls: string[]]
  reply: [id: string]
  delete: [id: string]
  restore: [id: string]
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

      <!-- Cible et signalant -->
      <div class="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        <section class="rounded-card border border-border bg-surface p-5" aria-label="Cible">
          <p class="mb-1 text-xs font-medium uppercase tracking-wide text-text-muted">Cible</p>
          <p class="text-sm font-semibold text-pretty">{{ reportTargetLabel(report) }}</p>
          <p class="text-xs text-text-muted">{{ reportTargetTypeLabel(report.targetType) }}</p>
          <p v-if="report.targetAuthor?.name" class="mt-1 text-xs text-text-muted">Auteur : {{ report.targetAuthor.name }}</p>
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
          <p class="text-sm font-semibold">{{ report.reporterName ?? 'Inconnu' }}</p>
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

      <!-- Issue (déjà traité) et suppression -->
      <section
        v-if="actionTaken || report.resolutionNote || deletedInfo" aria-label="Issue"
        class="rounded-card border border-border bg-surface p-5 text-sm"
      >
        <p class="mb-1 text-xs font-medium uppercase tracking-wide text-text-muted">Issue</p>
        <p v-if="actionTaken" :data-test="`report-action-taken-${report.id}`" class="font-medium text-pretty">{{ actionTaken }}</p>
        <p v-if="report.resolutionNote" class="mt-1 text-text-muted text-pretty">Note interne : {{ report.resolutionNote }}</p>
        <p v-if="report.resolvedAt" class="mt-1 text-xs text-text-muted tabular-nums">Le {{ fmt(report.resolvedAt) }}</p>
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
