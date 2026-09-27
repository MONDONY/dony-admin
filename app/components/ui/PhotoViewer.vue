<script setup lang="ts">
/**
 * Visionneuse plein écran d'une série d'images (captures de signalement, photos d'une
 * demande d'envoi). `urls` à null = fermée. Les URLs présignées ne sont jamais recopiées.
 */
withDefaults(defineProps<{ urls: string[] | null; title?: string; alt?: string }>(), {
  title: 'Captures jointes',
  alt: 'Capture d’écran jointe',
})
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <div
    v-if="urls !== null"
    class="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-6" data-test="photo-viewer"
    role="dialog" aria-modal="true" :aria-label="title"
    @click.self="emit('close')" @keydown.esc="emit('close')"
  >
    <div class="max-h-full max-w-4xl overflow-auto rounded-card bg-surface p-4 shadow-xl">
      <div class="mb-3 flex items-center justify-between gap-4">
        <h2 class="font-display text-lg font-semibold text-balance">{{ title }}</h2>
        <button
          type="button" data-test="photo-viewer-close"
          class="rounded-btn px-3 py-1.5 text-sm border border-border hover:bg-surface-elevated transition-colors active:scale-[0.96]"
          @click="emit('close')"
        >Fermer</button>
      </div>
      <div class="flex flex-wrap gap-4">
        <img
          v-for="(url, i) in urls" :key="i" :src="url" :alt="alt"
          class="max-h-[70vh] max-w-full rounded object-contain outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"
        >
      </div>
    </div>
  </div>
</template>
