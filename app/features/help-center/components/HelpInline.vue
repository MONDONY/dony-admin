<script setup lang="ts">
import { resolveActiveEntry } from '@/components/layout/navConfig'
import type { Inline } from '@/features/help-center/lib/helpMarkdown'
import { useAuthStore } from '@/stores/auth'

defineProps<{ inlines: Inline[] }>()
const emit = defineEmits<{ navigate: [] }>()
const auth = useAuthStore()

/**
 * Une fiche reste lisible par tout admin, mais un lien vers une page qu'il ne peut pas ouvrir
 * mènerait à « Accès refusé » : il devient du texte. Même règle que le menu (permission de la page).
 */
function allowed(to: string): boolean {
  const entry = resolveActiveEntry(to.split('?')[0])
  return !entry || auth.can(entry.permission)
}
</script>

<template>
  <template v-for="(part, i) in inlines" :key="i">
    <strong v-if="part.kind === 'bold'" class="font-semibold text-text">{{ part.text }}</strong>
    <NuxtLink
      v-else-if="part.kind === 'link' && allowed(part.to)" :to="part.to" data-test="help-inline-link"
      class="rounded-xs font-medium text-primary underline decoration-primary/30 underline-offset-2 transition-colors hover:decoration-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      @click="emit('navigate')"
    >{{ part.text }}</NuxtLink>
    <span v-else-if="part.kind === 'link'" data-test="help-inline-locked" class="font-medium">{{ part.text }}</span>
    <template v-else>{{ part.text }}</template>
  </template>
</template>
