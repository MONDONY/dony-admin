<script setup lang="ts">
import { computed } from 'vue'
import StateBlock from '@/components/ui/StateBlock.vue'
import { blockerInfo, countLabel, eurLabel, partialMayHelp } from '@/features/dac7/types/index'
import type { Dac7Overview } from '@/features/dac7/types/index'

/**
 * Synthèse de l'année : compteurs, totaux et blocages de l'export complet. Rien n'est calculé ici,
 * tout vient de `GET /admin/dac7/overview` ; un champ absent (ancien back) se lit comme zéro.
 */
const props = defineProps<{ overview: Dac7Overview | null; loading: boolean; error?: string | null }>()
defineEmits<{ retry: [] }>()

type CountKey = 'declarableSellers' | 'withTaxInfo' | 'missingTaxInfo' | 'identityReview'
  | 'unknownResidence' | 'nonDeclarable' | 'refundsToReconcile' | 'pendingSplits' | 'anomalies'

const COUNTS: { key: CountKey; label: string; attention?: boolean }[] = [
  { key: 'declarableSellers', label: 'Voyageurs déclarables' },
  { key: 'withTaxInfo', label: 'Avec numéro fiscal' },
  { key: 'missingTaxInfo', label: 'Numéro fiscal manquant', attention: true },
  { key: 'identityReview', label: 'Identité à revoir', attention: true },
  { key: 'unknownResidence', label: 'Résidence inconnue', attention: true },
  { key: 'nonDeclarable', label: 'Non déclarables' },
  { key: 'refundsToReconcile', label: 'Remboursements à réconcilier', attention: true },
  { key: 'pendingSplits', label: 'Partages en attente de versement' },
  { key: 'anomalies', label: 'Anomalies', attention: true },
]

const blockers = computed(() => (props.overview?.blockers ?? []).map(blockerInfo))
const partialHelps = computed(() => partialMayHelp(props.overview?.blockers ?? []))
/** Vrai seulement si le serveur a envoyé la liste (vide) ET ne dit pas le contraire : sinon l'état est inconnu. */
const noBlocker = computed(() => Array.isArray(props.overview?.blockers) && props.overview!.blockers!.length === 0 && props.overview!.exportReady !== false)
const jurisdictions = computed(() => (props.overview?.invalidPartnerJurisdictions ?? []).join(', '))
</script>

<template>
  <section aria-label="Synthèse de l’année" data-test="dac7-summary" class="flex flex-col gap-4">
    <StateBlock :loading="loading && !overview" :error="error" @retry="$emit('retry')" />

    <template v-if="overview">
      <div v-if="overview.enabled === false || overview.remindersEnabled === false" class="flex flex-wrap gap-2">
        <span
          v-if="overview.enabled === false" data-test="dac7-badge-collecte"
          class="rounded-full bg-warning/15 px-2.5 py-1 text-xs font-medium text-warning"
        >Collecte éteinte</span>
        <span
          v-if="overview.remindersEnabled === false" data-test="dac7-badge-rappels"
          class="rounded-full bg-warning/15 px-2.5 py-1 text-xs font-medium text-warning"
        >Rappels éteints</span>
      </div>

      <div class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <div
          v-for="c in COUNTS" :key="c.key" :data-test="`dac7-card-${c.key}`"
          class="rounded-card border border-border bg-surface p-4"
        >
          <p class="text-xs text-text-muted text-pretty">{{ c.label }}</p>
          <p :class="['mt-1 font-display text-2xl font-bold tabular-nums', c.attention && (overview[c.key] ?? 0) > 0 ? 'text-warning' : '']">
            {{ countLabel(overview[c.key]) }}
          </p>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div data-test="dac7-card-operations" class="rounded-card border border-border bg-surface p-4">
          <p class="text-xs text-text-muted">Opérations de l’année</p>
          <p class="mt-1 font-display text-2xl font-bold tabular-nums">{{ countLabel(overview.totals?.operations) }}</p>
        </div>
        <div data-test="dac7-card-netEur" class="rounded-card border border-border bg-surface p-4">
          <p class="text-xs text-text-muted">Net versé aux voyageurs</p>
          <p class="mt-1 font-display text-2xl font-bold tabular-nums">{{ eurLabel(overview.totals?.netEur) }}</p>
          <p v-if="overview.eurComplete === false" data-test="dac7-partial-eur" class="mt-1 text-xs text-warning text-pretty">
            Montant partiel : des taux de change manquent.
          </p>
        </div>
        <div data-test="dac7-card-commissionEur" class="rounded-card border border-border bg-surface p-4">
          <p class="text-xs text-text-muted">Commission de Yadony</p>
          <p class="mt-1 font-display text-2xl font-bold tabular-nums">{{ eurLabel(overview.totals?.commissionEur) }}</p>
          <p v-if="overview.commissionComplete === false" data-test="dac7-partial-commission" class="mt-1 text-xs text-warning text-pretty">
            Commission partielle : certaines sont introuvables.
          </p>
        </div>
      </div>

      <div
        v-if="blockers.length" data-test="dac7-blockers" role="status"
        class="rounded-card border border-danger/30 bg-danger/5 p-4"
      >
        <h2 class="font-display text-base font-bold text-danger">L’export complet est bloqué</h2>
        <p class="mt-1 text-sm text-text-muted text-pretty">
          <template v-if="partialHelps">Réglez ces points, ou exportez en mode Partiel (seuls les voyageurs complets sont alors déclarés).</template>
          <template v-else>Réglez ces points avant d’exporter : le mode Partiel ne les contourne pas.</template>
        </p>
        <ul class="mt-3 flex flex-col gap-3">
          <li v-for="b in blockers" :key="b.code" :data-test="`dac7-blocker-${b.code}`">
            <p class="text-sm font-semibold">{{ b.title }}</p>
            <p class="text-sm text-text-muted text-pretty">{{ b.explanation }}</p>
            <p v-if="b.code === 'INVALID_PARTNER_JURISDICTION' && jurisdictions" class="text-xs tabular-nums text-text-muted">
              Codes concernés : {{ jurisdictions }}
            </p>
          </li>
        </ul>
      </div>
      <p
        v-else-if="noBlocker" data-test="dac7-ready" role="status"
        class="rounded-card border border-success/30 bg-success/5 px-4 py-3 text-sm text-success text-pretty"
      >Aucun blocage : l’export complet est possible.</p>
      <p
        v-else data-test="dac7-state-unknown" role="status"
        class="rounded-card border border-border bg-surface px-4 py-3 text-sm text-text-muted text-pretty"
      >État inconnu : le serveur n’a pas indiqué si l’export est possible.</p>
    </template>
  </section>
</template>
