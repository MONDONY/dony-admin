<script setup lang="ts">
import { computed, onBeforeUnmount } from 'vue'
import SuggestSearchBox from '@/components/ui/SuggestSearchBox.vue'
import { MOBILE_MONEY_KIND_OPTIONS } from '@/features/finance/lib/mobileMoneyViews'
import { mobileMoneyProviderDisplay } from './mobileMoneyStatus'
import type { MobileMoneyOperationKind } from '@/features/finance/types/index'

/**
 * Recherche et filtres Type / Opérateur de la liste mobile money. La frappe applique la recherche
 * après 300 ms de pause ; Entrée ou « Chercher » l'applique tout de suite. Pas de suggestions (le
 * champ réutilise la boîte de recherche sans groupes) et jamais d'invitation à taper un numéro de
 * téléphone : le back ne le cherche pas.
 *
 * Opérateurs : ceux déjà rencontrés dans les listes chargées (`providers`, fournis par le parent),
 * plus la valeur choisie, qui reste listée même si elle n'apparaît plus dans la liste courante.
 */
const props = defineProps<{ query: string; kind: MobileMoneyOperationKind | ''; provider: string; providers: string[] }>()
const emit = defineEmits<{
  'update:query': [string]
  'update:kind': [MobileMoneyOperationKind | '']
  'update:provider': [string]
}>()

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

const providerOptions = computed(() => {
  const all = new Set(props.providers)
  if (props.provider) all.add(props.provider)
  return [...all].map(value => ({ value, label: mobileMoneyProviderDisplay(value) })).sort((a, b) => a.label.localeCompare(b.label, 'fr'))
})

const selectClass = 'min-h-10 rounded-btn border border-border bg-surface px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary'
</script>

<template>
  <div class="space-y-3">
    <SuggestSearchBox
      :model-query="query" :groups="[]" disabled test-prefix="mm"
      placeholder="Chercher : nom, référence d’opération, n° de suivi, trajet" v-bind="{ ariaLabel: 'Rechercher une opération mobile money' }"
      @type="onType" @update:query="onSubmit"
    />
    <div class="flex flex-wrap items-center gap-2">
      <select
        :value="kind" data-test="mm-filter-kind" aria-label="Type d’opération" :class="selectClass"
        @change="emit('update:kind', ($event.target as HTMLSelectElement).value as MobileMoneyOperationKind | '')"
      >
        <option v-for="o in MOBILE_MONEY_KIND_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
      <select
        :value="provider" data-test="mm-filter-provider" aria-label="Opérateur" :class="selectClass"
        @change="emit('update:provider', ($event.target as HTMLSelectElement).value)"
      >
        <option value="">Tous les opérateurs</option>
        <option v-for="o in providerOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
    </div>
  </div>
</template>
