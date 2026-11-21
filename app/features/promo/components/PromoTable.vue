<script setup lang="ts">
import StateBlock from '@/components/ui/StateBlock.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import {
  PROMO_ORIGIN_LABELS, PROMO_ORIGIN_TONES, PROMO_TARGET_LABELS, formatPromoRate, isPromoEditable, promoOriginOf,
  type AdminPromoCode,
} from '@/features/promo/types/index'
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
          <th class="px-4 py-2 font-medium">Origine</th>
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
          <td class="px-4 py-3 text-sm">
            <StatusBadge
              :data-test="`origin-${c.id}`" :label="PROMO_ORIGIN_LABELS[promoOriginOf(c)]" :tone="PROMO_ORIGIN_TONES[promoOriginOf(c)]"
            />
            <p v-if="!isPromoEditable(c) && c.ownerUserId && c.ownerFirstName" class="mt-1 text-xs text-text-muted">
              Pour
              <NuxtLink
                :to="`/users/${c.ownerUserId}`" :data-test="`owner-${c.id}`"
                class="font-medium text-primary underline-offset-2 hover:underline"
              >{{ c.ownerFirstName }}</NuxtLink>
            </p>
          </td>
          <td class="px-4 py-3 text-sm text-text-muted">{{ PROMO_TARGET_LABELS[c.target] }}</td>
          <td class="px-4 py-3 text-sm text-text-muted tabular-nums">
            {{ c.redeemedCount }} / {{ c.maxRedemptions ?? '∞' }}
            <p :data-test="`used-${c.id}`" class="text-xs">{{ c.redeemedCount > 0 ? 'Utilisé' : 'Non utilisé' }}</p>
          </td>
          <td class="px-4 py-3 text-sm text-text-muted tabular-nums">{{ fmtDate(c.validFrom) }} → {{ fmtDate(c.validTo) }}</td>
          <td class="px-4 py-3">
            <button type="button" :data-test="`toggle-${c.id}`" @click="emit('toggleStatus', c)">
              <StatusBadge v-if="c.status === 'ACTIVE'" label="Actif" tone="success" />
              <StatusBadge v-else label="Désactivé" tone="neutral" />
            </button>
          </td>
          <td class="px-4 py-3 text-right whitespace-nowrap">
            <button
              v-if="isPromoEditable(c)"
              type="button" :data-test="`edit-${c.id}`"
              class="rounded-btn px-3 py-1.5 text-sm bg-surface-elevated text-text-muted hover:text-text"
              @click="emit('edit', c.id)"
            >Éditer</button>
            <button
              v-if="isPromoEditable(c)"
              type="button" :data-test="`remove-${c.id}`"
              class="ml-2 rounded-btn px-3 py-1.5 text-sm bg-danger/15 text-danger hover:bg-danger/25"
              @click="emit('remove', c.id)"
            >Supprimer</button>
          </td>
        </tr>
      </tbody>
    </table>
    <StateBlock :loading="loading" :empty="codes.length === 0" empty-label="Aucun code promo" />
  </div>
</template>
