<script setup lang="ts">
import AlertsWorkbench from '@/features/alerts/components/AlertsWorkbench.vue'

definePageMeta({ middleware: 'admin-only', permission: 'ALERT_VIEW', pageTitle: 'Alertes', pageSubtitle: 'Alertes opérationnelles' })
</script>

<template>
  <AlertsWorkbench />
</template>
