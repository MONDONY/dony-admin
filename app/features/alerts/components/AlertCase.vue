<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { alertSeverityMeta } from './alertSeverity'
import AlertRowsTable from './AlertRowsTable.vue'
import AlertStripeFix from './AlertStripeFix.vue'
import { alertPaymentId } from '@/features/payments/lib/stripeResync'
import { alertFacts, alertGuide, alertLinks, alertSampleRows, alertSummary, entityLink, isMoneyInvariant } from '@/features/alerts/lib/alertCatalog'
import ReportTimeline from '@/features/signalements/components/ReportTimeline.vue'
import { alertAge, buildAlertTimeline, isSnoozed } from '@/features/alerts/lib/alertWorkbench'
import { alertsService } from '@/features/alerts/services/alertsService'
import type { AdminAlert, AlertContext, AlertViolations } from '@/features/alerts/types/index'
import { extractProblemMessage } from '@/lib/problemDetail'
import { formatAlertDate } from '@/features/alerts/lib/alertDate'

/**
 * Dossier de l'alerte, au centre du poste : ce qui s'est passé, les étapes à suivre, les gestes
 * directs (resynchroniser, forcer le versement), les lignes en faute et les données de la levée.
 */
const props = withDefaults(defineProps<{
  alert: AdminAlert | null
  now?: number
  /** Autres alertes sur le même paiement ou colis, et historique ; null tant qu'il charge ou sur un ancien back. */
  context?: AlertContext | null
  contextLoading?: boolean
  contextError?: string | null
}>(), { now: undefined, context: null, contextLoading: false, contextError: null })
const emit = defineEmits<{ 'auto-resolved': [ids: string[]]; changed: []; resolve: [id: string]; openAlert: [id: string] }>()

const guide = computed(() => props.alert ? alertGuide(props.alert.type) : null)
const facts = computed(() => props.alert ? alertFacts(props.alert) : [])
const links = computed(() => props.alert ? alertLinks(props.alert) : [])
const samples = computed(() => props.alert ? alertSampleRows(props.alert) : [])
/** Paiement visé : la section « Corriger » n'apparaît que s'il est identifié. */
const fixPaymentId = computed(() => props.alert ? alertPaymentId(props.alert) : null)
const moneyInvariant = computed(() => !!props.alert && isMoneyInvariant(props.alert.type))
const age = computed(() => (props.alert && !props.alert.resolved ? alertAge(props.alert, props.now) : null))
const snoozed = computed(() => !!props.alert && isSnoozed(props.alert, props.now))
const related = computed(() => props.context?.related ?? [])
const timeline = computed(() => (props.alert && props.context ? buildAlertTimeline(props.alert, props.context.history) : []))
const AGE_TONE = { neutral: 'text-text-muted', warning: 'text-warning', danger: 'text-danger' } as const

const violations = ref<AlertViolations | null>(null)
const violationsLoading = ref(false)
const violationsError = ref<string | null>(null)

async function loadViolations(id: string) {
  violations.value = null
  violationsError.value = null
  violationsLoading.value = true
  try {
    const result = await alertsService.violations(id)
    if (props.alert?.id === id) violations.value = result
  } catch (e) {
    if (props.alert?.id === id) violationsError.value = extractProblemMessage(e, 'Impossible de recalculer la règle')
  } finally {
    violationsLoading.value = false
  }
}

watch(() => props.alert?.id, (id) => {
  violations.value = null
  violationsError.value = null
  if (id && moneyInvariant.value) void loadViolations(id)
}, { immediate: true })
</script>

<template>
  <article aria-label="Dossier de l’alerte" data-test="alert-case" class="flex flex-col gap-3">
    <p
      v-if="!alert || !guide" data-test="alert-case-empty"
      class="rounded-card border border-border bg-surface px-5 py-8 text-center text-sm text-text-muted"
    >Aucune alerte sélectionnée.</p>

    <template v-else>
      <header class="rounded-card border border-border bg-surface p-5">
        <div class="flex flex-wrap items-center gap-2">
          <h2 class="font-display text-xl font-bold text-pretty" data-test="alert-detail-title">{{ guide.title }}</h2>
          <StatusBadge v-bind="alertSeverityMeta(alert.severity)" />
          <span
            :class="['rounded-full px-2 py-0.5 text-xs', alert.resolved ? 'bg-success/15 text-success' : 'bg-surface-elevated text-text-muted']"
            data-test="alert-detail-state"
          >{{ alert.resolved ? `Résolue${alert.resolvedAt ? ' le ' + formatAlertDate(alert.resolvedAt) : ''}` : 'Ouverte' }}</span>
          <span
            v-if="snoozed" data-test="alert-detail-snoozed"
            class="rounded-full bg-warning/15 px-2 py-0.5 text-xs text-warning"
          >Reportée jusqu’au {{ formatAlertDate(alert.snoozedUntil) }}</span>
          <span v-if="age" data-test="alert-detail-age" :class="['text-xs tabular-nums', AGE_TONE[age.tone]]">depuis {{ age.label }}</span>
        </div>
        <p class="mt-1 text-xs text-text-muted">
          {{ guide.category }} · <span class="font-mono">{{ alert.type }}</span> · levée le <span class="tabular-nums">{{ formatAlertDate(alert.createdAt) }}</span>
        </p>
        <p class="mt-3 text-sm text-pretty" data-test="alert-detail-summary">{{ alertSummary(alert) }}</p>
        <p class="mt-2 text-sm text-text-muted text-pretty" data-test="alert-detail-explanation">{{ guide.explanation }}</p>
      </header>

      <section class="rounded-card border border-primary/30 bg-primary/5 p-5" data-test="alert-detail-actions">
        <h3 class="mb-2 font-display text-sm font-semibold">Que faire</h3>
        <ol class="list-decimal space-y-1.5 pl-5 text-sm text-pretty">
          <li v-for="(step, i) in guide.actions" :key="i">{{ step }}</li>
        </ol>
        <div v-if="links.length" class="mt-3 flex flex-wrap gap-2">
          <NuxtLink
            v-for="link in links" :key="link.label + JSON.stringify(link.to.query)" :to="link.to"
            :data-test="`alert-link-${link.to.path.slice(1)}`"
            class="rounded-btn bg-primary/15 px-3 py-1.5 text-sm text-primary hover:bg-primary/25"
          >{{ link.label }}</NuxtLink>
        </div>
      </section>

      <AlertStripeFix
        v-if="fixPaymentId" :key="`${alert.id}:${fixPaymentId}`" :alert="alert" :payment-id="fixPaymentId"
        @auto-resolved="(ids) => emit('auto-resolved', ids)" @resolve="(id) => emit('resolve', id)" @changed="emit('changed')"
      />

      <section v-if="moneyInvariant" class="rounded-card border border-border bg-surface p-5" data-test="alert-detail-violations">
        <div class="mb-2 flex items-center justify-between">
          <h3 class="font-display text-sm font-semibold">Lignes en faute actuellement</h3>
          <button
            type="button" data-test="alert-violations-refresh" :disabled="violationsLoading"
            class="text-xs text-primary hover:underline disabled:opacity-40" @click="loadViolations(alert.id)"
          >Recalculer</button>
        </div>
        <p v-if="violationsLoading" class="text-sm text-text-muted">Calcul en cours…</p>
        <p v-else-if="violationsError" class="text-sm text-danger" data-test="alert-violations-error">{{ violationsError }}</p>
        <template v-else-if="violations">
          <p v-if="violations.total === 0" class="text-sm text-success" data-test="alert-violations-clear">
            Plus aucune ligne en faute : l’anomalie est corrigée, vous pouvez résoudre l’alerte.
          </p>
          <template v-else>
            <p class="mb-2 text-sm" data-test="alert-violations-total">
              {{ violations.total }} ligne(s) en faute<span v-if="violations.total > violations.rows.length"> ({{ violations.rows.length }} affichées)</span>.
            </p>
            <AlertRowsTable :rows="violations.rows" :link-for="entityLink" />
          </template>
        </template>
      </section>

      <section v-if="samples.length && (!moneyInvariant || violationsError)" class="rounded-card border border-border bg-surface p-5">
        <h3 class="mb-2 font-display text-sm font-semibold">Exemples au moment de l’alerte</h3>
        <AlertRowsTable :rows="samples" :link-for="entityLink" />
      </section>

      <p v-if="contextLoading" data-test="alert-context-loading" role="status" class="px-1 text-xs text-text-muted">Chargement du contexte…</p>
      <p v-else-if="contextError" data-test="alert-context-error" role="status" class="px-1 text-xs text-text-muted">{{ contextError }}</p>

      <section v-if="related.length" aria-label="Autres alertes sur le même objet" data-test="alert-related" class="rounded-card border border-border bg-surface p-5">
        <h3 class="mb-2 font-display text-sm font-semibold">Autres alertes sur ce paiement ou ce colis</h3>
        <ul class="flex flex-col gap-1">
          <li v-for="r in related" :key="r.id">
            <button
              type="button" :data-test="`alert-related-${r.id}`"
              class="flex w-full items-baseline justify-between gap-3 rounded-btn px-2 py-1.5 text-left text-sm hover:bg-surface-elevated"
              @click="emit('openAlert', r.id)"
            >
              <span class="min-w-0 truncate">{{ alertGuide(r.type).title }}</span>
              <span :class="['shrink-0 text-xs tabular-nums', r.resolved ? 'text-success' : 'text-text-muted']">
                {{ r.resolved ? 'Résolue' : 'Ouverte' }} · {{ formatAlertDate(r.createdAt) }}
              </span>
            </button>
          </li>
        </ul>
      </section>

      <section v-if="context" aria-label="Historique" data-test="alert-history" class="rounded-card border border-border bg-surface p-5">
        <h3 class="mb-3 font-display text-sm font-semibold">Historique</h3>
        <ReportTimeline :items="timeline" />
      </section>

      <section v-if="facts.length" class="rounded-card border border-border bg-surface p-5">
        <h3 class="mb-2 font-display text-sm font-semibold">Données de l’alerte</h3>
        <dl class="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2" data-test="alert-detail-facts">
          <div v-for="f in facts" :key="f.key" class="min-w-0">
            <dt class="text-text-muted">{{ f.label }}</dt>
            <dd class="break-all font-mono text-xs">{{ f.value }}</dd>
          </div>
        </dl>
      </section>
    </template>
  </article>
</template>
