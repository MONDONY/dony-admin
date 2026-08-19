<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ConfirmActionDialog from '@/components/ui/ConfirmActionDialog.vue'
import { TARGET_LABELS, type BroadcastTarget, type BroadcastTargetType } from '@/features/broadcast/types/index'

const props = defineProps<{
  recipientCount: number | null
  busy?: boolean
  previewing?: boolean
}>()
const emit = defineEmits<{
  preview: [target: BroadcastTarget]
  send: [title: string, body: string, target: BroadcastTarget]
}>()

const title = ref('')
const body = ref('')
const targetType = ref<BroadcastTargetType>('ALL')
const origin = ref('')
const destination = ref('')
const userId = ref('')
const confirmOpen = ref(false)

// Seuls les champs pertinents pour le type choisi entrent dans le ciblage — un champ
// laissé rempli après un changement de cible ne doit pas fuiter dans la requête.
const target = computed<BroadcastTarget>(() => {
  if (targetType.value === 'CORRIDOR') return { type: 'CORRIDOR', origin: origin.value, destination: destination.value }
  if (targetType.value === 'USER') return { type: 'USER', userId: userId.value }
  return { type: targetType.value }
})

// Le ciblage pour lequel l'estimation courante a été demandée. Changer de ciblage ensuite
// rend le compteur mensonger : on le considère alors comme non estimé plutôt que d'afficher
// un chiffre qui ne correspond plus à ce qui partira.
const estimatedFor = ref<string | null>(null)
// Le compteur est fourni par la page, qui le remplit après l'estimation : on note le
// ciblage courant au moment précis où il arrive, ce qui est le seul instant où l'on sait
// à quoi il correspond.
watch(() => props.recipientCount, (count) => {
  estimatedFor.value = count === null ? null : JSON.stringify(target.value)
}, { immediate: true })
const freshCount = computed<number | null>(() =>
  props.recipientCount !== null && estimatedFor.value === JSON.stringify(target.value)
    ? props.recipientCount
    : null,
)
const estimateIsStale = computed(() => props.recipientCount !== null && freshCount.value === null)

// Phrase de contrôle exigée pour la cible la plus large. Réservée à `ALL` : l'imposer sur
// toutes les cibles la banaliserait, et une confirmation qu'on tape sans lire ne protège
// plus de rien — même raisonnement que pour la désactivation des SMS.
const BROADCAST_ALL_PHRASE = 'DIFFUSER A TOUS'
const needsControlPhrase = computed(() => targetType.value === 'ALL')

// L'estimation fraîche est OBLIGATOIRE avant tout envoi : c'est elle qui oblige à VOIR le
// nombre de personnes touchées avant de s'engager. Une notification push ne se rappelle pas.
const canSend = computed(() =>
  title.value.trim().length > 0
  && body.value.trim().length > 0
  && !props.busy
  && freshCount.value !== null,
)

function onPreview() {
  emit('preview', target.value)
}

function onSendClick() {
  if (canSend.value) confirmOpen.value = true
}

function confirmSend() {
  confirmOpen.value = false
  emit('send', title.value, body.value, target.value)
}

// Un broadcast est irrattrapable une fois parti : la confirmation nomme toujours le
// nombre de destinataires (ou signale explicitement qu'il n'a pas été estimé), pour que
// l'admin sache combien de personnes il s'apprête à toucher avant de valider.
const confirmMessage = computed(() => {
  if (freshCount.value === null) {
    return 'Le nombre de destinataires n’a pas été estimé pour ce ciblage. '
      + 'Ce message sera envoyé immédiatement et ne pourra pas être annulé.'
  }
  const n = freshCount.value
  return `Ce message sera envoyé à ${n} destinataire${n > 1 ? 's' : ''}. `
    + 'Cette action est irréversible et ne pourra pas être annulée.'
})
</script>

<template>
  <div class="rounded-card border border-border bg-surface p-6 space-y-4">
    <label class="block text-sm text-text-muted">Titre
      <input
        v-model="title" data-test="broadcast-title" type="text" :disabled="busy"
        placeholder="Titre de la notification"
        class="mt-1 w-full rounded-btn border border-border bg-bg p-2 text-sm disabled:opacity-40"
      >
    </label>

    <label class="block text-sm text-text-muted">Message
      <textarea
        v-model="body" data-test="broadcast-body" rows="4" :disabled="busy"
        placeholder="Corps du message"
        class="mt-1 w-full rounded-btn border border-border bg-bg p-2 text-sm disabled:opacity-40"
      />
    </label>

    <label class="block text-sm text-text-muted">Cible
      <select
        v-model="targetType" data-test="broadcast-target" :disabled="busy"
        class="mt-1 w-full rounded-btn border border-border bg-bg p-2 text-sm disabled:opacity-40"
      >
        <option v-for="(label, value) in TARGET_LABELS" :key="value" :value="value">{{ label }}</option>
      </select>
    </label>

    <div v-if="targetType === 'CORRIDOR'" class="flex gap-3">
      <label class="text-sm text-text-muted flex-1">Ville de départ
        <input
          v-model="origin" data-test="broadcast-origin" type="text" :disabled="busy"
          class="mt-1 w-full rounded-btn border border-border bg-bg p-2 text-sm disabled:opacity-40"
        >
      </label>
      <label class="text-sm text-text-muted flex-1">Ville d’arrivée
        <input
          v-model="destination" data-test="broadcast-destination" type="text" :disabled="busy"
          class="mt-1 w-full rounded-btn border border-border bg-bg p-2 text-sm disabled:opacity-40"
        >
      </label>
    </div>

    <label v-if="targetType === 'USER'" class="block text-sm text-text-muted">Identifiant utilisateur
      <input
        v-model="userId" data-test="broadcast-user-id" type="text" :disabled="busy"
        class="mt-1 w-full rounded-btn border border-border bg-bg p-2 text-sm disabled:opacity-40"
      >
    </label>

    <div class="flex items-center gap-3">
      <button
        type="button" data-test="broadcast-preview" :disabled="busy || previewing"
        class="rounded-btn px-4 py-2 text-sm border border-border hover:bg-surface-elevated disabled:opacity-40"
        @click="onPreview"
      >Estimer les destinataires</button>
      <span v-if="freshCount !== null" data-test="broadcast-recipient-count" class="text-sm text-text-muted tabular-nums">
        {{ freshCount }} destinataire{{ freshCount > 1 ? 's' : '' }} estimé{{ freshCount > 1 ? 's' : '' }}
      </span>
      <span v-else-if="estimateIsStale" data-test="broadcast-stale-estimate" class="text-sm text-warning">
        Le ciblage a changé — relancez l’estimation.
      </span>
    </div>

    <div class="flex justify-end">
      <button
        type="button" data-test="broadcast-send" :disabled="!canSend"
        class="rounded-btn px-4 py-2 text-sm bg-primary text-white disabled:opacity-40 hover:bg-primary/90"
        @click="onSendClick"
      >Envoyer</button>
    </div>

    <ConfirmActionDialog
      :open="confirmOpen"
      title="Envoyer la diffusion"
      :message="confirmMessage"
      confirm-label="Envoyer"
      :confirmation-phrase="needsControlPhrase ? BROADCAST_ALL_PHRASE : undefined"
      :confirmation-label="needsControlPhrase ? `Saisissez « ${BROADCAST_ALL_PHRASE} » pour confirmer` : undefined"
      @confirm="confirmSend"
      @cancel="confirmOpen = false"
    />
  </div>
</template>
