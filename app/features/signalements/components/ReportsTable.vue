<script setup lang="ts">
import { computed } from 'vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { reportStatusMeta } from './reportStatus'
import { reportReasonLabel } from '@/features/signalements/reportReasons'
import { reportActionTakenLabel, reportTargetTypeLabel } from '@/features/signalements/reportActionLabels'
import { canReplyToReport, hasSupportConversation, supportConversationLink } from '@/features/signalements/reportReply'
import type { AdminReport } from '@/features/signalements/types/index'
import { useAuthStore } from '@/stores/auth'
const props = withDefaults(defineProps<{
  reports: AdminReport[]
  loading: boolean
  /** Identifiants cochés ; la colonne de cases n'apparaît qu'avec REPORT_DELETE. */
  selected?: string[]
  /** Endpoints de restauration absents (ancien back) : le bouton Restaurer disparaît. */
  restoreUnavailable?: boolean
  /** Signalement ouvert par lien profond (`?open=`) : ligne mise en avant. */
  highlightId?: string | null
}>(), { selected: () => [], restoreUnavailable: false, highlightId: null })
const emit = defineEmits<{
  resolve: [id: string]
  viewPhotos: [urls: string[]]
  toggle: [id: string]
  togglePage: []
  delete: [id: string]
  restore: [id: string]
  reply: [id: string]
}>()
const auth = useAuthStore()
const canDelete = computed(() => auth.can('REPORT_DELETE'))
const canOpenSupport = computed(() => auth.can('SUPPORT_TICKET_VIEW'))
const canReply = (r: AdminReport) => canReplyToReport(r, auth.permissions)
const allChecked = computed(() => props.reports.length > 0 && props.reports.every((r) => props.selected.includes(r.id)))
const someChecked = computed(() => !allChecked.value && props.reports.some((r) => props.selected.includes(r.id)))
function fmt(d: string) { return new Date(d).toLocaleString('fr-FR') }
/** « Supprimé le … par … » : qui et quand, pour décider d'une restauration. */
function deletedInfo(r: AdminReport): string {
  const when = r.deletedAt ? `Supprimé le ${fmt(r.deletedAt)}` : 'Supprimé'
  return r.deletedByAdminEmail ? `${when} par ${r.deletedByAdminEmail}` : when
}
/** Demande d'envoi signalée : lien profond vers sa fiche de modération dans /colis. */
function requestLink(r: AdminReport): string | null {
  if (r.targetType !== 'PACKAGE_REQUEST' || !r.targetId || !auth.can('BID_VIEW')) return null
  return `/colis?tab=demandes&open=${encodeURIComponent(r.targetId)}`
}
/** Cible APP : ni libellé ni identifiant côté back, on nomme l’application. */
function targetLabel(r: AdminReport) {
  return r.targetLabel ?? r.targetId ?? (r.targetType === 'APP' ? 'Application' : 'Cible inconnue')
}
/**
 * Bouton Traiter : `availableActions` du back fait foi (permissions comprises) ; sur un
 * ancien back, on garde la règle locale (ouvert + REPORT_RESOLVE).
 */
function canResolve(r: AdminReport): boolean {
  if (Array.isArray(r.availableActions)) return r.availableActions.length > 0
  return r.status === 'OPEN' && auth.can('REPORT_RESOLVE')
}
/** Action prise, sauf le rejet que le statut « Rejeté » dit déjà. */
function actionTaken(r: AdminReport): string | null {
  if (!r.actionTaken || r.actionTaken === 'DISMISS') return null
  return reportActionTakenLabel(r.actionTaken)
}
</script>

<template>
  <div class="rounded-card border border-border bg-surface overflow-hidden">
    <table class="w-full">
      <thead class="bg-surface-elevated text-left text-xs uppercase text-text-muted">
        <tr>
          <th v-if="canDelete" class="w-10 px-3 py-2">
            <input
              type="checkbox" data-test="select-page" aria-label="Sélectionner la page"
              :checked="allChecked" :indeterminate.prop="someChecked"
              :disabled="reports.length === 0"
              @change="emit('togglePage')"
            >
          </th>
          <th class="px-4 py-2 font-medium">Cible</th>
          <th class="px-4 py-2 font-medium">Motif</th>
          <th class="px-4 py-2 font-medium">Signalé par</th>
          <th class="px-4 py-2 font-medium">Créé</th>
          <th class="px-4 py-2 font-medium">État</th>
          <th class="px-4 py-2 font-medium"/>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="r in reports" :key="r.id" :data-test="`report-row-${r.id}`"
          :data-highlighted="highlightId === r.id ? 'true' : undefined"
          :class="['border-b border-border transition-[background-color]', selected.includes(r.id) || highlightId === r.id ? 'bg-primary/5' : '',
            highlightId === r.id ? 'shadow-[inset_3px_0_0_rgb(var(--primary-rgb))]' : '',
            r.deletedAt ? 'text-text-muted' : '']"
        >
          <td v-if="canDelete" class="px-3 py-3">
            <input
              type="checkbox" :data-test="`select-${r.id}`" :aria-label="`Sélectionner le signalement`"
              :checked="selected.includes(r.id)"
              @change="emit('toggle', r.id)"
            >
          </td>
          <td class="px-4 py-3 text-sm">
            <div class="font-medium">{{ targetLabel(r) }}</div>
            <div class="text-xs text-text-muted">{{ reportTargetTypeLabel(r.targetType) }}</div>
            <NuxtLink
              v-if="requestLink(r)" :to="requestLink(r)!" :data-test="`report-open-request-${r.id}`"
              class="mt-1 inline-block text-xs text-primary underline-offset-2 hover:underline"
            >Voir la demande</NuxtLink>
            <!-- Rapport du scarabée : la route de l’écran dit où regarder -->
            <div
              v-if="r.screenRoute" :data-test="`report-screen-${r.id}`"
              class="mt-1 inline-block rounded bg-surface-elevated px-1.5 py-0.5 font-mono text-xs text-text-muted"
            >Écran {{ r.screenRoute }}</div>
          </td>
          <td class="px-4 py-3 text-sm">
            <div class="font-medium">{{ reportReasonLabel(r.reason) }}</div>
            <div v-if="r.description" class="text-xs text-text-muted">{{ r.description }}</div>
            <div v-if="r.photoUrls?.length" class="mt-1.5 flex gap-1.5">
              <button
                v-for="(url, i) in r.photoUrls" :key="i" type="button"
                :data-test="`report-photo-${r.id}-${i}`"
                class="h-10 w-10 overflow-hidden rounded border border-border hover:ring-2 hover:ring-primary"
                @click="emit('viewPhotos', r.photoUrls)"
              >
                <img :src="url" alt="Capture jointe" class="h-full w-full object-cover">
              </button>
            </div>
          </td>
          <td class="px-4 py-3 text-sm text-text-muted">{{ r.reporterName ?? 'Inconnu' }}</td>
          <td class="px-4 py-3 text-sm text-text-muted tabular-nums">{{ fmt(r.createdAt) }}</td>
          <td class="px-4 py-3">
            <StatusBadge v-bind="reportStatusMeta(r.status)" />
            <div
              v-if="actionTaken(r)" :data-test="`report-action-taken-${r.id}`"
              class="mt-1 text-xs text-text-muted text-pretty"
            >{{ actionTaken(r) }}</div>
            <div
              v-if="r.deletedAt" :data-test="`report-deleted-info-${r.id}`"
              class="mt-1 text-xs text-text-muted text-pretty tabular-nums"
            >{{ deletedInfo(r) }}</div>
            <!-- Réponse au signalant : la conversation support reste accessible d'ici -->
            <div v-if="hasSupportConversation(r)" :data-test="`report-conversation-${r.id}`" class="mt-1.5">
              <StatusBadge label="Conversation ouverte" tone="info" />
              <NuxtLink
                v-if="canOpenSupport" :to="supportConversationLink(r.supportTicketId!)"
                :data-test="`report-conversation-link-${r.id}`"
                class="mt-1 block text-xs text-primary underline-offset-2 hover:underline"
              >Ouvrir la conversation</NuxtLink>
            </div>
          </td>
          <td v-if="r.deletedAt" class="px-4 py-3 text-right whitespace-nowrap">
            <button
              v-if="canDelete && !restoreUnavailable" type="button" :data-test="`restore-${r.id}`"
              class="rounded-btn px-3 py-1.5 text-sm bg-primary/15 text-primary transition-[background-color,scale] hover:bg-primary/25 active:scale-[0.96]"
              @click="emit('restore', r.id)"
            >Restaurer</button>
          </td>
          <td v-else class="px-4 py-3 text-right whitespace-nowrap">
            <button
              v-if="canReply(r)" type="button" :data-test="`reply-${r.id}`"
              class="mr-1 rounded-btn border border-border px-3 py-1.5 text-sm text-text transition-[background-color,scale] hover:bg-surface-elevated active:scale-[0.96]"
              @click="emit('reply', r.id)"
            >{{ hasSupportConversation(r) ? 'Répondre à nouveau' : 'Répondre' }}</button>
            <button
              v-if="canResolve(r)" type="button" :data-test="`resolve-${r.id}`"
              class="rounded-btn px-3 py-1.5 text-sm bg-primary/15 text-primary hover:bg-primary/25"
              @click="emit('resolve', r.id)"
            >Traiter</button>
            <button
              v-if="canDelete" type="button" :data-test="`delete-${r.id}`" title="Supprimer"
              class="ml-1 rounded-btn px-3 py-1.5 text-sm text-danger hover:bg-danger/10"
              @click="emit('delete', r.id)"
            >Supprimer</button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="loading" class="p-6 text-center text-sm text-text-muted">Chargement…</p>
    <p v-else-if="reports.length === 0" class="p-6 text-center text-sm text-text-muted">Aucun signalement</p>
  </div>
</template>
