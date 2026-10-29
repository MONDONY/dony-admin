<script setup lang="ts">
import { ref, watch } from 'vue'
import { topupCodesService } from '@/features/topup-codes/services/topupCodesService'
import { displayCode, formatTopupAmount, parseUtc, type AdminTopupCode, type TopupCodeRedemption } from '@/features/topup-codes/types/index'
import { extractProblemMessage } from '@/lib/problemDetail'

const props = defineProps<{ code: AdminTopupCode | null }>()
const emit = defineEmits<{ close: [] }>()

const rows = ref<TopupCodeRedemption[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

async function load(id: string) {
  rows.value = []
  error.value = null
  loading.value = true
  try {
    const result = await topupCodesService.redemptions(id)
    if (props.code?.id === id) rows.value = Array.isArray(result) ? result : []
  } catch (e) {
    if (props.code?.id === id) error.value = extractProblemMessage(e, 'Impossible de charger les utilisations')
  } finally {
    loading.value = false
  }
}

watch(() => props.code?.id, (id) => { if (id) void load(id) }, { immediate: true })

function fmtDateTime(d: string) { return parseUtc(d).toLocaleString('fr-FR') }
</script>

<template>
  <div v-if="code" class="fixed inset-0 z-40 flex justify-end bg-black/30" data-test="topup-redemptions" @click.self="emit('close')">
    <aside class="h-full w-full max-w-xl bg-surface border-l border-border overflow-y-auto p-6">
      <h2 class="font-display text-xl font-bold font-mono">{{ displayCode(code) }}</h2>
      <p class="text-sm text-text-muted mb-4 tabular-nums">
        {{ formatTopupAmount(code.amount, code.currency) }} · {{ code.redeemedCount }} / {{ code.maxRedemptions }} utilisations
      </p>
      <p v-if="loading" class="text-sm text-text-muted">Chargement…</p>
      <p v-else-if="error" class="text-sm text-danger" data-test="redemptions-error">{{ error }}</p>
      <p v-else-if="rows.length === 0" class="text-sm text-text-muted">Personne n’a encore utilisé ce code.</p>
      <ul v-else class="divide-y divide-border">
        <li v-for="r in rows" :key="r.id" class="py-2 flex items-center justify-between text-sm">
          <NuxtLink :to="`/users?open=${r.userId}`" class="hover:underline">{{ r.userName ?? r.userId }}</NuxtLink>
          <span class="text-text-muted tabular-nums">{{ fmtDateTime(r.createdAt) }}</span>
        </li>
      </ul>
      <div class="mt-6">
        <button type="button" data-test="redemptions-close" class="rounded-btn px-4 py-2 text-sm border border-border" @click="emit('close')">Fermer</button>
      </div>
    </aside>
  </div>
</template>
