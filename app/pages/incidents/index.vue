<script setup lang="ts">
import IncidentsWorkbench from '@/features/incidents/components/IncidentsWorkbench.vue'

definePageMeta({ middleware: 'admin-only', permission: 'DISPUTE_VIEW', pageTitle: 'Incidents', pageSubtitle: 'Litiges & no-shows' })
</script>

<template>
  <IncidentsWorkbench />
</template>
