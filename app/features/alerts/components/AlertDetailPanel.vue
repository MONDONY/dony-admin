<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { alertSeverityMeta } from './alertSeverity'
import AlertRowsTable from './AlertRowsTable.vue'
import AlertStripeFix from './AlertStripeFix.vue'
import { alertPaymentId } from '@/features/payments/lib/stripeResync'
import { alertFacts, alertGuide, alertLinks, alertSampleRows, alertSummary, entityLink, isMoneyInvariant } from '@/features/alerts/lib/alertCatalog'
import { alertsService } from '@/features/alerts/services/alertsService'
import type { AdminAlert, AlertViolations } from '@/features/alerts/types/index'
import { extractProblemMessage } from '@/lib/problemDetail'
import { formatAlertDate } from '@/features/alerts/lib/alertDate'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{ alert: AdminAlert | null }>()
const emit = defineEmits<{ close: []; resolve: [id: string]; 'auto-resolved': [ids: string[]]; changed: [] }>()
const auth = useAuthStore()

const guide = computed(() => props.alert ? alertGuide(props.alert.type) : null)
const facts = computed(() => props.alert ? alertFacts(props.alert) : [])
const links = computed(() => props.alert ? alertLinks(props.alert) : [])
const samples = computed(() => props.alert ? alertSampleRows(props.alert) : [])
/** Paiement visé : la section « Corriger » n'apparaît que s'il est identifié. */
const fixPaymentId = computed(() => props.alert ? alertPaymentId(props.alert) : null)
const moneyInvariant = computed(() => !!props.alert && isMoneyInvariant(props.alert.type))

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
  <div v-if="alert && guide" class="fixed inset-0 z-40 flex justify-end bg-black/30" data-test="alert-detail" @click.self="emit('close')">
    <aside class="h-full w-full max-w-2xl bg-surface border-l border-border overflow-y-auto p-6">
      <div class="flex items-start justify-between gap-3 mb-1">
        <h2 class="font-display text-xl font-bold text-pretty" data-test="alert-detail-title">{{ guide.title }}</h2>
        <StatusBadge v-bind="alertSeverityMeta(alert.severity)" />
      </div>
      <p class="text-xs text-text-muted mb-4">
        {{ guide.category }} · <span class="font-mono">{{ alert.type }}</span>
      </p>

      <dl class="grid grid-cols-2 gap-3 text-sm mb-5">
        <div><dt class="text-text-muted">Levée le</dt><dd class="tabular-nums">{{ formatAlertDate(alert.createdAt) }}</dd></div>
        <div>
          <dt class="text-text-muted">État</dt>
          <dd>{{ alert.resolved ? `Résolue${alert.resolvedAt ? ' le ' + formatAlertDate(alert.resolvedAt) : ''}` : 'Ouverte' }}</dd>
        </div>
      </dl>

      <section class="mb-5">
        <h3 class="text-sm font-semibold mb-1">Ce qui s’est passé</h3>
        <p class="text-sm text-pretty" data-test="alert-detail-summary">{{ alertSummary(alert) }}</p>
        <p class="mt-2 text-sm text-text-muted text-pretty" data-test="alert-detail-explanation">{{ guide.explanation }}</p>
      </section>

      <section class="mb-5 rounded-card border border-primary/30 bg-primary/5 p-4" data-test="alert-detail-actions">
        <h3 class="text-sm font-semibold mb-2">Que faire</h3>
        <ol class="list-decimal pl-5 space-y-1.5 text-sm text-pretty">
          <li v-for="(step, i) in guide.actions" :key="i">{{ step }}</li>
        </ol>
        <div v-if="links.length" class="mt-3 flex flex-wrap gap-2">
          <NuxtLink
            v-for="link in links" :key="link.label + JSON.stringify(link.to.query)" :to="link.to"
            :data-test="`alert-link-${link.to.path.slice(1)}`"
            class="rounded-btn px-3 py-1.5 text-sm bg-primary/15 text-primary hover:bg-primary/25"
          >{{ link.label }}</NuxtLink>
        </div>
      </section>

      <AlertStripeFix
        v-if="fixPaymentId" :key="`${alert.id}:${fixPaymentId}`" :alert="alert" :payment-id="fixPaymentId"
        @auto-resolved="(ids) => emit('auto-resolved', ids)" @resolve="(id) => emit('resolve', id)" @changed="emit('changed')"
      />

      <section v-if="moneyInvariant" class="mb-5" data-test="alert-detail-violations">
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-sm font-semibold">Lignes en faute actuellement</h3>
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
            <p class="text-sm mb-2" data-test="alert-violations-total">
              {{ violations.total }} ligne(s) en faute<span v-if="violations.total > violations.rows.length"> ({{ violations.rows.length }} affichées)</span>.
            </p>
            <AlertRowsTable :rows="violations.rows" :link-for="entityLink" />
          </template>
        </template>
      </section>

      <section v-if="samples.length && (!moneyInvariant || violationsError)" class="mb-5">
        <h3 class="text-sm font-semibold mb-2">Exemples au moment de l’alerte</h3>
        <AlertRowsTable :rows="samples" :link-for="entityLink" />
      </section>

      <section v-if="facts.length" class="mb-5">
        <h3 class="text-sm font-semibold mb-2">Données de l’alerte</h3>
        <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm" data-test="alert-detail-facts">
          <div v-for="f in facts" :key="f.key" class="min-w-0">
            <dt class="text-text-muted">{{ f.label }}</dt>
            <dd class="break-all font-mono text-xs">{{ f.value }}</dd>
          </div>
        </dl>
      </section>

      <div class="mt-6 flex flex-wrap gap-2">
        <button
          v-if="!alert.resolved && auth.can('ALERT_RESOLVE')" type="button" data-test="alert-detail-resolve"
          class="rounded-btn px-4 py-2 text-sm bg-success/20 text-success hover:bg-success/30"
          @click="emit('resolve', alert.id)"
        >Marquer comme résolue</button>
        <button type="button" data-test="alert-detail-close" class="rounded-btn px-4 py-2 text-sm border border-border" @click="emit('close')">Fermer</button>
      </div>
    </aside>
  </div>
</template>
