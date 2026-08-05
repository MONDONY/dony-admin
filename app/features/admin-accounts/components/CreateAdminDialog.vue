<script setup lang="ts">
import { ref, computed } from 'vue'
import type { ManagedAdminRole } from '@/features/admin-accounts/types/index'

const emit = defineEmits<{ submit: [email: string, role: ManagedAdminRole]; cancel: [] }>()

const roles: ManagedAdminRole[] = ['ADMIN', 'SUPPORT']
const email = ref('')
const role = ref<ManagedAdminRole>('ADMIN')

const canSubmit = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()))

function onSubmit() {
  if (!canSubmit.value) return
  emit('submit', email.value.trim(), role.value)
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" data-test="create-admin-overlay">
    <form
      class="w-full max-w-md rounded-card border border-border bg-surface p-6 shadow-xl flex flex-col gap-3"
      @submit.prevent="onSubmit"
    >
      <h2 class="font-display text-lg font-semibold">Nouvel administrateur</h2>

      <label class="text-sm text-text-muted">Email
        <input
          v-model="email" data-test="create-admin-email" type="email" autocomplete="off"
          class="mt-1 w-full rounded-btn border border-border bg-bg p-2 text-sm"
        >
      </label>

      <label class="text-sm text-text-muted">Rôle
        <select v-model="role" data-test="create-admin-role" class="mt-1 w-full rounded-btn border border-border bg-bg p-2 text-sm">
          <option v-for="r in roles" :key="r" :value="r">{{ r }}</option>
        </select>
      </label>

      <div class="flex justify-end gap-2 mt-2">
        <button
          type="button" data-test="create-admin-cancel"
          class="rounded-btn px-4 py-2 text-sm border border-border hover:bg-surface-elevated"
          @click="emit('cancel')"
        >Annuler</button>
        <button
          type="submit" data-test="create-admin-submit" :disabled="!canSubmit"
          class="rounded-btn px-4 py-2 text-sm bg-primary text-white disabled:opacity-40 hover:bg-primary/90"
        >Créer</button>
      </div>
    </form>
  </div>
</template>
