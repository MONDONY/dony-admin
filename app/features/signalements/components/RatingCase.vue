<script setup lang="ts">
import { computed } from 'vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import ReportRelatedList from './ReportRelatedList.vue'
import ReportTimeline from './ReportTimeline.vue'
import { memberSinceLabel } from '@/features/signalements/reportContext'
import {
  buildRatingTimeline,
  distributionBars,
  formatAverage,
  raterHabit,
  sameRelationText,
} from '@/features/signalements/ratingWorkbench'
import type { AdminRating, RatingContext } from '@/features/signalements/types/index'
import { useAuthStore } from '@/stores/auth'
import { bidRoute, gate, toHref, userRoute } from '@/lib/adminLinks'

const props = withDefaults(defineProps<{
  rating: AdminRating | null
  /** Contexte du dossier (notant, noté, signalements, historique) ; null tant qu'il charge ou sur un ancien back. */
  context?: RatingContext | null
  contextLoading?: boolean
  contextError?: string | null
}>(), { context: null, contextLoading: false, contextError: null })
const emit = defineEmits<{ openReport: [id: string] }>()

const auth = useAuthStore()
function fmt(d: string) { return new Date(d).toLocaleString('fr-FR') }
function stars(n: number) { return '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n)) }
function accountLink(userId: string): string | null {
  const route = gate(auth.can, 'USER_VIEW', userRoute(userId))
  return route ? toHref(route) : null
}

/** Livraison à laquelle l'avis se rapporte, si l'admin peut la voir. */
const deliveryLink = computed(() => {
  const id = props.rating?.bidId
  if (!id) return null
  const route = gate(auth.can, 'BID_VIEW', bidRoute(id))
  return route ? toHref(route) : null
})
const deletedInfo = computed(() => {
  const r = props.rating
  if (!r?.deletedAt) return null
  const when = `Supprimé le ${fmt(r.deletedAt)}`
  return r.deletedByAdminEmail ? `${when} par ${r.deletedByAdminEmail}` : when
})

const rater = computed(() => props.context?.rater ?? null)
const rated = computed(() => props.context?.rated ?? null)
const habit = computed(() => (rater.value ? raterHabit(rater.value) : null))
const sameRelation = computed(() => (props.context && props.rating
  ? sameRelationText(props.context.sameRelationCount, props.rating.raterName, props.rating.ratedName) : null))
const bars = computed(() => distributionBars(rated.value?.distribution))
const reports = computed(() => props.context?.reports ?? [])
const timeline = computed(() => (props.rating && props.context ? buildRatingTimeline(props.rating, props.context.history) : []))
</script>

<template>
  <article aria-label="Dossier de l’avis" data-test="rating-case" class="flex flex-col gap-3">
    <p
      v-if="!rating" data-test="rating-case-empty"
      class="rounded-card border border-border bg-surface px-5 py-8 text-center text-sm text-text-muted"
    >Aucun avis sélectionné.</p>

    <template v-else>
      <!-- En-tête : la note, l'état, la date -->
      <header class="flex flex-col gap-3 rounded-card border border-border bg-surface p-5">
        <div class="flex flex-wrap items-center gap-2">
          <span
            class="text-xl tabular-nums text-warning" role="img" data-test="rating-case-stars"
            :aria-label="`${rating.score} étoile${rating.score > 1 ? 's' : ''} sur 5`"
          >{{ stars(rating.score) }}</span>
          <span class="font-display text-lg font-semibold tabular-nums">{{ rating.score }}/5</span>
          <StatusBadge v-if="rating.flagged" data-test="rating-case-flagged" label="Signalé" tone="danger" />
          <StatusBadge v-if="rating.excluded && !rating.deletedAt" data-test="rating-case-excluded" label="Exclu de la moyenne" tone="warning" />
          <StatusBadge v-if="rating.deletedAt" data-test="rating-case-deleted" label="Supprimé" tone="neutral" />
        </div>
        <p class="text-xs text-text-muted tabular-nums">
          Laissé le {{ fmt(rating.createdAt) }} · {{ rating.raterName ?? 'Anonyme' }} → {{ rating.ratedName ?? 'Compte supprimé' }}
          <template v-if="deliveryLink"> ·
            <NuxtLink :to="deliveryLink" data-test="rating-case-delivery" class="text-primary underline-offset-2 hover:underline">Voir la livraison</NuxtLink>
          </template>
        </p>

        <blockquote
          data-test="rating-case-comment"
          :class="['m-0 rounded-btn bg-surface-elevated px-4 py-3 text-sm text-pretty', rating.excluded ? 'text-text-muted' : '']"
        >
          <span class="mb-1 block text-xs font-medium uppercase tracking-wide text-text-muted">Ce qu’a écrit {{ rating.raterName ?? 'le notant' }}</span>
          <span :class="rating.excluded ? 'line-through' : ''">{{ rating.comment ?? 'Sans commentaire' }}</span>
        </blockquote>
        <p v-if="rating.excluded && rating.excludedReason" data-test="rating-case-excluded-reason" class="text-xs text-warning text-pretty">
          Exclu : {{ rating.excludedReason }}
        </p>
        <div v-if="rating.deletedAt" :data-test="`rating-deleted-info-${rating.id}`" class="text-xs text-text-muted text-pretty">
          <span class="tabular-nums">{{ deletedInfo }}</span>
          <span v-if="rating.deleteReason" class="block">Motif : {{ rating.deleteReason }}</span>
        </div>
      </header>

      <p v-if="contextLoading" data-test="rating-context-loading" role="status" class="px-1 text-xs text-text-muted">Chargement du contexte…</p>
      <p v-else-if="contextError" data-test="rating-context-error" role="status" class="px-1 text-xs text-text-muted">{{ contextError }}</p>

      <!-- Le notant et la personne notée -->
      <div v-if="context" class="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
        <section class="rounded-card border border-border bg-surface p-5" aria-label="Notant">
          <p class="mb-1 text-xs font-medium uppercase tracking-wide text-text-muted">Notant</p>
          <template v-if="rater">
            <p class="text-sm font-semibold">
              <NuxtLink
                v-if="accountLink(rater.userId)" :to="accountLink(rater.userId)!" data-test="rating-rater-link"
                class="text-primary underline-offset-2 hover:underline"
              >{{ rater.displayName ?? 'Compte' }}</NuxtLink>
              <template v-else>{{ rater.displayName ?? 'Compte' }}</template>
            </p>
            <StatusBadge v-if="habit" data-test="rating-rater-habit" class="mt-1.5" :label="habit.label" :tone="habit.tone" />
            <ul class="mt-2 space-y-0.5 text-xs text-text-muted">
              <li v-if="memberSinceLabel(rater.memberSince)">{{ memberSinceLabel(rater.memberSince) }}</li>
              <li data-test="rating-rater-given">
                {{ rater.ratingsGiven }} avis donné{{ rater.ratingsGiven > 1 ? 's' : '' }}<template v-if="rater.averageGiven != null">, moyenne {{ formatAverage(rater.averageGiven) }}</template>
              </li>
              <li v-if="rater.lowRatingsGiven > 0" data-test="rating-rater-low">dont {{ rater.lowRatingsGiven }} de 2 étoiles ou moins</li>
            </ul>
          </template>
          <p v-else data-test="rating-rater-anonymous" class="text-sm text-text-muted text-pretty">Avis anonyme (destinataire du colis) ou compte supprimé.</p>
          <p v-if="sameRelation" data-test="rating-same-relation" class="mt-2 text-xs font-medium text-warning text-pretty">{{ sameRelation }}</p>
        </section>

        <section class="rounded-card border border-border bg-surface p-5" aria-label="Personne notée">
          <p class="mb-1 text-xs font-medium uppercase tracking-wide text-text-muted">Personne notée</p>
          <template v-if="rated">
            <p class="text-sm font-semibold">
              <NuxtLink
                v-if="accountLink(rated.userId)" :to="accountLink(rated.userId)!" data-test="rating-rated-link"
                class="text-primary underline-offset-2 hover:underline"
              >{{ rated.displayName ?? 'Compte' }}</NuxtLink>
              <template v-else>{{ rated.displayName ?? 'Compte' }}</template>
            </p>
            <p data-test="rating-rated-average" class="mt-1 text-sm tabular-nums">
              <span class="text-warning">★</span>
              <template v-if="rated.averageRating != null"> {{ formatAverage(rated.averageRating) }}</template>
              <template v-else> aucune moyenne</template>
              <span class="text-text-muted"> · {{ rated.ratingCount }} avis compté{{ rated.ratingCount > 1 ? 's' : '' }}</span>
            </p>
            <p v-if="rated.excludedCount > 0" data-test="rating-rated-excluded" class="text-xs text-text-muted">
              {{ rated.excludedCount }} exclu{{ rated.excludedCount > 1 ? 's' : '' }} de la moyenne
            </p>
            <!-- Répartition des notes comptées -->
            <ul class="mt-2 space-y-1" aria-label="Répartition des notes" data-test="rating-distribution">
              <li v-for="b in bars" :key="b.stars" class="flex items-center gap-2 text-xs text-text-muted">
                <span class="w-3 tabular-nums">{{ b.stars }}</span>
                <span class="h-1.5 flex-1 overflow-hidden rounded-full bg-border/40" aria-hidden="true">
                  <span class="block h-full rounded-full bg-warning" :style="{ width: `${Math.round(b.ratio * 100)}%` }" />
                </span>
                <span class="w-6 text-right tabular-nums">{{ b.count }}</span>
              </li>
            </ul>
          </template>
          <p v-else class="text-sm text-text-muted">Compte supprimé.</p>
        </section>
      </div>

      <!-- Signalements qui visent cet avis -->
      <section
        v-if="context?.reportsRestricted" data-test="rating-reports-restricted"
        class="rounded-card border border-border bg-surface px-5 py-3 text-xs text-text-muted text-pretty"
      >Les signalements qui visent cet avis ne sont pas visibles avec votre rôle.</section>
      <section
        v-else-if="reports.length" aria-label="Signalements sur cet avis" data-test="rating-reports"
        class="rounded-card border border-border bg-surface p-5"
      >
        <h3 class="mb-2 font-display text-sm font-semibold">
          Signalements sur cet avis
          <span v-if="context && context.openReports > 0" data-test="rating-reports-open" class="ml-1 font-normal text-text-muted">· {{ context.openReports }} ouvert{{ context.openReports > 1 ? 's' : '' }}</span>
        </h3>
        <ReportRelatedList :items="reports" @open="(id) => emit('openReport', id)" />
      </section>

      <!-- Historique -->
      <section
        v-if="context" aria-label="Historique" data-test="rating-history"
        class="rounded-card border border-border bg-surface p-5"
      >
        <h3 class="mb-3 font-display text-sm font-semibold">Historique</h3>
        <ReportTimeline :items="timeline" />
      </section>
    </template>
  </article>
</template>
