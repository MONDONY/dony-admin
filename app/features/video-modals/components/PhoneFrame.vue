<script setup lang="ts">
/**
 * Téléphone de l'aperçu, commun aux modals vidéo et information : écran de l'app assombri en
 * fond, le contenu du modal arrive dans le slot. Couleurs unies, quel que soit le thème de l'admin.
 */
defineProps<{ lang: 'fr' | 'en' }>()
</script>

<template>
  <div class="mx-auto h-[620px] w-[300px] rounded-[44px] bg-[#0F1526] p-2.5 shadow-[0_24px_48px_rgba(4,29,84,0.16)]" data-test="vm-preview">
    <div class="relative h-full w-full overflow-hidden rounded-[35px] bg-white text-[#0B1535]" :lang="lang">
      <div class="absolute inset-0 px-3.5 pt-11" aria-hidden="true">
        <div class="mb-2.5 h-[34px] rounded-[17px] bg-[#F1F3F8]" />
        <div class="mb-2.5 h-[110px] rounded-2xl border border-[#E3E7F0]" />
        <div class="h-[110px] rounded-2xl border border-[#E3E7F0]" />
      </div>
      <div class="absolute inset-0 bg-[rgba(10,18,40,0.55)]" aria-hidden="true" />
      <slot />
    </div>
  </div>
</template>
