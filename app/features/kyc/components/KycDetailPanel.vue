<script setup lang="ts">
import { computed } from 'vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import KycReviewDetails from './KycReviewDetails.vue'
import KycDecisionActions from './KycDecisionActions.vue'
import { kycDecisionCodeLabel, kycProviderLabel, kycStatusMeta } from '@/features/kyc/types/index'
import type { AdminKycQueueItem } from '@/features/kyc/types/index'
import type { AdminKycDetail } from '@/features/users/types/index'

const props = defineProps<{
  /** Ligne de la file ; absente quand la fiche est ouverte par lien profond. */
  row: AdminKycQueueItem | null
  userId: string
  kyc: AdminKycDetail | null
  loading: boolean
  /** Échec du chargement (fiche absente) ou d'une réinitialisation (fiche affichée). */
  error: string | null
  resetBusy?: boolean
}>()
const emit = defineEmits<{ close: []; decided: [kyc: AdminKycDetail]; stale: []; reset: [reason: string] }>()

const title = computed(() => props.row?.userName ?? `Utilisateur ${props.userId.slice(0, 8)}`)
const provider = computed(() => props.kyc?.provider ?? props.row?.provider ?? null)
</script>

<template>
  <div
    class="fixed inset-0 z-40 flex justify-end bg-black/30" data-test="kyc-detail-overlay"
    @click.self="emit('close')"
  >
    <aside
      class="h-full w-full max-w-xl bg-surface border-l border-border overflow-y-auto p-6"
      data-test="kyc-detail" role="dialog" aria-modal="true" aria-labelledby="kyc-detail-title"
    >
      <div class="flex items-start justify-between gap-4 mb-5">
        <div class="min-w-0">
          <h2 id="kyc-detail-title" class="font-display text-xl font-bold text-balance">{{ title }}</h2>
          <p v-if="row?.userPhone" class="text-sm text-text-muted tabular-nums">{{ row.userPhone }}</p>
          <NuxtLink
            :to="`/users?open=${userId}`" data-test="kyc-user-link"
            class="text-sm text-primary underline-offset-2 hover:underline"
          >Ouvrir la fiche utilisateur</NuxtLink>
        </div>
        <button
          type="button" data-test="kyc-detail-close"
          class="shrink-0 rounded-btn px-3 py-1.5 text-sm border border-border hover:bg-surface-elevated transition-colors"
          @click="emit('close')"
        >Fermer</button>
      </div>

      <p v-if="loading" data-test="kyc-detail-loading" class="text-sm text-text-muted">Chargement du dossier…</p>
      <p
        v-else-if="!kyc && error" data-test="kyc-detail-error" role="alert"
        class="rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
      >{{ error }}</p>

      <template v-else-if="kyc">
        <p
          v-if="kyc.stripeUnavailable" data-test="kyc-provider-unavailable"
          class="mb-4 rounded-btn border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning text-pretty"
        >Le fournisseur ne répond pas : seules les données enregistrées chez Yadony sont affichées.</p>

        <dl class="grid grid-cols-2 gap-3 text-sm mb-6">
          <div>
            <dt class="text-text-muted">Statut</dt>
            <dd data-test="kyc-detail-status"><StatusBadge v-bind="kycStatusMeta(kyc.kycStatus)" /></dd>
          </div>
          <div>
            <dt class="text-text-muted">Fournisseur</dt>
            <dd data-test="kyc-detail-provider">{{ kycProviderLabel(provider) }}</dd>
          </div>
          <div v-if="kyc.rejectionCode || kyc.rejectionReason" class="col-span-2" data-test="kyc-detail-rejection">
            <dt class="text-text-muted">Refus</dt>
            <dd>{{ kycDecisionCodeLabel(kyc.rejectionCode) }}</dd>
            <dd v-if="kyc.rejectionReason" class="text-text-muted text-pretty break-words">{{ kyc.rejectionReason }}</dd>
          </div>
        </dl>

        <KycReviewDetails :kyc="kyc" class="mb-6" />

        <p
          v-if="error" data-test="kyc-reset-error" role="alert"
          class="mb-3 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
        >{{ error }}</p>
        <KycDecisionActions
          :kyc="kyc" :user-name="row?.userName ?? null" :reset-busy="resetBusy"
          @decided="(k) => emit('decided', k)" @stale="emit('stale')" @reset="(r) => emit('reset', r)"
        />
      </template>
    </aside>
  </div>
</template>
