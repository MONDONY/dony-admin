<script setup lang="ts">
import ModerationWorkbench from '@/features/moderation/components/ModerationWorkbench.vue'

definePageMeta({ middleware: 'admin-only', permission: 'MODERATION_VIEW', pageTitle: 'Modération', pageSubtitle: 'Conversations et messages' })
</script>

<template>
  <ModerationWorkbench />
</template>
