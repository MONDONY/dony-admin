<script setup lang="ts">
import KycWorkbench from '@/features/kyc/components/KycWorkbench.vue'

definePageMeta({
  middleware: 'admin-only', permission: 'USER_KYC',
  pageTitle: 'Vérifications d’identité', pageSubtitle: 'File KYC et décisions manuelles',
})
</script>

<template>
  <KycWorkbench />
</template>
