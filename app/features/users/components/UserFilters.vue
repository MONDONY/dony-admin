<script setup lang="ts">
import { ref } from 'vue'
import type { UserStatusFilter } from '@/features/users/types/index'
/** `showRecette` : filtre « Testeurs recette », réservé au super-admin en staging. */
withDefaults(defineProps<{ modelStatus: UserStatusFilter; modelQuery: string; showRecette?: boolean; modelRecette?: boolean }>(),
  { showRecette: false, modelRecette: false })
const emit = defineEmits<{ 'update:status': [UserStatusFilter]; 'update:query': [string]; 'update:recette': [boolean] }>()
const chips: { value: UserStatusFilter; label: string }[] = [
  { value: 'TOUS', label: 'Tous' },
  { value: 'ACTIVE', label: 'Actifs' },
  { value: 'SUSPENDED', label: 'Suspendus' },
  { value: 'BANNED', label: 'Bannis' },
  { value: 'PENDING_DELETION', label: 'Suppression demandée' },
]
const q = ref('')
</script>

<template>
  <div class="flex flex-wrap items-center gap-3 mb-4">
    <div class="flex flex-wrap gap-1">
      <button
        v-for="c in chips" :key="c.value" type="button" :data-test="`chip-${c.value}`"
        :class="['rounded-full px-3 py-1.5 text-sm transition-colors',
          modelStatus === c.value ? 'bg-primary text-white' : 'bg-surface-elevated text-text-muted hover:text-text']"
        @click="emit('update:status', c.value)"
      >{{ c.label }}</button>
      <button
        v-if="showRecette" type="button" data-test="chip-recette" :aria-pressed="modelRecette"
        :class="['rounded-full px-3 py-1.5 text-sm transition-colors',
          modelRecette ? 'bg-warning text-white' : 'bg-surface-elevated text-text-muted hover:text-text']"
        @click="emit('update:recette', !modelRecette)"
      >Testeurs recette</button>
    </div>
    <input
      v-model="q" data-test="search" type="search"
      placeholder="Nom, e-mail, téléphone, UID ou identifiant"
      aria-label="Rechercher par nom, e-mail, téléphone, UID Firebase ou identifiant"
      title="L'UID Firebase et l'identifiant doivent être collés en entier."
      class="flex-1 min-w-[280px] rounded-btn border border-border bg-surface px-3 py-2 text-sm"
      @keyup.enter="emit('update:query', q)"
    >
  </div>
</template>
