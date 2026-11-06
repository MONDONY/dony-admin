<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useFirebaseAuth } from '@/features/auth/composables/useFirebaseAuth'
import PasswordField from '@/features/auth/components/PasswordField.vue'
import ThemeToggle from '@/components/ui/ThemeToggle.vue'

definePageMeta({ layout: 'auth' })

const { signIn, completeTotpSignIn, cancelTotpSignIn } = useFirebaseAuth()
const route = useRoute()

/** Étape mot de passe, puis étape code si le compte a un second facteur. */
const step = ref<'password' | 'totp'>('password')
const email = ref('')
const password = ref('')
const totpCode = ref('')
const error = ref('')
const loading = ref(false)
const totpInput = ref<HTMLInputElement | null>(null)

/** Retour de l'inscription : l'admin a été déconnecté pour ouvrir une session avec son code. */
const justEnrolled = computed(() => route.query.mfa === 'enrolled')
const totpComplete = computed(() => /^\d{6}$/.test(totpCode.value.replace(/\s+/g, '')))

async function goAfterSignIn(adminUser: { mustChangePassword: boolean }) {
  await navigateTo(adminUser.mustChangePassword ? '/change-password' : '/')
}

async function submitPassword() {
  if (!email.value.trim() || !password.value) return
  try {
    await goAfterSignIn(await signIn(email.value.trim(), password.value))
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code
    if (code === 'auth/multi-factor-auth-required') {
      step.value = 'totp'
      password.value = ''
      await nextTick()
      totpInput.value?.focus()
    } else if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
      error.value = 'Identifiants incorrects'
    } else if (code === 'auth/too-many-requests') {
      error.value = 'Trop de tentatives. Réessaie dans quelques minutes.'
    } else {
      error.value = 'Erreur de connexion. Réessaie.'
    }
  }
}

async function submitTotp() {
  if (!totpComplete.value) return
  try {
    await goAfterSignIn(await completeTotpSignIn(totpCode.value))
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code
    totpCode.value = ''
    if (code === 'auth/invalid-verification-code') {
      error.value = 'Code incorrect. Vérifie l’heure de ton téléphone et réessaie.'
    } else if (code === 'auth/too-many-requests') {
      error.value = 'Trop de tentatives. Réessaie dans quelques minutes.'
    } else {
      error.value = 'Le code a expiré. Reconnecte-toi.'
      backToPassword()
    }
  }
}

async function handleSubmit() {
  error.value = ''
  loading.value = true
  try {
    if (step.value === 'password') await submitPassword()
    else await submitTotp()
  } finally {
    loading.value = false
  }
}

function backToPassword() {
  cancelTotpSignIn()
  step.value = 'password'
  totpCode.value = ''
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
      <h1 class="font-display text-2xl font-extrabold text-text [text-wrap:balance]">
        {{ step === 'password' ? 'Connexion' : 'Code de vérification' }}
      </h1>
      <p class="text-sm text-subtle mt-1 [text-wrap:pretty]">
        {{ step === 'password'
          ? 'Accède au back-office administrateur'
          : 'Saisis le code à 6 chiffres affiché par ton appli d’authentification.' }}
      </p>
    </div>

    <div
      v-if="justEnrolled && step === 'password'"
      class="rounded-btn bg-success/10 border border-success/20 px-3 py-2 text-sm text-success"
    >
      Double authentification activée. Reconnecte-toi avec ton mot de passe, puis ton code.
    </div>

    <form class="flex flex-col gap-4" @submit.prevent="handleSubmit">
      <template v-if="step === 'password'">
        <div class="flex flex-col gap-1.5">
          <label for="email" class="text-sm font-medium text-text">Email</label>
          <input
            id="email"
            v-model="email"
            type="email"
            autocomplete="email"
            placeholder="admin@yadony.com"
            class="w-full rounded-btn border border-border bg-surface-el px-3 py-2 text-sm text-text placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
            :disabled="loading"
          >
        </div>

        <PasswordField
          id="password" v-model="password"
          label="Mot de passe" autocomplete="current-password"
          placeholder="••••••••••••" :disabled="loading"
        />
      </template>

      <div v-else class="flex flex-col gap-1.5">
        <label for="totp-code" class="text-sm font-medium text-text">Code</label>
        <input
          id="totp-code"
          ref="totpInput"
          v-model="totpCode"
          type="text"
          inputmode="numeric"
          autocomplete="one-time-code"
          maxlength="7"
          placeholder="123 456"
          class="w-full rounded-btn border border-border bg-surface-el px-3 py-2 text-lg tracking-[0.3em] text-center text-text tabular-nums placeholder:text-subtle placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
          :disabled="loading"
        >
      </div>

      <div v-if="error" class="rounded-btn bg-error/10 border border-error/20 px-3 py-2 text-sm text-error">
        {{ error }}
      </div>

      <button
        type="submit"
        :disabled="loading || (step === 'password' ? (!email.trim() || !password) : !totpComplete)"
        class="w-full rounded-btn bg-primary text-white font-semibold py-2.5 text-sm hover:bg-primary/90 active:scale-[0.96] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 transition-[background-color,opacity,scale] flex items-center justify-center gap-2"
      >
        <svg v-if="loading" class="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="12" cy="12" r="10" stroke-opacity="0.25" />
          <path d="M12 2a10 10 0 0 1 10 10" />
        </svg>
        <template v-if="step === 'password'">{{ loading ? 'Connexion…' : 'Se connecter' }}</template>
        <template v-else>{{ loading ? 'Vérification…' : 'Valider le code' }}</template>
      </button>

      <button
        v-if="step === 'totp'"
        type="button"
        data-test="totp-back"
        class="text-sm text-subtle hover:text-text transition-colors self-center"
        :disabled="loading"
        @click="backToPassword"
      >
        Retour au mot de passe
      </button>
    </form>
  </div>
</template>
