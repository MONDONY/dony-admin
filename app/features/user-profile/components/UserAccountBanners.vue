<script setup lang="ts">
import { toHref, heldPayoutsRoute } from '@/lib/adminLinks'
import { computed, ref, watch } from 'vue'
import RestoreReasonDialog from '@/components/ui/RestoreReasonDialog.vue'
import { holdReasonsLabel } from '@/features/payments/types/index'
import { useAuthStore } from '@/stores/auth'
import type { AdminUserDetail } from '@/features/users/types/index'

const heldPayoutsHref = toHref(heldPayoutsRoute())
const props = defineProps<{
  user: AdminUserDetail
  busy?: boolean
  /** Erreur de fiche : ferme le dialogue d'annulation (le message est montré par la page). */
  error?: string | null
  /** Ancien back sans POST /admin/users/{id}/cancel-deletion : bouton remplacé par un texte. */
  cancelDeletionUnavailable?: boolean
  /** Motif refusé par le back (422) : montré dans le dialogue, qui reste ouvert. */
  cancelDeletionReasonError?: string | null
}>()
const emit = defineEmits<{ cancelDeletion: [reason: string] }>()
const auth = useAuthStore()
// Dates sans fuseau côté back : toujours l'heure de Paris, quel que soit le navigateur.
const PARIS = { timeZone: 'Europe/Paris' } as const

// Versements retenus (compte banni ou identité révoquée) : l'argent reste chez Yadony et ne
// repart pas tout seul quand le compte est rétabli, d'où ce bandeau.
const heldCount = computed(() => props.user.heldPaymentsCount ?? 0)
const plural = (n: number) => (n > 1 ? 's' : '')
const heldReasons = computed<string[]>(() =>
  props.user.payoutsHeldReasons ?? (props.user.payoutsHeldReason ? [props.user.payoutsHeldReason] : []))
// Compte rétabli (tableau des motifs vide, toujours envoyé par le nouveau back) mais des
// paiements restent retenus : l'admin doit les débloquer.
const payoutsRestored = computed(() =>
  props.user.payoutsHeldReasons !== undefined && props.user.payoutsHeldReasons.length === 0 && heldCount.value > 0)
const payoutsHeld = computed(() => !payoutsRestored.value
  && (props.user.payoutsHeldSince != null || heldReasons.value.length > 0 || heldCount.value > 0))
const payoutsHeldText = computed(() => {
  const since = props.user.payoutsHeldSince
    ? ` depuis le ${new Date(props.user.payoutsHeldSince).toLocaleDateString('fr-FR', PARIS)}`
    : ''
  const reason = holdReasonsLabel(heldReasons.value)
  const n = heldCount.value
  const pendingPart = n > 0 ? `${n} paiement${plural(n)} en attente` : 'aucun paiement en attente'
  return `Versements bloqués${since}${reason ? ` (${reason})` : ''} : ${pendingPart}.`
})
const payoutsRestoredText = computed(() => {
  const n = heldCount.value
  return `Compte rétabli : ${n} paiement${plural(n)} toujours retenu${plural(n)}, à débloquer manuellement.`
})

// Suppression demandée (délai de rétractation) : l'admin peut l'annuler, motif à l'appui.
const pendingDeletion = computed(() => props.user.status === 'PENDING_DELETION')
const pendingDeletionText = computed(() => {
  const d = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', PARIS)
  if (props.user.deletionScheduledFor) return `Suppression prévue le ${d(props.user.deletionScheduledFor)}`
  if (props.user.deletionRequestedAt) return `Suppression demandée le ${d(props.user.deletionRequestedAt)}`
  return 'Suppression demandée'
})
// Le dialogue reste ouvert après la confirmation : un motif refusé (422) s'affiche à côté de la
// saisie, conservée. Il se ferme au succès (le compte n'est plus en suppression), sur un refus
// métier (erreur de fiche) ou quand l'endpoint se révèle absent.
const cancelDeletionOpen = ref(false)
watch(
  () => [props.user.status, props.error, props.cancelDeletionUnavailable] as const,
  ([status, error, unavailable]) => {
    if (status !== 'PENDING_DELETION' || error || unavailable) cancelDeletionOpen.value = false
  },
)
</script>

<template>
  <div v-if="payoutsHeld || payoutsRestored || pendingDeletion" class="flex flex-col gap-3">
    <div
      v-if="payoutsHeld || payoutsRestored" :data-test="payoutsRestored ? 'user-payouts-restored' : 'user-payouts-held'" role="status"
      :class="['rounded-card border px-4 py-3 text-sm', payoutsRestored ? 'border-warning/30 bg-warning/5' : 'border-danger/30 bg-danger/5']"
    >
      <p :class="['font-medium text-pretty', payoutsRestored ? 'text-warning' : 'text-danger']">
        {{ payoutsRestored ? payoutsRestoredText : payoutsHeldText }}
      </p>
      <p class="mt-1 text-xs text-text-muted text-pretty">
        {{ payoutsRestored
          ? 'Rien ne repart tout seul : débloquez chaque paiement depuis Transactions, ou remboursez l’expéditeur.'
          : 'Ses gains restent chez Yadony. Chaque paiement se décide à part : rembourser l’expéditeur ou payer le voyageur par dérogation.' }}
      </p>
      <NuxtLink
        v-if="heldCount > 0 && auth.can('PAYMENT_VIEW')" data-test="user-payouts-held-link"
        :to="heldPayoutsHref"
        class="mt-2 inline-block text-xs font-medium text-primary underline-offset-2 hover:underline"
      >Voir les versements retenus</NuxtLink>
    </div>

    <div
      v-if="pendingDeletion" data-test="user-pending-deletion" role="status"
      class="rounded-card border border-warning/30 bg-warning/5 px-4 py-3 text-sm"
    >
      <p class="font-medium text-warning tabular-nums">{{ pendingDeletionText }}</p>
      <p class="mt-1 text-xs text-text-muted text-pretty">
        L’utilisateur a demandé la suppression de son compte. Tant qu’elle n’est pas exécutée, elle peut être annulée.
      </p>
      <template v-if="auth.can('USER_DELETE')">
        <p v-if="cancelDeletionUnavailable" data-test="cancel-deletion-unavailable" class="mt-2 text-xs text-text-muted">
          Annulation indisponible tant que le serveur n’est pas mis à jour.
        </p>
        <button
          v-else type="button" data-test="action-cancel-deletion" :disabled="busy"
          class="mt-2 rounded-btn bg-primary px-3 py-1.5 text-sm text-white transition-[background-color,scale] hover:bg-primary/90 active:scale-[0.96] disabled:opacity-40"
          @click="cancelDeletionOpen = true"
        >Annuler la suppression</button>
      </template>
    </div>
  </div>

  <RestoreReasonDialog
    :open="cancelDeletionOpen"
    title="Annuler la suppression du compte"
    message="Le compte est conservé et redevient actif."
    notice="L’utilisateur sera prévenu que son compte n’est plus supprimé."
    confirm-label="Annuler la suppression"
    :busy="busy" :error="cancelDeletionReasonError"
    @confirm="(r) => emit('cancelDeletion', r)"
    @cancel="cancelDeletionOpen = false"
  />
</template>
