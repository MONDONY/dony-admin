<script setup lang="ts">
/**
 * Erreur de chargement d'une liste financière. Sur un écran d'argent, un appel en échec ne doit
 * jamais ressembler à une absence de données : le tableau, lui, n'affiche alors pas d'état vide.
 */
defineProps<{ message: string | null }>()
</script>

<template>
  <p
    v-if="message" data-test="transactions-error" role="alert"
    class="mb-3 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger text-pretty"
  >{{ message }}</p>
</template>
