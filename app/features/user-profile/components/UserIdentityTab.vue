<script setup lang="ts">
import { computed, onMounted } from 'vue'
import UserKycTab from '@/features/users/components/UserKycTab.vue'
import { useUserKyc } from '@/features/users/composables/useUserKyc'
import type { AdminKycDetail, AdminUserDetail } from '@/features/users/types/index'

const props = defineProps<{ user: AdminUserDetail }>()
/** Le détail appartient à la page : après un geste KYC, elle le relit. */
const emit = defineEmits<{ refresh: [] }>()

const kyc = useUserKyc()
const userName = computed(() => [props.user.firstName, props.user.lastName].filter(Boolean).join(' ') || null)
const heldCount = computed(() => props.user.heldPaymentsCount ?? 0)

// Chargement paresseux : l'onglet n'est monté qu'à son ouverture (lecture back = appel live au fournisseur).
onMounted(() => { void kyc.load(props.user.id) })

async function onReset(reason: string) {
  await kyc.reset(props.user.id, reason)
  // Échec : l'erreur reste affichée et le détail n'a pas changé.
  if (!kyc.error.value) emit('refresh')
}
function onDecided(updated: AdminKycDetail) {
  kyc.set(updated)
  emit('refresh')
}
</script>

<template>
  <UserKycTab
    :kyc="kyc.kyc.value" :loading="kyc.isLoading.value" :error="kyc.error.value" :busy="kyc.busy.value"
    :user-name="userName" :held-payments-count="heldCount"
    @reset="onReset" @decided="onDecided" @stale="kyc.refresh(user.id)"
  />
</template>
