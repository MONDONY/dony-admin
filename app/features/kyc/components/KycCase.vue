<script setup lang="ts">
import { computed } from 'vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import KycReviewDetails from './KycReviewDetails.vue'
import { kycDisplayName, kycSituation } from '@/features/kyc/lib/kycWorkbench'
import {
  formatWaiting, isOverdue, kycDecisionCodeLabel, kycDecisionMeta, kycProviderLabel, kycStatusMeta,
} from '@/features/kyc/types/index'
import type { AdminKycQueueItem } from '@/features/kyc/types/index'
import type { AdminKycDetail } from '@/features/users/types/index'

/**
 * Dossier d'une vérification au centre du poste : pourquoi il est là, ce que dit le fournisseur,
 * décision admin et historique. Les pièces et le selfie ne sont pas stockés chez Yadony : le lien
 * ouvre la session chez le fournisseur.
 */
const props = defineProps<{
  /** Ligne de la file ; absente quand le dossier est ouvert par lien profond. */
  row: AdminKycQueueItem | null
  userId: string
  kyc: AdminKycDetail | null
  loading: boolean
  /** Échec du chargement (dossier absent) ou d'une réinitialisation (dossier affiché). */
  error: string | null
}>()

const title = computed(() => (props.row ? kycDisplayName(props.row) : `Utilisateur ${props.userId.slice(0, 8)}`))
const provider = computed(() => props.kyc?.provider ?? props.row?.provider ?? null)
/**
 * Le dossier chargé fait foi pour un état tranché (validée, refusée, non commencée) : la ligne de file
 * est un instantané pris à l'ouverture, périmé après une décision. Tant que le dossier est « en cours »,
 * la ligne distingue « à décider » de « parcours en cours », ce que le dossier seul ne dit pas.
 */
const effectiveStatus = computed(() => {
  const loaded = props.kyc?.kycStatus
  if (loaded && loaded !== 'PENDING') return loaded
  return props.row?.queueStatus ?? props.row?.kycStatus ?? loaded ?? ''
})
const status = computed(() => kycStatusMeta(effectiveStatus.value))
const hasSession = computed(() => Boolean(props.kyc?.stripeSessionId))
const situation = computed(() => kycSituation(effectiveStatus.value, null, hasSession.value))
const overdue = computed(() => isOverdue(props.row?.waitingHours))
const subline = computed(() => {
  const parts: string[] = []
  if (props.row?.userPhone) parts.push(props.row.userPhone)
  if (props.row?.submittedAt) parts.push(`soumise le ${fmt(props.row.submittedAt)}`)
  if (typeof props.row?.waitingHours === 'number') parts.push(`${formatWaiting(props.row.waitingHours)} d’attente`)
  return parts.join(' · ')
})

function fmt(d: string | null | undefined) { return d ? new Date(d).toLocaleString('fr-FR') : 'Date inconnue' }
</script>

<template>
  <section aria-label="Dossier" class="flex min-w-0 flex-col overflow-hidden rounded-card border border-border bg-surface" data-test="kyc-case">
    <p v-if="!userId" data-test="kyc-case-empty" class="px-5 py-16 text-center text-sm text-text-muted">Choisissez une vérification dans la file.</p>

    <template v-else>
      <header class="border-b border-border px-5 py-4">
        <div class="flex flex-wrap items-center gap-2">
          <span data-test="kyc-detail-status"><StatusBadge v-bind="status" /></span>
          <span v-if="row?.decisionKind" data-test="kyc-case-decision-badge"><StatusBadge v-bind="kycDecisionMeta(row.decisionKind)" /></span>
          <span v-if="overdue" data-test="kyc-case-overdue"><StatusBadge label="En retard" tone="danger" /></span>
          <span class="rounded-full bg-surface-elevated px-2 py-0.5 text-xs font-medium text-text-muted" data-test="kyc-detail-provider">{{ kycProviderLabel(provider) }}</span>
        </div>
        <h2 class="mt-2 font-display text-xl font-bold text-balance" data-test="kyc-case-title">{{ title }}</h2>
        <p v-if="subline" class="mt-0.5 text-sm tabular-nums text-text-muted" data-test="kyc-case-subline">{{ subline }}</p>
      </header>

      <div class="flex flex-col gap-5 p-5">
        <p v-if="loading" data-test="kyc-detail-loading" class="text-sm text-text-muted">Chargement du dossier…</p>
        <p
          v-else-if="!kyc && error" data-test="kyc-detail-error" role="alert"
          class="rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
        >{{ error }}</p>

        <template v-else-if="kyc">
          <p
            v-if="kyc.stripeUnavailable" data-test="kyc-provider-unavailable"
            class="rounded-btn border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning text-pretty"
          >Le fournisseur ne répond pas : seules les données enregistrées chez Yadony sont affichées.</p>

          <div
            v-if="situation === 'REVIEW'" data-test="kyc-why-review"
            class="rounded-card border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-pretty"
          >
            <p><b>Pourquoi ce dossier est ici.</b> Le fournisseur n’a pas tranché : il demande une revue manuelle.</p>
            <p class="mt-1 text-text-muted">Les pièces et le selfie ne sont pas stockés chez Yadony : ils se consultent chez le fournisseur.</p>
          </div>
          <div
            v-else-if="situation === 'NO_SESSION'" data-test="kyc-why-no-session"
            class="rounded-card border border-info/40 bg-info/10 px-4 py-3 text-sm text-pretty"
          >
            <p><b>Rien à décider pour l’instant.</b> L’utilisateur n’a envoyé aucune pièce : il n’y a pas encore de session à examiner chez le fournisseur.</p>
            <p class="mt-1 text-text-muted">Valider ou refuser reste verrouillé tant qu’aucune pièce n’est arrivée.</p>
          </div>

          <a
            v-if="kyc.providerSessionUrl" :href="kyc.providerSessionUrl" target="_blank" rel="noopener noreferrer"
            data-test="kyc-provider-link"
            class="inline-flex w-fit items-center rounded-btn border border-border px-3 py-2 text-sm font-medium text-primary transition-[background-color,scale] hover:bg-surface-elevated active:scale-[0.96]"
          >Ouvrir la session chez {{ kycProviderLabel(provider) }} ↗</a>

          <section data-test="kyc-provider-facts">
            <h3 class="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">Ce que dit le fournisseur</h3>
            <dl class="divide-y divide-border rounded-card border border-border px-4 text-sm">
              <div class="flex justify-between gap-3 py-2">
                <dt class="text-text-muted">Statut chez le fournisseur</dt>
                <dd class="text-right font-medium" data-test="kyc-provider-status">{{ kyc.stripeStatus || (hasSession ? 'Inconnu' : 'Aucune pièce envoyée') }}</dd>
              </div>
              <div v-if="kyc.stripeCreatedAt" class="flex justify-between gap-3 py-2">
                <dt class="text-text-muted">Session créée le</dt>
                <dd class="text-right font-medium tabular-nums" data-test="kyc-provider-created">{{ fmt(kyc.stripeCreatedAt) }}</dd>
              </div>
              <div v-if="kyc.stripeLastErrorCode || kyc.stripeLastErrorReason" class="flex justify-between gap-3 py-2" data-test="kyc-provider-error">
                <dt class="text-text-muted">Dernier motif signalé</dt>
                <dd class="text-right font-medium text-pretty break-words">{{ kyc.stripeLastErrorReason || kycDecisionCodeLabel(kyc.stripeLastErrorCode) }}</dd>
              </div>
              <div v-if="kyc.rejectionCode || kyc.rejectionReason" class="flex justify-between gap-3 py-2" data-test="kyc-detail-rejection">
                <dt class="text-text-muted">Refus</dt>
                <dd class="text-right font-medium text-pretty break-words">{{ kyc.rejectionReason || kycDecisionCodeLabel(kyc.rejectionCode) }}</dd>
              </div>
            </dl>
          </section>

          <KycReviewDetails :kyc="kyc" hide-provider-link />
        </template>
      </div>
    </template>
  </section>
</template>
