<script setup lang="ts">
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { PROMO_TARGET_LABELS, formatPromoRate, type AdminPromoCode } from '@/features/promo/types/index'
defineProps<{ codes: AdminPromoCode[]; loading: boolean }>()
const emit = defineEmits<{ edit: [id: string]; remove: [id: string]; toggleStatus: [code: AdminPromoCode] }>()
function fmtDate(d: string | null) { return d ? new Date(d).toLocaleDateString('fr-FR') : '—' }
</script>

<template>
  <div class="rounded-card border border-border bg-surface overflow-hidden">
    <table class="w-full">
      <thead class="bg-surface-elevated text-left text-xs uppercase text-text-muted">
        <tr>
          <th class="px-4 py-2 font-medium">Code</th>
          <th class="px-4 py-2 font-medium">Réduction</th>
          <th class="px-4 py-2 font-medium">Cible</th>
          <th class="px-4 py-2 font-medium">Utilisations</th>
          <th class="px-4 py-2 font-medium">Validité</th>
          <th class="px-4 py-2 font-medium">État</th>
          <th class="px-4 py-2 font-medium"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="c in codes" :key="c.id" :data-test="`promo-row-${c.id}`" class="border-b border-border">
          <td class="px-4 py-3 text-sm font-mono font-medium">{{ c.code }}</td>
          <td class="px-4 py-3 text-sm tabular-nums">{{ formatPromoRate(c.rate) }}</td>
          <td class="px-4 py-3 text-sm text-text-muted">{{ PROMO_TARGET_LABELS[c.target] }}</td>
          <td class="px-4 py-3 text-sm text-text-muted tabular-nums">{{ c.redeemedCount }} / {{ c.maxRedemptions ?? '∞' }}</td>
          <td class="px-4 py-3 text-sm text-text-muted tabular-nums">{{ fmtDate(c.validFrom) }} → {{ fmtDate(c.validTo) }}</td>
          <td class="px-4 py-3">
            <button type="button" :data-test="`toggle-${c.id}`" @click="emit('toggleStatus', c)">
              <StatusBadge v-if="c.status === 'ACTIVE'" label="Actif" tone="success" />
              <StatusBadge v-else label="Désactivé" tone="neutral" />
            </button>
          </td>
          <td class="px-4 py-3 text-right whitespace-nowrap">
            <button
              type="button" :data-test="`edit-${c.id}`"
              class="rounded-btn px-3 py-1.5 text-sm bg-surface-elevated text-text-muted hover:text-text"
              @click="emit('edit', c.id)"
            >Éditer</button>
            <button
              type="button" :data-test="`remove-${c.id}`"
              class="ml-2 rounded-btn px-3 py-1.5 text-sm bg-danger/15 text-danger hover:bg-danger/25"
              @click="emit('remove', c.id)"
            >Supprimer</button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="loading" class="p-6 text-center text-sm text-text-muted">Chargement…</p>
    <p v-else-if="codes.length === 0" class="p-6 text-center text-sm text-text-muted">Aucun code promo</p>
  </div>
</template>
