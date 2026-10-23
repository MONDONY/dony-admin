<script setup lang="ts">
import type { UserAlert } from '@/features/user-profile/lib/userProfileAlerts'

defineProps<{ alerts: UserAlert[] }>()
</script>

<template>
  <div
    v-if="alerts.length > 0" role="status" data-test="alert-band"
    class="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-card border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
  >
    <strong>À surveiller</strong>
    <span v-for="a in alerts" :key="a.id" :data-test="`alert-${a.id}`">{{ a.text }}</span>
  </div>
</template>
