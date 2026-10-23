<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import ConfirmActionDialog from '@/components/ui/ConfirmActionDialog.vue'
import UserGpProSection from '@/features/gp-pro/components/UserGpProSection.vue'
import UserRecetteTesterSection from '@/features/users/components/UserRecetteTesterSection.vue'
import UserDeletionDialog from '@/features/users/components/UserDeletionDialog.vue'
import { useUserDeletion } from '@/features/users/composables/useUserDeletion'
import { userDisplayName } from '@/features/broadcast/composables/useUserSearch'
import { useAuthStore } from '@/stores/auth'
import type { AdminDeletionReasonCode, AdminUserDetail } from '@/features/users/types/index'

const props = defineProps<{ user: AdminUserDetail, busy?: boolean, error?: string | null }>()
const emit = defineEmits<{
  setCommission: [rate: number | null]; grantPro: [reason: string]; revokePro: []; changed: []
}>()

const auth = useAuthStore()
const fullName = computed(() => [props.user.firstName, props.user.lastName].filter(Boolean).join(' ') || userDisplayName(props.user))

// --- Commission ---
// `!= null` : le backend est en NON_NULL, un champ nul est ABSENT du JSON (undefined).
// L'arrondi absorbe le bruit flottant : `0.07 * 100 === 7.000000000000001`.
const toPercent = (rate: number | null | undefined) => rate != null ? String(Math.round(rate * 1000) / 10) : ''
const commissionPercent = ref(toPercent(props.user.commissionRateOverride))
watch(() => props.user.commissionRateOverride, (rate) => { commissionPercent.value = toPercent(rate) })
const pendingRate = ref<number | null>(null)
const commissionInvalid = ref(false)
const hasOverride = computed(() => props.user.commissionRateOverride != null)

function applyCommission() {
  const pct = Number.parseFloat(commissionPercent.value)
  if (Number.isNaN(pct) || pct < 0 || pct > 99.9) { commissionInvalid.value = true; return }
  commissionInvalid.value = false
  pendingRate.value = Math.round(pct * 10) / 1000 // % → fraction, 1 décimale de %
  pending.value = 'setCommission'
}

// --- Accès PRO (mêmes règles que le tiroir) ---
const proSource = computed(() => props.user.proSubscription?.source ?? null)
const isAdminGranted = computed(() => proSource.value === 'ADMIN_GRANT')
/** Miroir de `ProSubscriptionStatus.grantsProAccess()`. */
const PRO_ACCESS_STATUSES = ['ACTIVE', 'PAST_DUE', 'LEGACY_GRACE']
/** Abonnement payant en cours : le backend refuse l'octroi (409), il faut résilier dans Stripe. */
const hasLiveStripeSubscription = computed(() =>
  proSource.value === 'STRIPE' && PRO_ACCESS_STATUSES.includes(props.user.proSubscription?.status ?? ''))
const canGrantPro = computed(() => !hasLiveStripeSubscription.value && !isAdminGranted.value)
const proSourceLabel = computed(() => {
  switch (proSource.value) {
    case 'STRIPE': return 'abonnement payant'
    case 'ADMIN_GRANT': return 'accès offert par un administrateur'
    case 'LEGACY_FREE': return 'grâce historique'
    default: return 'aucun'
  }
})

// --- Confirmations ---
type Pending = 'setCommission' | 'resetCommission' | 'grantPro' | 'revokePro' | null
const pending = ref<Pending>(null)
const dialog = computed(() => {
  switch (pending.value) {
    case 'setCommission': {
      const pct = pendingRate.value !== null ? (pendingRate.value * 100).toFixed(1) : ''
      return {
        title: 'Appliquer la dérogation de commission',
        message: `Un taux de commission de ${pct} % sera appliqué à cet utilisateur, en remplacement du taux global de la plateforme.`,
        confirmLabel: 'Appliquer', requireReason: false,
      }
    }
    case 'resetCommission': return {
      title: 'Réinitialiser la commission',
      message: 'La dérogation de commission sera supprimée : l\'utilisateur repassera au taux global de la plateforme.',
      confirmLabel: 'Réinitialiser', requireReason: false,
    }
    case 'grantPro': return {
      title: 'Offrir un accès PRO',
      message: 'L\'utilisateur obtiendra immédiatement les avantages PRO, sans payer. Le motif est journalisé avec votre identifiant d\'administrateur.',
      confirmLabel: 'Offrir l\'accès PRO', requireReason: true,
    }
    case 'revokePro': return {
      title: 'Révoquer l\'accès PRO offert',
      message: 'L\'accès offert sera retiré et l\'utilisateur repassera en compte standard. Un abonnement payant, lui, se résilie dans Stripe.',
      confirmLabel: 'Révoquer', requireReason: false,
    }
    default: return { title: '', message: '', confirmLabel: '', requireReason: false }
  }
})
function confirm(reason: string) {
  const p = pending.value
  pending.value = null
  if (p === 'setCommission') emit('setCommission', pendingRate.value)
  else if (p === 'resetCommission') emit('setCommission', null)
  else if (p === 'grantPro') emit('grantPro', reason)
  else if (p === 'revokePro') emit('revokePro')
}

// --- Suppression du compte (même parcours que la liste : analyse d'impact, puis confirmation) ---
const deletion = useUserDeletion()
const deletionOpen = ref(false)
let unmounted = false
onBeforeUnmount(() => { unmounted = true })
async function openDeletion() {
  deletionOpen.value = true
  await deletion.loadImpact(props.user.id)
}
function closeDeletion() {
  deletionOpen.value = false
  deletion.reset()
}
async function confirmDeletion(reasonCode: AdminDeletionReasonCode, reason: string) {
  const ok = await deletion.remove(props.user.id, reasonCode, reason)
  // Sur un refus, l'erreur reste lisible dans le dialogue. Après un succès, la fiche n'a plus
  // d'objet : retour à la liste, sauf si l'admin a déjà quitté cette page.
  if (!ok || unmounted) return
  closeDeletion()
  await navigateTo('/users')
}

const showCommission = computed(() => auth.can('USER_COMMISSION'))
const showPro = computed(() => auth.can('USER_PRO_GRANT'))
const showGpPro = computed(() => auth.can('GP_PRO_REVIEW') && props.user.gpPro !== undefined)
const showRecette = computed(() => auth.can('ADMIN_MANAGE'))
const showDanger = computed(() => auth.can('USER_DELETE'))
const nothing = computed(() => !showCommission.value && !showPro.value && !showGpPro.value && !showRecette.value && !showDanger.value)
const card = 'rounded-card border border-border bg-surface p-5'
</script>

<template>
  <div class="flex flex-col gap-4" data-test="user-manage">
    <p
      v-if="error" data-test="manage-error" role="alert"
      class="rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger text-pretty"
    >{{ error }}</p>

    <p v-if="nothing" data-test="manage-empty" class="text-sm text-text-muted">
      Aucun réglage de compte n’est disponible avec vos droits : les gestes courants sont dans « Actions du compte ».
    </p>

    <section v-if="showCommission" :class="card" data-test="commission-card" aria-labelledby="commission-title">
      <h3 id="commission-title" class="font-display text-base font-semibold">Commission</h3>
      <p data-test="commission-state" class="mt-1 text-sm text-text-muted">
        <template v-if="hasOverride">Dérogation actuelle : {{ (user.commissionRateOverride! * 100).toFixed(1) }} %</template>
        <template v-else>Taux global appliqué</template>
      </p>
      <p class="mt-1 text-xs text-text-muted text-pretty">
        Une dérogation remplace le taux de la plateforme pour cet utilisateur seulement (de 0 à 99,9 %).
      </p>
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <label for="commission-input" class="sr-only">Taux de commission en pourcentage</label>
        <input
          id="commission-input" v-model="commissionPercent" data-test="commission-input" type="number"
          min="0" max="99.9" step="0.1" placeholder="ex. 8" :aria-invalid="commissionInvalid"
          class="w-28 rounded-btn border border-border bg-surface px-3 py-2 text-sm tabular-nums"
        >
        <button
          type="button" data-test="commission-apply" :disabled="busy"
          class="rounded-btn border border-border px-4 py-2 text-sm transition-[background-color,scale] hover:bg-surface-elevated active:scale-[0.96] disabled:opacity-40"
          @click="applyCommission"
        >Appliquer</button>
        <button
          v-if="hasOverride" type="button" data-test="commission-reset" :disabled="busy"
          class="rounded-btn border border-border px-4 py-2 text-sm transition-[background-color,scale] hover:bg-surface-elevated active:scale-[0.96] disabled:opacity-40"
          @click="pending = 'resetCommission'"
        >Réinitialiser</button>
      </div>
      <p v-if="commissionInvalid" data-test="commission-invalid" role="alert" class="mt-2 text-sm text-danger">
        Saisissez un taux entre 0 et 99,9 %.
      </p>
    </section>

    <section v-if="showPro" :class="card" data-test="pro-grant-section" aria-labelledby="pro-title">
      <h3 id="pro-title" class="font-display text-base font-semibold">Accès PRO</h3>
      <p class="mt-1 text-sm text-text-muted">
        Source : <span data-test="pro-source">{{ proSourceLabel }}</span>
        <span v-if="user.proSubscription?.adminGrantReason"> · motif : {{ user.proSubscription.adminGrantReason }}</span>
      </p>
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button
          v-if="canGrantPro" type="button" data-test="action-grant-pro" :disabled="busy"
          class="rounded-btn border border-border px-4 py-2 text-sm transition-[background-color,scale] hover:bg-surface-elevated active:scale-[0.96] disabled:opacity-40"
          @click="pending = 'grantPro'"
        >Offrir un accès PRO</button>
        <button
          v-if="isAdminGranted" type="button" data-test="action-revoke-pro" :disabled="busy"
          class="rounded-btn border border-border px-4 py-2 text-sm transition-[background-color,scale] hover:bg-surface-elevated active:scale-[0.96] disabled:opacity-40"
          @click="pending = 'revokePro'"
        >Révoquer l'accès offert</button>
        <p v-if="hasLiveStripeSubscription" class="text-xs text-text-muted" data-test="pro-stripe-hint">
          Abonnement payant : la résiliation se fait dans Stripe, pas ici.
        </p>
      </div>
    </section>

    <!-- Badge GP Pro : absent d'un back qui n'expose pas encore `gpPro`. -->
    <UserGpProSection
      v-if="showGpPro" :key="`gp-pro-${user.id}`"
      :user-id="user.id" :user-name="fullName" :gp-pro="user.gpPro!" :gp-pro-granted-at="user.gpProGrantedAt ?? null"
      :kyc-status="user.kycStatus" :status="user.status"
      @changed="emit('changed')"
    />

    <!-- Mode recette : super-admin seulement, le back l'exige aussi. -->
    <UserRecetteTesterSection v-if="showRecette" :key="user.id" :user-id="user.id" />

    <!-- Geste irréversible : zone à part, loin des gestes réversibles. -->
    <section v-if="showDanger" class="rounded-card border border-danger/30 bg-danger/5 p-5" data-test="danger-zone" aria-labelledby="danger-title">
      <h3 id="danger-title" class="font-display text-base font-semibold text-danger">Zone de danger</h3>
      <p class="mb-3 mt-1 text-xs text-text-muted text-pretty">
        La suppression anonymise définitivement le compte et le bannit. Elle ne peut pas être annulée.
      </p>
      <button
        type="button" data-test="action-delete" :disabled="busy"
        class="rounded-btn bg-danger px-4 py-2 text-sm text-white transition-[background-color,scale] hover:bg-danger/90 active:scale-[0.96] disabled:opacity-40"
        @click="openDeletion"
      >Supprimer le compte…</button>
    </section>

    <ConfirmActionDialog
      :open="pending !== null" :title="dialog.title" :message="dialog.message"
      :confirm-label="dialog.confirmLabel" :require-reason="dialog.requireReason"
      @confirm="confirm" @cancel="pending = null"
    />

    <UserDeletionDialog
      v-if="showDanger" :open="deletionOpen" :user="user" :impact="deletion.impact.value"
      :is-loading="deletion.isLoading.value" :busy="deletion.busy.value" :error="deletion.error.value"
      @confirm="confirmDeletion" @cancel="closeDeletion"
    />
  </div>
</template>
