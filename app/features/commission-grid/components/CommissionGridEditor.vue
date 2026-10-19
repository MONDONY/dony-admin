<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Plus, Trash2 } from 'lucide-vue-next'
import ConfirmActionDialog from '@/components/ui/ConfirmActionDialog.vue'
import { useDraftComparison } from '@/features/commission-grid/composables/useDraftComparison'
import { useScheduleGrid } from '@/features/commission-grid/composables/useScheduleGrid'
import {
  CFA_PER_EUR, COMMISSION_CURRENCIES, COMMISSION_GRID_UNAVAILABLE, INCREASE_WARNING, MAX_TIERS,
} from '@/features/commission-grid/types/index'
import type { CommissionGrid, CommissionGridWarning, GridDraft } from '@/features/commission-grid/types/index'
import {
  deltaSign, draftFromGrid, formatAmount, formatAmountDelta, parseDecimalInput,
} from '@/features/commission-grid/utils/grid'
import { formatParis, parisInputToUtc } from '@/features/commission-grid/utils/parisTime'

/**
 * Éditeur d'une nouvelle grille, pré-rempli avec la grille en vigueur (sinon la grille par
 * défaut). Le tableau comparatif et les erreurs par champ viennent de `simulate`, en direct ; la
 * programmation passe par une confirmation, avec la phrase « HAUSSE SANS PRÉAVIS » quand la grille
 * augmente la commission dans moins de 30 jours.
 */
const props = defineProps<{ initial: CommissionGrid | null; hasScheduled?: boolean }>()
const emit = defineEmits<{ scheduled: [grid: CommissionGrid]; close: [] }>()

const INCREASE_PHRASE = 'HAUSSE SANS PRÉAVIS'

const draft = ref<GridDraft>(draftFromGrid(props.initial))
const comparison = useDraftComparison(draft)
const scheduler = useScheduleGrid()

// Une erreur du dernier envoi ne vaut que pour la saisie envoyée.
watch(draft, () => { scheduler.reset() }, { deep: true })

/** Champs dont l'erreur s'affiche en face de la saisie ; le reste remonte en tête. */
const FIELD_KEY = /^(tiers(\[\d+\](\.(fromEur|rate))?)?|minimums\.[A-Z]{3}|effectiveFrom|note)$/
const violations = computed<Record<string, string>>(() => ({
  ...comparison.violations.value,
  ...scheduler.violations.value,
}))
const otherViolations = computed(() =>
  Object.entries(violations.value).filter(([k]) => !FIELD_KEY.test(k)).map(([, m]) => m),
)
const fieldError = (key: string) => violations.value[key] ?? null

function addTier() {
  const tiers = draft.value.tiers
  if (tiers.length >= MAX_TIERS) return
  const last = tiers[tiers.length - 1]
  const from = parseDecimalInput(last?.fromEur) ?? 0
  tiers.push({ fromEur: String(from + 100), ratePercent: last?.ratePercent ?? '' })
}
function removeTier(index: number) {
  // La première tranche (borne 0) porte toute grille : elle ne se supprime pas.
  if (index === 0) return
  draft.value.tiers.splice(index, 1)
}
function setImmediate() {
  draft.value.effectiveFromParis = ''
}

const effectiveLabel = computed(() => {
  const utc = parisInputToUtc(draft.value.effectiveFromParis)
  return utc ? `le ${formatParis(utc)} (heure de Paris)` : 'dès la confirmation'
})

const comparisonRows = computed(() => comparison.rows.value.map(r => ({
  net: formatAmount(r.net, 'EUR'),
  cfa: formatAmount(Math.round(Number(r.net) * CFA_PER_EUR), 'XOF'),
  current: formatAmount(r.current.commission, 'EUR'),
  next: formatAmount(r.draft.commission, 'EUR'),
  minimum: r.draft.minimumApplied,
  delta: formatAmountDelta(r.draft.commission, r.current.commission, 'EUR'),
  sign: deltaSign(r.draft.commission, r.current.commission),
})))

const increase = computed(() => comparison.warnings.value.includes(INCREASE_WARNING))

// ── Programmation ──────────────────────────────────────────────────────────
const pending = ref<{ warnings: CommissionGridWarning[] } | null>(null)
const pendingIncrease = computed(() => !!pending.value?.warnings.includes(INCREASE_WARNING))
const confirmMessage = computed(() => {
  let m = `La grille entrera en vigueur ${effectiveLabel.value}.`
  if (props.hasScheduled) m += ' Elle remplace la grille déjà programmée, qui sera annulée.'
  return m
})

async function requestSchedule() {
  const warnings = await scheduler.prepare(draft.value)
  if (warnings === null) return
  pending.value = { warnings }
}

async function confirmSchedule() {
  const p = pending.value
  if (!p) return
  pending.value = null
  const outcome = await scheduler.schedule(draft.value, p.warnings)
  if (outcome.status === 'scheduled') emit('scheduled', outcome.grid)
  else if (outcome.status === 'needs-ack') pending.value = { warnings: outcome.warnings }
}

const inputClass = 'w-full rounded-btn border border-border bg-bg p-2 text-sm tabular-nums disabled:opacity-40'
</script>

<template>
  <div class="space-y-5 rounded-card border border-border bg-surface p-4" data-test="grid-editor">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h3 class="font-display text-base font-semibold">Nouvelle grille</h3>
      <button
        type="button" data-test="editor-close"
        class="rounded-btn border border-border px-3 py-1.5 text-sm transition-colors hover:bg-surface-elevated active:scale-[0.97]"
        @click="emit('close')"
      >Fermer sans programmer</button>
    </div>

    <p
      v-if="comparison.unavailable.value" data-test="editor-unavailable"
      class="rounded-btn border border-border bg-surface-elevated px-3 py-2 text-sm text-text-muted"
    >{{ COMMISSION_GRID_UNAVAILABLE }}</p>
    <p
      v-if="scheduler.error.value" data-test="editor-error" role="alert"
      class="rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
    >{{ scheduler.error.value }}</p>
    <ul
      v-if="otherViolations.length" data-test="editor-other-errors" role="alert"
      class="rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
    >
      <li v-for="m in otherViolations" :key="m">{{ m }}</li>
    </ul>

    <!-- Tranches -->
    <section>
      <p class="mb-2 text-sm font-semibold">Tranches</p>
      <p class="mb-3 text-xs text-text-muted text-pretty">
        Chaque taux s’applique à la part du montant net comprise dans sa tranche. Bornes en euros, converties dans la devise du colis.
      </p>
      <div class="space-y-2">
        <div class="grid grid-cols-[1fr_1fr_auto] gap-2 text-xs text-text-muted">
          <span>À partir de (€)</span><span>Taux (%)</span><span class="w-9" />
        </div>
        <div v-for="(t, i) in draft.tiers" :key="i" :data-test="`tier-row-${i}`">
          <div class="grid grid-cols-[1fr_1fr_auto] items-start gap-2">
            <input
              v-model="t.fromEur" :data-test="`tier-from-${i}`" inputmode="decimal" :disabled="i === 0"
              :aria-label="`Borne de la tranche ${i + 1}`" :class="inputClass"
            >
            <input
              v-model="t.ratePercent" :data-test="`tier-rate-${i}`" inputmode="decimal"
              :aria-label="`Taux de la tranche ${i + 1}`" :class="inputClass"
            >
            <button
              type="button" :data-test="`tier-remove-${i}`" :disabled="i === 0"
              :aria-label="`Supprimer la tranche ${i + 1}`"
              class="rounded-btn border border-border p-2 text-text-muted transition-colors hover:bg-surface-elevated hover:text-danger active:scale-[0.97] disabled:opacity-30"
              @click="removeTier(i)"
            ><Trash2 class="h-4 w-4" /></button>
          </div>
          <p
            v-for="key in [`tiers[${i}]`, `tiers[${i}].fromEur`, `tiers[${i}].rate`]" v-show="fieldError(key)" :key="key"
            class="mt-1 text-xs text-danger" :data-test="`error-${key}`"
          >{{ fieldError(key) }}</p>
        </div>
      </div>
      <p v-if="fieldError('tiers')" class="mt-1 text-xs text-danger" data-test="error-tiers">{{ fieldError('tiers') }}</p>
      <button
        type="button" data-test="tier-add" :disabled="draft.tiers.length >= MAX_TIERS"
        class="mt-2 inline-flex items-center gap-1.5 rounded-btn border border-border px-3 py-1.5 text-sm transition-colors hover:bg-surface-elevated active:scale-[0.97] disabled:opacity-40"
        @click="addTier"
      ><Plus class="h-4 w-4" /> Ajouter une tranche</button>
      <p class="mt-1 text-xs text-text-muted">De 1 à {{ MAX_TIERS }} tranches. La première commence à 0 €.</p>
    </section>

    <!-- Minimums -->
    <section>
      <p class="mb-2 text-sm font-semibold">Commission minimum par devise</p>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label v-for="c in COMMISSION_CURRENCIES" :key="c" class="block">
          <span class="mb-1 block text-xs text-text-muted">{{ c }}</span>
          <input v-model="draft.minimums[c]" :data-test="`minimum-${c}`" inputmode="decimal" :class="inputClass">
          <span v-if="fieldError(`minimums.${c}`)" class="mt-1 block text-xs text-danger" :data-test="`error-minimums.${c}`">
            {{ fieldError(`minimums.${c}`) }}
          </span>
        </label>
      </div>
    </section>

    <!-- Date d'effet et note -->
    <section class="grid gap-4 sm:grid-cols-2">
      <div>
        <label for="grid-effective-from" class="mb-1 block text-sm font-semibold">Date et heure d’effet</label>
        <div class="flex gap-2">
          <input
            id="grid-effective-from" v-model="draft.effectiveFromParis" type="datetime-local" data-test="effective-from"
            :class="inputClass"
          >
          <button
            type="button" data-test="effective-now" :disabled="draft.effectiveFromParis === ''"
            class="shrink-0 rounded-btn border border-border px-3 py-1.5 text-sm transition-colors hover:bg-surface-elevated active:scale-[0.97] disabled:opacity-40"
            @click="setImmediate"
          >Immédiat</button>
        </div>
        <p class="mt-1 text-xs text-text-muted" data-test="effective-label">
          Heure de Paris. Effet {{ effectiveLabel }}.
        </p>
        <p v-if="fieldError('effectiveFrom')" class="mt-1 text-xs text-danger" data-test="error-effectiveFrom">{{ fieldError('effectiveFrom') }}</p>
      </div>
      <div>
        <label for="grid-note" class="mb-1 block text-sm font-semibold">Note (facultative)</label>
        <textarea
          id="grid-note" v-model="draft.note" rows="2" maxlength="500" data-test="note"
          placeholder="Pourquoi ce changement ?"
          class="w-full rounded-btn border border-border bg-bg p-2 text-sm"
        />
        <p v-if="fieldError('note')" class="mt-1 text-xs text-danger" data-test="error-note">{{ fieldError('note') }}</p>
      </div>
    </section>

    <!-- Comparatif -->
    <section>
      <div class="mb-2 flex items-center gap-2">
        <p class="text-sm font-semibold">Comparaison avec la grille en vigueur</p>
        <span v-if="comparison.isLoading.value" class="text-xs text-text-muted" data-test="comparison-loading">Calcul…</span>
      </div>
      <p
        v-if="increase" data-test="comparison-increase" role="status"
        class="mb-2 rounded-btn border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning text-pretty"
      >Cette grille augmente la commission et prend effet dans moins de 30 jours : la programmation demandera une confirmation renforcée.</p>
      <p v-if="comparison.error.value" class="mb-2 text-sm text-danger" data-test="comparison-error">{{ comparison.error.value }}</p>
      <div class="overflow-x-auto rounded-card border border-border">
        <table class="w-full text-sm" data-test="comparison-table">
          <thead class="bg-surface-elevated text-xs text-text-muted">
            <tr>
              <th class="px-3 py-2 text-left font-medium">Montant net</th>
              <th class="px-3 py-2 text-right font-medium">Commission actuelle</th>
              <th class="px-3 py-2 text-right font-medium">Nouvelle commission</th>
              <th class="px-3 py-2 text-right font-medium">Écart</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!comparisonRows.length">
              <td colspan="4" class="px-3 py-4 text-center text-xs text-text-muted">
                Corrigez la grille pour voir la comparaison.
              </td>
            </tr>
            <tr v-for="r in comparisonRows" :key="r.net" class="border-t border-border tabular-nums" data-test="comparison-row">
              <td class="px-3 py-2">{{ r.net }} <span class="text-xs text-text-muted">≈ {{ r.cfa }}</span></td>
              <td class="px-3 py-2 text-right">{{ r.current }}</td>
              <td class="px-3 py-2 text-right">
                {{ r.next }}<span v-if="r.minimum" class="text-xs text-text-muted"> (minimum)</span>
              </td>
              <td
                class="px-3 py-2 text-right font-medium"
                :class="r.sign > 0 ? 'text-danger' : r.sign < 0 ? 'text-success' : 'text-text-muted'"
              >{{ r.delta }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div class="flex justify-end">
      <button
        type="button" data-test="editor-submit" :disabled="scheduler.busy.value"
        class="rounded-btn bg-primary px-4 py-2 text-sm text-white transition-colors hover:bg-primary/90 active:scale-[0.97] disabled:opacity-40"
        @click="requestSchedule"
      >{{ scheduler.busy.value ? 'Vérification…' : 'Programmer cette grille' }}</button>
    </div>

    <ConfirmActionDialog
      :open="pending !== null"
      :title="pendingIncrease ? 'Hausse de commission sans préavis' : 'Programmer la nouvelle grille'"
      :message="confirmMessage"
      confirm-label="Programmer"
      :confirm-tone="pendingIncrease ? 'danger' : 'primary'"
      :confirmation-phrase="pendingIncrease ? INCREASE_PHRASE : undefined"
      @confirm="confirmSchedule"
      @cancel="pending = null"
    >
      <p v-if="pendingIncrease" data-test="confirm-increase" role="alert" class="mb-4 text-sm font-medium text-danger text-pretty">
        Cette grille augmente la commission (sur au moins un montant ou un minimum) et prend effet dans moins de 30 jours.
        Les utilisateurs n’auront pas de préavis d’un mois.
      </p>
    </ConfirmActionDialog>
  </div>
</template>
