<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import OtpInput from './OtpInput.vue'
import { useFirebaseAuth } from '@/features/auth/composables/useFirebaseAuth'

const props = defineProps<{ phone: string }>()
const emit = defineEmits<{ resend: [] }>()

const { confirmOtp } = useFirebaseAuth()

const otpInput = ref<InstanceType<typeof OtpInput> | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

const countdown = ref(60)
let timer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  timer = setInterval(() => {
    if (countdown.value > 0) countdown.value--
    else if (timer) { clearInterval(timer); timer = null }
  }, 1000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})

async function submit(code: string) {
  if (loading.value) return
  error.value = null
  loading.value = true
  try {
    const user = await confirmOtp(code)
    const isAdmin = (user.roles ?? []).some(r => r === 'ADMIN' || r === 'ROLE_ADMIN')
    if (!isAdmin) {
      await navigateTo('/denied')
      return
    }
    await navigateTo('/')
  }
  catch (e) {
    error.value = (e as Error).message || 'Code incorrect'
  }
  finally {
    loading.value = false
    if (error.value) otpInput.value?.reset()
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <p class="text-sm text-muted">
      Code envoyé au <span class="font-semibold text-text">{{ props.phone }}</span>
    </p>

    <OtpInput ref="otpInput" :disabled="loading" @complete="submit" />

    <p v-if="error" class="text-xs text-danger" aria-live="polite">{{ error }}</p>

    <p class="text-xs text-subtle text-center">
      <span v-if="countdown > 0">Renvoyer le code dans {{ countdown }}s</span>
      <button
        v-else
        type="button"
        data-test="resend-btn"
        class="text-primary hover:underline"
        @click="emit('resend')"
      >
        Renvoyer le code
      </button>
    </p>
  </div>
</template>
