<script setup lang="ts">
/** La ligne demandée par lien (`?open=`) n'est pas dans la page chargée : on le dit plutôt que rien. */
defineProps<{ show: boolean; label: string }>()
</script>

<template>
  <p
    v-if="show" data-test="open-row-missing" role="status"
    class="mb-3 rounded-btn border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning text-pretty"
  >{{ label }}</p>
</template>
