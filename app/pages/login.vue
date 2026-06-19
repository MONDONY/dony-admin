<!-- app/pages/login.vue -->
<script setup lang="ts">
import { ref } from 'vue'
import PhoneNumberForm from '@/features/auth/components/PhoneNumberForm.vue'
import OtpForm from '@/features/auth/components/OtpForm.vue'
import ThemeToggle from '@/components/ui/ThemeToggle.vue'

definePageMeta({ layout: 'auth' })

const step = ref<'phone' | 'otp'>('phone')
const phone = ref('')

function onSent(p: string) {
  phone.value = p
  step.value = 'otp'
}

function handleBack() {
  if (step.value === 'otp') {
    step.value = 'phone'
  } else {
    navigateTo('/')
  }
}
</script>

<template>
  <div class="w-full max-w-md flex flex-col gap-6">
    <!-- Barre de navigation interne -->
    <div class="flex items-center justify-between">
      <button
        type="button"
        class="flex items-center gap-1.5 text-sm text-subtle hover:text-text transition-colors"
        @click="handleBack"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        {{ step === 'otp' ? 'Changer de numéro' : 'Accueil' }}
      </button>
      <ThemeToggle />
    </div>

    <!-- Titre -->
    <div>
      <h1 class="font-display text-2xl font-extrabold text-text">
        {{ step === 'phone' ? 'Connexion' : 'Code de vérification' }}
      </h1>
      <p class="text-sm text-subtle mt-1">
        {{ step === 'phone'
          ? 'Accède au back-office administrateur'
          : `Code envoyé au ${phone}` }}
      </p>
    </div>

    <!-- Indicateur d'étapes -->
    <div>
      <div class="flex items-center gap-2">
        <div
          class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors"
          :class="step === 'otp' ? 'bg-success/20 text-success' : 'bg-primary text-white'"
        >
          <svg v-if="step === 'otp'" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          <span v-else>1</span>
        </div>
        <div
          class="flex-1 h-px transition-colors"
          :class="step === 'otp' ? 'bg-primary' : 'bg-border'"
        />
        <div
          class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors border"
          :class="step === 'otp'
            ? 'bg-primary text-white border-primary'
            : 'bg-surface-el border-border text-subtle'"
        >
          2
        </div>
      </div>
      <div class="flex justify-between mt-1">
        <span class="text-[10px]" :class="step === 'otp' ? 'text-success' : 'text-primary'">Téléphone</span>
        <span class="text-[10px]" :class="step === 'otp' ? 'text-primary' : 'text-subtle'">Code SMS</span>
      </div>
    </div>

    <!-- Formulaires -->
    <PhoneNumberForm v-if="step === 'phone'" @sent="onSent" />
    <OtpForm v-else :phone="phone" @resend="step = 'phone'" />
  </div>
</template>
