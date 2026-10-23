<script setup lang="ts">
defineProps<{ chips: { key: string; label: string }[] }>()
const emit = defineEmits<{ remove: [key: string]; clear: [] }>()
</script>

<template>
  <div v-if="chips.length" class="flex flex-wrap items-center gap-2" role="group" aria-label="Filtres actifs">
    <span
      v-for="c in chips" :key="c.key" :data-test="`active-chip-${c.key}`"
      class="inline-flex min-h-8 items-center gap-1 rounded-full border border-primary/30 bg-primary/5 pl-3 pr-1 text-sm"
    >
      {{ c.label }}
      <button
        type="button" :data-test="`active-chip-${c.key}-remove`" :aria-label="`Retirer le filtre ${c.label}`"
        class="inline-flex size-8 items-center justify-center rounded-full text-text-muted transition-[background-color,transform] hover:bg-primary/10 hover:text-text active:scale-[0.96] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        @click="emit('remove', c.key)"
      >×</button>
    </span>
    <button
      type="button" data-test="active-chips-clear"
      class="inline-flex min-h-10 items-center rounded-btn px-3 text-sm text-primary transition-[background-color,transform] hover:bg-primary/10 active:scale-[0.96] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      @click="emit('clear')"
    >Tout effacer</button>
  </div>
</template>
