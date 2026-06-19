<script setup lang="ts">
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { userStatusMeta } from './userStatus'
import type { AdminUserListItem } from '@/features/users/types/index'
const props = defineProps<{ user: AdminUserListItem }>()
const emit = defineEmits<{ select: [id: string] }>()
const fullName = (u: AdminUserListItem) => [u.firstName, u.lastName].filter(Boolean).join(' ') || '—'
</script>

<template>
  <tr
    :data-test="`row-${props.user.id}`"
    class="border-b border-border hover:bg-surface-elevated cursor-pointer transition-colors"
    @click="emit('select', props.user.id)"
  >
    <td class="px-4 py-3 text-sm font-medium">{{ fullName(props.user) }}</td>
    <td class="px-4 py-3 text-sm text-text-muted tabular-nums">{{ props.user.phoneNumber }}</td>
    <td class="px-4 py-3 text-sm text-text-muted">{{ props.user.city ?? '—' }}</td>
    <td class="px-4 py-3"><StatusBadge v-bind="userStatusMeta(props.user.status)" /></td>
    <td class="px-4 py-3 text-sm text-text-muted">{{ props.user.kycStatus }}</td>
    <td class="px-4 py-3 text-sm text-text-muted tabular-nums">{{ props.user.averageRating ?? '—' }}</td>
  </tr>
</template>
