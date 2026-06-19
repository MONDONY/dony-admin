<script setup lang="ts">
definePageMeta({ layout: false })
</script>

<template>
  <div class="flex h-screen items-center justify-center bg-bg">
    <div class="rounded-card border border-border bg-surface p-10 text-center max-w-sm">
      <h1 class="font-display text-xl font-bold mb-2">Accès refusé</h1>
      <p class="text-sm text-text-muted mb-4">Ce back-office est réservé aux administrateurs dony.</p>
      <NuxtLink to="/login" class="text-sm text-primary underline">Retour connexion</NuxtLink>
    </div>
  </div>
</template>
