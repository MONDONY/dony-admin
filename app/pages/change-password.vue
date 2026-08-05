<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Auth } from 'firebase/auth'
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth'
import { useApi } from '@/composables/useApi'
import { useFirebaseAuth } from '@/features/auth/composables/useFirebaseAuth'
import { useAuthStore } from '@/stores/auth'
import ThemeToggle from '@/components/ui/ThemeToggle.vue'

definePageMeta({ layout: 'auth' })

const api = useApi()
const { refreshProfile } = useFirebaseAuth()
const authStore = useAuthStore()

// Skip only for the forced first-login flow: the temporary password was
// just typed seconds ago at /login. A voluntary change mid-session (from
// the profile menu) must re-prove the current password first — otherwise
// anyone with a live, unattended session could lock the real owner out.
const requiresCurrentPassword = computed(() => authStore.user?.mustChangePassword === false)

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const error = ref('')
const loading = ref(false)

async function handleSubmit() {
  error.value = ''
  if (requiresCurrentPassword.value && !currentPassword.value) {
    error.value = 'Mot de passe actuel requis'
    return
  }
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
    const { $firebaseAuth } = useNuxtApp()
    const auth = $firebaseAuth as Auth | null

    if (requiresCurrentPassword.value) {
      if (!auth?.currentUser?.email) {
        error.value = 'Session invalide, reconnecte-toi.'
        loading.value = false
        return
      }
      try {
        await reauthenticateWithCredential(
          auth.currentUser,
          EmailAuthProvider.credential(auth.currentUser.email, currentPassword.value),
        )
      } catch {
        error.value = 'Mot de passe actuel incorrect'
        loading.value = false
        return
      }
    }

    await api('/admin/me/change-password', {
      method: 'POST',
      body: { newPassword: newPassword.value },
    })
    const freshToken = await auth?.currentUser?.getIdToken(true)
    await refreshProfile(freshToken)
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
      <div v-if="requiresCurrentPassword" class="flex flex-col gap-1.5">
        <label for="current-password" class="text-sm font-medium text-text">Mot de passe actuel</label>
        <input
          id="current-password"
          v-model="currentPassword"
          type="password"
          autocomplete="current-password"
          class="w-full rounded-btn border border-border bg-surface-el px-3 py-2 text-sm text-text placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
          :disabled="loading"
        />
      </div>

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
        :disabled="loading || !newPassword || !confirmPassword || (requiresCurrentPassword && !currentPassword)"
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
