<script setup lang="ts">
import SupportWorkbench from '@/features/support/components/SupportWorkbench.vue'

definePageMeta({
  middleware: 'admin-only',
  permission: 'SUPPORT_TICKET_VIEW',
  pageTitle: 'Support',
  pageSubtitle: 'Tickets utilisateurs & réponses',
})
</script>

<template>
  <SupportWorkbench />
</template>
