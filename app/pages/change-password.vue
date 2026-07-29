<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useApi } from '@/composables/useApi'
import ThemeToggle from '@/components/ui/ThemeToggle.vue'

definePageMeta({ layout: 'auth' })

const authStore = useAuthStore()
const api = useApi()

const newPassword = ref('')
const confirmPassword = ref('')
const error = ref('')
const loading = ref(false)

async function handleSubmit() {
  error.value = ''
  if (newPassword.value.length < 12) {
    error.value = 'Le mot de passe doit faire au moins 12 caractères'
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    error.value = 'Les mots de passe ne correspondent pas'
    return
  }
  loading.value = true
  try {
    await api('/admin/me/change-password', {
      method: 'POST',
      body: { newPassword: newPassword.value },
    })
    if (authStore.user) {
      authStore.user.mustChangePassword = false
    }
    await navigateTo('/')
  } catch {
    error.value = 'Erreur lors du changement de mot de passe. Réessaie.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="w-full max-w-md flex flex-col gap-6">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-primary" aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        <span class="text-sm font-semibold text-text">Yadony ADMIN</span>
      </div>
      <ThemeToggle />
    </div>

    <div>
      <h1 class="font-display text-2xl font-extrabold text-text">Changer le mot de passe</h1>
      <p class="text-sm text-subtle mt-1">Définis un mot de passe permanent pour ton compte</p>
    </div>

    <form class="flex flex-col gap-4" @submit.prevent="handleSubmit">
      <div class="flex flex-col gap-1.5">
        <label for="new-password" class="text-sm font-medium text-text">Nouveau mot de passe</label>
        <input
          id="new-password"
          v-model="newPassword"
          type="password"
          autocomplete="new-password"
          placeholder="12 caractères minimum"
          class="w-full rounded-btn border border-border bg-surface-el px-3 py-2 text-sm text-text placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
          :disabled="loading"
        />
      </div>

      <div class="flex flex-col gap-1.5">
        <label for="confirm-password" class="text-sm font-medium text-text">Confirmer</label>
        <input
          id="confirm-password"
          v-model="confirmPassword"
          type="password"
          autocomplete="new-password"
          placeholder="Répète le mot de passe"
          class="w-full rounded-btn border border-border bg-surface-el px-3 py-2 text-sm text-text placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
          :disabled="loading"
        />
      </div>

      <div v-if="error" class="rounded-btn bg-error/10 border border-error/20 px-3 py-2 text-sm text-error">
        {{ error }}
      </div>

      <button
        type="submit"
        :disabled="loading || !newPassword || !confirmPassword"
        class="w-full rounded-btn bg-primary text-white font-semibold py-2.5 text-sm hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        <svg v-if="loading" class="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="12" cy="12" r="10" stroke-opacity="0.25" />
          <path d="M12 2a10 10 0 0 1 10 10" />
        </svg>
        {{ loading ? 'Enregistrement…' : 'Enregistrer' }}
      </button>
    </form>
  </div>
</template>
