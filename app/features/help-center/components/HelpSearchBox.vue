<script setup lang="ts">
import { ref } from 'vue'
import { Loader2, Search, X } from 'lucide-vue-next'
import { SEARCH_MAX_LENGTH } from '@/features/help-center/composables/useHelpSearch'

/** Champ de recherche de la doc : `type` à chaque frappe, `submit` sur Entrée, `clear` sur la croix ou Échap. */
defineProps<{ modelValue: string; loading?: boolean }>()
const emit = defineEmits<{ type: [value: string]; submit: [value: string]; clear: [] }>()
const input = ref<HTMLInputElement | null>(null)

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && (e.target as HTMLInputElement).value) {
    e.preventDefault()
    emit('clear')
  }
}
function clear() {
  emit('clear')
  input.value?.focus()
}
defineExpose({ focus: () => input.value?.focus() })
</script>

<template>
  <form role="search" class="relative" @submit.prevent="emit('submit', modelValue)">
    <label for="help-search" class="sr-only">Rechercher dans la documentation</label>
    <Search class="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-text-muted" aria-hidden="true" />
    <input
      id="help-search" ref="input" data-test="help-search-input" type="search" autocomplete="off" enterkeyhint="search"
      :value="modelValue" :maxlength="SEARCH_MAX_LENGTH"
      placeholder="Rechercher un sujet : colis en cours, rembourser, suspendre un compte…"
      class="h-14 w-full rounded-card border border-border bg-surface pl-12 pr-24 text-base shadow-sm transition-[border-color,box-shadow] placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15 [&::-webkit-search-cancel-button]:hidden"
      @input="emit('type', ($event.target as HTMLInputElement).value)"
      @keydown="onKeydown"
    >
    <div class="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
      <Loader2 v-if="loading" class="h-4 w-4 animate-spin text-text-muted motion-reduce:animate-none" aria-hidden="true" />
      <button
        v-if="modelValue" type="button" data-test="help-search-clear" aria-label="Effacer la recherche"
        class="flex h-10 w-10 items-center justify-center rounded-btn text-text-muted transition-[background-color,transform] hover:bg-surface-elevated hover:text-text active:scale-[0.96] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        @click="clear"
      ><X class="h-4 w-4" aria-hidden="true" /></button>
    </div>
  </form>
</template>
