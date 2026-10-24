<script setup lang="ts">
import { computed } from 'vue'
import StateBlock from '@/components/ui/StateBlock.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { mobileMoneyStatusMeta, mobileMoneyProviderDisplay } from './mobileMoneyStatus'
import { formatAmount, maskPhoneNumber } from '@/features/finance/types/index'
import type { AdminMobileMoneyPayment } from '@/features/finance/types/index'
import { mobileMoneyLinks, mobileMoneyRoleLabel, mobileMoneyTypeLabel } from '@/features/finance/lib/mobileMoneyLinks'
import { paymentAge } from '@/features/payments/lib/paymentLabels'
import { useAuthStore } from '@/stores/auth'

const props = withDefaults(defineProps<{ payments: AdminMobileMoneyPayment[]; loading: boolean; emptyLabel?: string }>(), { emptyLabel: 'Aucune opération' })

const auth = useAuthStore()
const can = (p: Parameters<typeof auth.can>[0]) => auth.can(p)

/** Champs du nouveau back : tous absents d'un ancien back, qui garde les colonnes d'avant. */
const ENRICHED = ['purpose', 'personId', 'personName', 'role', 'bidId', 'trackingNumber', 'corridor'] as const
const enriched = computed(() => props.payments.some(p => ENRICHED.some(k => p[k] !== undefined)))

const links = (p: AdminMobileMoneyPayment) => mobileMoneyLinks(p, can)

const link = 'rounded-sm text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary'
const action = 'inline-flex min-h-10 items-center rounded-btn px-1 text-xs font-medium text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary'
</script>

<template>
  <div class="rounded-card border border-border bg-surface overflow-x-auto">
    <table :class="['w-full', enriched ? 'min-w-[960px]' : 'min-w-[720px]']">
      <thead class="bg-surface-elevated text-left text-xs uppercase text-text-muted">
        <tr>
          <th class="px-4 py-2 font-medium">Type</th>
          <th v-if="enriched" class="px-4 py-2 font-medium">Colis</th>
          <th v-if="enriched" class="px-4 py-2 font-medium">Personne</th>
          <th v-if="!enriched" class="px-4 py-2 font-medium">Paiement</th>
          <th class="px-4 py-2 font-medium">Opérateur</th>
          <th v-if="!enriched" class="px-4 py-2 font-medium">Téléphone</th>
          <th class="px-4 py-2 font-medium text-right">Montant</th>
          <th class="px-4 py-2 font-medium">Statut</th>
          <th class="px-4 py-2 font-medium">Créée</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="p in payments" :key="p.id" :data-test="`mm-row-${p.id}`" class="border-b border-border align-top">
          <td class="px-4 py-3 text-sm" :data-test="`mm-type-${p.id}`">
            <div class="font-medium">{{ mobileMoneyTypeLabel(p).kind }}</div>
            <div v-if="mobileMoneyTypeLabel(p).purpose" class="text-xs text-text-muted">{{ mobileMoneyTypeLabel(p).purpose }}</div>
          </td>
          <td v-if="enriched" class="px-4 py-3 text-sm">
            <template v-if="p.corridor || p.trackingNumber">
              <NuxtLink v-if="links(p).bid && p.corridor" :to="links(p).bid!" :data-test="`mm-route-${p.id}`" :class="[link, 'font-medium']">{{ p.corridor }}</NuxtLink>
              <span v-else-if="p.corridor" :data-test="`mm-route-${p.id}`" class="font-medium">{{ p.corridor }}</span>
              <div v-if="p.trackingNumber">
                <NuxtLink v-if="links(p).bid" :to="links(p).bid!" :data-test="`mm-tracking-${p.id}`" :class="[link, 'font-mono text-xs']">{{ p.trackingNumber }}</NuxtLink>
                <span v-else :data-test="`mm-tracking-${p.id}`" class="font-mono text-xs text-text-muted">{{ p.trackingNumber }}</span>
              </div>
            </template>
            <span v-else class="text-text-muted">—</span>
          </td>
          <td v-if="enriched" class="px-4 py-3 text-sm">
            <template v-if="p.personName">
              <NuxtLink v-if="links(p).person" :to="links(p).person!" :data-test="`mm-person-${p.id}`" :class="link">{{ p.personName }}</NuxtLink>
              <span v-else :data-test="`mm-person-${p.id}`">{{ p.personName }}</span>
              <div v-if="mobileMoneyRoleLabel(p.role)" class="text-xs text-text-muted">{{ mobileMoneyRoleLabel(p.role) }}</div>
            </template>
            <span v-else class="text-text-muted">—</span>
          </td>
          <!-- Ancien back : les colonnes d'avant (identifiant du paiement, téléphone à part). -->
          <td v-if="!enriched" class="px-4 py-3 text-sm">
            <NuxtLink v-if="links(p).main && p.paymentId" :to="links(p).main!.route" :data-test="`mm-main-${p.id}`" :class="link">{{ p.paymentId }}</NuxtLink>
            <span v-else class="text-text-muted">{{ p.paymentId ?? '—' }}</span>
          </td>
          <td class="px-4 py-3 text-sm">
            <div class="text-text-muted">{{ mobileMoneyProviderDisplay(p.provider) }}</div>
            <div v-if="enriched" class="text-xs tabular-nums text-text-muted" :data-test="`mm-phone-${p.id}`">{{ maskPhoneNumber(p.phoneNumber) }}</div>
          </td>
          <td v-if="!enriched" class="px-4 py-3 text-sm tabular-nums" :data-test="`mm-phone-${p.id}`">{{ maskPhoneNumber(p.phoneNumber) }}</td>
          <td class="px-4 py-3 text-right text-sm font-semibold tabular-nums whitespace-nowrap">{{ formatAmount(p.amountCents, p.currency) }}</td>
          <td class="px-4 py-3 text-sm">
            <StatusBadge v-bind="mobileMoneyStatusMeta(p.status)" />
            <span v-if="p.failureCode" :data-test="`mm-failure-${p.id}`" class="ml-2 text-xs text-text-muted">{{ p.failureCode }}</span>
            <div v-if="enriched && (links(p).main || links(p).retry)" class="flex flex-col items-start">
              <NuxtLink v-if="links(p).main" :to="links(p).main!.route" :data-test="`mm-main-${p.id}`" :class="action">{{ links(p).main!.label }}</NuxtLink>
              <NuxtLink v-if="links(p).retry" :to="links(p).retry!" :data-test="`mm-retry-${p.id}`" :class="action">Relancer depuis le paiement</NuxtLink>
            </div>
          </td>
          <td class="px-4 py-3 text-sm tabular-nums whitespace-nowrap">
            <template v-if="paymentAge(p.createdAt)">
              <div>{{ paymentAge(p.createdAt)!.relative }}</div>
              <div class="text-xs text-text-muted">{{ paymentAge(p.createdAt)!.day }}</div>
            </template>
            <span v-else class="text-text-muted">—</span>
          </td>
        </tr>
      </tbody>
    </table>
    <StateBlock :loading="loading" :empty="payments.length === 0" :empty-label="emptyLabel" />
  </div>
</template>
