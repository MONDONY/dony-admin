<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { usePushSubscription, type PushError } from '@/features/mobile/composables/usePushSubscription'

const { state, error, enable, disable, refresh } = usePushSubscription()
onMounted(() => { void refresh() })

const ERROR_TEXT: Record<PushError, string> = {
  generic: 'Activation impossible. Réessayez ou contactez l’administrateur.',
  config: 'Notifications non configurées sur ce serveur. Contactez l’administrateur.',
  permission: 'Notifications bloquées pour ce site. Autorisez-les dans les réglages du téléphone, puis réessayez.',
}

/** Bouton désactivé pendant l'appel : un double toucher ne lance qu'une activation. */
const busy = ref(false)
async function run(action: () => Promise<void>): Promise<void> {
  if (busy.value) return
  busy.value = true
  try { await action() } finally { busy.value = false }
}
</script>

<template>
  <div v-if="state !== 'unsupported'" class="text-sm" data-test="push-toggle" aria-live="polite">
    <p v-if="state === 'needs-install'" class="text-text-muted" data-test="push-needs-install">
      Ajoutez l'app à l'écran d'accueil pour recevoir les notifications
    </p>
    <p v-else-if="state === 'denied'" class="text-text-muted" data-test="push-denied">
      Notifications refusées dans les réglages de ce téléphone
    </p>
    <button
      v-else-if="state === 'off'"
      type="button"
      class="min-h-[44px] whitespace-nowrap rounded-md border border-border bg-surface px-3 font-semibold text-primary disabled:opacity-50"
      data-test="push-enable"
      :disabled="busy"
      :aria-busy="busy"
      @click="run(enable)"
    >Activer les notifications</button>
    <!-- Activées : simple état, la désactivation est repliée sous « Réglages » (pas de toucher accidentel). -->
    <div v-else class="flex flex-wrap items-center gap-x-3" data-test="push-on">
      <span class="text-text-muted" data-test="push-status">Notifications activées</span>
      <details data-test="push-settings">
        <summary class="flex min-h-[44px] cursor-pointer items-center font-semibold text-primary">Réglages</summary>
        <button
          type="button"
          class="mb-2 min-h-[44px] whitespace-nowrap rounded-md border border-border bg-surface px-3 font-semibold text-text disabled:opacity-50"
          data-test="push-disable"
          :disabled="busy"
          :aria-busy="busy"
          @click="run(disable)"
        >Désactiver les notifications</button>
      </details>
    </div>
    <p v-if="error" class="mt-1 text-danger [text-wrap:pretty]" data-test="push-error">{{ ERROR_TEXT[error] }}</p>
  </div>
</template>
