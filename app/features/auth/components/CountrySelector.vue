<script lang="ts">
export { type Country, COUNTRIES } from '../data/countries.ts'
</script>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { ChevronDown } from 'lucide-vue-next'
import { type Country, COUNTRIES } from '../data/countries.ts'

const props = defineProps<{ modelValue: Country }>()
const emit = defineEmits<{ 'update:modelValue': [country: Country] }>()

const open = ref(false)
const container = ref<HTMLElement | null>(null)

function select(country: Country) {
  emit('update:modelValue', country)
  open.value = false
}

function handleClickOutside(e: MouseEvent) {
  if (container.value && !container.value.contains(e.target as Node)) {
    open.value = false
  }
}

onMounted(() => document.addEventListener('click', handleClickOutside, true))
onUnmounted(() => document.removeEventListener('click', handleClickOutside, true))
</script>

<template>
  <div ref="container" class="relative">
    <button
      type="button"
      class="flex items-center gap-1.5 h-11 min-w-[92px] rounded-[10px] border border-border bg-surface-el px-3 text-sm font-semibold text-text hover:border-primary transition-colors"
      :aria-expanded="open"
      aria-haspopup="listbox"
      @click.stop="open = !open"
    >
      <span>{{ props.modelValue.flag }}</span>
      <span>{{ props.modelValue.dial }}</span>
      <ChevronDown class="w-3 h-3 text-subtle ml-auto" :class="{ 'rotate-180': open }" />
    </button>

    <ul
      v-if="open"
      role="listbox"
      class="absolute top-full left-0 mt-1 z-50 bg-surface border border-border rounded-card shadow-xl py-1 min-w-[200px]"
    >
      <li
        v-for="country in COUNTRIES"
        :key="country.code"
        role="option"
        :aria-selected="country.code === props.modelValue.code"
        class="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-surface-el transition-colors"
        :class="country.code === props.modelValue.code ? 'text-primary font-semibold' : 'text-text'"
        @click="select(country)"
      >
        <span>{{ country.flag }}</span>
        <span>{{ country.name }}</span>
        <span class="ml-auto text-subtle text-xs">{{ country.dial }}</span>
      </li>
    </ul>
  </div>
</template>
