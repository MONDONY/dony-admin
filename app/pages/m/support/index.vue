<script setup lang="ts">
import { onMounted } from 'vue'
import MobileSupportCard from '@/features/mobile/components/MobileSupportCard.vue'
import { useMobileSupportList } from '@/features/mobile/composables/useMobileSupportList'
import { SUPPORT_CHIPS } from '@/features/mobile/lib/mobileSupport'

definePageMeta({ layout: 'mobile', middleware: 'admin-only', permission: 'SUPPORT_TICKET_VIEW', pageTitle: 'Support' })

const { chip, sorted, isLoading, error, load, selectChip } = useMobileSupportList()

onMounted(load)
</script>

<template>
  <div class="space-y-4">
    <div class="flex gap-2 overflow-x-auto" role="tablist" aria-label="Statut des conversations">
      <button
        v-for="c in SUPPORT_CHIPS" :key="c.key" type="button" role="tab" data-test="support-chip"
        :data-chip="c.key" :aria-selected="chip === c.key"
        class="min-h-[44px] shrink-0 whitespace-nowrap rounded-full border px-4 text-sm font-semibold"
        :class="chip === c.key ? 'border-primary bg-primary text-white' : 'border-border bg-surface text-text'"
        @click="selectChip(c.key)"
      >{{ c.label }}</button>
    </div>

    <p v-if="error" data-test="support-error" class="text-sm text-danger" role="alert">{{ error }}</p>
    <p v-else-if="isLoading && !sorted.length" class="text-sm text-text-muted">Chargement…</p>
    <p v-else-if="!sorted.length" data-test="support-empty" class="text-sm text-text-muted">Aucune conversation dans cette liste.</p>
    <ul v-else class="space-y-2">
      <li v-for="t in sorted" :key="t.id"><MobileSupportCard :ticket="t" /></li>
    </ul>
  </div>
</template>
