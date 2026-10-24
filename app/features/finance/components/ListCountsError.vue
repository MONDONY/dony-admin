<script setup lang="ts">
/** Nombres des vues en échec : les derniers reçus restent affichés, « Réessayer » les relit. */
defineProps<{ testPrefix: string }>()
const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <p :data-test="`${testPrefix}-counts-error`" role="status" class="flex items-center gap-2 text-xs text-text-muted">
    Nombres indisponibles
    <button
      type="button" :data-test="`${testPrefix}-counts-retry`"
      class="inline-flex min-h-10 items-center rounded-btn px-2 text-xs text-primary transition-[background-color,transform] hover:bg-primary/10 active:scale-[0.96] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      @click="emit('retry')"
    >Réessayer</button>
  </p>
</template>
