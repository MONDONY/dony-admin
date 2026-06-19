<script setup lang="ts">
import { Bell, LogOut } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import ThemeToggle from '@/components/ui/ThemeToggle.vue'
import { useFirebaseAuth } from '@/features/auth/composables/useFirebaseAuth'

defineProps<{ title: string; subtitle?: string }>()

async function logout() {
  const { signOut } = useFirebaseAuth()
  await signOut()
}
</script>

<template>
  <header class="h-topbar shrink-0 bg-surface border-b border-border flex items-center justify-between px-6">
    <div>
      <h1 class="font-display text-xl font-bold">{{ title }}</h1>
      <p v-if="subtitle" class="text-sm text-text-muted">{{ subtitle }}</p>
    </div>
    <div class="flex items-center gap-2">
      <ThemeToggle />
      <Button variant="ghost" size="icon"><Bell class="w-4 h-4" /></Button>
      <Button variant="ghost" size="icon" @click="logout"><LogOut class="w-4 h-4" /></Button>
    </div>
  </header>
</template>
