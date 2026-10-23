<script setup lang="ts">
import type { AdminBidDetail } from '@/features/bids/types/index'
import BidPartyCard from './BidPartyCard.vue'

/** Les trois personnes du colis : expéditeur, voyageur, destinataire (téléphone masqué par le back). */
defineProps<{ bid: AdminBidDetail }>()
const emit = defineEmits<{ contact: [recipient: { id: string; name: string }] }>()
</script>

<template>
  <section data-test="section-people" aria-labelledby="bid-people-title">
    <h3 id="bid-people-title" class="sr-only">Personnes</h3>
    <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <BidPartyCard role="sender" title="Expéditeur" :party="bid.sender" :fallback-name="bid.senderName" @contact="emit('contact', $event)" />
      <BidPartyCard role="traveler" title="Voyageur" :party="bid.traveler" :fallback-name="bid.travelerName" @contact="emit('contact', $event)" />
      <div class="rounded-card bg-surface-elevated p-3 sm:col-span-2" data-test="party-recipient">
        <p class="text-xs font-medium text-text-muted">Destinataire</p>
        <p class="mt-0.5 font-medium break-words">{{ bid.recipient?.name ?? bid.recipientName ?? 'Non renseigné' }}</p>
        <p v-if="bid.recipient?.phoneMasked" class="text-xs tabular-nums text-text-muted" data-test="recipient-phone">{{ bid.recipient.phoneMasked }}</p>
      </div>
    </div>
  </section>
</template>
