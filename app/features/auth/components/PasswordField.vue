<script setup lang="ts">
import { ref } from 'vue'
import { Eye, EyeOff } from 'lucide-vue-next'

defineProps<{
  id: string
  modelValue: string
  label: string
  autocomplete: string
  placeholder?: string
  disabled?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const visible = ref(false)
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <label :for="id" class="text-sm font-medium text-text">{{ label }}</label>
    <div class="relative">
      <input
        :id="id"
        :type="visible ? 'text' : 'password'"
        :value="modelValue"
        :autocomplete="autocomplete"
        :placeholder="placeholder"
        :disabled="disabled"
        class="w-full rounded-btn border border-border bg-surface-el px-3 py-2 pr-10 text-sm text-text placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      />
      <button
        type="button"
        :data-test="`${id}-toggle-visibility`"
        class="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text transition-colors disabled:opacity-40"
        :aria-label="visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'"
        :disabled="disabled"
        @click="visible = !visible"
      >
        <EyeOff v-if="visible" class="w-4 h-4" />
        <Eye v-else class="w-4 h-4" />
      </button>
    </div>
  </div>
</template>
