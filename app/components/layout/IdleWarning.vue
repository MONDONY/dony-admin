<script setup lang="ts">
// Avertissement non modal de la console de bureau, 60 s avant la fermeture pour inactivité.
// La zone annoncée (role="status") reste dans la page : son contenu, ajouté ensuite, est lu.
defineProps<{ visible: boolean }>()
const emit = defineEmits<{ stay: [] }>()
</script>

<template>
  <div
    role="status"
    aria-live="polite"
    data-test="idle-warning-region"
    class="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4"
  >
    <Transition
      enter-active-class="transition-[opacity,translate] duration-200 ease-out motion-reduce:transition-none"
      enter-from-class="opacity-0 translate-y-2"
      leave-active-class="transition-[opacity,translate] duration-150 ease-in motion-reduce:transition-none"
      leave-to-class="opacity-0 translate-y-1"
    >
      <div
        v-if="visible"
        data-test="idle-warning"
        class="idle-warning pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-card bg-surface p-2 pl-4 text-sm text-text"
      >
        <p class="min-w-0 flex-1 [text-wrap:pretty]">
          Votre session va se fermer pour inactivité
        </p>
        <button
          type="button"
          data-test="idle-stay"
          class="shrink-0 whitespace-nowrap rounded-xs bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90 active:scale-[0.96] transition-[background-color,scale]"
          @click="emit('stay')"
        >
          Rester connecté
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* Ombres superposées plutôt qu'une bordure pleine : profondeur lisible sur tout fond. */
.idle-warning {
  box-shadow: 0 0 0 1px rgb(var(--border-rgb)), 0 4px 12px rgb(0 0 0 / 0.08), 0 12px 32px rgb(0 0 0 / 0.12);
}
</style>
