<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import ConfirmActionDialog from '@/components/ui/ConfirmActionDialog.vue'
import StateBlock from '@/components/ui/StateBlock.vue'
import { useEscapeClose } from '@/composables/useEscapeClose'
import { useDac7SellerCase } from '@/features/dac7/composables/useDac7SellerCase'
import {
  DAC7_NOTE_MAX, DAC7_UNAVAILABLE, diligenceActionLabel, fmtDateTime, noteValid,
} from '@/features/dac7/types/index'
import type { Dac7Seller } from '@/features/dac7/types/index'
import { gate, toHref, userRoute } from '@/lib/adminLinks'
import { parseServerDate } from '@/lib/serverDate'
import { useAuthStore } from '@/stores/auth'

/**
 * Tiroir d'un voyageur : registre des diligences, relance manuelle et décision de l'équipe.
 * Chaque geste demande une confirmation. La note de décision est un texte libre : on rappelle
 * de n'y mettre aucune donnée sensible (jamais de numéro fiscal ni d'adresse).
 */
const props = defineProps<{ seller: Dac7Seller }>()
const emit = defineEmits<{ close: []; changed: [] }>()

const auth = useAuthStore()
const root = ref<HTMLElement | null>(null)
useEscapeClose(() => emit('close'), () => true, () => root.value)

const work = useDac7SellerCase()
const note = ref('')
const confirming = ref<'remind' | 'decision' | null>(null)

const name = computed(() => props.seller.displayName || 'Nom non renseigné')
const canRemind = computed(() => !props.seller.solicitation || props.seller.solicitation === 'SOLLICITER')
const noteOk = computed(() => noteValid(note.value))
const noteLength = computed(() => note.value.trim().length)
const userLink = computed(() => {
  const route = gate(p => auth.can(p), 'USER_VIEW', userRoute(props.seller.userId))
  return route ? toHref(route) : null
})
/** Du plus récent au plus ancien ; une date illisible passe en dernier. */
const sorted = computed(() => [...work.entries.value].sort((a, b) => {
  const x = parseServerDate(a.at)
  const y = parseServerDate(b.at)
  if (Number.isNaN(x)) return Number.isNaN(y) ? 0 : 1
  if (Number.isNaN(y)) return -1
  return y - x
}))

function reload() { return work.loadDiligence(props.seller.userId) }
onMounted(reload)
watch(() => props.seller.userId, () => { note.value = ''; confirming.value = null; void reload() })

async function onConfirm() {
  const kind = confirming.value
  confirming.value = null
  const id = props.seller.userId
  const ok = kind === 'remind' ? await work.remind(id) : kind === 'decision' ? await work.decide(id, note.value) : false
  if (!ok) return
  if (kind === 'decision') note.value = ''
  await reload()
  emit('changed')
}
</script>

<template>
  <div class="fixed inset-0 z-40 flex justify-end bg-black/30" @click.self="emit('close')">
    <aside
      ref="root" role="dialog" aria-modal="true" :aria-label="`Diligences de ${name}`" data-test="dac7-drawer"
      class="h-full w-full max-w-md overflow-y-auto border-l border-border bg-surface p-6"
    >
      <div class="mb-4 flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h2 class="truncate font-display text-xl font-bold">{{ name }}</h2>
          <NuxtLink
            v-if="userLink" :to="userLink" data-test="dac7-drawer-user-link"
            class="text-sm text-primary underline-offset-2 hover:underline"
          >Ouvrir la fiche</NuxtLink>
        </div>
        <button
          type="button" data-test="dac7-drawer-close"
          class="rounded-btn border border-border px-3 py-1.5 text-sm"
          @click="emit('close')"
        >Fermer</button>
      </div>

      <p
        v-if="work.notice.value" data-test="dac7-drawer-notice" role="status"
        class="mb-3 rounded-btn border border-success/40 bg-success/10 px-3 py-2 text-sm text-success"
      >{{ work.notice.value }}</p>
      <p
        v-if="work.actionError.value" data-test="dac7-drawer-error" role="alert"
        class="mb-3 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger text-pretty"
      >{{ work.actionError.value }}</p>

      <section aria-label="Relance" class="mb-6">
        <h3 class="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">Relance</h3>
        <button
          type="button" data-test="dac7-remind" :disabled="!canRemind || work.busy.value"
          class="rounded-btn border border-border px-3 py-2 text-sm transition-[background-color,scale] hover:bg-surface-elevated active:scale-[0.96] disabled:opacity-40"
          @click="confirming = 'remind'"
        >Relancer</button>
        <p v-if="!canRemind" data-test="dac7-remind-hint" class="mt-2 text-xs text-text-muted text-pretty">
          Ce voyageur n’est pas à solliciter : aucune relance possible.
        </p>
        <p v-else class="mt-2 text-xs text-text-muted text-pretty">
          Un seul rappel manuel par semaine. Le voyageur reçoit une notification, sans menace ni blocage.
        </p>
      </section>

      <section aria-label="Décision de l’équipe" class="mb-6">
        <h3 class="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">Décision de l’équipe</h3>
        <textarea
          v-model="note" data-test="dac7-decision-note" rows="3" aria-label="Note de la décision"
          placeholder="Ce qui a été décidé, en une ou deux phrases"
          class="w-full rounded-btn border border-border bg-bg p-2 text-sm"
        />
        <p class="mt-1 flex items-start justify-between gap-3 text-xs text-text-muted">
          <span class="text-pretty">Sans donnée sensible : jamais de numéro fiscal, d’adresse ni de date de naissance.</span>
          <span
            data-test="dac7-decision-count"
            :class="['shrink-0 tabular-nums', noteLength > DAC7_NOTE_MAX ? 'text-danger' : '']"
          >{{ noteLength }} / {{ DAC7_NOTE_MAX }}</span>
        </p>
        <button
          type="button" data-test="dac7-decision-submit" :disabled="!noteOk || work.busy.value"
          class="mt-2 rounded-btn bg-primary px-3 py-2 text-sm text-white transition-[background-color,scale] hover:bg-primary/90 active:scale-[0.96] disabled:opacity-40"
          @click="confirming = 'decision'"
        >Enregistrer la décision</button>
      </section>

      <section aria-label="Registre des diligences">
        <h3 class="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">Registre des diligences</h3>
        <p v-if="work.unavailable.value" data-test="dac7-drawer-unavailable" class="text-sm text-text-muted">{{ DAC7_UNAVAILABLE }}</p>
        <ul v-else-if="sorted.length" class="divide-y divide-border">
          <li v-for="(e, i) in sorted" :key="i" data-test="dac7-diligence-item" class="py-2">
            <p class="flex items-baseline justify-between gap-2 text-sm">
              <span class="font-medium">{{ diligenceActionLabel(e.action) }}</span>
              <span class="shrink-0 text-xs tabular-nums text-text-muted">{{ fmtDateTime(e.at) }}</span>
            </p>
            <p class="text-xs text-text-muted">
              {{ [e.channel, e.actorName].filter(Boolean).join(' · ') }}
            </p>
            <p v-if="e.note" class="mt-1 text-sm text-pretty">{{ e.note }}</p>
          </li>
        </ul>
        <StateBlock
          v-if="!work.unavailable.value"
          :loading="work.isLoading.value && sorted.length === 0" :error="work.error.value"
          :empty="!work.isLoading.value && !work.error.value && sorted.length === 0"
          empty-label="Aucune diligence enregistrée" empty-test="dac7-diligence-empty" @retry="reload"
        />
      </section>

      <ConfirmActionDialog
        :open="confirming === 'remind'" title="Relancer ce voyageur"
        :message="`${name} recevra une notification lui rappelant de renseigner son numéro fiscal. Un seul rappel manuel est permis par semaine.`"
        confirm-label="Relancer" confirm-tone="primary"
        @confirm="onConfirm" @cancel="confirming = null"
      />
      <ConfirmActionDialog
        :open="confirming === 'decision'" title="Enregistrer la décision"
        :message="`La note sera inscrite au registre des diligences de ${name}, avec votre nom. Elle ne peut plus être modifiée.`"
        confirm-label="Enregistrer" confirm-tone="primary"
        @confirm="onConfirm" @cancel="confirming = null"
      />
    </aside>
  </div>
</template>
