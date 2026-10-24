<script setup lang="ts">
import { onBeforeUnmount } from 'vue'
import SuggestSearchBox from '@/components/ui/SuggestSearchBox.vue'

/**
 * Recherche d'une liste finance : la frappe s'applique après 300 ms de pause, Entrée ou
 * « Chercher » tout de suite. Pas de suggestions (boîte de recherche sans groupes).
 */
const props = defineProps<{ query: string; placeholder: string; ariaLabel: string; testPrefix: string }>()
const emit = defineEmits<{ 'update:query': [string] }>()

const DEBOUNCE_MS = 300
let timer: ReturnType<typeof setTimeout> | null = null
const clear = () => { if (timer) { clearTimeout(timer); timer = null } }
onBeforeUnmount(clear)

function emitQuery(text: string) {
  if (text.trim() === props.query.trim()) return
  emit('update:query', text.trim())
}
function onType(text: string) {
  clear()
  timer = setTimeout(() => { timer = null; emitQuery(text) }, DEBOUNCE_MS)
}
function onSubmit(text: string) {
  clear()
  emitQuery(text)
}
</script>

<template>
  <SuggestSearchBox
    :model-query="query" :groups="[]" disabled :test-prefix="testPrefix"
    :placeholder="placeholder" v-bind="{ ariaLabel }"
    @type="onType" @update:query="onSubmit"
  />
</template>
