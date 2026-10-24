<script setup lang="ts">
import { computed } from 'vue'
import StateBlock from '@/components/ui/StateBlock.vue'
import { formatAmount } from '@/features/finance/types/index'
import type { AdminWallet } from '@/features/finance/types/index'
import { gate, userRoute } from '@/lib/adminLinks'
import { paymentAge, shortId } from '@/features/payments/lib/paymentLabels'
import { useAuthStore } from '@/stores/auth'

/**
 * Portefeuilles, en lecture seule : le geste de correction vit dans la fiche, sous sa permission.
 * Le titulaire nommé mène à sa fiche, onglet Argent (USER_VIEW) ; sans nom (compte supprimé),
 * l'identifiant abrégé en texte. Ancien back (aucun nom dans la page) : la colonne d'avant,
 * identifiant abrégé, relié à la fiche.
 */
const props = withDefaults(defineProps<{ wallets: AdminWallet[]; loading: boolean; failed?: boolean }>(), { failed: false })

const auth = useAuthStore()
const enriched = computed(() => props.wallets.some(w => w.userName !== undefined && w.userName !== null))
const holderLink = (w: AdminWallet) => gate(p => auth.can(p), 'USER_VIEW', userRoute(w.userId, 'money'))
/** Lien sur le nom ; sur l'identifiant abrégé seulement face à un ancien back. */
const linkOf = (w: AdminWallet) => (w.userName || !enriched.value ? holderLink(w) : null)

const link = 'rounded-sm font-medium text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary'
</script>

<template>
  <div class="rounded-card border border-border bg-surface overflow-x-auto">
    <table class="w-full min-w-[640px]">
      <thead class="bg-surface-elevated text-left text-xs uppercase text-text-muted">
        <tr>
          <th class="px-4 py-2 font-medium">Titulaire</th>
          <th class="px-4 py-2 font-medium text-right">Solde</th>
          <th class="px-4 py-2 font-medium">Devise</th>
          <th class="px-4 py-2 font-medium">Mis à jour</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="w in wallets" :key="w.id" :data-test="`wallet-row-${w.id}`" class="border-b border-border last:border-b-0">
          <td class="px-4 py-3 text-sm">
            <NuxtLink v-if="linkOf(w)" :to="linkOf(w)!" :data-test="`wallet-holder-${w.id}`" :class="[link, !w.userName && 'tabular-nums']">
              {{ w.userName || shortId(w.userId) }}
            </NuxtLink>
            <span v-else :data-test="`wallet-holder-${w.id}`" :class="w.userName ? 'font-medium' : 'tabular-nums text-text-muted'" :title="w.userName ? undefined : w.userId">
              {{ w.userName || shortId(w.userId) }}
            </span>
            <div v-if="enriched && !w.userName" class="text-xs text-text-muted">Compte supprimé</div>
          </td>
          <td
            :data-test="`wallet-balance-${w.id}`"
            :class="['px-4 py-3 text-right text-sm font-semibold tabular-nums whitespace-nowrap', w.balanceCents < 0 && 'text-danger']"
          >{{ formatAmount(w.balanceCents, w.currency) }}</td>
          <td class="px-4 py-3 text-sm text-text-muted">{{ w.currency }}</td>
          <td class="px-4 py-3 text-sm tabular-nums whitespace-nowrap">
            <template v-if="paymentAge(w.updatedAt)">
              <div>{{ paymentAge(w.updatedAt)!.day }}</div>
              <div class="text-xs text-text-muted">{{ paymentAge(w.updatedAt)!.relative }}</div>
            </template>
            <span v-else class="text-text-muted">—</span>
          </td>
        </tr>
      </tbody>
    </table>
    <StateBlock :loading="loading" :empty="wallets.length === 0 && !failed" empty-label="Aucun portefeuille" />
  </div>
</template>
