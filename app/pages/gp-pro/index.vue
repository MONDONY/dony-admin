<script setup lang="ts">
import IndividualFrequencyQueue from '@/features/individual-frequency/components/IndividualFrequencyQueue.vue'
import GpProWorkbench from '@/features/gp-pro/components/GpProWorkbench.vue'

definePageMeta({
  middleware: 'admin-only', permission: 'GP_PRO_REVIEW',
  pageTitle: 'GP Pro', pageSubtitle: 'Demandes du badge, titulaires à revoir et particuliers à confirmer',
})
</script>

<template>
  <div>
    <GpProWorkbench />
    <IndividualFrequencyQueue />
  </div>
</template>
