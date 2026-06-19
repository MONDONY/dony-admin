<script setup lang="ts">
import { ref, computed } from 'vue'
import CountrySelector from './CountrySelector.vue'
import { type Country, COUNTRIES } from '../data/countries.ts'
import { useFirebaseAuth } from '@/features/auth/composables/useFirebaseAuth'

const QUICK_COUNTRIES = COUNTRIES.slice(0, 4) // FR, SN, CI, ML

const emit = defineEmits<{ sent: [phone: string] }>()

const country = ref<Country>(COUNTRIES[0])
const localNumber = ref('')
const loading = ref(false)
const error = ref<string | null>(null)

const fullPhone = computed(() => {
  const local = localNumber.value.replace(/[\s\-]/g, '').replace(/^0/, '')
  return `${country.value.dial}${local}`
})

const { sendOtp } = useFirebaseAuth()

async function submit() {
  if (loading.value) return
  error.value = null
  if (!/^\+\d{8,15}$/.test(fullPhone.value)) {
    error.value = 'Numéro invalide — ex : 6 12 34 56 78'
    return
  }
  loading.value = true
  try {
    await sendOtp(fullPhone.value, 'recaptcha-container')
    emit('sent', fullPhone.value)
  }
  catch (e) {
    error.value = (e as Error).message || 'Erreur envoi OTP'
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <form class="flex flex-col gap-4" @submit.prevent="submit">
    <div>
      <label class="block text-xs font-semibold text-muted mb-2">Numéro de téléphone</label>
      <div class="flex gap-2">
        <CountrySelector v-model="country" />
        <input
          v-model="localNumber"
          type="tel"
          inputmode="numeric"
          placeholder="6 12 34 56 78"
          :disabled="loading"
          class="flex-1 h-11 rounded-[10px] border bg-surface-el px-4 text-sm text-text placeholder:text-subtle outline-none focus:border-primary transition-colors"
          :class="error ? 'border-danger' : 'border-border'"
        />
      </div>
      <div class="flex gap-2 flex-wrap mt-2">
        <button
          v-for="c in QUICK_COUNTRIES"
          :key="c.code"
          type="button"
          data-test="country-chip"
          class="flex items-center gap-1.5 h-7 px-2.5 rounded-[7px] border text-xs font-medium transition-colors"
          :class="c.code === country.code
            ? 'border-primary/40 bg-primary/10 text-primary'
            : 'border-border text-subtle hover:border-primary/30 hover:text-text'"
          @click="country = c"
        >
          {{ c.flag }} {{ c.name }}
        </button>
      </div>
    </div>

    <p v-if="error" class="text-xs text-danger" aria-live="polite">{{ error }}</p>

    <button
      type="submit"
      :disabled="loading"
      class="h-11 rounded-btn bg-primary text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-primary-hover transition-colors disabled:opacity-50"
    >
      {{ loading ? 'Envoi en cours...' : 'Recevoir le code par SMS →' }}
    </button>

    <div id="recaptcha-container" />
  </form>
</template>
