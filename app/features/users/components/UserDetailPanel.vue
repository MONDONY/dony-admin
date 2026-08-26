<script setup lang="ts">
import { computed, ref } from 'vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import ConfirmActionDialog from '@/components/ui/ConfirmActionDialog.vue'
import { userStatusMeta } from './userStatus'
import UserKycTab from './UserKycTab.vue'
import type { AdminUserDetail, AdminKycDetail } from '@/features/users/types/index'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{
  user: AdminUserDetail; open: boolean; error?: string | null; busy?: boolean
  kyc?: AdminKycDetail | null; kycLoading?: boolean; kycError?: string | null
}>()
const emit = defineEmits<{
  close: []; suspend: [reason: string]; ban: [reason: string]; unsuspend: [];
  suspendPublishing: [reason: string]; liftPublishing: []; setCommission: [rate: number | null];
  muteMessaging: [durationHours: number | null, reason: string]; unmuteMessaging: [];
  openKyc: []; resetKyc: [reason: string]; deletionImpact: [];
}>()
const auth = useAuthStore()

type Pending = 'suspend' | 'ban' | 'suspendPublishing' | 'setCommission' | 'resetCommission' | 'muteMessaging' | null
const pending = ref<Pending>(null)

// « profil » par défaut : les gestes de compte restent immédiatement accessibles à
// l'ouverture de la fiche. L'onglet KYC déclenche un chargement paresseux (openKyc), car
// la lecture back interroge Stripe Identity en direct — inutile de la payer sans besoin.
type Tab = 'profil' | 'kyc'
const tab = ref<Tab>('profil')
const kycLoaded = ref(false)
function openTab(next: Tab) {
  tab.value = next
  if (next === 'kyc' && !kycLoaded.value) {
    kycLoaded.value = true
    emit('openKyc')
  }
}
const fullName = () => [props.user.firstName, props.user.lastName].filter(Boolean).join(' ') || '—'
function confirmReason(reason: string) {
  if (pending.value === 'suspend') emit('suspend', reason)
  else if (pending.value === 'ban') emit('ban', reason)
  else if (pending.value === 'suspendPublishing') emit('suspendPublishing', reason)
  else if (pending.value === 'setCommission') emit('setCommission', pendingCommissionRate.value)
  else if (pending.value === 'resetCommission') emit('setCommission', null)
  else if (pending.value === 'muteMessaging') emit('muteMessaging', muteDurationHours(), reason)
  pending.value = null
}

// Choix de durée (24 h / 7 j / indéfini) : contrôle dans le panneau (motif de
// l'éditeur de commission), la confirmation ne porte que le motif.
type MuteDurationOption = '24' | '168' | 'indefinite'
const muteDuration = ref<MuteDurationOption>('24')
function muteDurationHours(): number | null {
  if (muteDuration.value === '24') return 24
  if (muteDuration.value === '168') return 168
  return null
}
function muteDurationLabel(): string {
  if (muteDuration.value === '24') return '24 heures'
  if (muteDuration.value === '168') return '7 jours'
  return 'une durée indéterminée'
}
function fmt(d: string) { return new Date(d).toLocaleString('fr-FR') }

// `!= null` et non `!== null` : le backend est en NON_NULL, un champ nul est ABSENT du JSON
// et arrive donc à `undefined`. La comparaison stricte était vraie sur `undefined`, ce qui
// préremplissait ce champ avec la chaîne « NaN ».
// L'arrondi absorbe le bruit flottant : `0.07 * 100 === 7.000000000000001`.
const commissionPercent = ref<string>(
  props.user.commissionRateOverride != null
    ? String(Math.round(props.user.commissionRateOverride * 1000) / 10)
    : ''
)
const pendingCommissionRate = ref<number | null>(null)

function applyCommission() {
  const pct = Number.parseFloat(commissionPercent.value)
  if (Number.isNaN(pct) || pct < 0 || pct > 99.9) return
  pendingCommissionRate.value = Math.round(pct * 10) / 1000 // % → fraction, 1 décimale de %
  pending.value = 'setCommission'
}

type DialogConfig = { title: string; message: string; confirmLabel: string; requireReason: boolean }
const dialogConfig = computed<DialogConfig>(() => {
  switch (pending.value) {
    case 'suspend':
      return { title: 'Suspendre ce compte', message: 'Le compte sera suspendu.', confirmLabel: 'Suspendre', requireReason: true }
    case 'ban':
      return {
        title: 'Bannir ce compte', message: 'Le compte sera banni définitivement.', confirmLabel: 'Bannir', requireReason: true,
      }
    case 'suspendPublishing':
      return {
        title: 'Suspendre la publication',
        message: 'L\'utilisateur ne pourra plus publier ni trajets ni colis.',
        confirmLabel: 'Suspendre la publication',
        requireReason: true,
      }
    case 'setCommission': {
      const pct = pendingCommissionRate.value !== null ? (pendingCommissionRate.value * 100).toFixed(1) : ''
      return {
        title: 'Appliquer la dérogation de commission',
        message: `Un taux de commission de ${pct} % sera appliqué à cet utilisateur, en remplacement du taux global de la plateforme.`,
        confirmLabel: 'Appliquer',
        requireReason: false,
      }
    }
    case 'resetCommission':
      return {
        title: 'Réinitialiser la commission',
        message: 'La dérogation de commission sera supprimée : l\'utilisateur repassera au taux global de la plateforme.',
        confirmLabel: 'Réinitialiser',
        requireReason: false,
      }
    case 'muteMessaging':
      return {
        title: 'Couper la messagerie',
        message: `La messagerie de cet utilisateur sera coupée pour ${muteDurationLabel()}.`,
        confirmLabel: 'Couper la messagerie',
        requireReason: true,
      }
    default:
      return { title: '', message: '', confirmLabel: '', requireReason: false }
  }
})
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-40 flex justify-end bg-black/30" @click.self="emit('close')">
    <aside class="h-full w-full max-w-md bg-surface border-l border-border overflow-y-auto p-6">
      <div class="flex items-start justify-between mb-4">
        <div>
          <h2 class="font-display text-xl font-bold">{{ fullName() }}</h2>
          <p class="text-sm text-text-muted tabular-nums">{{ user.phoneNumber }}</p>
        </div>
        <div class="flex items-center gap-2">
          <StatusBadge v-bind="userStatusMeta(user.status)" />
          <button
            type="button" data-test="action-close"
            class="rounded-btn px-3 py-1.5 text-sm border border-border"
            @click="emit('close')"
          >Fermer</button>
        </div>
      </div>

      <div class="mb-4 flex gap-1 border-b border-border" role="tablist">
        <button
          type="button" data-test="tab-profil" role="tab" :aria-selected="tab === 'profil'"
          class="rounded-t-btn px-4 py-2 text-sm"
          :class="tab === 'profil' ? 'border-b-2 border-primary text-text' : 'text-text-muted hover:text-text'"
          @click="openTab('profil')"
        >Profil</button>
        <button
          v-if="auth.can('USER_KYC')" type="button" data-test="tab-kyc" role="tab" :aria-selected="tab === 'kyc'"
          class="rounded-t-btn px-4 py-2 text-sm"
          :class="tab === 'kyc' ? 'border-b-2 border-primary text-text' : 'text-text-muted hover:text-text'"
          @click="openTab('kyc')"
        >KYC</button>
      </div>

      <template v-if="tab === 'profil'">
      <dl class="grid grid-cols-2 gap-3 text-sm mb-6">
        <div><dt class="text-text-muted">Email</dt><dd>{{ user.email ?? '—' }}</dd></div>
        <div><dt class="text-text-muted">Ville</dt><dd>{{ user.city ?? '—' }}</dd></div>
        <div><dt class="text-text-muted">KYC</dt><dd>{{ user.kycStatus }}</dd></div>
        <div><dt class="text-text-muted">Stripe</dt><dd>{{ user.stripeAccountStatus ?? '—' }}</dd></div>
        <div><dt class="text-text-muted">Trajets</dt><dd class="tabular-nums">{{ user.totalTrips }}</dd></div>
        <div><dt class="text-text-muted">Envois</dt><dd class="tabular-nums">{{ user.totalShipments }}</dd></div>
        <div><dt class="text-text-muted">No-shows</dt><dd class="tabular-nums">{{ user.noShowCount }}</dd></div>
        <div><dt class="text-text-muted">Annulations</dt><dd class="tabular-nums">{{ user.cancellationCount }}</dd></div>
        <div><dt class="text-text-muted">Publication</dt>
          <dd>{{ user.publishingSuspended ? 'Suspendue' : 'Autorisée' }}</dd></div>
        <div><dt class="text-text-muted">Messagerie</dt>
          <dd data-test="messaging-status">{{ user.messagingMutedUntil ? `Coupée jusqu'au ${fmt(user.messagingMutedUntil)}` : 'Autorisée' }}</dd></div>
      </dl>

      <p v-if="error" data-test="user-error" class="mb-3 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{{ error }}</p>

      <div class="flex flex-wrap gap-2">
        <button
          v-if="user.status === 'ACTIVE' && auth.can('USER_SUSPEND')" type="button" data-test="action-suspend"
          class="rounded-btn px-4 py-2 text-sm bg-warning/20 text-warning hover:bg-warning/30"
          @click="pending = 'suspend'"
        >Suspendre</button>
        <button
          v-if="user.status === 'ACTIVE' && auth.can('USER_BAN')" type="button" data-test="action-ban"
          class="rounded-btn px-4 py-2 text-sm bg-danger/20 text-danger hover:bg-danger/30"
          @click="pending = 'ban'"
        >Bannir</button>
        <button
          v-if="user.status === 'SUSPENDED' && auth.can('USER_SUSPEND')" type="button" data-test="action-unsuspend"
          class="rounded-btn px-4 py-2 text-sm bg-success/20 text-success hover:bg-success/30"
          @click="emit('unsuspend')"
        >Réactiver</button>
        <button
          v-if="!user.publishingSuspended && auth.can('USER_SUSPEND')" type="button" data-test="action-suspend-publishing"
          class="rounded-btn px-4 py-2 text-sm bg-warning/20 text-warning hover:bg-warning/30"
          @click="pending = 'suspendPublishing'"
        >Suspendre la publication</button>
        <button
          v-if="user.publishingSuspended && auth.can('USER_SUSPEND')" type="button" data-test="action-lift-publishing"
          class="rounded-btn px-4 py-2 text-sm bg-success/20 text-success hover:bg-success/30"
          @click="emit('liftPublishing')"
        >Lever la suspension de publication</button>
        <button
          v-if="user.messagingMutedUntil != null && auth.can('USER_MESSAGE_MUTE')" type="button" data-test="action-unmute"
          :disabled="busy"
          class="rounded-btn px-4 py-2 text-sm bg-success/20 text-success hover:bg-success/30 disabled:opacity-40"
          @click="emit('unmuteMessaging')"
        >Rétablir la messagerie</button>
      </div>

      <div v-if="auth.can('USER_MESSAGE_MUTE')" class="mt-4 flex items-center gap-2">
        <select
          v-model="muteDuration" data-test="mute-duration"
          class="rounded-btn border border-border bg-surface px-3 py-2 text-sm"
        >
          <option value="24">24 heures</option>
          <option value="168">7 jours</option>
          <option value="indefinite">Indéfini</option>
        </select>
        <button
          type="button" data-test="action-mute" :disabled="busy"
          class="rounded-btn px-4 py-2 text-sm bg-danger/20 text-danger hover:bg-danger/30 disabled:opacity-40"
          @click="pending = 'muteMessaging'"
        >Couper la messagerie</button>
      </div>

      <!-- Suppression administrative — réservée au rôle ADMIN (USER_DELETE exclut SUPPORT). -->
      <div v-if="auth.can('USER_DELETE')" class="mt-4">
        <button
          type="button" data-test="action-deletion-impact"
          class="rounded-btn px-4 py-2 text-sm bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20"
          @click="emit('deletionImpact')"
        >Supprimer le compte…</button>
      </div>

      <div v-if="auth.can('USER_COMMISSION')" class="mt-4 space-y-2">
        <p class="text-text-muted">Commission
          <span v-if="user.commissionRateOverride != null">
            — dérogation actuelle : {{ (user.commissionRateOverride * 100).toFixed(1) }} %</span>
          <span v-else> — taux global appliqué</span>
        </p>
        <div class="flex items-center gap-2">
          <input
            v-model="commissionPercent" data-test="commission-input" type="number"
            min="0" max="99.9" step="0.1" placeholder="ex. 8"
            class="rounded-btn border border-border bg-surface px-3 py-2 text-sm tabular-nums"
          >
          <button
            type="button" data-test="commission-apply"
            class="rounded-btn px-4 py-2 text-sm border border-border"
            @click="applyCommission"
          >Appliquer</button>
          <button
            v-if="user.commissionRateOverride != null" type="button"
            data-test="commission-reset"
            class="rounded-btn px-4 py-2 text-sm border border-border"
            @click="pending = 'resetCommission'"
          >Réinitialiser</button>
        </div>
      </div>
      </template>

      <UserKycTab
        v-if="tab === 'kyc'"
        :kyc="props.kyc ?? null" :loading="props.kycLoading" :error="props.kycError" :busy="props.busy"
        @reset="(reason) => emit('resetKyc', reason)"
      />

      <ConfirmActionDialog
        :open="pending !== null"
        :title="dialogConfig.title"
        :message="dialogConfig.message"
        :confirm-label="dialogConfig.confirmLabel"
        :require-reason="dialogConfig.requireReason"
        @confirm="confirmReason"
        @cancel="pending = null"
      />
    </aside>
  </div>
</template>
