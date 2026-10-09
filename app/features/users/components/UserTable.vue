<script setup lang="ts">
import { computed } from 'vue'
import UserTableRow from './UserTableRow.vue'
import type { AdminUserListItem } from '@/features/users/types/index'

/**
 * `selectable` ajoute une colonne de cases à cocher et le badge « Testeur » (mode recette,
 * staging et ADMIN_MANAGE seulement). Sans lui, le tableau reste celui de toujours.
 */
const props = withDefaults(defineProps<{
  users: AdminUserListItem[]
  loading: boolean
  selectable?: boolean
  selectedIds?: ReadonlySet<string>
}>(), { selectable: false, selectedIds: () => new Set<string>() })
const emit = defineEmits<{ select: [id: string]; toggle: [id: string]; 'toggle-page': [ids: string[]] }>()

const pageIds = computed(() => props.users.map((u) => u.id))
const selectedOnPage = computed(() => pageIds.value.filter((id) => props.selectedIds.has(id)).length)
const allOnPage = computed(() => pageIds.value.length > 0 && selectedOnPage.value === pageIds.value.length)
const someOnPage = computed(() => selectedOnPage.value > 0 && !allOnPage.value)
</script>

<template>
  <div class="rounded-card border border-border bg-surface overflow-hidden">
    <table class="w-full">
      <thead class="bg-surface-elevated text-left text-xs uppercase text-text-muted">
        <tr>
          <th v-if="selectable" class="w-10 pl-4 pr-0 py-2">
            <label class="relative flex size-4 items-center justify-center before:absolute before:-inset-3 before:content-['']">
              <input
                type="checkbox" data-test="select-page"
                class="size-4 cursor-pointer accent-primary"
                :checked="allOnPage" :indeterminate="someOnPage" :disabled="pageIds.length === 0"
                aria-label="Sélectionner tous les utilisateurs de la page"
                @change="emit('toggle-page', pageIds)"
              >
            </label>
          </th>
          <th class="px-4 py-2 font-medium">Nom</th>
          <th class="px-4 py-2 font-medium">Email</th>
          <th class="px-4 py-2 font-medium">Téléphone</th>
          <th class="px-4 py-2 font-medium">Ville</th>
          <th class="px-4 py-2 font-medium">Statut</th>
          <th class="px-4 py-2 font-medium">KYC</th>
          <th class="px-4 py-2 font-medium">Note</th>
        </tr>
      </thead>
      <tbody>
        <UserTableRow
          v-for="u in users" :key="u.id" :user="u"
          :selectable="selectable" :selected="selectedIds.has(u.id)"
          @select="(id) => emit('select', id)" @toggle="(id) => emit('toggle', id)"
        />
      </tbody>
    </table>
    <p v-if="loading" class="p-6 text-center text-sm text-text-muted">Chargement…</p>
    <p v-else-if="users.length === 0" class="p-6 text-center text-sm text-text-muted">Aucun utilisateur</p>
  </div>
</template>
