<script setup lang="ts">
import { computed } from 'vue'
import { BUTTON_LABEL_SOFT_LIMIT } from '@/features/video-modals/lib/validation'
import {
  ACTION_KIND_LABELS, INFO_SCREENS, INFO_SCREEN_LABELS, VIDEO_MODAL_ACTION_KINDS,
  type InfoScreen, type VideoModalAction, type VideoModalActionKind,
} from '@/features/video-modals/types/index'

/**
 * Un bouton d'un modal Information : libellés FR / EN et action (écran de l'app dans une liste
 * fermée, lien https, ou simple fermeture). `prefix` sert aux repères de test (`vm-primary-…`).
 */
const props = defineProps<{
  prefix: 'primary' | 'secondary'
  title: string
  action: VideoModalAction
  labelFr: string
  labelEn: string
  errors: { action?: string; url?: string; labelFr?: string; labelEn?: string }
}>()
const emit = defineEmits<{
  'update:action': [action: VideoModalAction]
  'update:labelFr': [value: string]
  'update:labelEn': [value: string]
}>()

const inputClass = 'mt-1 w-full rounded-btn border border-border bg-bg p-2 text-sm'
const errClass = 'mt-1 text-xs text-danger'
const labelClass = 'block text-xs font-semibold text-text-muted'

const labelHint = computed(() => (props.action.kind === 'CLOSE' ? 'Vide : « OK ».' : `${BUTTON_LABEL_SOFT_LIMIT} caractères au plus.`))

function setKind(kind: VideoModalActionKind) {
  emit('update:action', { kind, screen: kind === 'SCREEN' ? (props.action.screen ?? 'SEARCH') : null, url: kind === 'URL' ? (props.action.url ?? '') : null })
}
const onKind = (e: Event) => setKind((e.target as HTMLSelectElement).value as VideoModalActionKind)
const onScreen = (e: Event) => emit('update:action', { ...props.action, screen: (e.target as HTMLSelectElement).value as InfoScreen })
const onUrl = (e: Event) => emit('update:action', { ...props.action, url: (e.target as HTMLInputElement).value })
const onFr = (e: Event) => emit('update:labelFr', (e.target as HTMLInputElement).value)
const onEn = (e: Event) => emit('update:labelEn', (e.target as HTMLInputElement).value)
</script>

<template>
  <div class="rounded-btn border border-border p-4" :data-test="`vm-${prefix}-box`">
    <p class="mb-3 text-sm font-semibold">{{ title }}</p>
    <div class="grid gap-3 sm:grid-cols-2">
      <label :class="labelClass">Libellé FR
        <input :value="labelFr" :data-test="`vm-${prefix}-fr`" type="text" :class="inputClass" @input="onFr">
        <span v-if="errors.labelFr" :class="errClass">{{ errors.labelFr }}</span>
      </label>
      <label :class="labelClass">Libellé EN
        <input :value="labelEn" :data-test="`vm-${prefix}-en`" type="text" :class="inputClass" @input="onEn">
        <span v-if="errors.labelEn" :class="errClass">{{ errors.labelEn }}</span>
      </label>
    </div>
    <p class="mt-1 text-xs text-text-muted">{{ labelHint }}</p>

    <label :class="[labelClass, 'mt-3']">Action au toucher
      <select :value="action.kind" :data-test="`vm-${prefix}-kind`" :class="inputClass" @change="onKind">
        <option v-for="k in VIDEO_MODAL_ACTION_KINDS" :key="k" :value="k">{{ ACTION_KIND_LABELS[k] }}</option>
      </select>
    </label>

    <label v-if="action.kind === 'SCREEN'" :class="[labelClass, 'mt-3']">Écran à ouvrir
      <select :value="action.screen ?? ''" :data-test="`vm-${prefix}-screen`" :class="inputClass" @change="onScreen">
        <option value="" disabled>Choisir un écran</option>
        <option v-for="s in INFO_SCREENS" :key="s" :value="s">{{ INFO_SCREEN_LABELS[s] }}</option>
      </select>
    </label>
    <label v-else-if="action.kind === 'URL'" :class="[labelClass, 'mt-3']">Lien (https uniquement)
      <input :value="action.url ?? ''" :data-test="`vm-${prefix}-url`" type="url" autocomplete="off" :class="inputClass" placeholder="https://…" @input="onUrl">
      <span v-if="errors.url" :data-test="`vm-${prefix}-url-error`" :class="errClass">{{ errors.url }}</span>
    </label>
    <p v-if="errors.action" :class="errClass">{{ errors.action }}</p>
  </div>
</template>
