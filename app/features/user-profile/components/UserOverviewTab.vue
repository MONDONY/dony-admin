<script setup lang="ts">
import UserInProgressTable from '@/features/user-profile/components/UserInProgressTable.vue'
import UserTimeline from '@/features/user-profile/components/UserTimeline.vue'
import type { InProgressItem, TimelineEntry } from '@/features/user-profile/types/index'

/** `null` = permission absente : la carte n'existe pas (jamais « Aucun »). */
defineProps<{ inProgress: InProgressItem[] | null; timeline: TimelineEntry[] | null }>()
</script>

<template>
  <div class="flex flex-wrap items-start gap-4">
    <div v-if="inProgress !== null" class="min-w-0 basis-full lg:basis-0 lg:grow-[3]">
      <UserInProgressTable :items="inProgress" />
    </div>
    <div v-if="timeline !== null" class="min-w-0 basis-full lg:basis-0 lg:grow-[2]">
      <UserTimeline :entries="timeline" />
    </div>
  </div>
</template>
