<script setup lang="ts">
import { TARGET_LABELS, type AdminBroadcast } from '@/features/broadcast/types/index'

defineProps<{ broadcasts: AdminBroadcast[]; loading?: boolean }>()

// Le libellé de base ne suffit pas à identifier UN envoi précis dans l'historique :
// on complète CORRIDOR et USER par la valeur réellement ciblée.
function targetDescription(b: AdminBroadcast): string {
  if (b.targetType === 'CORRIDOR' && b.targetOrigin && b.targetDestination) {
    return `${TARGET_LABELS.CORRIDOR} : ${b.targetOrigin} → ${b.targetDestination}`
  }
  if (b.targetType === 'USER' && b.targetUserId) {
    return `${TARGET_LABELS.USER} : ${b.targetUserId}`
  }
  return TARGET_LABELS[b.targetType]
}

function fmt(d: string) { return new Date(d).toLocaleString('fr-FR') }
</script>

<template>
  <div class="overflow-x-auto rounded-card border border-border">
    <p v-if="loading" class="p-4 text-sm text-text-muted">Chargement…</p>
    <p v-else-if="broadcasts.length === 0" data-test="broadcast-history-empty" class="p-4 text-sm text-text-muted">
      Aucun envoi pour le moment.
    </p>
    <table v-else class="w-full text-sm">
      <thead class="border-b border-border text-left text-text-muted">
        <tr>
          <th class="px-4 py-3 font-medium">Titre</th>
          <th class="px-4 py-3 font-medium">Cible</th>
          <th class="px-4 py-3 font-medium">Destinataires</th>
          <th class="px-4 py-3 font-medium">Envoyé le</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="b in broadcasts" :key="b.id" :data-test="`broadcast-row-${b.id}`" class="border-b border-border last:border-0">
          <td class="px-4 py-3">{{ b.title }}</td>
          <td class="px-4 py-3 text-text-muted">{{ targetDescription(b) }}</td>
          <td class="px-4 py-3 tabular-nums">{{ b.recipientCount }}</td>
          <td class="px-4 py-3 tabular-nums">{{ fmt(b.createdAt) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
