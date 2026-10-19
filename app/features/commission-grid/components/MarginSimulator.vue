<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useMarginSimulator, type SimulatorSource } from '@/features/commission-grid/composables/useMarginSimulator'
import {
  COMMISSION_CURRENCIES, COMMISSION_GRID_UNAVAILABLE, RAIL_LABELS,
} from '@/features/commission-grid/types/index'
import type { CommissionCurrency, CommissionGrid, GridDraft } from '@/features/commission-grid/types/index'
import {
  draftFromGrid, draftToRequest, formatAmount, formatPercent, rateToPercent,
} from '@/features/commission-grid/utils/grid'
import { formatParis } from '@/features/commission-grid/utils/parisTime'

/**
 * Onglet « Simulateur » : marge de Yadony par moyen de paiement pour un montant net, sur la grille
 * en vigueur ou la grille programmée. Tant qu'aucune grille n'est en vigueur : le taux unique
 * actuel (`flatRate`, réglage `commission_rate`, en fraction) par défaut, ou la grille proposée
 * 7 / 6 / 5 %. Chiffres indicatifs du back (tarifs publics des prestataires), jamais un prix.
 */
const props = defineProps<{ current: CommissionGrid | null; scheduled: CommissionGrid | null; flatRate?: string | null }>()

type SourceKey = 'current' | 'scheduled' | 'flat' | 'proposal'

/**
 * Le taux unique simulé comme une grille d'une seule tranche, sans minimum : c'est ce que fait le
 * back (`flatPlatformGrid`) pour la commission « actuelle » tant qu'aucune grille n'existe.
 */
function flatDraft(rate: string): GridDraft {
  const minimums = {} as Record<CommissionCurrency, string>
  for (const c of COMMISSION_CURRENCIES) minimums[c] = '0'
  return { tiers: [{ fromEur: '0', ratePercent: rateToPercent(rate) }], minimums, effectiveFromParis: '', note: '' }
}
const hasFlatRate = computed(() => rateToPercent(props.flatRate) !== '')

const sourceOptions = computed(() => {
  const out: { value: SourceKey; label: string }[] = []
  if (props.current) {
    out.push({ value: 'current', label: 'Grille en vigueur' })
  } else {
    if (hasFlatRate.value) out.push({ value: 'flat', label: `Taux unique actuel (${formatPercent(props.flatRate)})` })
    out.push({ value: 'proposal', label: 'Grille proposée (7 / 6 / 5 %)' })
  }
  if (props.scheduled) {
    out.push({ value: 'scheduled', label: `Grille programmée (${formatParis(props.scheduled.effectiveFrom)})` })
  }
  return out
})

const sourceKey = ref<SourceKey>(sourceOptions.value[0]!.value)

// Une grille qui disparaît (annulée, ou entrée en vigueur) ne doit pas rester sélectionnée ; le
// taux unique, lu à part, arrive parfois après le montage : il redevient alors le choix par défaut.
watch(sourceOptions, (opts, previous) => {
  if (sourceKey.value === 'proposal' && opts[0]?.value === 'flat' && !previous?.some(o => o.value === 'flat')) {
    sourceKey.value = 'flat'
    return
  }
  if (!opts.some(o => o.value === sourceKey.value)) sourceKey.value = opts[0]!.value
})

const source = computed<SimulatorSource | null>(() => {
  if (sourceKey.value === 'current' && props.current) return { gridId: props.current.id }
  if (sourceKey.value === 'scheduled' && props.scheduled) return { gridId: props.scheduled.id }
  if (sourceKey.value === 'flat' && props.flatRate) return { draft: draftToRequest(flatDraft(props.flatRate)) }
  return { draft: draftToRequest(draftFromGrid(null)) }
})

const sim = useMarginSimulator(source)
onMounted(() => { void sim.run() })

const cur = computed(() => sim.currency.value)
const preview = computed(() => {
  const r = sim.row.value
  if (!r) return null
  return `${formatAmount(r.draft.commission, cur.value)}${r.draft.minimumApplied ? ' (minimum)' : ''}`
})
const rails = computed(() => (sim.row.value?.rails ?? []).map(r => ({
  rail: r.rail,
  label: RAIL_LABELS[r.rail] ?? r.rail,
  providerCost: formatAmount(r.providerCost, cur.value),
  margin: formatAmount(r.marginExVat, cur.value),
  negative: Number(r.marginExVat) < 0,
})))

const inputClass = 'w-full rounded-btn border border-border bg-bg p-2 text-sm tabular-nums'
</script>

<template>
  <div class="space-y-4">
    <p
      v-if="sim.unavailable.value" data-test="simulator-unavailable"
      class="rounded-card border border-border bg-surface-elevated px-4 py-6 text-center text-sm text-text-muted"
    >{{ COMMISSION_GRID_UNAVAILABLE }}</p>

    <section class="grid gap-3 rounded-card border border-border bg-surface p-4 sm:grid-cols-4">
      <label class="block sm:col-span-4">
        <span class="mb-1 block text-xs text-text-muted">Grille simulée</span>
        <select v-model="sourceKey" data-test="simulator-source" class="w-full rounded-btn border border-border bg-bg p-2 text-sm">
          <option v-for="o in sourceOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
      </label>
      <label class="block">
        <span class="mb-1 block text-xs text-text-muted">Montant net du voyageur</span>
        <input v-model="sim.amount.value" data-test="simulator-amount" inputmode="decimal" :class="inputClass">
      </label>
      <label class="block">
        <span class="mb-1 block text-xs text-text-muted">Devise</span>
        <select v-model="sim.currency.value" data-test="simulator-currency" class="w-full rounded-btn border border-border bg-bg p-2 text-sm">
          <option v-for="c in COMMISSION_CURRENCIES" :key="c" :value="c">{{ c }}</option>
        </select>
      </label>
      <label class="block">
        <span class="mb-1 block text-xs text-text-muted">TVA sur la commission (%)</span>
        <input v-model="sim.vatPercent.value" data-test="simulator-vat" inputmode="decimal" :class="inputClass">
      </label>
      <div class="flex items-end">
        <span v-if="sim.isLoading.value" class="pb-2 text-xs text-text-muted" data-test="simulator-loading">Calcul…</span>
      </div>
    </section>

    <p v-if="sim.inputError.value" class="text-sm text-danger" data-test="simulator-input-error">{{ sim.inputError.value }}</p>
    <p
      v-if="sim.error.value" data-test="simulator-error" role="alert"
      class="rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
    >{{ sim.error.value }}</p>

    <template v-if="sim.row.value && !sim.inputError.value">
      <section class="rounded-card border border-border bg-surface p-4" data-test="simulator-preview">
        <p class="mb-1 text-xs text-text-muted">Ligne vue par l’expéditeur</p>
        <p class="text-sm">
          Frais de service Yadony : <span class="font-semibold tabular-nums">{{ preview }}</span>
        </p>
      </section>

      <div class="overflow-x-auto rounded-card border border-border">
        <table class="w-full text-sm" data-test="simulator-table">
          <thead class="bg-surface-elevated text-xs text-text-muted">
            <tr>
              <th class="px-3 py-2 text-left font-medium">Moyen de paiement</th>
              <th class="px-3 py-2 text-right font-medium">Commission</th>
              <th class="px-3 py-2 text-right font-medium">Total payé</th>
              <th class="px-3 py-2 text-right font-medium">Coût prestataire</th>
              <th class="px-3 py-2 text-right font-medium">Marge HT</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in rails" :key="r.rail" class="border-t border-border tabular-nums" :data-test="`simulator-rail-${r.rail}`">
              <td class="px-3 py-2">{{ r.label }}</td>
              <td class="px-3 py-2 text-right">{{ formatAmount(sim.row.value.draft.commission, cur) }}</td>
              <td class="px-3 py-2 text-right">{{ formatAmount(sim.row.value.draft.gross, cur) }}</td>
              <td class="px-3 py-2 text-right">{{ r.providerCost }}</td>
              <td class="px-3 py-2 text-right font-medium" :class="r.negative ? 'text-danger' : 'text-success'">{{ r.margin }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="sim.connectMonthly.value !== null" class="text-xs text-text-muted text-pretty" data-test="simulator-connect">
        Connect : {{ formatAmount(sim.connectMonthly.value, cur) }} par voyageur payé dans le mois, non inclus.
      </p>
      <p class="text-xs text-text-muted text-pretty">
        Coûts estimés sur les tarifs publics des prestataires. Le mobile money n’apparaît que pour le XOF et le XAF.
      </p>
    </template>
  </div>
</template>
