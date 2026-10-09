<script setup lang="ts">
import { computed } from 'vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { userStatusMeta } from './userStatus'
import { userIdentityLabel } from '@/features/users/userIdentity'
import type { AdminUserListItem } from '@/features/users/types/index'
const props = withDefaults(defineProps<{ user: AdminUserListItem; selectable?: boolean; selected?: boolean }>(),
  { selectable: false, selected: false })
const emit = defineEmits<{ select: [id: string]; toggle: [id: string] }>()
const fullName = (u: AdminUserListItem) => [u.firstName, u.lastName].filter(Boolean).join(' ') || '—'
const identity = computed(() => userIdentityLabel(props.user))
</script>

<template>
  <tr
    :data-test="`row-${props.user.id}`"
    class="border-b border-border hover:bg-surface-elevated cursor-pointer transition-colors"
    :class="selectable && selected ? 'bg-primary/5' : ''"
    :aria-selected="selectable ? selected : undefined"
    @click="emit('select', props.user.id)"
  >
    <td v-if="selectable" class="w-10 pl-4 pr-0 py-3" @click.stop>
      <label class="relative flex size-4 items-center justify-center before:absolute before:-inset-3 before:content-['']">
        <input
          type="checkbox" :data-test="`select-${props.user.id}`"
          class="size-4 cursor-pointer accent-primary"
          :checked="selected"
          :aria-label="`Sélectionner ${fullName(props.user)}`"
          @change="emit('toggle', props.user.id)"
        >
      </label>
    </td>
    <td class="px-4 py-3 text-sm font-medium">
      <span class="inline-flex items-center gap-2">
        {{ fullName(props.user) }}
        <span
          v-if="selectable && props.user.recetteTester" data-test="recette-tester-badge"
          class="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning"
        >Testeur</span>
      </span>
    </td>
    <td class="px-4 py-3 text-sm" data-test="cell-identity">
      <span
        :class="identity.isFallback
          ? 'font-mono text-xs text-text-muted'
          : 'text-text-muted'"
        :title="identity.isFallback ? props.user.id : undefined"
      >{{ identity.text }}</span>
    </td>
    <td class="px-4 py-3 text-sm text-text-muted tabular-nums">{{ props.user.phoneNumber }}</td>
    <td class="px-4 py-3 text-sm text-text-muted">{{ props.user.city ?? '—' }}</td>
    <td class="px-4 py-3"><StatusBadge v-bind="userStatusMeta(props.user.status)" /></td>
    <td class="px-4 py-3 text-sm text-text-muted">{{ props.user.kycStatus }}</td>
    <td class="px-4 py-3 text-sm text-text-muted tabular-nums">{{ props.user.averageRating ?? '—' }}</td>
  </tr>
</template>
