<script setup lang="ts">
import { ref } from 'vue'
import type { UserStatusFilter } from '@/features/users/types/index'
defineProps<{ modelStatus: UserStatusFilter; modelQuery: string }>()
const emit = defineEmits<{ 'update:status': [UserStatusFilter]; 'update:query': [string] }>()
const chips: { value: UserStatusFilter; label: string }[] = [
  { value: 'TOUS', label: 'Tous' },
  { value: 'ACTIVE', label: 'Actifs' },
  { value: 'SUSPENDED', label: 'Suspendus' },
  { value: 'BANNED', label: 'Bannis' },
]
const q = ref('')
</script>

<template>
  <div class="flex flex-wrap items-center gap-3 mb-4">
    <div class="flex gap-1">
      <button
        v-for="c in chips" :key="c.value" type="button" :data-test="`chip-${c.value}`"
        :class="['rounded-full px-3 py-1.5 text-sm transition-colors',
          modelStatus === c.value ? 'bg-primary text-white' : 'bg-surface-elevated text-text-muted hover:text-text']"
        @click="emit('update:status', c.value)"
      >{{ c.label }}</button>
    </div>
    <input
      data-test="search" v-model="q" type="search" placeholder="Nom, téléphone, email…"
      class="flex-1 min-w-[200px] rounded-btn border border-border bg-surface px-3 py-2 text-sm"
      @keyup.enter="emit('update:query', q)"
    >
  </div>
</template>
