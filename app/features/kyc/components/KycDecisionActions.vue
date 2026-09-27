<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import ConfirmActionDialog from '@/components/ui/ConfirmActionDialog.vue'
import KycDecisionDialog from './KycDecisionDialog.vue'
import type { KycDecisionMode, KycDecisionPayload } from './KycDecisionDialog.vue'
import { useKycDecision } from '@/features/kyc/composables/useKycDecision'
import { toDecisionCodes, useKycRejectionCodes } from '@/features/kyc/composables/useKycRejectionCodes'
import { KYC_DECISIONS_UNAVAILABLE } from '@/features/kyc/types/index'
import type { AdminKycDetail } from '@/features/users/types/index'
import { useAuthStore } from '@/stores/auth'

/**
 * Gestes sur l'identité d'un utilisateur, partagés par la file /kyc et l'onglet KYC de la
 * fiche utilisateur : valider, refuser, révoquer (KYC_DECIDE) et réinitialiser (USER_KYC).
 * Les décisions sont exécutées ici ; le parent reçoit la fiche à jour (`decided`) ou la
 * consigne de la relire après un conflit (`stale`).
 */
const props = defineProps<{
  kyc: AdminKycDetail
  userName: string | null
  /** Réinitialisation en cours (portée par le parent, qui détient l'appel). */
  resetBusy?: boolean
}>()
const emit = defineEmits<{ decided: [kyc: AdminKycDetail]; stale: []; reset: [reason: string] }>()
const auth = useAuthStore()

const decision = useKycDecision(() => props.kyc.userId, { onStale: () => emit('stale') })

const canDecide = computed(() => auth.can('KYC_DECIDE') && !decision.unavailable.value)
const isVerified = computed(() => props.kyc.kycStatus === 'VERIFIED')
// La session se lit sur son identifiant (`stripeSessionId`, qui porte celui du fournisseur
// courant). `providerSessionUrl` est absent tant que les modèles d'URL console ne sont pas
// configurés côté back : il ne dit rien de l'existence d'une session.
const hasProviderSession = computed(() => Boolean(props.kyc.stripeSessionId))

const catalogue = useKycRejectionCodes()
onMounted(() => { if (auth.can('KYC_DECIDE')) void catalogue.load() })
const codeOptions = computed(() =>
  decision.allowedCodes.value?.length ? toDecisionCodes(decision.allowedCodes.value) : catalogue.codes.value)
/** Nom à ressaisir ; sans nom connu, le début de l'identifiant, toujours présent. */
const confirmationName = computed(() => props.userName?.trim() || props.kyc.userId.slice(0, 8))

const mode = ref<KycDecisionMode | null>(null)
const resetOpen = ref(false)

function openDialog(next: KycDecisionMode) {
  decision.clearError()
  mode.value = next
}
function closeDialog() {
  mode.value = null
  decision.clearError()
}

async function onSubmit(payload: KycDecisionPayload) {
  const current = mode.value
  let result: AdminKycDetail | null = null
  if (current === 'approve') result = await decision.approve(payload.reason)
  else if (current === 'reject') result = await decision.reject(payload.code ?? '', payload.reason)
  else if (current === 'revoke') result = await decision.revoke(payload.code ?? '', payload.reason)
  // Succès, ou endpoint absent (ancien back) : le dialogue n'a plus lieu d'être. Sur un refus
  // du back, il reste ouvert pour que le message soit lu à côté de la saisie.
  if (result || decision.unavailable.value) mode.value = null
  if (result) emit('decided', result)
}

function confirmReset(reason: string) {
  resetOpen.value = false
  emit('reset', reason)
}

const btn = 'rounded-btn px-4 py-2 text-sm font-medium transition-[background-color,scale] active:scale-[0.96] disabled:opacity-40 disabled:active:scale-100'
</script>

<template>
  <section data-test="kyc-actions" class="rounded-card border border-border p-4">
    <h3 class="text-sm font-semibold mb-3">Décision</h3>

    <p
      v-if="decision.unavailable.value" data-test="kyc-decisions-unavailable"
      class="mb-3 text-xs text-text-muted text-pretty"
    >{{ KYC_DECISIONS_UNAVAILABLE }}</p>

    <div class="flex flex-wrap gap-2">
      <template v-if="canDecide && !isVerified">
        <button
          type="button" data-test="kyc-approve" :disabled="decision.busy.value || !hasProviderSession"
          :class="[btn, 'bg-success/15 text-success hover:bg-success/25']"
          @click="openDialog('approve')"
        >Valider l’identité</button>
        <button
          type="button" data-test="kyc-reject" :disabled="decision.busy.value || !hasProviderSession"
          :class="[btn, 'bg-danger/15 text-danger hover:bg-danger/25']"
          @click="openDialog('reject')"
        >Refuser</button>
      </template>
      <button
        v-if="canDecide && isVerified" type="button" data-test="kyc-revoke" :disabled="decision.busy.value"
        :class="[btn, 'bg-danger/15 text-danger hover:bg-danger/25']"
        @click="openDialog('revoke')"
      >Révoquer</button>
      <button
        v-if="auth.can('USER_KYC')" type="button" data-test="action-reset-kyc" :disabled="props.resetBusy"
        :class="[btn, 'bg-warning/20 text-warning hover:bg-warning/30']"
        @click="resetOpen = true"
      >Réinitialiser le KYC</button>
    </div>

    <p
      v-if="canDecide && !isVerified && !hasProviderSession" data-test="kyc-approve-no-session"
      class="mt-2 text-xs text-text-muted text-pretty"
    >Décision impossible : aucune session chez le fournisseur, l’utilisateur n’a encore envoyé aucune pièce.</p>

    <KycDecisionDialog
      :open="mode !== null"
      :mode="mode ?? 'approve'"
      :user-name="confirmationName"
      :provider-session-url="props.kyc.providerSessionUrl ?? null"
      :codes="codeOptions"
      :busy="decision.busy.value"
      :error="decision.error.value"
      @submit="onSubmit"
      @cancel="closeDialog"
    />
    <ConfirmActionDialog
      :open="resetOpen"
      title="Réinitialiser le KYC"
      message="La session de vérification en cours sera annulée chez le fournisseur et l’utilisateur devra refaire sa vérification d’identité."
      confirm-label="Réinitialiser"
      :require-reason="true"
      @confirm="confirmReset"
      @cancel="resetOpen = false"
    />
  </section>
</template>
