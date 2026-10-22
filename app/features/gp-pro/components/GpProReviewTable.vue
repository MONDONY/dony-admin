<script setup lang="ts">
import StateBlock from '@/components/ui/StateBlock.vue'
import { fmtDate, reviewReasonLabel } from '@/features/gp-pro/types/index'
import type { AdminGpProReviewRow } from '@/features/gp-pro/types/index'

/**
 * Titulaires GP Pro signalés par les alertes quotidiennes. Une alerte n'agit jamais seule :
 * l'admin l'écarte, ou retire le badge depuis la fiche utilisateur.
 */
defineProps<{ items: AdminGpProReviewRow[]; loading: boolean; busy?: boolean; canDismiss: boolean }>()
const emit = defineEmits<{ dismiss: [flagId: string] }>()
</script>

<template>
  <div class="rounded-card border border-border bg-surface overflow-x-auto">
    <table class="w-full">
      <thead class="bg-surface-elevated text-left text-xs uppercase text-text-muted">
        <tr>
          <th class="px-4 py-2 font-medium">Titulaire</th>
          <th class="px-4 py-2 font-medium">Motifs</th>
          <th class="px-4 py-2 font-medium">Depuis le</th>
          <th class="px-4 py-2 font-medium"><span class="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in items" :key="r.userId" :data-test="`gp-pro-review-${r.userId}`" class="border-b border-border align-top">
          <td class="px-4 py-3 text-sm font-medium">{{ r.displayName ?? 'Nom non renseigné' }}</td>
          <td class="px-4 py-3 text-sm">
            <ul class="space-y-1.5">
              <li v-for="f in r.flags ?? []" :key="f.flagId" class="flex flex-wrap items-center gap-2">
                <span class="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">{{ reviewReasonLabel(f.reason) }}</span>
                <button
                  v-if="canDismiss" type="button" :data-test="`gp-pro-dismiss-${f.flagId}`" :disabled="busy"
                  class="rounded-btn px-2 py-0.5 text-xs border border-border transition-[background-color,scale] hover:bg-surface-elevated active:scale-[0.96] disabled:opacity-40"
                  @click="emit('dismiss', f.flagId)"
                >Écarter</button>
              </li>
            </ul>
          </td>
          <td class="px-4 py-3 text-sm text-text-muted tabular-nums">{{ fmtDate(r.detectedAt) }}</td>
          <td class="px-4 py-3 text-sm text-right">
            <NuxtLink
              :to="`/users?open=${r.userId}`" :data-test="`gp-pro-review-open-${r.userId}`"
              class="text-primary underline-offset-2 hover:underline whitespace-nowrap"
            >Ouvrir la fiche</NuxtLink>
          </td>
        </tr>
      </tbody>
    </table>
    <StateBlock :loading="loading" :empty="items.length === 0" empty-label="Aucun titulaire à revoir" empty-test="gp-pro-review-empty" />
  </div>
</template>
