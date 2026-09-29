<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { supportService } from '@/features/support/services/supportService'
import type { AdminSupportTicket } from '@/features/support/types/index'
import { STATUS_LABELS, statusTone } from '@/features/support/utils/format'
import { extractProblemMessage } from '@/lib/problemDetail'

/**
 * Section « Conversations support » de la fiche utilisateur : les 5 dernières, avec un lien
 * vers chaque fil et vers la liste complète filtrée sur ce compte.
 */
const props = defineProps<{ userId: string }>()

const LIMIT = 5
const tickets = ref<AdminSupportTicket[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const total = ref(0)
/** L'ancien back ignore ?userId= et renvoie la file entière : la section n'aurait aucun sens. */
const hidden = ref(false)
let seq = 0

async function load(id: string) {
  const current = ++seq
  loading.value = true
  error.value = null
  hidden.value = false
  try {
    const page = await supportService.listByUser(id, LIMIT)
    if (current !== seq) return
    hidden.value = page.content.some((t) => t.userId && t.userId !== id)
    tickets.value = page.content
    total.value = page.totalElements
  } catch (e) {
    if (current !== seq) return
    tickets.value = []
    error.value = extractProblemMessage(e, 'Conversations indisponibles.')
  } finally {
    if (current === seq) loading.value = false
  }
}
watch(() => props.userId, (id) => { void load(id) }, { immediate: true })

const allLink = computed(() => `/support?userId=${encodeURIComponent(props.userId)}`)

function lastActivity(t: AdminSupportTicket): string {
  const iso = t.lastMessageAt ?? t.createdAt
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <section v-if="!hidden" data-test="user-support-section" class="mt-6">
    <div class="mb-2 flex items-baseline justify-between gap-3">
      <h3 class="text-sm font-semibold">Conversations support</h3>
      <NuxtLink
        v-if="tickets.length > 0" data-test="user-support-all" :to="allLink"
        class="text-xs font-medium text-primary underline-offset-2 hover:underline"
      >Voir tout<span v-if="total > tickets.length" class="tabular-nums"> ({{ total }})</span></NuxtLink>
    </div>
    <p v-if="loading" data-test="user-support-loading" class="text-xs text-text-muted">Chargement…</p>
    <p v-else-if="error" data-test="user-support-error" role="alert" class="text-xs text-danger">{{ error }}</p>
    <p v-else-if="tickets.length === 0" data-test="user-support-empty" class="text-xs text-text-muted">
      Aucune conversation avec cet utilisateur.
    </p>
    <ul v-else class="overflow-hidden rounded-card border border-border">
      <li
        v-for="t in tickets" :key="t.id" :data-test="`user-support-row-${t.id}`"
        class="border-b border-border last:border-0"
      >
        <NuxtLink
          :to="`/support?ticket=${encodeURIComponent(t.id)}`"
          class="flex items-center justify-between gap-3 px-3 py-2 text-sm transition-colors hover:bg-surface-elevated"
        >
          <span class="min-w-0">
            <span class="block truncate font-medium text-text">{{ t.subject }}</span>
            <span class="block text-xs text-text-muted tabular-nums">{{ lastActivity(t) }}</span>
          </span>
          <StatusBadge class="shrink-0" :label="STATUS_LABELS[t.status] ?? t.status" :tone="statusTone(t.status)" />
        </NuxtLink>
      </li>
    </ul>
  </section>
</template>
