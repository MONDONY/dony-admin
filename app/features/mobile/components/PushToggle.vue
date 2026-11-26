<script setup lang="ts">
import { onMounted } from 'vue'
import { usePushSubscription } from '@/features/mobile/composables/usePushSubscription'

const { state, enable, disable, refresh } = usePushSubscription()
onMounted(() => { void refresh() })
</script>

<template>
  <div v-if="state !== 'unsupported'" class="text-sm" data-test="push-toggle">
    <p v-if="state === 'needs-install'" class="text-text-muted" data-test="push-needs-install">
      Ajoutez l'app à l'écran d'accueil pour recevoir les notifications
    </p>
    <p v-else-if="state === 'denied'" class="text-text-muted" data-test="push-denied">
      Notifications refusées dans les réglages de ce téléphone
    </p>
    <button
      v-else-if="state === 'off'"
      type="button"
      class="min-h-[44px] whitespace-nowrap rounded-md border border-border bg-surface px-3 font-semibold text-primary"
      data-test="push-enable"
      @click="enable()"
    >Activer les notifications</button>
    <button
      v-else
      type="button"
      class="min-h-[44px] whitespace-nowrap rounded-md border border-border bg-surface px-3 font-semibold text-text"
      data-test="push-disable"
      @click="disable()"
    >Désactiver les notifications</button>
  </div>
</template>
