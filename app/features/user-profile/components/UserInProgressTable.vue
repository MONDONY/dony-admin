<script setup lang="ts">
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { bidStatusMeta } from '@/features/bids/components/bidStatus'
import { announcementStatusMeta } from '@/features/bids/lib/bidLabels'
import { formatAmount } from '@/features/finance/types/index'
import { linkForItem } from '@/features/user-profile/lib/objectLinks'
import type { InProgressItem } from '@/features/user-profile/types/index'
import type { BidStatus } from '@/features/bids/types/index'

defineProps<{ items: InProgressItem[] }>()

const ROLES: Record<string, string> = { SENDER: 'Expéditeur', TRAVELER: 'Voyageur' }
const roleLabel = (r: string) => ROLES[r] ?? r
const statusMeta = (i: InProgressItem) =>
  i.kind === 'TRIP' ? announcementStatusMeta(i.status) : bidStatusMeta(i.status as BidStatus)
const dateFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Paris' })
const when = (iso: string) => dateFmt.format(new Date(iso))
</script>

<template>
  <section data-test="in-progress-card" class="flex min-w-0 flex-col gap-3 rounded-card border border-border bg-surface p-4">
    <h2 class="text-base font-semibold">En cours et livrés depuis 3 jours</h2>
    <p v-if="items.length === 0" data-test="in-progress-empty" class="text-sm text-text-muted">Rien en cours ni livré depuis 3 jours</p>
    <div v-else class="overflow-x-auto">
      <table class="w-full min-w-[40rem] text-left text-sm">
        <thead>
          <tr class="text-xs text-text-muted">
            <th class="py-2 pr-3 font-semibold">Type</th>
            <th class="py-2 pr-3 font-semibold">Référence</th>
            <th class="py-2 pr-3 font-semibold">Trajet</th>
            <th class="py-2 pr-3 font-semibold">Rôle</th>
            <th class="py-2 pr-3 font-semibold">Statut</th>
            <th class="py-2 pr-3 font-semibold">Mise à jour</th>
            <th class="py-2 pr-3 text-right font-semibold">Montant</th>
            <th class="py-2 font-semibold"><span class="sr-only">Ouvrir</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="i in items" :key="`${i.kind}-${i.id}`" data-test="in-progress-row" class="border-t border-border">
            <td class="py-2 pr-3">{{ i.kind === 'TRIP' ? 'Trajet' : 'Colis' }}</td>
            <td class="py-2 pr-3 font-medium">{{ i.reference }}</td>
            <td class="py-2 pr-3">{{ i.corridor }}</td>
            <td class="py-2 pr-3">{{ roleLabel(i.role) }}</td>
            <td class="py-2 pr-3"><StatusBadge :label="statusMeta(i).label" :tone="statusMeta(i).tone" /></td>
            <td class="py-2 pr-3 tabular-nums">{{ when(i.updatedAt) }}</td>
            <td class="py-2 pr-3 text-right tabular-nums">{{ i.amount ? formatAmount(i.amount.amountCents, i.amount.currency) : '—' }}</td>
            <td class="py-2">
              <NuxtLink v-if="linkForItem(i)" :to="linkForItem(i)!" class="text-primary hover:underline">Ouvrir</NuxtLink>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
