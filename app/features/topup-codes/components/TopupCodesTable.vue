<script setup lang="ts">
import StateBlock from '@/components/ui/StateBlock.vue'
import { ref } from 'vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { TOPUP_STATUS_META, formatTopupAmount, parseUtc, type AdminTopupCode } from '@/features/topup-codes/types/index'

defineProps<{ codes: AdminTopupCode[]; loading: boolean }>()
const emit = defineEmits<{ revoke: [code: AdminTopupCode]; showRedemptions: [code: AdminTopupCode] }>()

const copied = ref<string | null>(null)
async function copy(c: AdminTopupCode) {
  try { await navigator.clipboard.writeText(c.code); copied.value = c.id } catch { copied.value = null }
}
function fmtDate(d: string) { return parseUtc(d).toLocaleDateString('fr-FR') }
</script>

<template>
  <div class="rounded-card border border-border bg-surface overflow-hidden">
    <table class="w-full">
      <thead class="bg-surface-elevated text-left text-xs uppercase text-text-muted">
        <tr>
          <th class="px-4 py-2 font-medium">Code</th>
          <th class="px-4 py-2 font-medium">Montant</th>
          <th class="px-4 py-2 font-medium">Utilisations</th>
          <th class="px-4 py-2 font-medium">Expire le</th>
          <th class="px-4 py-2 font-medium">État</th>
          <th class="px-4 py-2 font-medium"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="c in codes" :key="c.id" :data-test="`topup-row-${c.id}`" class="border-b border-border">
          <td class="px-4 py-3 text-sm font-mono font-medium whitespace-nowrap">
            {{ c.code }}
            <button type="button" :data-test="`copy-${c.id}`" class="ml-2 text-xs text-text-muted hover:text-text" @click="copy(c)">
              {{ copied === c.id ? 'Copié' : 'Copier' }}
            </button>
          </td>
          <td class="px-4 py-3 text-sm tabular-nums whitespace-nowrap">{{ formatTopupAmount(c.amount, c.currency) }}</td>
          <td class="px-4 py-3 text-sm text-text-muted tabular-nums">{{ c.redeemedCount }} / {{ c.maxRedemptions }}</td>
          <td class="px-4 py-3 text-sm text-text-muted tabular-nums">{{ fmtDate(c.expiresAt) }}</td>
          <td class="px-4 py-3"><StatusBadge v-bind="TOPUP_STATUS_META[c.displayStatus]" /></td>
          <td class="px-4 py-3 text-right whitespace-nowrap">
            <button
              type="button" :data-test="`redemptions-${c.id}`"
              class="rounded-btn px-3 py-1.5 text-sm bg-surface-elevated text-text-muted hover:text-text"
              @click="emit('showRedemptions', c)"
            >Utilisations</button>
            <button
              v-if="c.displayStatus !== 'REVOKED'" type="button" :data-test="`revoke-${c.id}`"
              class="ml-2 rounded-btn px-3 py-1.5 text-sm bg-danger/15 text-danger hover:bg-danger/25"
              @click="emit('revoke', c)"
            >Révoquer</button>
          </td>
        </tr>
      </tbody>
    </table>
    <StateBlock :loading="loading" :empty="codes.length === 0" empty-label="Aucun code de recharge" />
  </div>
</template>
