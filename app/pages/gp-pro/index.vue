<script setup lang="ts">
import GpProWorkbench from '@/features/gp-pro/components/GpProWorkbench.vue'

definePageMeta({
  middleware: 'admin-only', permission: 'GP_PRO_REVIEW',
  pageTitle: 'GP Pro', pageSubtitle: 'Demandes du badge et titulaires à revoir',
})
</script>

<template>
  <GpProWorkbench />
</template>
