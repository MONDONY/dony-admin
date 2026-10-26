<script setup lang="ts">
/** Indication de touche (« J », « ⏎ »). Décorative : le geste reste faisable à la souris. */
withDefaults(defineProps<{ tone?: 'default' | 'inverse' }>(), { tone: 'default' })
</script>

<template>
  <kbd
    aria-hidden="true"
    :class="['inline-flex h-5 min-w-5 items-center justify-center rounded-xs border border-b-2 px-1 text-[11px] font-semibold leading-none',
      tone === 'inverse' ? 'border-white/30 bg-white/15 text-white' : 'border-border bg-surface-elevated text-text-muted']"
  ><slot /></kbd>
</template>
