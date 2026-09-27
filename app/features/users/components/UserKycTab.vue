<script setup lang="ts">
import KycReviewDetails from '@/features/kyc/components/KycReviewDetails.vue'
import KycDecisionActions from '@/features/kyc/components/KycDecisionActions.vue'
import { kycProviderLabel } from '@/features/kyc/types/index'
import type { AdminKycDetail } from '@/features/users/types/index'

const props = defineProps<{
  kyc: AdminKycDetail | null; loading?: boolean; error?: string | null; busy?: boolean
  /** Nom à ressaisir avant une révocation. */
  userName?: string | null
  /** Paiements retenus du voyageur : rappelés au moment de valider l'identité. */
  heldPaymentsCount?: number | null
}>()
const emit = defineEmits<{ reset: [reason: string]; decided: [kyc: AdminKycDetail]; stale: [] }>()

function fmt(d: string | null | undefined) { return d ? new Date(d).toLocaleString('fr-FR') : 'Non renseigné' }
</script>

<template>
  <div>
    <p v-if="loading" data-test="kyc-loading" class="text-sm text-text-muted">Chargement du KYC…</p>

    <template v-else-if="props.kyc">
      <p
        v-if="props.kyc.stripeUnavailable" data-test="kyc-stripe-unavailable"
        class="mb-3 rounded-btn border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning"
      >Le fournisseur ne répond pas : seules les données locales sont affichées.</p>

      <dl class="grid grid-cols-2 gap-3 text-sm mb-6">
        <div>
          <dt class="text-text-muted">Statut du compte</dt>
          <dd data-test="kyc-status">{{ props.kyc.kycStatus }}</dd>
        </div>
        <div>
          <dt class="text-text-muted">Statut de vérification</dt>
          <dd data-test="kyc-verification-status">{{ props.kyc.verificationStatus }}</dd>
        </div>
        <div>
          <dt class="text-text-muted">Motif de rejet</dt>
          <dd>{{ props.kyc.rejectionReason ?? 'Aucun' }}</dd>
        </div>
        <div>
          <dt class="text-text-muted">Code de rejet</dt>
          <dd>{{ props.kyc.rejectionCode ?? 'Aucun' }}</dd>
        </div>
        <div>
          <dt class="text-text-muted">Fournisseur</dt>
          <dd data-test="kyc-provider">{{ kycProviderLabel(props.kyc.provider) }}</dd>
        </div>
        <div>
          <dt class="text-text-muted">Session courante</dt>
          <dd data-test="kyc-stripe-session" class="break-all">
            {{ props.kyc.stripeSessionId ?? 'Aucune session : vérification jamais démarrée' }}
          </dd>
        </div>
        <div>
          <dt class="text-text-muted">Statut chez le fournisseur</dt>
          <dd>{{ props.kyc.stripeStatus ?? 'Non renseigné' }}</dd>
        </div>
        <div>
          <dt class="text-text-muted">Créée le</dt>
          <dd>{{ fmt(props.kyc.stripeCreatedAt) }}</dd>
        </div>
        <div class="col-span-2">
          <dt class="text-text-muted">Dernière erreur du fournisseur</dt>
          <dd>
            {{ props.kyc.stripeLastErrorReason ?? 'Aucune' }}
            <span v-if="props.kyc.stripeLastErrorCode" class="text-text-muted">
              ({{ props.kyc.stripeLastErrorCode }})</span>
          </dd>
        </div>
      </dl>

      <p class="mb-4 text-xs text-text-muted">
        Les pièces d'identité sont détenues par le fournisseur et ne sont pas stockées par Yadony.
      </p>

      <KycReviewDetails :kyc="props.kyc" class="mb-6" />

      <p
        v-if="props.error" data-test="kyc-error"
        class="mb-3 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
      >{{ props.error }}</p>

      <KycDecisionActions
        :kyc="props.kyc" :user-name="props.userName ?? null" :reset-busy="props.busy"
        :held-payments-count="props.heldPaymentsCount ?? null"
        @decided="(k) => emit('decided', k)" @stale="emit('stale')" @reset="(r) => emit('reset', r)"
      />
    </template>

    <p v-else data-test="kyc-empty" class="text-sm text-text-muted">Aucune donnée KYC.</p>
  </div>
</template>
