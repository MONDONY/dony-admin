<script setup lang="ts">
import StatusBadge from '@/components/ui/StatusBadge.vue'
import type { AdminAccount, ManagedAdminRole, AdminStatus } from '@/features/admin-accounts/types/index'

defineProps<{ accounts: AdminAccount[]; loading: boolean }>()
const emit = defineEmits<{
  role: [id: string, role: ManagedAdminRole]
  status: [id: string, status: AdminStatus]
  reset: [id: string]
}>()

const isRoot = (account: AdminAccount) => account.role === 'SUPER_ADMIN'
const otherRole = (role: AdminAccount['role']): ManagedAdminRole => (role === 'ADMIN' ? 'SUPPORT' : 'ADMIN')

function fmtDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString('fr-FR') : '—'
}
</script>

<template>
  <div class="rounded-card border border-border bg-surface overflow-hidden">
    <table class="w-full">
      <thead class="bg-surface-elevated text-left text-xs uppercase text-text-muted">
        <tr>
          <th class="px-4 py-2 font-medium">Email</th>
          <th class="px-4 py-2 font-medium">Rôle</th>
          <th class="px-4 py-2 font-medium">Statut</th>
          <th class="px-4 py-2 font-medium">Changement requis</th>
          <th class="px-4 py-2 font-medium">Dernière connexion</th>
          <th class="px-4 py-2 font-medium"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="a in accounts" :key="a.id" :data-test="`admin-row-${a.id}`" class="border-b border-border">
          <td class="px-4 py-3 text-sm font-medium">{{ a.email }}</td>
          <td class="px-4 py-3">
            <StatusBadge :label="a.role" :tone="isRoot(a) ? 'info' : 'neutral'" />
          </td>
          <td class="px-4 py-3">
            <StatusBadge v-if="a.status === 'ACTIVE'" label="Actif" tone="success" />
            <StatusBadge v-else label="Désactivé" tone="neutral" />
          </td>
          <td class="px-4 py-3 text-sm text-text-muted">{{ a.mustChangePassword ? 'Oui' : 'Non' }}</td>
          <td class="px-4 py-3 text-sm text-text-muted tabular-nums">{{ fmtDate(a.lastLoginAt) }}</td>
          <td class="px-4 py-3 text-right whitespace-nowrap">
            <button
              type="button" :data-test="`toggle-role-${a.id}`" :disabled="isRoot(a)"
              class="rounded-btn px-3 py-1.5 text-sm bg-surface-elevated text-text-muted hover:text-text disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              @click="emit('role', a.id, otherRole(a.role))"
            >Passer {{ otherRole(a.role) }}</button>
            <button
              type="button" :data-test="`toggle-status-${a.id}`" :disabled="isRoot(a)"
              class="ml-2 rounded-btn px-3 py-1.5 text-sm bg-surface-elevated text-text-muted hover:text-text disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              @click="emit('status', a.id, a.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE')"
            >{{ a.status === 'ACTIVE' ? 'Désactiver' : 'Activer' }}</button>
            <button
              type="button" :data-test="`reset-${a.id}`" :disabled="isRoot(a)"
              class="ml-2 rounded-btn px-3 py-1.5 text-sm bg-danger/15 text-danger hover:bg-danger/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              @click="emit('reset', a.id)"
            >Réinitialiser</button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="loading" class="p-6 text-center text-sm text-text-muted">Chargement…</p>
    <p v-else-if="accounts.length === 0" class="p-6 text-center text-sm text-text-muted">Aucun administrateur</p>
  </div>
</template>
