<!-- app/layouts/auth.vue -->
<script setup lang="ts">
import LoginLeftPanel from '@/features/auth/components/LoginLeftPanel.vue'
</script>

<template>
  <div class="min-h-screen flex bg-bg">
    <LoginLeftPanel class="hidden lg:flex" />
    <div class="flex-1 flex items-center justify-center px-6 py-12">
      <slot />
    </div>
  </div>
</template>
