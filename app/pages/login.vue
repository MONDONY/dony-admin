<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useFirebaseAuth } from '@/features/auth/composables/useFirebaseAuth'
import { useAuthStore } from '@/stores/auth'
import ThemeToggle from '@/components/ui/ThemeToggle.vue'

definePageMeta({ layout: 'auth' })

const { signIn } = useFirebaseAuth()

const login = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const ready = ref(false)
onMounted(() => { ready.value = true })

const showDemoLogin = computed(() => import.meta.dev)

async function handleSubmit() {
  error.value = ''
  if (!login.value.trim() || !password.value) return
  loading.value = true
  try {
    const adminUser = await signIn(login.value.trim(), password.value)
    if (adminUser.mustChangePassword) {
      await navigateTo('/change-password')
    } else {
      await navigateTo('/')
    }
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
      error.value = 'Identifiants incorrects'
    } else if (code === 'auth/too-many-requests') {
      error.value = 'Trop de tentatives. Réessaie dans quelques minutes.'
    } else {
      error.value = 'Erreur de connexion. Réessaie.'
    }
  } finally {
    loading.value = false
  }
}

function demoLogin() {
  useAuthStore().setSession('demo-token', {
    id: 'demo-admin',
    login: 'demo',
    role: 'SUPER_ADMIN',
    status: 'ACTIVE',
    mustChangePassword: false,
    permissionOverrides: {},
  })
  navigateTo('/')
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
        <span class="text-sm font-semibold text-text">Dony Admin</span>
      </div>
      <ThemeToggle />
    </div>

    <div>
      <h1 class="font-display text-2xl font-extrabold text-text">Connexion</h1>
      <p class="text-sm text-subtle mt-1">Accède au back-office administrateur</p>
    </div>

    <form class="flex flex-col gap-4" @submit.prevent="handleSubmit">
      <div class="flex flex-col gap-1.5">
        <label for="login" class="text-sm font-medium text-text">Identifiant</label>
        <input
          id="login"
          v-model="login"
          type="text"
          autocomplete="username"
          placeholder="admin.1"
          class="w-full rounded-btn border border-border bg-surface-el px-3 py-2 text-sm text-text placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
          :disabled="loading"
        />
      </div>

      <div class="flex flex-col gap-1.5">
        <label for="password" class="text-sm font-medium text-text">Mot de passe</label>
        <input
          id="password"
          v-model="password"
          type="password"
          autocomplete="current-password"
          placeholder="••••••••••••"
          class="w-full rounded-btn border border-border bg-surface-el px-3 py-2 text-sm text-text placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
          :disabled="loading"
        />
      </div>

      <div v-if="error" class="rounded-btn bg-error/10 border border-error/20 px-3 py-2 text-sm text-error">
        {{ error }}
      </div>

      <button
        type="submit"
        :disabled="loading || !login.trim() || !password"
        class="w-full rounded-btn bg-primary text-white font-semibold py-2.5 text-sm hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        <svg v-if="loading" class="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="12" cy="12" r="10" stroke-opacity="0.25" />
          <path d="M12 2a10 10 0 0 1 10 10" />
        </svg>
        {{ loading ? 'Connexion…' : 'Se connecter' }}
      </button>
    </form>

    <div v-if="showDemoLogin" class="border-t border-border pt-4">
      <button
        type="button"
        data-test="demo-login"
        :disabled="!ready"
        class="w-full rounded-btn px-4 py-2 text-sm border border-dashed border-primary/50 text-primary hover:bg-primary/10 disabled:opacity-40 transition-colors"
        @click="demoLogin"
      >
        Connexion démo (admin)
      </button>
      <p class="mt-2 text-center text-[11px] text-subtle">Mode local — aucune authentification Firebase requise</p>
    </div>
  </div>
</template>
