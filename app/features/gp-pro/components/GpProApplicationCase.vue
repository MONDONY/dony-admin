<script setup lang="ts">
import { computed } from 'vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { kycStatusMeta } from '@/features/kyc/types/index'
import { ageLabel, applicantName, attentionPoints } from '@/features/gp-pro/lib/gpProWorkbench'
import {
  applicationStatusMeta, documentTypeLabel, fmtDate, frequencyLabel, sourceLabel,
} from '@/features/gp-pro/types/index'
import type { AdminGpProApplicationDetail, AdminGpProApplicationRow } from '@/features/gp-pro/types/index'

/**
 * Demande GP Pro au centre du poste : points d'attention, la demande, le profil du demandeur et ses
 * justificatifs facultatifs (liens de 15 minutes, supprimés dès la décision).
 */
const props = defineProps<{
  /** Ligne de la file ; absente quand la demande est ouverte par lien profond. */
  row: AdminGpProApplicationRow | null
  applicationId: string
  detail: AdminGpProApplicationDetail | null
  loading: boolean
  /** Échec du chargement (dossier absent) ou d'une relecture (dossier affiché). */
  error: string | null
  now?: number
}>()
const emit = defineEmits<{ refresh: [] }>()

const title = computed(() => props.detail?.displayName ?? (props.row ? applicantName(props.row) : `Demande ${props.applicationId.slice(0, 8)}`))
const received = computed(() => props.detail?.createdAt ?? props.row?.createdAt ?? null)
const subline = computed(() => {
  const parts: string[] = []
  if (received.value) parts.push(`Reçue le ${fmtDate(received.value)}`)
  const age = ageLabel(received.value, props.now)
  if (age && props.detail?.status === 'PENDING') parts.push(`${age} d’attente`)
  return parts.join(' · ')
})
const points = computed(() => (props.detail ? attentionPoints(props.detail) : []))
const documents = computed(() => props.detail?.documents ?? [])
const lastFive = computed(() => props.detail?.lastFiveRatings ?? [])
const kycVerified = computed(() => props.detail?.kycStatus === 'VERIFIED')
const kycLabel = computed(() => {
  if (kycVerified.value) return 'Vérifiée'
  const status = props.detail?.kycStatus
  return status ? kycStatusMeta(status).label : 'Inconnue'
})
const rating = computed(() => {
  const r = props.detail?.averageRating
  return r == null ? 'Aucune note' : `${Number(r).toFixed(1)} / 5`
})
const alertCls = (n: number | undefined) => ((n ?? 0) > 0 ? 'border-danger/40 bg-danger/5 text-danger' : 'border-border bg-surface')
</script>

<template>
  <section aria-label="Demande" class="flex min-w-0 flex-col overflow-hidden rounded-card border border-border bg-surface" data-test="gp-pro-case">
    <header class="border-b border-border px-5 py-4">
      <div class="flex flex-wrap items-center gap-2">
        <span v-if="detail" data-test="gp-pro-detail-status"><StatusBadge v-bind="applicationStatusMeta(detail.status)" /></span>
        <span v-if="detail?.source || row?.source" class="rounded-full bg-surface-elevated px-2 py-0.5 text-xs font-medium text-text-muted">{{ sourceLabel(detail?.source ?? row?.source) }}</span>
      </div>
      <h2 id="gp-pro-detail-title" class="mt-2 font-display text-xl font-bold text-balance" data-test="gp-pro-case-title">{{ title }}</h2>
      <p v-if="subline" class="mt-0.5 text-sm tabular-nums text-text-muted" data-test="gp-pro-case-subline">{{ subline }}</p>
    </header>

    <div class="flex flex-col gap-5 p-5">
      <p v-if="loading" data-test="gp-pro-detail-loading" class="text-sm text-text-muted">Chargement de la demande…</p>
      <p
        v-else-if="!detail && error" data-test="gp-pro-detail-error" role="alert"
        class="rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
      >{{ error }}</p>

      <template v-else-if="detail">
        <p
          v-if="error" data-test="gp-pro-detail-refresh-error" role="alert"
          class="rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
        >{{ error }}</p>

        <div
          v-if="points.length" data-test="gp-pro-attention"
          class="rounded-card border border-warning/40 bg-warning/10 px-4 py-3 text-sm"
        >
          <p class="font-semibold">{{ points.length > 1 ? `${points.length} points à regarder avant de décider` : 'Un point à regarder avant de décider' }}</p>
          <ul class="mt-1.5 divide-y divide-warning/30">
            <li v-for="p in points" :key="p.key" :data-test="`gp-pro-attention-${p.key}`" class="flex gap-2 py-1.5 text-pretty">
              <span class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" aria-hidden="true" />
              <span>{{ p.label }}</span>
            </li>
          </ul>
        </div>
        <p
          v-else data-test="gp-pro-attention-none"
          class="rounded-card border border-success/40 bg-success/10 px-4 py-3 text-sm text-pretty"
        ><b>Rien d’inquiétant dans le profil.</b> Identité vérifiée, aucun litige ni signalement ouvert, aucune note sous 4/5.</p>

        <section>
          <h3 class="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">La demande</h3>
          <dl class="divide-y divide-border rounded-card border border-border px-4 text-sm">
            <div class="flex justify-between gap-3 py-2"><dt class="text-text-muted">Fréquence de voyage</dt><dd class="text-right font-medium" data-test="gp-pro-detail-frequency">{{ frequencyLabel(detail.travelFrequency) }}</dd></div>
            <div class="flex justify-between gap-3 py-2">
              <dt class="text-text-muted">Nom commercial</dt>
              <dd class="text-right font-medium" data-test="gp-pro-detail-commercial" :class="detail.commercialName ? '' : 'text-text-muted'">{{ detail.commercialName ?? 'Non renseigné' }}</dd>
            </div>
            <div class="flex justify-between gap-3 py-2"><dt class="text-text-muted">Origine</dt><dd class="text-right font-medium">{{ sourceLabel(detail.source) }}</dd></div>
          </dl>
        </section>

        <section>
          <h3 class="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">Profil du demandeur</h3>
          <div class="grid grid-cols-3 gap-2.5">
            <div :class="['rounded-btn border px-3 py-2', kycVerified ? 'border-border bg-surface' : 'border-danger/40 bg-danger/5']">
              <span class="block text-xs text-text-muted">Identité</span>
              <span class="block text-base font-bold" data-test="gp-pro-detail-kyc" :class="kycVerified ? 'text-success' : 'text-danger'">{{ kycLabel }}</span>
            </div>
            <div class="rounded-btn border border-border bg-surface px-3 py-2"><span class="block text-xs text-text-muted">Membre depuis</span><span class="block text-base font-bold tabular-nums">{{ detail.memberSince ? fmtDate(detail.memberSince) : 'Inconnu' }}</span></div>
            <div class="rounded-btn border border-border bg-surface px-3 py-2"><span class="block text-xs text-text-muted">Livraisons</span><span class="block text-base font-bold tabular-nums">{{ detail.completedDeliveries ?? 0 }}</span></div>
            <div class="rounded-btn border border-border bg-surface px-3 py-2"><span class="block text-xs text-text-muted">Trajets publiés</span><span class="block text-base font-bold tabular-nums" data-test="gp-pro-detail-trips">{{ detail.publishedTrips ?? 0 }}</span></div>
            <div class="rounded-btn border border-border bg-surface px-3 py-2"><span class="block text-xs text-text-muted">Sur 8 semaines</span><span class="block text-base font-bold tabular-nums">{{ detail.tripsLast56Days ?? 0 }}</span></div>
            <div class="rounded-btn border border-border bg-surface px-3 py-2"><span class="block text-xs text-text-muted">Note moyenne</span><span class="block text-base font-bold tabular-nums" data-test="gp-pro-detail-rating">{{ rating }}</span></div>
            <div :class="['rounded-btn border px-3 py-2', alertCls(detail.openDisputes)]" data-test="gp-pro-detail-disputes"><span class="block text-xs text-text-muted">Litiges ouverts</span><span class="block text-base font-bold tabular-nums">{{ detail.openDisputes ?? 0 }}</span></div>
            <div :class="['rounded-btn border px-3 py-2', alertCls(detail.openReports)]" data-test="gp-pro-detail-reports"><span class="block text-xs text-text-muted">Signalements ouverts</span><span class="block text-base font-bold tabular-nums">{{ detail.openReports ?? 0 }}</span></div>
          </div>
          <p class="mt-2 text-sm text-text-muted tabular-nums">5 dernières notes : <span data-test="gp-pro-detail-last-five">{{ lastFive.length ? lastFive.join(' · ') : 'Aucune' }}</span></p>
        </section>

        <section data-test="gp-pro-detail-documents">
          <div class="mb-1.5 flex items-baseline justify-between gap-3">
            <h3 class="text-xs font-semibold uppercase tracking-wide text-text-muted">Justificatifs <span class="font-normal normal-case tracking-normal">· facultatifs</span></h3>
            <button
              v-if="documents.length" type="button" data-test="gp-pro-detail-refresh"
              class="text-xs text-primary underline-offset-2 hover:underline"
              @click="emit('refresh')"
            >Nouveaux liens</button>
          </div>
          <!-- Facultatifs : leur absence n'est pas un manque, aucun ton d'alerte ici. -->
          <p v-if="documents.length === 0" data-test="gp-pro-detail-no-documents" class="rounded-card border border-border px-4 py-3 text-sm text-text-muted text-pretty">
            Aucun justificatif joint. Ils sont facultatifs.
          </p>
          <div v-else class="rounded-card border border-border px-4 py-3">
            <ul class="space-y-1.5">
              <li v-for="d in documents" :key="d.id">
                <a
                  :href="d.url" target="_blank" rel="noopener noreferrer" :data-test="`gp-pro-doc-${d.id}`"
                  class="text-sm text-primary underline-offset-2 hover:underline"
                >{{ documentTypeLabel(d.type) }} ↗</a>
              </li>
            </ul>
            <p class="mt-2 text-xs text-text-muted text-pretty">Liens valables 15 minutes. Les fichiers sont supprimés dès la décision.</p>
          </div>
        </section>
      </template>
    </div>
  </section>
</template>
