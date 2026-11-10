<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { extractYoutubeId } from '@/features/video-modals/lib/youtube'
import { AUDIENCE_LABELS, VIDEO_MODAL_AUDIENCES, type AdminVideoModal, type NewVersionInput, type VideoModalAudience } from '@/features/video-modals/types/index'

/**
 * Nouvelle version d'une campagne : le modal est remontré au public choisi, même à ceux qui
 * avaient répondu à la version précédente si « Tout le monde » est coché. Geste lourd, d'où la
 * fenêtre dédiée et le récapitulatif avant publication.
 */
const props = defineProps<{ open: boolean; modal: AdminVideoModal | null; busy?: boolean }>()
const emit = defineEmits<{ confirm: [input: NewVersionInput]; cancel: [] }>()

const audience = ref<VideoModalAudience>('NEVER_ANSWERED')
const youtubeUrl = ref('')
watch(() => props.open, (o) => {
  if (o) { audience.value = 'NEVER_ANSWERED'; youtubeUrl.value = '' }
})

const isInfo = computed(() => props.modal?.type === 'INFO')
const nextVersion = computed(() => (props.modal?.version ?? 0) + 1)
const urlFilled = computed(() => youtubeUrl.value.trim().length > 0)
const urlValid = computed(() => isInfo.value || !urlFilled.value || extractYoutubeId(youtubeUrl.value) !== null)
const canConfirm = computed(() => !props.busy && urlValid.value)

function onEscape(e: KeyboardEvent) {
  if (e.key !== 'Escape' || !props.open) return
  e.preventDefault()
  emit('cancel')
}
onMounted(() => window.addEventListener('keydown', onEscape))
onBeforeUnmount(() => window.removeEventListener('keydown', onEscape))

function onConfirm() {
  if (!canConfirm.value) return
  const input: NewVersionInput = { audience: audience.value }
  if (!isInfo.value && urlFilled.value) input.youtubeUrl = youtubeUrl.value.trim()
  emit('confirm', input)
}
</script>

<template>
  <div v-if="open && modal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-test="vm-version-overlay">
    <div role="dialog" aria-modal="true" aria-label="Nouvelle version" class="w-full max-w-md rounded-card border border-border bg-surface p-6 shadow-xl">
      <h2 class="mb-1 font-display text-lg font-semibold">Nouvelle version</h2>
      <p class="mb-4 text-sm text-text-muted text-pretty">
        « {{ modal.name }} » passe en version {{ nextVersion }}. Le modal sera de nouveau montré au public choisi,
        selon les déclencheurs déjà réglés. Pour corriger une faute sans le remontrer, utilisez plutôt « Enregistrer ».
      </p>

      <fieldset class="mb-4">
        <legend class="mb-2 text-xs font-semibold text-text-muted">Qui doit voir cette version ?</legend>
        <label
          v-for="a in VIDEO_MODAL_AUDIENCES" :key="a" :data-test="`vm-audience-${a}`"
          :class="['mb-1.5 flex cursor-pointer items-start gap-2.5 rounded-btn border px-3 py-2.5 text-sm transition-colors',
                   audience === a ? 'border-primary bg-primary/10' : 'border-border hover:bg-surface-elevated']"
        >
          <input v-model="audience" type="radio" name="vm-audience" :value="a" class="mt-0.5 accent-primary">
          <span>
            <b class="block font-semibold">{{ AUDIENCE_LABELS[a].label }}</b>
            <span class="text-xs text-text-muted">{{ AUDIENCE_LABELS[a].hint }}</span>
          </span>
        </label>
      </fieldset>

      <template v-if="!isInfo">
      <label class="mb-1 block text-xs font-semibold text-text-muted" for="vm-version-url">Nouveau lien YouTube (facultatif)</label>
      <input
        id="vm-version-url" v-model="youtubeUrl" data-test="vm-version-url" type="url" autocomplete="off"
        :placeholder="modal.youtubeUrl || 'https://youtu.be/…'"
        class="w-full rounded-btn border border-border bg-bg p-2 text-sm"
      >
      <p v-if="!urlValid" data-test="vm-version-url-error" class="mt-1 text-xs text-danger">Lien non reconnu : youtu.be/…, youtube.com/watch?v=…, /shorts/… ou /embed/…</p>
      <p v-else class="mt-1 text-xs text-text-muted">Vide : la vidéo actuelle est gardée. La vidéo doit être publique ou non répertoriée.</p>
      </template>

      <div class="mt-5 flex justify-end gap-2">
        <button
          type="button" data-test="vm-version-cancel"
          class="whitespace-nowrap rounded-btn border border-border px-4 py-2 text-sm hover:bg-surface-elevated"
          @click="emit('cancel')"
        >Annuler</button>
        <button
          type="button" data-test="vm-version-confirm" :disabled="!canConfirm"
          class="whitespace-nowrap rounded-btn bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90 disabled:opacity-40"
          @click="onConfirm"
        >Publier la version {{ nextVersion }}</button>
      </div>
    </div>
  </div>
</template>
