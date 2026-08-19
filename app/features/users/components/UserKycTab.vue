<script setup lang="ts">
import { ref } from 'vue'
import ConfirmActionDialog from '@/components/ui/ConfirmActionDialog.vue'
import { useAuthStore } from '@/stores/auth'
import type { AdminKycDetail } from '@/features/users/types/index'

const props = defineProps<{
  kyc: AdminKycDetail | null; loading?: boolean; error?: string | null; busy?: boolean
}>()
const emit = defineEmits<{ reset: [reason: string] }>()
const auth = useAuthStore()

// Réinitialiser un KYC ne détruit aucune donnée (l'utilisateur refait sa vérification) :
// confirmation simple avec motif, pas de double confirmation par saisie de nom — celle-ci
// est réservée à l'exécution RGPD, irréversible.
const confirming = ref(false)
function confirmReset(reason: string) {
  confirming.value = false
  emit('reset', reason)
}
function fmt(d: string | null) { return d ? new Date(d).toLocaleString('fr-FR') : '—' }
</script>

<template>
  <div>
    <p v-if="loading" data-test="kyc-loading" class="text-sm text-text-muted">Chargement du KYC…</p>

    <template v-else-if="props.kyc">
      <p
        v-if="props.kyc.stripeUnavailable" data-test="kyc-stripe-unavailable"
        class="mb-3 rounded-btn border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning"
      >Statut Stripe indisponible — seules les données locales sont affichées.</p>

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
          <dd>{{ props.kyc.rejectionReason ?? '—' }}</dd>
        </div>
        <div>
          <dt class="text-text-muted">Code de rejet</dt>
          <dd>{{ props.kyc.rejectionCode ?? '—' }}</dd>
        </div>
        <div class="col-span-2">
          <dt class="text-text-muted">Session Stripe courante</dt>
          <dd data-test="kyc-stripe-session" class="break-all">
            {{ props.kyc.stripeSessionId ?? 'Aucune session — vérification jamais démarrée' }}
          </dd>
        </div>
        <div>
          <dt class="text-text-muted">Statut Stripe</dt>
          <dd>{{ props.kyc.stripeStatus ?? '—' }}</dd>
        </div>
        <div>
          <dt class="text-text-muted">Créée le</dt>
          <dd>{{ fmt(props.kyc.stripeCreatedAt) }}</dd>
        </div>
        <div class="col-span-2">
          <dt class="text-text-muted">Dernière erreur Stripe</dt>
          <dd>
            {{ props.kyc.stripeLastErrorReason ?? '—' }}
            <span v-if="props.kyc.stripeLastErrorCode" class="text-text-muted">
              ({{ props.kyc.stripeLastErrorCode }})</span>
          </dd>
        </div>
      </dl>

      <p class="mb-4 text-xs text-text-muted">
        Les pièces d'identité sont détenues par Stripe et ne sont pas stockées par Yadony :
        seule la session courante est consultable, sans historique.
      </p>

      <p
        v-if="props.error" data-test="kyc-error"
        class="mb-3 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
      >{{ props.error }}</p>

      <button
        v-if="auth.can('USER_KYC')" type="button" data-test="action-reset-kyc" :disabled="props.busy"
        class="rounded-btn px-4 py-2 text-sm bg-warning/20 text-warning hover:bg-warning/30 disabled:opacity-40"
        @click="confirming = true"
      >Réinitialiser le KYC</button>
    </template>

    <p v-else data-test="kyc-empty" class="text-sm text-text-muted">Aucune donnée KYC.</p>

    <ConfirmActionDialog
      :open="confirming"
      title="Réinitialiser le KYC"
      message="La session de vérification en cours sera annulée côté Stripe et l'utilisateur devra refaire sa vérification d'identité."
      confirm-label="Réinitialiser"
      :require-reason="true"
      @confirm="confirmReset"
      @cancel="confirming = false"
    />
  </div>
</template>
