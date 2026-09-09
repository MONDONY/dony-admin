<script setup lang="ts">
import { computed } from 'vue'
import { formatAmount } from '@/features/finance/types/index'
import type { AdminMobileMoneyCommissions } from '@/features/finance/types/index'

const props = defineProps<{ data: AdminMobileMoneyCommissions | null; loading: boolean }>()

/** `2026-09` → `septembre 2026`, sans dépendance : la chaîne vient du serveur, jamais d'un Date. */
function monthLabel(month: string): string {
  const [year, m] = month.split('-')
  const names = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
  return `${names[Number(m) - 1] ?? month} ${year}`
}

function fmtDate(d: string) { return new Date(d).toLocaleDateString('fr-FR') }

const isEmpty = computed(() => (props.data?.byCurrency.length ?? 0) === 0)

/**
 * Export du tableau affiché, construit dans le navigateur : ces chiffres sont déjà chargés,
 * un aller-retour serveur n'apporterait rien. Point-virgule et virgule décimale pour qu'Excel
 * en français ouvre le fichier sans étape d'import.
 */
const csv = computed(() => {
  const rows: string[][] = [['Mois', 'Devise', 'Paiements', 'Encaissé', 'Commission', 'Versé au voyageur']]
  for (const m of props.data?.monthly ?? []) {
    rows.push([
      m.month,
      m.currency,
      String(m.count),
      (m.grossCents / 100).toFixed(2).replace('.', ','),
      (m.commissionCents / 100).toFixed(2).replace('.', ','),
      (m.netCents / 100).toFixed(2).replace('.', ','),
    ])
  }
  return rows.map(r => r.join(';')).join('\n')
})

function exportCsv() {
  // BOM : sans lui, Excel lit le fichier en latin-1 et les accents des en-têtes sont cassés.
  const blob = new Blob(['﻿' + csv.value], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `commissions-mobile-money-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="space-y-6">
    <p class="text-sm text-text-muted">
      La commission mobile money n'est versée nulle part : c'est la part de l'encaissement qui ne
      repart pas au voyageur et qui reste sur le solde pawaPay de Yadony, d'où elle sort par un
      règlement vers le compte bancaire, depuis le tableau de bord pawaPay.
      <template v-if="data">
        Période : {{ fmtDate(data.from) }} au {{ fmtDate(data.to) }}, par date de paiement.
      </template>
    </p>

    <p v-if="loading" class="p-6 text-center text-sm text-text-muted">Chargement…</p>

    <template v-else-if="isEmpty">
      <p data-test="mm-commissions-empty" class="p-6 text-center text-sm text-text-muted">
        Aucune commission mobile money sur la période
      </p>
    </template>

    <template v-else>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="c in data!.byCurrency" :key="c.currency" :data-test="`mm-commission-card-${c.currency}`"
          class="rounded-card border border-border bg-surface p-4"
        >
          <p class="text-xs uppercase text-text-muted">Commission acquise · {{ c.currency }}</p>
          <p class="mt-1 text-2xl font-semibold tabular-nums">{{ formatAmount(c.earnedCommissionCents, c.currency) }}</p>
          <dl class="mt-3 space-y-1 text-sm text-text-muted">
            <div class="flex justify-between"><dt>Encaissé</dt><dd class="tabular-nums">{{ formatAmount(c.earnedGrossCents, c.currency) }}</dd></div>
            <div class="flex justify-between"><dt>Versé aux voyageurs</dt><dd class="tabular-nums">{{ formatAmount(c.earnedNetCents, c.currency) }}</dd></div>
            <div class="flex justify-between"><dt>Envois livrés</dt><dd class="tabular-nums">{{ c.earnedCount }}</dd></div>
            <div class="flex justify-between border-t border-border pt-1">
              <dt>En séquestre</dt>
              <dd class="tabular-nums" :data-test="`mm-commission-escrowed-${c.currency}`">{{ formatAmount(c.escrowedCommissionCents, c.currency) }} · {{ c.escrowedCount }}</dd>
            </div>
            <div v-if="c.refundedCount > 0" class="flex justify-between">
              <dt>Remboursée</dt>
              <dd class="tabular-nums">{{ formatAmount(c.refundedCommissionCents, c.currency) }} · {{ c.refundedCount }}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div class="rounded-card border border-border bg-surface overflow-hidden">
        <div class="flex items-center justify-between px-4 py-3">
          <h3 class="text-sm font-medium">Par mois, commissions acquises</h3>
          <button
            v-if="data!.monthly.length > 0"
            type="button" data-test="mm-commissions-export"
            class="rounded-full bg-surface-elevated px-3 py-1.5 text-xs text-text-muted"
            @click="exportCsv"
          >Exporter en CSV</button>
        </div>
        <table class="w-full">
          <thead class="bg-surface-elevated text-left text-xs uppercase text-text-muted">
            <tr><th class="px-4 py-2 font-medium">Mois</th><th class="px-4 py-2 font-medium">Devise</th><th class="px-4 py-2 font-medium">Envois</th><th class="px-4 py-2 font-medium">Encaissé</th><th class="px-4 py-2 font-medium">Commission</th><th class="px-4 py-2 font-medium">Versé</th></tr>
          </thead>
          <tbody>
            <tr v-for="m in data!.monthly" :key="`${m.month}-${m.currency}`" :data-test="`mm-commission-month-${m.month}-${m.currency}`" class="border-b border-border">
              <td class="px-4 py-3 text-sm font-medium">{{ monthLabel(m.month) }}</td>
              <td class="px-4 py-3 text-sm text-text-muted">{{ m.currency }}</td>
              <td class="px-4 py-3 text-sm tabular-nums">{{ m.count }}</td>
              <td class="px-4 py-3 text-sm tabular-nums">{{ formatAmount(m.grossCents, m.currency) }}</td>
              <td class="px-4 py-3 text-sm font-medium tabular-nums">{{ formatAmount(m.commissionCents, m.currency) }}</td>
              <td class="px-4 py-3 text-sm text-text-muted tabular-nums">{{ formatAmount(m.netCents, m.currency) }}</td>
            </tr>
          </tbody>
        </table>
        <p v-if="data!.monthly.length === 0" class="p-6 text-center text-sm text-text-muted">
          Aucune commission acquise : les paiements de la période sont encore en séquestre
        </p>
      </div>
    </template>
  </div>
</template>
