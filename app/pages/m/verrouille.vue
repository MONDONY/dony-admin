<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useFirebaseAuth } from '@/features/auth/composables/useFirebaseAuth'
import { clearLockContext, isSafeReturnPath, readLockContext, readLockMarker } from '@/features/mobile/lib/lockState'
import PasswordField from '@/features/auth/components/PasswordField.vue'

// Layout sans onglets : l'admin est déconnecté, rien ne dépend de ses permissions.
definePageMeta({ layout: 'auth' })

// Même parcours que login.vue (mot de passe, puis code TOTP), sans logique métier en plus.
const { signIn, completeTotpSignIn, cancelTotpSignIn } = useFirebaseAuth()

const step = ref<'password' | 'totp'>('password')
const email = ref('')
const password = ref('')
const totpCode = ref('')
const error = ref('')
const loading = ref(false)
const totpInput = ref<HTMLInputElement | null>(null)
/**
 * Verrou posé par l'inactivité (marqueur `idle`) : texte « session fermée après 30 minutes ».
 * Sinon (premier lancement, session terminée) : simple invitation à se connecter.
 */
const idleLocked = ref(false)

const totpComplete = computed(() => /^\d{6}$/.test(totpCode.value.replace(/\s+/g, '')))

// Stockage du navigateur lu au montage seulement : le rendu serveur et l'hydratation restent identiques.
onMounted(() => {
  idleLocked.value = readLockMarker()?.reason === 'idle'
  if (!email.value) email.value = readLockContext().email ?? ''
})

async function goAfterSignIn(adminUser: { mustChangePassword: boolean }) {
  const remembered = readLockContext().path
  const back = isSafeReturnPath(remembered) ? remembered : '/m'
  clearLockContext()
  await navigateTo(adminUser.mustChangePassword ? '/change-password' : back)
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
      error.value = 'Trop de tentatives. Réessayez dans quelques minutes.'
    } else {
      error.value = 'Erreur de connexion. Réessayez.'
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
      error.value = 'Code incorrect. Vérifiez l’heure de votre téléphone et réessayez.'
    } else if (code === 'auth/too-many-requests') {
      error.value = 'Trop de tentatives. Réessayez dans quelques minutes.'
    } else {
      error.value = 'Le code a expiré. Reconnectez-vous.'
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
    <div>
      <h1 class="font-display text-2xl font-extrabold text-text [text-wrap:balance]">
        {{ step === 'totp' ? 'Code de vérification' : idleLocked ? 'Session verrouillée' : 'Connexion' }}
      </h1>
      <p class="text-sm text-subtle mt-1 [text-wrap:pretty]" data-test="lock-reason">
        {{ step === 'totp'
          ? 'Saisissez le code à 6 chiffres affiché par votre appli d’authentification.'
          : idleLocked
            ? 'Votre session a été fermée après 30 minutes d’inactivité.'
            : 'Connectez-vous pour continuer.' }}
      </p>
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
            class="w-full min-h-[44px] rounded-btn border border-border bg-surface-el px-3 py-2 text-base text-text placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
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
          class="w-full min-h-[44px] rounded-btn border border-border bg-surface-el px-3 py-2 text-lg tracking-[0.3em] text-center text-text tabular-nums placeholder:text-subtle placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
          :disabled="loading"
        >
      </div>

      <div v-if="error" class="rounded-btn bg-error/10 border border-error/20 px-3 py-2 text-sm text-error">
        {{ error }}
      </div>

      <button
        type="submit"
        :disabled="loading || (step === 'password' ? (!email.trim() || !password) : !totpComplete)"
        class="w-full min-h-[44px] whitespace-nowrap rounded-btn bg-primary text-white font-semibold py-2.5 text-sm hover:bg-primary/90 active:scale-[0.96] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 transition-[background-color,opacity,scale] flex items-center justify-center gap-2"
      >
        <svg v-if="loading" class="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="12" cy="12" r="10" stroke-opacity="0.25" />
          <path d="M12 2a10 10 0 0 1 10 10" />
        </svg>
        <template v-if="step === 'password'">{{ loading ? 'Connexion…' : idleLocked ? 'Se reconnecter' : 'Se connecter' }}</template>
        <template v-else>{{ loading ? 'Vérification…' : 'Valider le code' }}</template>
      </button>

      <button
        v-if="step === 'totp'"
        type="button"
        data-test="totp-back"
        class="min-h-[44px] text-sm text-subtle hover:text-text transition-colors self-center"
        :disabled="loading"
        @click="backToPassword"
      >
        Retour au mot de passe
      </button>
    </form>
  </div>
</template>
