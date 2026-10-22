<script setup lang="ts">
import { ChevronDown } from 'lucide-vue-next'
import { computed } from 'vue'
import { badgeLabel } from '@/features/notifications/lib/format'

const props = withDefaults(defineProps<{
  id: string
  label: string
  open: boolean
  /** Une page du groupe est affichée : l'en-tête le signale même replié. */
  active?: boolean
  /** Somme des pastilles du groupe, montrée seulement quand il est replié. */
  badge?: number
  badgeTone?: 'neutral' | 'danger'
}>(), { active: false, badge: 0, badgeTone: 'neutral' })
const emit = defineEmits<{ toggle: [] }>()

const panelId = computed(() => `nav-group-${props.id}`)
const showBadge = computed(() => !props.open && props.badge > 0)
</script>

<template>
  <div :data-test="`nav-group-${id}`">
    <button
      type="button"
      :data-test="`nav-group-toggle-${id}`"
      :aria-expanded="open"
      :aria-controls="panelId"
      class="flex w-full items-center gap-2 rounded-btn px-4 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted transition-colors hover:text-text"
      @click="emit('toggle')"
    >
      <span class="flex-1 truncate">{{ label }}</span>
      <span v-if="active && !open" class="h-1.5 w-1.5 rounded-full bg-primary" data-test="nav-group-active" />
      <span
        v-if="showBadge"
        data-test="nav-group-badge"
        :data-tone="badgeTone"
        class="min-w-[20px] rounded-full px-1.5 py-0.5 text-center text-xs font-semibold leading-4 tabular-nums normal-case tracking-normal"
        :class="badgeTone === 'danger' ? 'bg-danger text-white' : 'bg-surface-elevated text-text ring-1 ring-inset ring-border'"
      >{{ badgeLabel(badge) }}<span class="sr-only">&nbsp;à traiter</span></span>
      <ChevronDown class="h-3.5 w-3.5 shrink-0 transition-transform duration-150" :class="open ? '' : '-rotate-90'" />
    </button>
    <div v-show="open" :id="panelId" class="space-y-1 pt-1">
      <slot />
    </div>
  </div>
</template>
