<script setup lang="ts">
import { Copy } from 'lucide-vue-next'
import type { TemporaryCredentials } from '@/features/admin-accounts/types/index'

const props = defineProps<{ credentials: TemporaryCredentials }>()
const emit = defineEmits<{ close: [] }>()

async function copyPassword() {
  await navigator.clipboard.writeText(props.credentials.temporaryPassword)
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" data-test="credentials-overlay">
    <div class="w-full max-w-sm rounded-card border border-border bg-surface p-6 shadow-xl">
      <h2 class="font-display text-lg font-semibold mb-1">Identifiants temporaires</h2>
      <p class="text-sm text-text-muted mb-4 text-wrap">
        Communiquez ce mot de passe une seule fois : il ne sera plus jamais affiché.
      </p>
      <div class="rounded-btn border border-border bg-bg p-3 mb-4 space-y-1">
        <p class="text-sm text-text-muted" data-test="credentials-email">{{ credentials.email }}</p>
        <p class="text-sm font-mono font-medium" data-test="credentials-password">{{ credentials.temporaryPassword }}</p>
      </div>
      <div class="flex justify-end gap-2">
        <button
          type="button" data-test="credentials-copy"
          class="rounded-btn px-4 py-2 text-sm border border-border hover:bg-surface-elevated flex items-center gap-1.5"
          @click="copyPassword"
        ><Copy class="w-4 h-4" /> Copier</button>
        <button
          type="button" data-test="credentials-close"
          class="rounded-btn px-4 py-2 text-sm bg-primary text-white hover:bg-primary/90"
          @click="emit('close')"
        >Fermer</button>
      </div>
    </div>
  </div>
</template>
