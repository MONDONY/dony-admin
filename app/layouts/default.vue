<script setup lang="ts">
import { computed } from 'vue'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import AppTopbar from '@/components/layout/AppTopbar.vue'

const route = useRoute()
const meta = computed(() => ({
  title: (route.meta.pageTitle as string) ?? 'Yadony ADMIN',
  subtitle: route.meta.pageSubtitle as string | undefined,
}))
</script>

<template>
  <div class="flex h-screen overflow-hidden">
    <AppSidebar />
    <div class="flex-1 flex flex-col min-w-0">
      <AppTopbar :title="meta.title" :subtitle="meta.subtitle" />
      <main class="flex-1 overflow-y-auto p-6">
        <slot />
      </main>
    </div>
  </div>
</template>
