<script setup lang="ts">
import { formatMoney } from '@/features/payments/types/index'
import type { PaymentTotals } from '@/features/payments/types/index'

/** Totaux du périmètre filtré, une carte par devise : on n'additionne jamais des EUR et des XOF. */
defineProps<{ totals: PaymentTotals[] }>()
</script>

<template>
  <div v-if="totals.length" class="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-test="payment-totals">
    <section
      v-for="t in totals" :key="t.currency" :data-test="`payment-totals-${t.currency}`"
      class="rounded-card border border-border bg-surface p-4"
    >
      <div class="mb-2 flex items-baseline justify-between">
        <h3 class="text-sm font-semibold">{{ t.currency }}</h3>
        <span class="text-xs text-text-muted tabular-nums">{{ t.count }} paiement(s)<span v-if="t.pendingCount"> · {{ t.pendingCount }} en attente</span></span>
      </div>
      <dl class="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
        <div><dt class="text-xs text-text-muted">En séquestre</dt><dd class="tabular-nums font-medium">{{ formatMoney(t.escrowCents, t.currency) }}</dd></div>
        <div><dt class="text-xs text-text-muted">Versé (libéré)</dt><dd class="tabular-nums font-medium">{{ formatMoney(t.releasedCents, t.currency) }}</dd></div>
        <div><dt class="text-xs text-text-muted">Remboursé</dt><dd class="tabular-nums">{{ formatMoney(t.refundedCents, t.currency) }}</dd></div>
        <div><dt class="text-xs text-text-muted" title="Commission des paiements en séquestre ou libérés">Commissions</dt><dd class="tabular-nums">{{ formatMoney(t.commissionCents, t.currency) }}</dd></div>
      </dl>
    </section>
  </div>
</template>
