<script setup lang="ts">
import { ref } from 'vue'
import { ImagePlus, RefreshCw, Trash2 } from 'lucide-vue-next'
import { IMAGE_RULES_HINT } from '@/features/video-modals/lib/image'
import {
  IMAGE_ALT_MAX_LENGTH, IMAGE_FIT_LABELS, IMAGE_FITS, IMAGE_MODE_LABELS, IMAGE_MODES,
  type ImageFit, type ImageMode,
} from '@/features/video-modals/types/index'

/**
 * Image du modal Information : mode (aucune, bannière, affiche), fichier, cadrage et textes
 * alternatifs. Sur une campagne existante, le fichier part tout de suite ; à la création il est
 * choisi ici et envoyé juste après l'enregistrement (la campagne doit d'abord avoir un `id`).
 */
const props = defineProps<{
  mode: ImageMode
  fit: ImageFit
  altFr: string
  altEn: string
  /** Aperçu de l'image envoyée, ou du fichier choisi avant la création. */
  previewUrl: string | null
  /** Nom du fichier choisi avant la création. */
  pendingName: string | null
  isEdit: boolean
  busy?: boolean
  fileError: string | null
  modeError?: string
  altFrError?: string
  altEnError?: string
}>()
const emit = defineEmits<{
  'update:mode': [value: ImageMode]
  'update:fit': [value: ImageFit]
  'update:altFr': [value: string]
  'update:altEn': [value: string]
  pick: [file: File]
  remove: []
}>()

const input = ref<HTMLInputElement | null>(null)
const hasImage = () => props.previewUrl !== null || props.pendingName !== null

function onFile(e: Event) {
  const el = e.target as HTMLInputElement
  const file = el.files?.[0]
  if (file) emit('pick', file)
  el.value = ''
}

const inputClass = 'mt-1 w-full rounded-btn border border-border bg-bg p-2 text-sm'
const labelClass = 'block text-xs font-semibold text-text-muted'
</script>

<template>
  <fieldset data-test="vm-image" class="flex flex-col gap-3 rounded-btn border border-border p-4">
    <legend class="px-1 text-xs font-semibold text-text-muted">Image</legend>

    <div class="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Mode de l’image">
      <button
        v-for="m in IMAGE_MODES" :key="m" type="button" role="radio" :aria-checked="mode === m" :data-test="`vm-image-mode-${m}`"
        :class="['rounded-btn border px-3 py-2.5 text-left text-sm transition-colors',
                 mode === m ? 'border-primary bg-primary/10' : 'border-border hover:bg-surface-elevated']"
        @click="emit('update:mode', m)"
      >
        <b class="block font-semibold">{{ IMAGE_MODE_LABELS[m].label }}</b>
        <span class="text-xs text-text-muted text-pretty">{{ IMAGE_MODE_LABELS[m].hint }}</span>
      </button>
    </div>
    <p v-if="modeError" data-test="vm-image-mode-error" class="text-xs text-danger">{{ modeError }}</p>

    <template v-if="mode !== 'NONE' || hasImage()">
      <div class="flex flex-wrap items-center gap-3">
        <img
          v-if="previewUrl" :src="previewUrl" alt="" data-test="vm-image-thumb"
          class="h-16 w-16 rounded-btn border border-border bg-[#F6F7FA] object-cover"
        >
        <div class="min-w-0 flex-1 text-sm">
          <p v-if="previewUrl && !pendingName" data-test="vm-image-state" class="font-semibold">Image envoyée</p>
          <p v-else-if="pendingName" data-test="vm-image-state" class="truncate font-semibold">{{ pendingName }}</p>
          <p v-else data-test="vm-image-state" class="font-semibold text-text-muted">Aucune image envoyée</p>
          <p data-test="vm-image-rules" class="text-xs text-text-muted text-pretty">{{ IMAGE_RULES_HINT }}.</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            type="button" data-test="vm-image-pick" :disabled="busy"
            class="inline-flex items-center gap-1.5 whitespace-nowrap rounded-btn border border-border px-3 py-1.5 text-sm hover:bg-surface-elevated disabled:opacity-40"
            @click="input?.click()"
          >
            <component :is="hasImage() ? RefreshCw : ImagePlus" class="h-4 w-4" aria-hidden="true" />
            {{ hasImage() ? 'Remplacer' : 'Choisir une image' }}
          </button>
          <button
            v-if="hasImage()" type="button" data-test="vm-image-remove" :disabled="busy"
            class="inline-flex items-center gap-1.5 whitespace-nowrap rounded-btn px-3 py-1.5 text-sm text-danger hover:bg-danger/10 disabled:opacity-40"
            @click="emit('remove')"
          ><Trash2 class="h-4 w-4" aria-hidden="true" />Retirer</button>
        </div>
        <input
          ref="input" data-test="vm-image-file" type="file" class="hidden" accept="image/jpeg,image/png,image/webp" @change="onFile"
        >
      </div>
      <p v-if="fileError" data-test="vm-image-file-error" role="alert" class="rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">{{ fileError }}</p>
      <p data-test="vm-image-flow" class="text-xs text-text-muted text-pretty">
        <template v-if="isEdit">Le fichier est envoyé dès que vous le choisissez ; « Enregistrer » garde le mode, le cadrage et les textes.</template>
        <template v-else>Le fichier est envoyé automatiquement juste après la création du modal (il lui faut d’abord un identifiant). Le modal n’est activé qu’une fois l’image en place.</template>
      </p>

      <div class="flex flex-col gap-1">
        <span :class="labelClass">Cadrage</span>
        <div class="flex gap-2" role="radiogroup" aria-label="Cadrage de l’image">
          <button
            v-for="f in IMAGE_FITS" :key="f" type="button" role="radio" :aria-checked="fit === f" :data-test="`vm-image-fit-${f}`"
            :class="['rounded-btn border px-3 py-1.5 text-sm transition-colors',
                     fit === f ? 'border-primary bg-primary/10 font-semibold' : 'border-border hover:bg-surface-elevated']"
            :title="IMAGE_FIT_LABELS[f].hint" @click="emit('update:fit', f)"
          >{{ IMAGE_FIT_LABELS[f].label }}</button>
        </div>
        <p class="text-xs text-text-muted">{{ IMAGE_FIT_LABELS[fit].hint }}.</p>
      </div>

      <div class="grid gap-3 sm:grid-cols-2">
        <label :class="labelClass">Texte alternatif FR (facultatif)
          <input
            data-test="vm-image-alt-fr" type="text" :maxlength="IMAGE_ALT_MAX_LENGTH + 50" :value="altFr" :class="inputClass"
            @input="emit('update:altFr', ($event.target as HTMLInputElement).value)"
          >
          <span v-if="altFrError" class="mt-1 block text-xs text-danger">{{ altFrError }}</span>
        </label>
        <label :class="labelClass">Texte alternatif EN (facultatif)
          <input
            data-test="vm-image-alt-en" type="text" :maxlength="IMAGE_ALT_MAX_LENGTH + 50" :value="altEn" :class="inputClass"
            @input="emit('update:altEn', ($event.target as HTMLInputElement).value)"
          >
          <span v-if="altEnError" class="mt-1 block text-xs text-danger">{{ altEnError }}</span>
        </label>
      </div>
      <p class="-mt-2 text-xs text-text-muted text-pretty">Lu par les lecteurs d’écran. Laissé vide, le titre du modal est utilisé.</p>
    </template>
    <p v-else class="text-xs text-text-muted">Choisissez « Bannière en haut » ou « Affiche seule » pour ajouter une image.</p>
  </fieldset>
</template>
