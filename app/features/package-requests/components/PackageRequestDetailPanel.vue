<script setup lang="ts">
import { computed, ref } from 'vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import ConfirmActionDialog from '@/components/ui/ConfirmActionDialog.vue'
import PhotoViewer from '@/components/ui/PhotoViewer.vue'
import { formatMajorAmount } from '@/features/finance/types/index'
import { reportReasonLabel } from '@/features/signalements/reportReasons'
import { PACKAGE_REQUEST_REMOVAL_REASONS } from '@/features/bids/removalReasons'
import {
  isActiveShipmentBlock, negotiationStatusMeta, packageRequestStatusMeta, parcelSizeLabel,
  paymentMethodsLabel, removeBlockedExplanation, transportModeLabel,
} from '@/features/package-requests/labels'
import type { AdminPackageRequestDetail } from '@/features/package-requests/types/index'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{
  request: AdminPackageRequestDetail
  busy: boolean
  /** Message d'échec de la dernière action (detail du ProblemDetail). */
  error: string | null
  /** Slug `code` de cet échec, pour proposer le bon renvoi (litiges). */
  errorCode?: string | null
}>()
const emit = defineEmits<{ close: []; remove: [publicReason: string, internalNote: string]; restore: [] }>()
const auth = useAuthStore()

const canModerate = computed(() => auth.can('CONTENT_REMOVE'))
const isRemoved = computed(() => props.request.status === 'REMOVED_BY_ADMIN')
const blockedExplanation = computed(() =>
  props.request.canRemove ? null : removeBlockedExplanation(props.request.removeBlockedReason))
const showDisputesLink = computed(() => !props.request.canRemove && isActiveShipmentBlock(props.request.removeBlockedReason))
const errorPointsToDisputes = computed(() => isActiveShipmentBlock(props.errorCode ?? null))

const photoUrls = computed(() => props.request.photos.map((p) => p.url))
const viewerUrls = ref<string[] | null>(null)

const confirmRemoveOpen = ref(false)
const confirmRestoreOpen = ref(false)

const removeMessage = computed(() => {
  const n = props.request.openNegotiationCount
  const negotiations = n === 0
    ? 'Aucune négociation ouverte n’est en cours.'
    : n === 1
      ? 'La négociation ouverte sera annulée et le voyageur concerné sera prévenu.'
      : `Les ${n} négociations ouvertes seront annulées et les voyageurs concernés seront prévenus.`
  return 'La demande sera masquée aux voyageurs. Seul le motif public est envoyé à l’expéditeur : '
    + 'la note interne reste dans le journal d’audit. ' + negotiations
})
const restoreMessage = 'La demande redevient visible avec son statut d’avant le retrait. '
  + 'Les négociations annulées lors du retrait ne reviennent pas : les voyageurs devront refaire une offre.'

function confirmRemove(internalNote: string, publicReason?: string) {
  // Le catalogue rend le motif obligatoire : le dialogue ne confirme pas sans lui.
  if (publicReason) emit('remove', publicReason, internalNote)
  confirmRemoveOpen.value = false
}
function confirmRestore() {
  emit('restore')
  confirmRestoreOpen.value = false
}

function fmtDate(d: string) { return new Date(d).toLocaleDateString('fr-FR') }
function fmtDateTime(d: string) { return new Date(d).toLocaleString('fr-FR') }
function money(amount: number | null, currency: string | null) {
  return amount === null || amount === undefined ? null : formatMajorAmount(amount, currency)
}
</script>

<template>
  <div
    class="fixed inset-0 z-40 flex justify-end bg-black/30" data-test="pr-detail-overlay"
    @click.self="emit('close')"
  >
    <aside
      class="h-full w-full max-w-xl bg-surface border-l border-border overflow-y-auto p-6"
      data-test="pr-detail" role="dialog" aria-modal="true" aria-labelledby="pr-detail-title"
    >
      <div class="flex items-start justify-between gap-4 mb-4">
        <div class="min-w-0">
          <h2 id="pr-detail-title" class="font-display text-xl font-bold text-balance">
            {{ request.departureCity }} → {{ request.arrivalCity }}
          </h2>
          <p class="text-sm text-text-muted">{{ request.senderName ?? 'Expéditeur inconnu' }}</p>
        </div>
        <div class="flex shrink-0 flex-col items-end gap-1">
          <StatusBadge v-bind="packageRequestStatusMeta(request.status)" />
          <span
            v-if="isRemoved && request.statusBeforeRemoval" data-test="pr-status-before"
            class="text-xs text-text-muted"
          >Avant retrait : {{ packageRequestStatusMeta(request.statusBeforeRemoval).label }}</span>
        </div>
      </div>

      <p class="mb-4 text-sm text-pretty" :class="request.description ? '' : 'text-text-muted italic'">
        {{ request.description ?? 'Aucune description' }}
      </p>

      <dl class="grid grid-cols-2 gap-3 text-sm mb-6">
        <div><dt class="text-text-muted">Date souhaitée</dt><dd class="tabular-nums">{{ request.desiredDate ? fmtDate(request.desiredDate) : 'Date flexible' }}</dd></div>
        <div><dt class="text-text-muted">Créée le</dt><dd class="tabular-nums">{{ fmtDate(request.createdAt) }}</dd></div>
        <div><dt class="text-text-muted">Poids</dt><dd class="tabular-nums">{{ request.weightKg !== null && request.weightKg !== undefined ? `${request.weightKg} kg` : 'Non renseigné' }}</dd></div>
        <div><dt class="text-text-muted">Taille</dt><dd>{{ parcelSizeLabel(request.parcelSize) }}</dd></div>
        <div><dt class="text-text-muted">Transport</dt><dd>{{ transportModeLabel(request.transportMode) }}</dd></div>
        <div><dt class="text-text-muted">Contenu</dt><dd>{{ request.contentCategory ?? 'Non renseigné' }}</dd></div>
        <div>
          <dt class="text-text-muted">Prix visé</dt>
          <dd class="tabular-nums">{{ money(request.targetPrice, request.currency) ?? 'À négocier' }}</dd>
          <dd class="text-xs text-text-muted">{{ request.negotiable ? 'Prix négociable' : 'Prix ferme' }}</dd>
        </div>
        <div><dt class="text-text-muted">Paiements acceptés</dt><dd>{{ paymentMethodsLabel(request.acceptedPaymentMethods) }}</dd></div>
        <div>
          <dt class="text-text-muted">Remise</dt>
          <dd>{{ request.pickupNeighborhood ?? 'Quartier non renseigné' }}</dd>
          <dd v-if="request.pickupAddressLabel" class="text-xs text-text-muted">{{ request.pickupAddressLabel }}</dd>
        </div>
        <div>
          <dt class="text-text-muted">Livraison</dt>
          <dd>{{ request.deliveryNeighborhood ?? 'Quartier non renseigné' }}</dd>
          <dd v-if="request.deliveryAddressLabel" class="text-xs text-text-muted">{{ request.deliveryAddressLabel }}</dd>
        </div>
      </dl>

      <section class="mb-6">
        <h3 class="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">Photos</h3>
        <div v-if="photoUrls.length" class="flex flex-wrap gap-2">
          <button
            v-for="(url, i) in photoUrls" :key="i" type="button" :data-test="`pr-photo-${i}`"
            :aria-label="`Agrandir la photo ${i + 1}`"
            class="h-20 w-20 overflow-hidden rounded-btn transition-[box-shadow] hover:ring-2 hover:ring-primary active:scale-[0.96]"
            @click="viewerUrls = photoUrls"
          >
            <img :src="url" alt="Photo du colis" class="h-full w-full object-cover outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10">
          </button>
        </div>
        <p v-else data-test="pr-no-photo" class="text-sm text-text-muted">Aucune photo jointe</p>
      </section>

      <section class="mb-6">
        <h3 class="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
          Négociations <span class="tabular-nums">({{ request.negotiations.length }})</span>
        </h3>
        <ul v-if="request.negotiations.length" class="divide-y divide-border rounded-card border border-border">
          <li
            v-for="n in request.negotiations" :key="n.id" :data-test="`pr-negotiation-${n.id}`"
            class="flex items-center justify-between gap-3 px-3 py-2 text-sm"
          >
            <div class="min-w-0">
              <div class="font-medium truncate">{{ n.travelerName ?? 'Voyageur inconnu' }}</div>
              <div class="text-xs text-text-muted tabular-nums">Mise à jour le {{ fmtDateTime(n.updatedAt) }}</div>
            </div>
            <div class="flex shrink-0 items-center gap-2">
              <span class="tabular-nums">{{ money(n.lastPrice, n.currency) ?? 'Aucun prix' }}</span>
              <StatusBadge v-bind="negotiationStatusMeta(n.status)" />
            </div>
          </li>
        </ul>
        <p v-else class="text-sm text-text-muted">Aucune négociation</p>
      </section>

      <section class="mb-6">
        <h3 class="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
          Signalements <span class="tabular-nums">({{ request.reports.length }})</span>
        </h3>
        <ul v-if="request.reports.length" class="space-y-2">
          <li
            v-for="r in request.reports" :key="r.id" :data-test="`pr-report-${r.id}`"
            class="rounded-card border border-border px-3 py-2 text-sm"
          >
            <div class="flex items-center justify-between gap-3">
              <span class="font-medium">{{ reportReasonLabel(r.reason) }}</span>
              <span class="text-xs text-text-muted tabular-nums">{{ fmtDateTime(r.createdAt) }}</span>
            </div>
            <p v-if="r.details" class="mt-1 text-text-muted text-pretty">{{ r.details }}</p>
            <p class="mt-1 text-xs text-text-muted">Signalé par {{ r.reporterName ?? 'un utilisateur inconnu' }}</p>
          </li>
        </ul>
        <p v-else class="text-sm text-text-muted">Aucun signalement</p>
      </section>

      <p
        v-if="error" data-test="pr-action-error" role="alert"
        class="mb-4 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
      >
        {{ error }}
        <NuxtLink
          v-if="errorPointsToDisputes" to="/incidents" data-test="pr-error-disputes-link"
          class="ml-1 underline underline-offset-2"
        >Ouvrir les litiges</NuxtLink>
      </p>

      <section v-if="canModerate" data-test="pr-actions" class="mb-6 rounded-card border border-border p-4">
        <h3 class="text-sm font-semibold mb-2">Modération</h3>
        <template v-if="!isRemoved">
          <button
            type="button" data-test="pr-remove" :disabled="busy || !request.canRemove"
            class="rounded-btn px-4 py-2 text-sm bg-danger/15 text-danger transition-[background-color,scale] hover:bg-danger/25 active:scale-[0.96] disabled:opacity-40 disabled:active:scale-100"
            @click="confirmRemoveOpen = true"
          >Retirer la demande</button>
          <p v-if="blockedExplanation" data-test="pr-remove-blocked" class="mt-2 text-sm text-text-muted text-pretty">
            {{ blockedExplanation }}
            <NuxtLink
              v-if="showDisputesLink" to="/incidents" data-test="pr-disputes-link"
              class="ml-1 text-primary underline-offset-2 hover:underline"
            >Ouvrir les litiges</NuxtLink>
          </p>
        </template>
        <button
          v-if="request.canRestore" type="button" data-test="pr-restore" :disabled="busy"
          class="rounded-btn px-4 py-2 text-sm bg-success/15 text-success transition-[background-color,scale] hover:bg-success/25 active:scale-[0.96] disabled:opacity-40"
          @click="confirmRestoreOpen = true"
        >Restaurer la demande</button>
      </section>

      <button
        type="button" data-test="pr-close"
        class="rounded-btn px-4 py-2 text-sm border border-border hover:bg-surface-elevated transition-colors"
        @click="emit('close')"
      >Fermer</button>
    </aside>

    <PhotoViewer :urls="viewerUrls" title="Photos de la demande" alt="Photo du colis" @close="viewerUrls = null" />

    <ConfirmActionDialog
      :open="confirmRemoveOpen"
      title="Retirer cette demande"
      :message="removeMessage"
      confirm-label="Retirer"
      :reason-options="PACKAGE_REQUEST_REMOVAL_REASONS"
      @confirm="confirmRemove"
      @cancel="confirmRemoveOpen = false"
    />
    <ConfirmActionDialog
      :open="confirmRestoreOpen"
      title="Restaurer cette demande"
      :message="restoreMessage"
      confirm-label="Restaurer"
      confirm-tone="primary"
      @confirm="confirmRestore"
      @cancel="confirmRestoreOpen = false"
    />
  </div>
</template>
