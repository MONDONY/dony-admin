<script setup lang="ts">
import { useMobileTabs } from '@/features/mobile/composables/useMobileTabs'

definePageMeta({ layout: 'mobile', middleware: 'admin-only' })

// Entrée de l'app mobile : on envoie l'admin sur le premier onglet qu'il peut voir.
const tabs = useMobileTabs()
await navigateTo(tabs.value[0]?.to ?? '/denied', { replace: true })
</script>

<template>
  <div />
</template>
