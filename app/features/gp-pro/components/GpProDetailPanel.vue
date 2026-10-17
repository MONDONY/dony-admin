<script setup lang="ts">
import { computed, ref } from 'vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import GpProDecisionDialog from './GpProDecisionDialog.vue'
import { gpProService } from '@/features/gp-pro/services/gpProService'
import { useGpProAction } from '@/features/gp-pro/composables/useGpProAction'
import {
  GP_PRO_UNAVAILABLE, applicationStatusMeta, documentTypeLabel, fmtDate, frequencyLabel, sourceLabel,
} from '@/features/gp-pro/types/index'
import type { AdminGpProApplicationDetail } from '@/features/gp-pro/types/index'
import { useAuthStore } from '@/stores/auth'

/**
 * Fiche d'une demande GP Pro : la demande, le profil du demandeur, ses justificatifs
 * facultatifs (liens de 15 minutes) et la décision. Les décisions sont exécutées ici ; le
 * parent relit la file (`decided`) ou la fiche (`stale`, `refresh`).
 */
const props = defineProps<{
  applicationId: string
  detail: AdminGpProApplicationDetail | null
  loading: boolean
  error: string | null
}>()
const emit = defineEmits<{ close: []; decided: []; stale: []; refresh: [] }>()
const auth = useAuthStore()

const action = useGpProAction({ onStale: () => emit('stale') })
const mode = ref<'approve' | 'reject' | null>(null)

const title = computed(() => props.detail?.displayName ?? `Demande ${props.applicationId.slice(0, 8)}`)
const isPending = computed(() => props.detail?.status === 'PENDING')
const kycVerified = computed(() => props.detail?.kycStatus === 'VERIFIED')
const canDecide = computed(() => auth.can('GP_PRO_REVIEW') && isPending.value && !action.unavailable.value)
const documents = computed(() => props.detail?.documents ?? [])
const lastFive = computed(() => props.detail?.lastFiveRatings ?? [])
const rating = computed(() => {
  const r = props.detail?.averageRating
  return r == null ? 'Aucune note' : `${Number(r).toFixed(1)} / 5`
})

function openDialog(next: 'approve' | 'reject') {
  action.clearError()
  mode.value = next
}

async function onSubmit(reason: string) {
  const id = props.applicationId
  const ok = mode.value === 'approve'
    ? await action.run(() => gpProService.approve(id))
    : await action.run(() => gpProService.reject(id, reason))
  // Succès ou endpoint absent : le dialogue n'a plus lieu d'être. Sur un refus du back, il
  // reste ouvert pour que le message se lise à côté de la saisie.
  if (ok || action.unavailable.value) mode.value = null
  if (ok) emit('decided')
}
</script>

<template>
  <div class="fixed inset-0 z-40 flex justify-end bg-black/30" data-test="gp-pro-detail-overlay" @click.self="emit('close')">
    <aside
      class="h-full w-full max-w-xl bg-surface border-l border-border overflow-y-auto p-6"
      data-test="gp-pro-detail" role="dialog" aria-modal="true" aria-labelledby="gp-pro-detail-title"
    >
      <div class="flex items-start justify-between gap-4 mb-5">
        <div class="min-w-0">
          <h2 id="gp-pro-detail-title" class="font-display text-xl font-bold text-balance">{{ title }}</h2>
          <NuxtLink
            v-if="detail" :to="`/users?open=${detail.userId}`" data-test="gp-pro-user-link"
            class="text-sm text-primary underline-offset-2 hover:underline"
          >Ouvrir la fiche utilisateur</NuxtLink>
        </div>
        <button
          type="button" data-test="gp-pro-detail-close"
          class="shrink-0 rounded-btn px-3 py-1.5 text-sm border border-border hover:bg-surface-elevated transition-colors"
          @click="emit('close')"
        >Fermer</button>
      </div>

      <p v-if="loading" data-test="gp-pro-detail-loading" class="text-sm text-text-muted">Chargement de la demande…</p>
      <p
        v-else-if="!detail && error" data-test="gp-pro-detail-error" role="alert"
        class="rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
      >{{ error }}</p>

      <template v-else-if="detail">
        <section class="mb-6">
          <h3 class="text-sm font-semibold mb-2">Demande</h3>
          <dl class="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt class="text-text-muted">Statut</dt>
              <dd data-test="gp-pro-detail-status"><StatusBadge v-bind="applicationStatusMeta(detail.status)" /></dd>
            </div>
            <div><dt class="text-text-muted">Origine</dt><dd>{{ sourceLabel(detail.source) }}</dd></div>
            <div><dt class="text-text-muted">Fréquence de voyage</dt><dd data-test="gp-pro-detail-frequency">{{ frequencyLabel(detail.travelFrequency) }}</dd></div>
            <div>
              <dt class="text-text-muted">Nom commercial</dt>
              <dd data-test="gp-pro-detail-commercial" :class="detail.commercialName ? '' : 'text-text-muted'">{{ detail.commercialName ?? 'Non renseigné' }}</dd>
            </div>
            <div><dt class="text-text-muted">Reçue le</dt><dd class="tabular-nums">{{ fmtDate(detail.createdAt) }}</dd></div>
          </dl>
        </section>

        <section class="mb-6">
          <h3 class="text-sm font-semibold mb-2">Profil</h3>
          <dl class="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt class="text-text-muted">Identité</dt>
              <dd data-test="gp-pro-detail-kyc" :class="kycVerified ? 'text-success' : 'text-warning'">
                {{ kycVerified ? 'Vérifiée' : (detail.kycStatus ?? 'Inconnue') }}
              </dd>
            </div>
            <div><dt class="text-text-muted">Membre depuis</dt><dd class="tabular-nums">{{ fmtDate(detail.memberSince) }}</dd></div>
            <div><dt class="text-text-muted">Trajets publiés</dt><dd class="tabular-nums" data-test="gp-pro-detail-trips">{{ detail.publishedTrips ?? 0 }}</dd></div>
            <div><dt class="text-text-muted">Trajets sur 8 semaines</dt><dd class="tabular-nums">{{ detail.tripsLast56Days ?? 0 }}</dd></div>
            <div><dt class="text-text-muted">Livraisons</dt><dd class="tabular-nums">{{ detail.completedDeliveries ?? 0 }}</dd></div>
            <div><dt class="text-text-muted">Note moyenne</dt><dd class="tabular-nums" data-test="gp-pro-detail-rating">{{ rating }}</dd></div>
            <div class="col-span-2">
              <dt class="text-text-muted">5 dernières notes</dt>
              <dd class="tabular-nums" data-test="gp-pro-detail-last-five">{{ lastFive.length ? lastFive.join(' · ') : 'Aucune' }}</dd>
            </div>
            <div>
              <dt class="text-text-muted">Litiges ouverts</dt>
              <dd class="tabular-nums" :class="(detail.openDisputes ?? 0) > 0 ? 'text-danger font-semibold' : ''">{{ detail.openDisputes ?? 0 }}</dd>
            </div>
            <div>
              <dt class="text-text-muted">Signalements ouverts</dt>
              <dd class="tabular-nums" :class="(detail.openReports ?? 0) > 0 ? 'text-danger font-semibold' : ''">{{ detail.openReports ?? 0 }}</dd>
            </div>
          </dl>
        </section>

        <section class="mb-6" data-test="gp-pro-detail-documents">
          <div class="mb-2 flex items-baseline justify-between gap-3">
            <h3 class="text-sm font-semibold">Justificatifs</h3>
            <button
              v-if="documents.length" type="button" data-test="gp-pro-detail-refresh"
              class="text-xs text-primary underline-offset-2 hover:underline"
              @click="emit('refresh')"
            >Nouveaux liens</button>
          </div>
          <!-- Facultatifs : leur absence n'est pas un manque, aucun ton d'alerte ici. -->
          <p v-if="documents.length === 0" data-test="gp-pro-detail-no-documents" class="text-sm text-text-muted text-pretty">
            Aucun justificatif joint. Ils sont facultatifs.
          </p>
          <template v-else>
            <ul class="space-y-1.5">
              <li v-for="d in documents" :key="d.id">
                <a
                  :href="d.url" target="_blank" rel="noopener noreferrer" :data-test="`gp-pro-doc-${d.id}`"
                  class="text-sm text-primary underline-offset-2 hover:underline"
                >{{ documentTypeLabel(d.type) }}</a>
              </li>
            </ul>
            <p class="mt-2 text-xs text-text-muted text-pretty">
              Liens valables 15 minutes. Les fichiers sont supprimés dès la décision.
            </p>
          </template>
        </section>

        <p
          v-if="error" data-test="gp-pro-detail-refresh-error" role="alert"
          class="mb-3 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
        >{{ error }}</p>

        <section v-if="isPending" data-test="gp-pro-actions" class="rounded-card border border-border p-4">
          <h3 class="text-sm font-semibold mb-3">Décision</h3>
          <p v-if="action.unavailable.value" data-test="gp-pro-actions-unavailable" class="mb-3 text-xs text-text-muted">{{ GP_PRO_UNAVAILABLE }}</p>
          <div v-if="canDecide" class="flex flex-wrap gap-2">
            <button
              type="button" data-test="gp-pro-approve" :disabled="action.busy.value || !kycVerified"
              class="rounded-btn px-4 py-2 text-sm font-medium bg-success/15 text-success hover:bg-success/25 transition-[background-color,scale] active:scale-[0.96] disabled:opacity-40 disabled:active:scale-100"
              @click="openDialog('approve')"
            >Accepter</button>
            <button
              type="button" data-test="gp-pro-reject" :disabled="action.busy.value"
              class="rounded-btn px-4 py-2 text-sm font-medium bg-danger/15 text-danger hover:bg-danger/25 transition-[background-color,scale] active:scale-[0.96] disabled:opacity-40 disabled:active:scale-100"
              @click="openDialog('reject')"
            >Refuser</button>
          </div>
          <p v-if="canDecide && !kycVerified" data-test="gp-pro-approve-kyc-hint" class="mt-2 text-xs text-text-muted text-pretty">
            Acceptation impossible : l’identité n’est plus vérifiée.
          </p>
        </section>
      </template>

      <GpProDecisionDialog
        :open="mode !== null" :mode="mode ?? 'approve'" :user-name="title"
        :busy="action.busy.value" :error="action.error.value"
        @submit="onSubmit" @cancel="mode = null"
      />
    </aside>
  </div>
</template>
