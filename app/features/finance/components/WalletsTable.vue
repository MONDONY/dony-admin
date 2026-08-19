<script setup lang="ts">
import { formatAmount } from '@/features/finance/types/index'
import type { AdminWallet } from '@/features/finance/types/index'

defineProps<{ wallets: AdminWallet[]; loading: boolean }>()

function fmt(d: string) { return new Date(d).toLocaleDateString('fr-FR') }
</script>

<template>
  <div class="rounded-card border border-border bg-surface overflow-hidden">
    <table class="w-full">
      <thead class="bg-surface-elevated text-left text-xs uppercase text-text-muted">
        <tr><th class="px-4 py-2 font-medium">Utilisateur</th><th class="px-4 py-2 font-medium">Solde</th><th class="px-4 py-2 font-medium">Devise</th><th class="px-4 py-2 font-medium">Mis à jour</th></tr>
      </thead>
      <tbody>
        <tr v-for="w in wallets" :key="w.id" :data-test="`wallet-row-${w.id}`" class="border-b border-border">
          <td class="px-4 py-3 text-sm font-medium">{{ w.userId }}</td>
          <td class="px-4 py-3 text-sm tabular-nums">{{ formatAmount(w.balanceCents, w.currency) }}</td>
          <td class="px-4 py-3 text-sm text-text-muted">{{ w.currency }}</td>
          <td class="px-4 py-3 text-sm text-text-muted tabular-nums">{{ fmt(w.updatedAt) }}</td>
        </tr>
      </tbody>
    </table>
    <p v-if="loading" class="p-6 text-center text-sm text-text-muted">Chargement…</p>
    <p v-else-if="wallets.length === 0" class="p-6 text-center text-sm text-text-muted">Aucun portefeuille</p>
  </div>
</template>
