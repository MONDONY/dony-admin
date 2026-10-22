<script setup lang="ts">
import { Inbox, Loader2, TriangleAlert } from 'lucide-vue-next'

/**
 * Les trois états d'une liste, rendus partout pareil : chargement, échec (avec « Réessayer »)
 * et vide. À poser sous le tableau ; sans état à montrer, il ne rend rien.
 *
 * Un échec ne doit jamais ressembler à une liste vide : sans `error`, un 500 affichait
 * « Aucun colis » et l'admin concluait à tort qu'il n'y avait rien à traiter.
 */
withDefaults(defineProps<{
  loading?: boolean
  empty?: boolean
  error?: string | null
  emptyLabel?: string
  /** Piste pour sortir du vide (ex. « Modifiez les filtres »). */
  hint?: string
  /** `data-test` de l'état vide (certains écrans en ont un depuis toujours). */
  emptyTest?: string
}>(), { loading: false, empty: false, error: null, emptyLabel: 'Aucun résultat', hint: undefined, emptyTest: undefined })
const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <div v-if="loading" role="status" aria-live="polite" class="flex items-center justify-center gap-2 p-6 text-sm text-text-muted">
    <Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
    <span>Chargement…</span>
  </div>
  <div
    v-else-if="error" role="alert" data-test="state-error"
    class="flex flex-col items-center gap-2 p-6 text-center text-sm"
  >
    <TriangleAlert class="h-5 w-5 text-danger" aria-hidden="true" />
    <p class="text-danger text-pretty">{{ error }}</p>
    <button
      type="button" data-test="state-retry"
      class="rounded-btn border border-border px-3 py-1.5 transition-[background-color,scale] hover:bg-surface-elevated active:scale-[0.96]"
      @click="emit('retry')"
    >Réessayer</button>
  </div>
  <div v-else-if="empty" :data-test="emptyTest ?? 'state-empty'" class="flex flex-col items-center gap-1.5 p-8 text-center">
    <Inbox class="h-5 w-5 text-text-muted" aria-hidden="true" />
    <p class="text-sm text-text-muted text-pretty">{{ emptyLabel }}</p>
    <p v-if="hint" class="text-xs text-text-muted/80 text-pretty">{{ hint }}</p>
  </div>
</template>
