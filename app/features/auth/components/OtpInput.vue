<!-- app/features/auth/components/OtpInput.vue -->
<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{ disabled?: boolean }>()
const emit = defineEmits<{ complete: [code: string] }>()

const digits = ref<string[]>(Array(6).fill(''))
const inputs = ref<HTMLInputElement[]>([])

function onInput(index: number, event: Event) {
  const raw = (event.target as HTMLInputElement).value.replace(/\D/g, '')
  const value = raw.slice(-1)
  digits.value[index] = value
  if (value && index < 5) {
    inputs.value[index + 1]?.focus()
  }
  checkComplete()
}

function onKeydown(index: number, event: KeyboardEvent) {
  if (event.key === 'Backspace' && !digits.value[index] && index > 0) {
    digits.value[index - 1] = ''
    inputs.value[index - 1]?.focus()
  }
}

function onPaste(event: ClipboardEvent) {
  event.preventDefault()
  const text = event.clipboardData?.getData('text')?.replace(/\D/g, '').slice(0, 6) ?? ''
  for (let i = 0; i < 6; i++) {
    digits.value[i] = text[i] ?? ''
  }
  const lastFilled = Math.min(text.length, 5)
  inputs.value[lastFilled]?.focus()
  checkComplete()
}

function checkComplete() {
  const code = digits.value.join('')
  if (code.length === 6) emit('complete', code)
}

function reset() {
  digits.value = Array(6).fill('')
  inputs.value[0]?.focus()
}

defineExpose({ reset })
</script>

<template>
  <div>
    <div class="flex gap-2">
      <input
        v-for="(digit, i) in digits"
        :key="i"
        ref="inputs"
        type="text"
        inputmode="numeric"
        maxlength="1"
        :autocomplete="i === 0 ? 'one-time-code' : 'off'"
        :value="digit"
        :disabled="props.disabled"
        :aria-label="`Chiffre ${i + 1} sur 6`"
        class="w-10 h-12 text-center text-lg font-bold rounded-[10px] border bg-surface-el outline-none transition-colors focus:ring-2 focus:ring-primary/15"
        :class="digit ? 'border-primary text-text' : 'border-border text-subtle'"
        style="caret-color: var(--primary);"
        @input="onInput(i, $event)"
        @keydown="onKeydown(i, $event)"
        @paste="onPaste"
        @focus="($event.target as HTMLInputElement).select()"
      />
    </div>
    <div class="mt-2 h-0.5 rounded-full bg-border overflow-hidden">
      <div
        class="h-full rounded-full bg-primary transition-all duration-200"
        :style="{ width: `${(digits.filter(Boolean).length / 6) * 100}%` }"
      />
    </div>
  </div>
</template>
