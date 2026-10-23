<script setup lang="ts">
import { computed } from 'vue'
import { badgeLabel } from '@/features/notifications/lib/format'

const props = withDefaults(defineProps<{
  to: string
  label: string
  badge?: number
  /** `danger` : l'attente coûte (alerte, versement retenu). */
  badgeTone?: 'neutral' | 'danger'
  /**
   * Page courante, décidée par l'appelant. Absent : on laisse le routeur décider (préfixe),
   * ce qui allume « Utilisateurs » et « Demandes RGPD » ensemble sur /users/rgpd.
   */
  active?: boolean
}>(), { badge: 0, badgeTone: 'neutral', active: undefined })

const badgeText = computed(() => badgeLabel(props.badge))
</script>

<template>
  <NuxtLink
    :to="to"
    class="flex items-center gap-3 px-4 py-2.5 rounded-btn transition-colors"
    :class="active === undefined ? 'text-text-muted hover:text-text hover:bg-surface-elevated' : active ? 'bg-primary/10 text-primary' : 'text-text-muted hover:text-text hover:bg-surface-elevated'"
    :active-class="active === undefined ? 'bg-primary/10 text-primary' : ''"
    :aria-current="active ? 'page' : undefined"
  >
    <slot name="icon" />
    <span class="flex-1 text-sm font-medium">{{ label }}</span>
    <Transition
      enter-active-class="transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)]"
      enter-from-class="opacity-0 scale-50"
      leave-active-class="transition-opacity duration-150 ease-in"
      leave-to-class="opacity-0"
    >
      <span
        v-if="badge > 0"
        data-test="badge"
        :data-tone="badgeTone"
        class="text-xs font-semibold tabular-nums rounded-full px-1.5 py-0.5 min-w-[20px] text-center leading-4"
        :class="badgeTone === 'danger' ? 'bg-danger text-white' : 'bg-surface-elevated text-text ring-1 ring-inset ring-border'"
      >{{ badgeText }}<span class="sr-only">&nbsp;à traiter</span></span>
    </Transition>
  </NuxtLink>
</template>
