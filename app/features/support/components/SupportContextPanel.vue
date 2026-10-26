<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import ReportTimeline from '@/features/signalements/components/ReportTimeline.vue'
import { accountStatusMeta, memberSinceLabel } from '@/features/signalements/reportContext'
import { STATUS_LABELS, statusTone } from '@/features/support/utils/format'
import { ticketTimeline } from '@/features/support/lib/supportWorkbench'
import type { AdminSupportTicket } from '@/features/support/types/index'
import type { AdminUserDetail } from '@/features/users/types/index'
import { useAuthStore } from '@/stores/auth'
import { gate, toHref, userRoute } from '@/lib/adminLinks'

/**
 * Colonne de droite du poste : qui écrit (fiche, colis, paiements), les gestes sur le ticket
 * (s'assigner, reprendre, résoudre), ses autres conversations et son historique.
 */
const props = withDefaults(defineProps<{
  ticket: AdminSupportTicket | null
  /** Fiche de la personne ; null sans droit USER_VIEW ou tant qu'elle charge. */
  user?: AdminUserDetail | null
  /** Autres conversations de la personne (le ticket affiché en est exclu par l'appelant). */
  related?: AdminSupportTicket[]
  acting?: boolean
  actionError?: string | null
}>(), { user: null, related: () => [], acting: false, actionError: null })
const emit = defineEmits<{
  assign: [id: string]
  reassign: [id: string, adminId: string]
  resolve: [id: string]
  openTicket: [id: string]
}>()

const auth = useAuthStore()
const confirming = ref(false)
// Une autre conversation repart sans confirmation en attente : on ne résout pas le ticket d'à côté par erreur.
watch(() => props.ticket?.id, () => { confirming.value = false })

const isResolved = computed(() => props.ticket?.status === 'RESOLVED')
const isMine = computed(() => !!props.ticket && props.ticket.assignedAdminId === auth.user?.id)
const isUnassigned = computed(() => props.ticket?.assignedAdminId === null)
const canManage = computed(() => auth.can('SUPPORT_TICKET_MANAGE'))
const href = (tab?: 'parcels' | 'money') => {
  const route = gate(auth.can, 'USER_VIEW', userRoute(props.ticket?.userId, tab))
  return route ? toHref(route) : null
}
const account = computed(() => (props.user ? accountStatusMeta(props.user.status) : null))
const kyc = computed(() => (props.user ? (props.user.kycStatus === 'VERIFIED' ? 'Identité vérifiée' : 'Identité non vérifiée') : null))
const since = computed(() => memberSinceLabel(props.user?.createdAt))
const timeline = computed(() => (props.ticket ? ticketTimeline(props.ticket) : []))

function resolve() {
  if (!props.ticket) return
  if (!confirming.value) { confirming.value = true; return }
  confirming.value = false
  emit('resolve', props.ticket.id)
}
</script>

<template>
  <aside aria-label="Contexte et actions" data-test="support-context" class="flex flex-col gap-3">
    <p
      v-if="!ticket" data-test="support-context-empty"
      class="rounded-card border border-border bg-surface px-4 py-4 text-sm text-text-muted text-pretty"
    >Le contexte de la personne et les actions apparaissent avec le ticket.</p>

    <template v-else>
      <div class="rounded-card border border-border bg-surface p-4">
        <h3 class="text-xs font-semibold uppercase tracking-wide text-text-muted">Utilisateur</h3>
        <p class="mt-1 truncate text-base font-semibold" data-test="support-user-name">{{ ticket.userDisplayName }}</p>
        <p v-if="kyc || since" class="mt-0.5 text-sm text-text-muted" data-test="support-user-facts">{{ [kyc, since].filter(Boolean).join(' · ') }}</p>
        <StatusBadge v-if="account" v-bind="account" class="mt-1" data-test="support-user-account" />
        <div v-if="href()" class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm" data-test="support-user-links">
          <NuxtLink :to="href()!" data-test="support-user-link" class="text-primary hover:underline">Voir la fiche</NuxtLink>
          <NuxtLink :to="href('parcels')!" data-test="support-user-parcels" class="text-primary hover:underline">Ses colis</NuxtLink>
          <NuxtLink :to="href('money')!" data-test="support-user-money" class="text-primary hover:underline">Ses paiements</NuxtLink>
        </div>
      </div>

      <div v-if="canManage && !isResolved" class="rounded-card border border-border bg-surface p-4" data-test="support-actions">
        <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Actions</h3>
        <div class="flex flex-col gap-2">
          <button
            v-if="isUnassigned" type="button" data-test="support-action-assign" :disabled="acting"
            class="rounded-btn bg-primary px-3 py-2 text-sm font-medium text-white transition-[background-color,scale] hover:bg-primary/90 active:scale-[0.97] disabled:opacity-50"
            @click="emit('assign', ticket.id)"
          >M’assigner ce ticket</button>
          <button
            v-else-if="!isMine" type="button" data-test="support-action-reassign" :disabled="acting"
            class="rounded-btn border border-border px-3 py-2 text-sm font-medium transition-[background-color,scale] hover:bg-surface-elevated active:scale-[0.97] disabled:opacity-50"
            @click="auth.user && emit('reassign', ticket.id, auth.user.id)"
          >Reprendre ce ticket</button>
          <template v-if="isMine">
            <button
              type="button" data-test="support-action-resolve" :disabled="acting"
              :class="['rounded-btn border px-3 py-2 text-left text-sm font-medium transition-[background-color,scale] active:scale-[0.97] disabled:opacity-50',
                confirming ? 'border-success bg-success/10 text-success' : 'border-border hover:bg-surface-elevated']"
              @click="resolve"
            >{{ confirming ? 'Confirmer : résoudre ce ticket' : 'Marquer résolu' }}</button>
            <p class="text-xs text-text-muted text-pretty" data-test="support-resolve-hint">Définitif : plus aucune réponse ne sera possible.</p>
            <button
              v-if="confirming" type="button" data-test="support-action-cancel"
              class="self-start text-xs text-text-muted underline-offset-2 hover:underline" @click="confirming = false"
            >Annuler</button>
          </template>
          <p v-else-if="!isUnassigned" class="text-xs text-text-muted text-pretty">Répondre et résoudre sont réservés à la personne assignée.</p>
        </div>
        <p v-if="actionError" data-test="support-action-error" role="alert" class="mt-2 text-sm text-danger text-pretty">{{ actionError }}</p>
      </div>
      <p v-else-if="actionError" data-test="support-action-error" role="alert" class="text-sm text-danger text-pretty">{{ actionError }}</p>

      <div class="rounded-card border border-border bg-surface p-4">
        <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Autres conversations de cette personne</h3>
        <p v-if="related.length === 0" class="text-sm text-text-muted" data-test="support-related-empty">Aucune autre conversation.</p>
        <ul v-else class="flex flex-col" data-test="support-related">
          <li v-for="r in related" :key="r.id" class="border-t border-border first:border-t-0">
            <button
              type="button" :data-test="`support-related-${r.id}`"
              class="flex w-full items-center justify-between gap-2 rounded-btn px-1 py-1.5 text-left text-sm hover:bg-surface-elevated"
              @click="emit('openTicket', r.id)"
            >
              <span class="min-w-0 truncate font-medium">{{ r.subject }}</span>
              <StatusBadge :label="STATUS_LABELS[r.status]" :tone="statusTone(r.status)" class="shrink-0" />
            </button>
          </li>
        </ul>
      </div>

      <div class="rounded-card border border-border bg-surface p-4">
        <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Historique du ticket</h3>
        <ReportTimeline :items="timeline" />
      </div>
    </template>
  </aside>
</template>
