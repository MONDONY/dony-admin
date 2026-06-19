<script setup lang="ts">
import OverviewDashboard from '@/features/overview/components/OverviewDashboard.vue'
definePageMeta({ middleware: 'admin-only', pageTitle: "Vue d’ensemble", pageSubtitle: 'Santé de la plateforme' })
</script>

<template>
  <OverviewDashboard />
</template>
