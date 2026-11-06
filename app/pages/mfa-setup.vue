<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue'
import { renderSVG } from 'uqr'
import { useFirebaseAuth, type TotpEnrollment } from '@/features/auth/composables/useFirebaseAuth'
import { useAuthStore } from '@/stores/auth'
import ThemeToggle from '@/components/ui/ThemeToggle.vue'

definePageMeta({ layout: 'auth' })

const { startTotpEnrollment, finishTotpEnrollment, sendVerificationEmail, signOut } = useFirebaseAuth()
const auth = useAuthStore()

/**
 * Ce qui empêche l'inscription : adresse non vérifiée, connexion trop ancienne, TOTP non activé
 * sur ce projet Firebase, ou autre erreur. `null` = inscription possible.
 */
type Blocker = 'unverified-email' | 'recent-login' | 'unavailable' | 'error'

const enrollment = shallowRef<TotpEnrollment | null>(null)
const blocker = ref<Blocker | null>(null)
const code = ref('')
const error = ref('')
const loading = ref(false)
const starting = ref(true)
const verificationSent = ref(false)

/** QR code en image (SVG en data URL) : pas de HTML injecté dans la page. */
const qrSrc = computed(() => enrollment.value
  ? `data:image/svg+xml;utf8,${encodeURIComponent(renderSVG(enrollment.value.qrCodeUrl, { border: 1 }))}`
  : '')
/** Clé par groupes de 4, plus facile à recopier. */
const groupedKey = computed(() => enrollment.value?.secretKey.match(/.{1,4}/g)?.join(' ') ?? '')
const codeComplete = computed(() => /^\d{6}$/.test(code.value.replace(/\s+/g, '')))

function blockerFor(errorCode: string | undefined): Blocker {
  if (errorCode === 'auth/unverified-email') return 'unverified-email'
  if (errorCode === 'auth/requires-recent-login') return 'recent-login'
  if (errorCode === 'auth/operation-not-allowed' || errorCode === 'auth/admin-restricted-operation') return 'unavailable'
  return 'error'
}

async function start() {
  starting.value = true
  blocker.value = null
  try {
    enrollment.value = await startTotpEnrollment()
  } catch (e: unknown) {
    blocker.value = blockerFor((e as { code?: string })?.code)
  } finally {
    starting.value = false
  }
}

async function submit() {
  if (!enrollment.value || !codeComplete.value) return
  error.value = ''
  loading.value = true
  try {
    await finishTotpEnrollment(enrollment.value.secret, code.value)
  } catch (e: unknown) {
    code.value = ''
    const errorCode = (e as { code?: string })?.code
    error.value = errorCode === 'auth/invalid-verification-code'
      ? 'Code incorrect. Vérifie l’heure de ton téléphone et réessaie.'
      : 'L’activation a échoué. Réessaie.'
  } finally {
    loading.value = false
  }
}

async function sendVerification() {
  await sendVerificationEmail()
  verificationSent.value = true
}

async function continueWithout() {
  auth.markMfaUnavailable()
  await navigateTo('/')
}

onMounted(start)
</script>

<template>
  <div class="w-full max-w-md flex flex-col gap-6">
    <div class="flex items-center justify-between">
      <span class="text-sm font-semibold text-text">Yadony ADMIN</span>
      <ThemeToggle />
    </div>

    <div>
      <h1 class="font-display text-2xl font-extrabold text-text [text-wrap:balance]">Double authentification</h1>
      <p class="text-sm text-subtle mt-1 [text-wrap:pretty]">
        Obligatoire pour le back-office : à chaque connexion, un code de ton téléphone en plus du mot de passe.
      </p>
    </div>

    <p v-if="starting" class="text-sm text-subtle">Préparation…</p>

    <!-- Inscription impossible pour l'instant -->
    <div v-else-if="blocker" class="flex flex-col gap-3 rounded-btn border border-border bg-surface-el px-4 py-3 text-sm text-text">
      <template v-if="blocker === 'unverified-email'">
        <p class="[text-wrap:pretty]">Tu dois d’abord vérifier ton adresse e-mail. Ouvre le lien reçu, puis recharge cette page.</p>
        <p v-if="verificationSent" class="text-success">E-mail envoyé.</p>
        <button
          type="button" data-test="send-verification"
          class="self-start rounded-btn bg-primary text-white font-semibold px-3 py-2 text-sm hover:bg-primary/90 active:scale-[0.96] transition-[background-color,scale]"
          @click="sendVerification"
        >
          Envoyer le lien
        </button>
      </template>
      <template v-else-if="blocker === 'recent-login'">
        <p class="[text-wrap:pretty]">Ta connexion est trop ancienne pour activer la double authentification.</p>
        <button
          type="button" data-test="sign-in-again"
          class="self-start rounded-btn bg-primary text-white font-semibold px-3 py-2 text-sm hover:bg-primary/90 active:scale-[0.96] transition-[background-color,scale]"
          @click="signOut"
        >
          Se reconnecter
        </button>
      </template>
      <template v-else-if="blocker === 'unavailable'">
        <p class="[text-wrap:pretty]">La double authentification n’est pas disponible sur cet environnement.</p>
        <button
          type="button" data-test="continue-without"
          class="self-start rounded-btn border border-border px-3 py-2 text-sm hover:bg-surface active:scale-[0.96] transition-[background-color,scale]"
          @click="continueWithout"
        >
          Continuer
        </button>
      </template>
      <template v-else>
        <p>Impossible de préparer l’activation.</p>
        <button
          type="button"
          class="self-start rounded-btn border border-border px-3 py-2 text-sm hover:bg-surface active:scale-[0.96] transition-[background-color,scale]"
          @click="start"
        >
          Réessayer
        </button>
      </template>
    </div>

    <!-- Inscription : QR code, clé, premier code -->
    <form v-else-if="enrollment" class="flex flex-col gap-4" @submit.prevent="submit">
      <ol class="flex flex-col gap-1 text-sm text-text list-decimal pl-5">
        <li>Ouvre ton appli d’authentification (Google Authenticator, Microsoft Authenticator, 1Password…).</li>
        <li>Scanne ce QR code, ou saisis la clé à la main.</li>
        <li>Recopie le code à 6 chiffres affiché.</li>
      </ol>

      <div class="flex flex-col items-center gap-3">
        <img
          data-test="totp-qr" :src="qrSrc" alt="QR code à scanner avec l’appli d’authentification"
          width="192" height="192"
          class="rounded-lg bg-white p-2 outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"
        >
        <code class="select-all rounded-btn bg-surface-el px-3 py-1.5 text-sm tracking-wider tabular-nums text-text">{{ groupedKey }}</code>
      </div>

      <div class="flex flex-col gap-1.5">
        <label for="totp-code" class="text-sm font-medium text-text">Code</label>
        <input
          id="totp-code" v-model="code"
          type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="7" placeholder="123 456"
          class="w-full rounded-btn border border-border bg-surface-el px-3 py-2 text-lg tracking-[0.3em] text-center text-text tabular-nums placeholder:text-subtle placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
          :disabled="loading"
        >
      </div>

      <div v-if="error" class="rounded-btn bg-error/10 border border-error/20 px-3 py-2 text-sm text-error">
        {{ error }}
      </div>

      <button
        type="submit"
        :disabled="loading || !codeComplete"
        class="w-full rounded-btn bg-primary text-white font-semibold py-2.5 text-sm hover:bg-primary/90 active:scale-[0.96] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 transition-[background-color,opacity,scale]"
      >
        {{ loading ? 'Activation…' : 'Activer' }}
      </button>
    </form>

    <button type="button" class="text-sm text-subtle hover:text-text transition-colors self-center" @click="signOut">
      Se déconnecter
    </button>
  </div>
</template>
