<script setup lang="ts">
import { onMounted } from 'vue'
import MobileConversationCard from '@/features/mobile/components/MobileConversationCard.vue'
import { useMobileMessageList } from '@/features/mobile/composables/useMobileMessageList'
import { MESSAGES_CHIPS } from '@/features/mobile/lib/mobileMessages'

definePageMeta({ layout: 'mobile', middleware: 'admin-only', permission: 'MODERATION_VIEW', pageTitle: 'Messages' })

const { chip, search, items, isLoading, isLoadingMore, error, hasMore, load, loadMore, selectChip, setSearch } = useMobileMessageList()

onMounted(load)
</script>

<template>
  <div class="space-y-4">
    <p class="text-sm text-text-muted">Conversations entre utilisateurs</p>

    <div>
      <label for="messages-search" class="sr-only">Rechercher un nom</label>
      <input
        id="messages-search" type="search" data-test="messages-search" :value="search" autocomplete="off"
        placeholder="Rechercher un nom"
        class="min-h-[44px] w-full rounded-xl border border-border bg-surface px-3 text-base text-text"
        @input="setSearch(($event.target as HTMLInputElement).value)"
      >
    </div>

    <div class="flex gap-2 overflow-x-auto" role="tablist" aria-label="Filtre des conversations">
      <button
        v-for="c in MESSAGES_CHIPS" :key="c.key" type="button" role="tab" data-test="messages-chip"
        :data-chip="c.key" :aria-selected="chip === c.key"
        class="min-h-[44px] shrink-0 whitespace-nowrap rounded-full border px-4 text-sm font-semibold"
        :class="chip === c.key ? 'border-primary bg-primary text-white' : 'border-border bg-surface text-text'"
        @click="selectChip(c.key)"
      >{{ c.label }}</button>
    </div>

    <div v-if="error" class="space-y-2">
      <p data-test="messages-error" class="text-sm text-danger" role="alert">{{ error }}</p>
      <button type="button" data-test="messages-retry" class="min-h-[44px] whitespace-nowrap rounded-xl border border-border bg-surface px-4 text-sm font-semibold text-text" @click="load">Réessayer</button>
    </div>
    <p v-else-if="isLoading && !items.length" class="text-sm text-text-muted">Chargement…</p>
    <p v-else-if="!items.length" data-test="messages-empty" class="text-sm text-text-muted">Aucune conversation dans cette liste.</p>
    <ul v-if="items.length" class="space-y-2">
      <li v-for="c in items" :key="c.id"><MobileConversationCard :conversation="c" /></li>
    </ul>

    <button
      v-if="hasMore && items.length" type="button" data-test="messages-more" :disabled="isLoadingMore"
      class="min-h-[44px] w-full whitespace-nowrap rounded-xl border border-border bg-surface px-4 text-sm font-semibold text-text disabled:opacity-60"
      @click="loadMore"
    >Voir plus</button>
  </div>
</template>
