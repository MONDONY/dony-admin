<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import type { AdminGdprRequest } from '@/features/users/types/index'

defineProps<{ requests: AdminGdprRequest[]; loading?: boolean }>()
const emit = defineEmits<{ execute: [request: AdminGdprRequest] }>()
const auth = useAuthStore()

function fullName(r: AdminGdprRequest) {
  return [r.firstName, r.lastName].filter(Boolean).join(' ') || '—'
}
function fmt(d: string) { return new Date(d).toLocaleDateString('fr-FR') }
</script>

<template>
  <div class="overflow-x-auto rounded-card border border-border">
    <p v-if="loading" class="p-4 text-sm text-text-muted">Chargement…</p>
    <p v-else-if="requests.length === 0" data-test="gdpr-empty" class="p-4 text-sm text-text-muted">
      Aucune demande de suppression en attente.
    </p>
    <table v-else class="w-full text-sm">
      <thead class="border-b border-border text-left text-text-muted">
        <tr>
          <th class="px-4 py-3 font-medium">Utilisateur</th>
          <th class="px-4 py-3 font-medium">Email</th>
          <th class="px-4 py-3 font-medium">Demandée le</th>
          <th class="px-4 py-3 font-medium">Ancienneté</th>
          <th class="px-4 py-3 font-medium" />
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in requests" :key="r.id" :data-test="`row-${r.id}`" class="border-b border-border last:border-0">
          <td class="px-4 py-3">{{ fullName(r) }}</td>
          <td class="px-4 py-3">{{ r.email ?? '—' }}</td>
          <td class="px-4 py-3 tabular-nums">{{ fmt(r.deletionRequestedAt) }}</td>
          <td class="px-4 py-3 tabular-nums">{{ r.ageDays }} j</td>
          <td class="px-4 py-3 text-right">
            <button
              v-if="auth.can('USER_GDPR_DELETE')" type="button" :data-test="`action-gdpr-execute-${r.id}`"
              class="rounded-btn px-3 py-1.5 text-sm bg-danger/20 text-danger hover:bg-danger/30"
              @click="emit('execute', r)"
            >Exécuter la suppression</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
