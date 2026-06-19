<script setup lang="ts">
import UserTableRow from './UserTableRow.vue'
import type { AdminUserListItem } from '@/features/users/types/index'
defineProps<{ users: AdminUserListItem[]; loading: boolean }>()
const emit = defineEmits<{ select: [id: string] }>()
</script>

<template>
  <div class="rounded-card border border-border bg-surface overflow-hidden">
    <table class="w-full">
      <thead class="bg-surface-elevated text-left text-xs uppercase text-text-muted">
        <tr>
          <th class="px-4 py-2 font-medium">Nom</th>
          <th class="px-4 py-2 font-medium">Téléphone</th>
          <th class="px-4 py-2 font-medium">Ville</th>
          <th class="px-4 py-2 font-medium">Statut</th>
          <th class="px-4 py-2 font-medium">KYC</th>
          <th class="px-4 py-2 font-medium">Note</th>
        </tr>
      </thead>
      <tbody>
        <UserTableRow v-for="u in users" :key="u.id" :user="u" @select="(id) => emit('select', id)" />
      </tbody>
    </table>
    <p v-if="loading" class="p-6 text-center text-sm text-text-muted">Chargement…</p>
    <p v-else-if="users.length === 0" class="p-6 text-center text-sm text-text-muted">Aucun utilisateur</p>
  </div>
</template>
