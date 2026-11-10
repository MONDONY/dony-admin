<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { CircleCheck, CircleAlert, ExternalLink, Plus, Trash2 } from 'lucide-vue-next'
import { serializeRule } from '@/features/broadcast/composables/audienceRule'
import { useAudienceRule } from '@/features/broadcast/composables/useAudienceRule'
import { useBroadcast } from '@/features/broadcast/composables/useBroadcast'
import ActionEditor from '@/features/video-modals/components/ActionEditor.vue'
import ActiveSwitch from '@/features/video-modals/components/ActiveSwitch.vue'
import AudienceSection from '@/features/video-modals/components/AudienceSection.vue'
import FrequencySection from '@/features/video-modals/components/FrequencySection.vue'
import ImageSection from '@/features/video-modals/components/ImageSection.vue'
import InfoModalPreview from '@/features/video-modals/components/InfoModalPreview.vue'
import LayoutPicker from '@/features/video-modals/components/LayoutPicker.vue'
import TargetingSummary from '@/features/video-modals/components/TargetingSummary.vue'
import TriggerPicker from '@/features/video-modals/components/TriggerPicker.vue'
import VideoModalPreview from '@/features/video-modals/components/VideoModalPreview.vue'
import VideoModalStats from '@/features/video-modals/components/VideoModalStats.vue'
import { defaultFormState, formStateFromModal, inputFromFormState } from '@/features/video-modals/lib/form'
import { buildSummary } from '@/features/video-modals/lib/summary'
import { BUTTON_LABEL_SOFT_LIMIT, hasErrors, validateVideoModal } from '@/features/video-modals/lib/validation'
import { useAudienceEstimate } from '@/features/video-modals/composables/useAudienceEstimate'
import { validateImageFile } from '@/features/video-modals/lib/image'
import { extractYoutubeId, formatDuration, youtubeWatchUrl } from '@/features/video-modals/lib/youtube'
import {
  AUDIENCE_LABELS, BODY_MAX_LENGTH, HIGHLIGHT_ICONS, ICON_LABELS, MAX_HIGHLIGHTS, MODAL_ICONS, SITUATIONS, TYPE_LABELS,
  type AdminVideoModal, type AudienceEstimateRequest, type SituationKind, type VideoModalAction, type VideoModalInput, type VideoModalTrigger, type VideoModalType,
} from '@/features/video-modals/types/index'

/**
 * Création (`modal` nul) ou modification d'une campagne, avec l'aperçu en direct à droite.
 * En modification, l'interrupteur « Modal actif » agit tout de suite (PATCH dédié) : le PUT ne
 * porte pas l'état actif. À la création, il décide si la campagne est activée juste après.
 */
/** `type` ne sert qu'à la création : en modification, il vient de la campagne et ne change plus. */
const props = defineProps<{ modal: AdminVideoModal | null; busy?: boolean; type?: VideoModalType }>()
const emit = defineEmits<{
  /** `imageFile` : fichier choisi à la création, à envoyer juste après. */
  submit: [input: VideoModalInput, activate: boolean, imageFile: File | null]
  'upload-image': [file: File]
  'remove-image': []
  'toggle-active': [active: boolean]
  'new-version': []
}>()

const state = reactive(props.modal ? formStateFromModal(props.modal) : defaultFormState(['SEARCH_TAB'], props.type ?? 'VIDEO'))
const activateOnCreate = ref(false)
const submitted = ref(false)
const lang = ref<'fr' | 'en'>('fr')

const isEdit = computed(() => props.modal !== null)
const isInfo = computed(() => state.type === 'INFO')
const active = computed(() => (isEdit.value ? props.modal!.active : activateOnCreate.value))

// Image : celle du serveur (modification) ou le fichier choisi avant la création.
const pendingFile = ref<File | null>(null)
const pendingUrl = ref<string | null>(null)
const fileError = ref<string | null>(null)
const serverImageUrl = computed(() => props.modal?.imageUrl ?? null)
const previewImageUrl = computed(() => pendingUrl.value ?? serverImageUrl.value)
const hasImage = computed(() => previewImageUrl.value !== null || pendingFile.value !== null)

// Conditions : le constructeur et le catalogue de champs de la page Communications, tels quels. Le catalogue
// vient du back ; tant qu'il manque, les conditions déjà enregistrées ne peuvent pas être modifiées (ni
// invalidées), elles repartent telles quelles.
const { fields, fetchFields, error: catalogError } = useBroadcast()
const catalogLoading = ref(false)
async function loadCatalog() {
  catalogLoading.value = true
  try {
    await fetchFields()
  } finally {
    catalogLoading.value = false
  }
}
const rule = useAudienceRule(fields)
if (state.conditions) rule.load(state.conditions)
watch(() => serializeRule(rule.root.value), (wire) => { state.conditions = wire.children.length > 0 ? wire : null })
const conditionsComplete = computed(() => fields.value.length === 0 || rule.isComplete.value)

const input = computed(() => inputFromFormState(state))
const errors = computed(() => validateVideoModal(input.value, { hasImage: hasImage.value, conditionsComplete: conditionsComplete.value }))
const shown = (k: keyof typeof errors.value) => (submitted.value ? errors.value[k] : undefined)

const targetingErrorKeys = ['conditions', 'minAppVersion', 'maxAppVersion', 'platforms', 'samplePercent'] as const
const estimateRequest = computed<AudienceEstimateRequest | null>(() => {
  if (targetingErrorKeys.some(k => errors.value[k])) return null
  const i = input.value
  return {
    conditions: i.conditions ?? null,
    connectedOnly: i.connectedOnly ?? false,
    platforms: i.platforms ?? [],
    samplePercent: i.samplePercent ?? 100,
    minAppVersion: i.minAppVersion ?? null,
    maxAppVersion: i.maxAppVersion ?? null,
  }
})
const estimate = useAudienceEstimate(estimateRequest)
const summary = computed(() => buildSummary(input.value, fields.value))
const visitorsExcluded = computed(() => {
  const i = input.value
  return !!i.connectedOnly || !!i.conditions || (i.situations ?? []).length > 0 || (typeof i.samplePercent === 'number' && i.samplePercent < 100)
})

const videoId = computed(() => extractYoutubeId(state.youtubeUrl))
const urlFilled = computed(() => state.youtubeUrl.trim().length > 0)
const durationText = computed(() => formatDuration(Number(state.durationSeconds)))

const bodyLength = computed(() => state.bodyFr.trim().length)
const bodyEnLength = computed(() => state.bodyEn.trim().length)
const primaryErrors = computed(() => ({
  action: shown('primaryAction'), url: shown('primaryUrl'), labelFr: shown('primaryLabelFr'), labelEn: shown('primaryLabelEn'),
}))
const secondaryErrors = computed(() => ({
  action: shown('secondaryAction'), url: shown('secondaryUrl'), labelFr: shown('secondaryLabelFr'), labelEn: shown('secondaryLabelEn'),
}))
const setPrimary = (a: VideoModalAction) => { state.primaryAction = a }
const setSecondary = (a: VideoModalAction) => { state.secondaryAction = a }

function revokePending() {
  if (pendingUrl.value && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(pendingUrl.value)
  pendingUrl.value = null
  pendingFile.value = null
}
async function onPickImage(file: File) {
  fileError.value = await validateImageFile(file)
  if (fileError.value) return
  if (isEdit.value) {
    emit('upload-image', file)
    return
  }
  revokePending()
  pendingFile.value = file
  pendingUrl.value = typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : null
}
function onRemoveImage() {
  fileError.value = null
  if (pendingFile.value) revokePending()
  else emit('remove-image')
  if (!isEdit.value || !serverImageUrl.value) state.imageMode = 'NONE'
}
// Le back repasse le mode à « Aucune » quand l'image requise disparaît : la saisie suit.
watch(serverImageUrl, (url) => {
  if (!url && state.imageMode !== 'NONE') state.imageMode = 'NONE'
})
onBeforeUnmount(revokePending)

const stepClass = 'flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#041D54] text-sm font-black text-white'
const longLabel = (s: string) => s.trim().length > BUTTON_LABEL_SOFT_LIMIT

function onToggleActive(value: boolean) {
  if (isEdit.value) emit('toggle-active', value)
  else activateOnCreate.value = value
}

function toggleSituation(kind: SituationKind) {
  const i = state.situations.findIndex(s => s.kind === kind)
  if (i >= 0) state.situations.splice(i, 1)
  else state.situations.push({ kind, value: SITUATIONS[kind].defaultValue })
}
function setSituationValue(kind: SituationKind, raw: number | string) {
  const s = state.situations.find(x => x.kind === kind)
  if (s) s.value = raw === '' ? '' : Number(raw)
}

onMounted(() => { void loadCatalog() })

function toggleTrigger(t: VideoModalTrigger) {
  const i = state.triggers.indexOf(t)
  if (i >= 0) state.triggers.splice(i, 1)
  else state.triggers.push(t)
}

function addHighlight() {
  if (state.highlights.length >= MAX_HIGHLIGHTS) return
  const used = new Set(state.highlights.map(h => h.icon))
  const icon = HIGHLIGHT_ICONS.find(i => !used.has(i)) ?? 'PARCEL'
  state.highlights.push({ icon, textFr: '', textEn: '' })
}
function removeHighlight(i: number) {
  state.highlights.splice(i, 1)
}

function onSubmit() {
  submitted.value = true
  if (props.busy || hasErrors(errors.value)) return
  // Un nouveau modal Information est montré à tout le monde (une vidéo, à ceux qui n'ont jamais répondu).
  const body: VideoModalInput = isEdit.value || state.type !== 'INFO' ? input.value : { ...input.value, audience: 'EVERYONE' }
  emit('submit', body, !isEdit.value && activateOnCreate.value, pendingFile.value)
}

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : null)

const inputClass = 'mt-1 w-full rounded-btn border border-border bg-bg p-2 text-sm'
const errClass = 'mt-1 text-xs text-danger'
const labelClass = 'block text-xs font-semibold text-text-muted'
</script>

<template>
  <form class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]" novalidate data-test="vm-form" @submit.prevent="onSubmit">
    <div class="flex flex-col gap-5 rounded-card border border-border bg-surface p-5">
      <!-- Actif -->
      <div class="flex items-center justify-between gap-4 rounded-btn border border-border px-4 py-3">
        <span class="text-sm">
          <b class="block font-semibold">Modal actif</b>
          <span class="text-xs text-text-muted">{{ isEdit ? 'Visible dans l’app au prochain lancement' : 'Activer dès la création' }}</span>
        </span>
        <ActiveSwitch :model-value="active" :disabled="busy" label="Modal actif" @update:model-value="onToggleActive" />
      </div>

      <p v-if="isEdit" data-test="vm-type" class="text-xs text-text-muted">
        Type : <b class="font-semibold text-text">{{ TYPE_LABELS[state.type] }}</b> (fixé à la création)
      </p>

      <label :class="labelClass">Nom de la campagne (visible dans l’admin seulement)
        <input v-model="state.name" data-test="vm-name" type="text" :class="inputClass" placeholder="Vidéo d’accueil">
        <span v-if="shown('name')" :class="errClass">{{ shown('name') }}</span>
      </label>

      <!-- Format et taille -->
      <LayoutPicker
        v-model:layout="state.layout" v-model:size-percent="state.sizePercent"
        :error="shown('layout')" :size-error="shown('sizePercent')"
      />
      <p data-test="vm-compat-note" class="-mt-3 rounded-btn border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-text text-pretty">
        Les nouveaux formats et images ne s’affichent que sur la version récente de l’application ; les anciennes versions ne reçoivent pas ces modals.
      </p>

      <!-- Vidéo -->
      <div v-if="!isInfo" class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
        <label :class="labelClass">Lien YouTube
          <input v-model="state.youtubeUrl" data-test="vm-url" type="url" autocomplete="off" :class="inputClass" placeholder="https://youtu.be/…">
        </label>
        <label :class="labelClass">Durée (secondes)
          <input v-model="state.durationSeconds" data-test="vm-duration" type="number" min="0" step="1" :class="[inputClass, 'tabular-nums']" placeholder="204">
          <span v-if="shown('durationSeconds')" :class="errClass">{{ shown('durationSeconds') }}</span>
        </label>
      </div>
      <div v-if="!isInfo" class="-mt-3 flex flex-col gap-1">
        <p v-if="videoId" data-test="vm-url-ok" class="flex items-center gap-1.5 text-xs text-success">
          <CircleCheck class="h-3.5 w-3.5" aria-hidden="true" />
          <span>Vidéo reconnue<template v-if="durationText"> · {{ durationText }}</template></span>
          <a :href="youtubeWatchUrl(videoId)" target="_blank" rel="noopener noreferrer" class="ml-1 inline-flex items-center gap-1 whitespace-nowrap text-primary hover:underline">
            Ouvrir sur YouTube <ExternalLink class="h-3 w-3" aria-hidden="true" />
          </a>
        </p>
        <p v-else-if="urlFilled || shown('youtubeUrl')" data-test="vm-url-error" class="flex items-center gap-1.5 text-xs text-danger">
          <CircleAlert class="h-3.5 w-3.5" aria-hidden="true" />{{ errors.youtubeUrl }}
        </p>
        <p data-test="vm-url-reminder" class="rounded-btn border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-text text-pretty">
          La vidéo doit être <b>publique</b> ou <b>non répertoriée</b> sur YouTube. Une vidéo privée ne se lit pas dans l’app.
        </p>
      </div>

      <!-- Textes -->
      <div class="grid gap-3 sm:grid-cols-2">
        <label :class="labelClass">Titre FR
          <input v-model="state.titleFr" data-test="vm-title-fr" type="text" :class="inputClass" placeholder="Bienvenue sur Yadony">
          <span v-if="shown('titleFr')" :class="errClass">{{ shown('titleFr') }}</span>
        </label>
        <label :class="labelClass">Titre EN
          <input v-model="state.titleEn" data-test="vm-title-en" type="text" :class="inputClass" placeholder="Welcome to Yadony">
        </label>
        <label :class="labelClass">Sous-titre FR
          <input v-model="state.subtitleFr" data-test="vm-subtitle-fr" type="text" :class="inputClass">
        </label>
        <label :class="labelClass">Sous-titre EN
          <input v-model="state.subtitleEn" data-test="vm-subtitle-en" type="text" :class="inputClass">
        </label>
      </div>
      <p class="-mt-3 text-xs text-text-muted">Un texte EN laissé vide est remplacé par le texte FR dans l’app.</p>

      <!-- Information : icône et texte -->
      <template v-if="isInfo">
        <label :class="labelClass">Icône
          <select v-model="state.icon" data-test="vm-icon" class="mt-1 w-full rounded-btn border border-border bg-bg p-2 text-sm sm:w-60">
            <option v-for="ic in MODAL_ICONS" :key="ic" :value="ic">{{ ICON_LABELS[ic] }}</option>
          </select>
          <span v-if="shown('icon')" :class="errClass">{{ shown('icon') }}</span>
        </label>
        <div class="grid gap-3 sm:grid-cols-2">
          <label :class="labelClass">Texte FR
            <textarea v-model="state.bodyFr" data-test="vm-body-fr" rows="5" :maxlength="BODY_MAX_LENGTH + 200" :class="inputClass" />
            <span data-test="vm-body-fr-count" :class="['block text-right text-xs tabular-nums', bodyLength > BODY_MAX_LENGTH ? 'text-danger' : 'text-text-muted']">{{ bodyLength }} / {{ BODY_MAX_LENGTH }}</span>
            <span v-if="shown('bodyFr')" :class="errClass">{{ shown('bodyFr') }}</span>
          </label>
          <label :class="labelClass">Texte EN
            <textarea v-model="state.bodyEn" data-test="vm-body-en" rows="5" :maxlength="BODY_MAX_LENGTH + 200" :class="inputClass" />
            <span data-test="vm-body-en-count" :class="['block text-right text-xs tabular-nums', bodyEnLength > BODY_MAX_LENGTH ? 'text-danger' : 'text-text-muted']">{{ bodyEnLength }} / {{ BODY_MAX_LENGTH }}</span>
            <span v-if="shown('bodyEn')" :class="errClass">{{ shown('bodyEn') }}</span>
          </label>
        </div>

        <ImageSection
          v-model:mode="state.imageMode" v-model:fit="state.imageFit" v-model:alt-fr="state.imageAltFr" v-model:alt-en="state.imageAltEn"
          :preview-url="previewImageUrl" :pending-name="pendingFile?.name ?? null" :is-edit="isEdit" :busy="busy" :file-error="fileError"
          :mode-error="shown('imageMode')" :alt-fr-error="shown('imageAltFr')" :alt-en-error="shown('imageAltEn')"
          @pick="onPickImage" @remove="onRemoveImage"
        />

        <ActionEditor
          prefix="primary" title="Bouton principal" :action="state.primaryAction"
          :label-fr="state.primaryLabelFr" :label-en="state.primaryLabelEn" :errors="primaryErrors"
          @update:action="setPrimary" @update:label-fr="v => state.primaryLabelFr = v" @update:label-en="v => state.primaryLabelEn = v"
        />
        <label class="flex cursor-pointer items-center gap-2.5 text-sm">
          <input v-model="state.secondaryEnabled" data-test="vm-secondary-enabled" type="checkbox" class="accent-primary">
          Ajouter un bouton secondaire
        </label>
        <ActionEditor
          v-if="state.secondaryEnabled"
          prefix="secondary" title="Bouton secondaire" :action="state.secondaryAction"
          :label-fr="state.secondaryLabelFr" :label-en="state.secondaryLabelEn" :errors="secondaryErrors"
          @update:action="setSecondary" @update:label-fr="v => state.secondaryLabelFr = v" @update:label-en="v => state.secondaryLabelEn = v"
        />
      </template>

      <!-- Points forts -->
      <fieldset v-if="!isInfo">
        <legend :class="[labelClass, 'mb-2']">Points forts (0 à 3), icône + texte FR / EN</legend>
        <div
          v-for="(h, i) in state.highlights" :key="i" :data-test="`vm-highlight-${i}`"
          class="mb-2 grid items-center gap-2 sm:grid-cols-[130px_minmax(0,1fr)_minmax(0,1fr)_auto]"
        >
          <select v-model="h.icon" :data-test="`vm-highlight-icon-${i}`" aria-label="Icône" class="rounded-btn border border-border bg-bg p-2 text-sm">
            <option v-for="ic in HIGHLIGHT_ICONS" :key="ic" :value="ic">{{ ICON_LABELS[ic] }}</option>
          </select>
          <input v-model="h.textFr" :data-test="`vm-highlight-fr-${i}`" type="text" aria-label="Texte FR" placeholder="Texte FR" class="rounded-btn border border-border bg-bg p-2 text-sm">
          <input v-model="h.textEn" :data-test="`vm-highlight-en-${i}`" type="text" aria-label="Texte EN" placeholder="Texte EN" class="rounded-btn border border-border bg-bg p-2 text-sm">
          <button
            type="button" :data-test="`vm-highlight-remove-${i}`" aria-label="Retirer ce point fort"
            class="flex h-9 w-9 items-center justify-center rounded-btn text-text-muted hover:bg-surface-elevated hover:text-danger"
            @click="removeHighlight(i)"
          ><Trash2 class="h-4 w-4" aria-hidden="true" /></button>
        </div>
        <button
          type="button" data-test="vm-highlight-add" :disabled="state.highlights.length >= MAX_HIGHLIGHTS"
          class="inline-flex items-center gap-1.5 whitespace-nowrap rounded-btn border border-border px-3 py-1.5 text-sm hover:bg-surface-elevated disabled:opacity-40"
          @click="addHighlight"
        ><Plus class="h-4 w-4" aria-hidden="true" />Ajouter un point fort</button>
        <p v-if="shown('highlights')" :class="errClass">{{ shown('highlights') }}</p>
      </fieldset>

      <!-- Boutons -->
      <div v-if="!isInfo" class="grid gap-3 sm:grid-cols-2">
        <label :class="labelClass">Bouton principal FR (ouvre la vidéo)
          <input v-model="state.primaryLabelFr" data-test="vm-primary-fr" type="text" :class="inputClass">
          <span v-if="shown('primaryLabelFr')" :class="errClass">{{ shown('primaryLabelFr') }}</span>
        </label>
        <label :class="labelClass">Bouton principal EN
          <input v-model="state.primaryLabelEn" data-test="vm-primary-en" type="text" :class="inputClass">
        </label>
        <label :class="labelClass">Bouton secondaire FR
          <input v-model="state.secondaryLabelFr" data-test="vm-secondary-fr" type="text" :class="inputClass">
          <span v-if="shown('secondaryLabelFr')" :class="errClass">{{ shown('secondaryLabelFr') }}</span>
        </label>
        <label :class="labelClass">Bouton secondaire EN
          <input v-model="state.secondaryLabelEn" data-test="vm-secondary-en" type="text" :class="inputClass">
        </label>
      </div>
      <p
        v-if="!isInfo && [state.primaryLabelFr, state.primaryLabelEn, state.secondaryLabelFr, state.secondaryLabelEn].some(longLabel)"
        data-test="vm-label-long" class="-mt-3 text-xs text-warning"
      >Libellé long : il risque de ne pas tenir sur une ligne dans l’app. Visez 2 à 4 mots.</p>

      <!-- Moment, ciblage, fréquence -->
      <section data-test="vm-step-when" class="border-t border-border pt-5">
        <h3 class="mb-3 flex items-center gap-3 text-base font-semibold"><span :class="stepClass">1</span>Quand s’ouvre-t-il ?</h3>
        <TriggerPicker
          :triggers="state.triggers" :situations="state.situations" :is-info="isInfo"
          :error="shown('triggers')" :situations-error="shown('situations')"
          @toggle-trigger="toggleTrigger" @toggle-situation="toggleSituation" @set-situation-value="setSituationValue"
        />
      </section>

      <section data-test="vm-step-who" class="border-t border-border pt-5">
        <h3 class="mb-3 flex items-center gap-3 text-base font-semibold"><span :class="stepClass">2</span>Pour qui ?</h3>
        <AudienceSection
          v-model:connected-only="state.connectedOnly" v-model:min-app-version="state.minAppVersion" v-model:max-app-version="state.maxAppVersion"
          v-model:platforms="state.platforms" v-model:sample-percent="state.samplePercent"
          :fields="fields" :rule="rule" :catalog-loading="catalogLoading" :catalog-error="catalogError" :visitors-excluded="visitorsExcluded"
          :errors="{ conditions: shown('conditions'), minAppVersion: shown('minAppVersion'), maxAppVersion: shown('maxAppVersion'), platforms: shown('platforms'), samplePercent: shown('samplePercent') }"
          @reload-catalog="loadCatalog"
        />
      </section>

      <section data-test="vm-step-frequency" class="border-t border-border pt-5">
        <h3 class="mb-3 flex items-center gap-3 text-base font-semibold"><span :class="stepClass">3</span>À quelle fréquence ?</h3>
        <FrequencySection
          v-model:frequency="state.frequency" v-model:max-displays="state.maxDisplays" v-model:frequency-days="state.frequencyDays"
          v-model:stop-after-answer="state.stopAfterAnswer" v-model:allow-dont-show-again="state.allowDontShowAgain"
          v-model:priority="state.priority" v-model:starts-at="state.startsAt" v-model:ends-at="state.endsAt"
          :is-info="isInfo"
          :errors="{ frequency: shown('frequency'), frequencyDays: shown('frequencyDays'), maxDisplays: shown('maxDisplays'), priority: shown('priority'), period: shown('period') }"
        />
      </section>

      <TargetingSummary
        :parts="summary" :priority="state.priority" :sample-percent="state.samplePercent"
        :ready="estimate.ready.value" :loading="estimate.loading.value" :error="estimate.error.value" :result="estimate.result.value"
        :has-situations="state.situations.length > 0"
        @retry="estimate.refresh"
      />

      <!-- Version et public -->
      <div class="rounded-btn border border-border px-4 py-3 text-sm" data-test="vm-version-box">
        <template v-if="modal">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <span>
              <b class="block font-semibold">Version {{ modal.version }}<template v-if="fmtDate(modal.versionPublishedAt)">, publiée le {{ fmtDate(modal.versionPublishedAt) }}</template></b>
              <span class="text-xs text-text-muted">Public : {{ AUDIENCE_LABELS[modal.audience]?.label ?? modal.audience }}</span>
            </span>
            <button
              type="button" data-test="vm-new-version" :disabled="busy"
              class="whitespace-nowrap rounded-btn border border-primary px-3 py-1.5 text-sm text-primary hover:bg-primary/10 disabled:opacity-40"
              @click="emit('new-version')"
            >Nouvelle version</button>
          </div>
          <p class="mt-2 text-xs text-text-muted text-pretty">« Enregistrer » corrige le modal sans le remontrer. « Nouvelle version » le remontre au public que vous choisissez.</p>
        </template>
        <p v-else class="text-xs text-text-muted text-pretty">
          Version 1, montrée à : <b>{{ isInfo ? 'tout le monde' : AUDIENCE_LABELS.NEVER_ANSWERED.label.toLowerCase() }}</b>. Pour la remontrer plus tard à d’autres publics, publiez une nouvelle version.
        </p>
      </div>

      <div v-if="modal">
        <p :class="[labelClass, 'mb-1.5']">Résultats de la version en cours (personnes distinctes)</p>
        <VideoModalStats :stats="modal.stats" :type="state.type" />
      </div>

      <div class="flex justify-end gap-2 border-t border-border pt-4">
        <slot name="actions" />
        <button
          type="submit" data-test="vm-submit" :disabled="busy"
          class="whitespace-nowrap rounded-btn bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-40"
        >{{ isEdit ? 'Enregistrer' : 'Créer le modal' }}</button>
      </div>
    </div>

    <!-- Aperçu -->
    <div class="lg:sticky lg:top-4">
      <div class="mb-3 flex justify-center gap-1" role="group" aria-label="Langue de l’aperçu">
        <button
          v-for="l in (['fr', 'en'] as const)" :key="l" type="button" :data-test="`vm-lang-${l}`" :aria-pressed="lang === l"
          :class="['rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                   lang === l ? 'bg-primary text-white' : 'bg-surface-elevated text-text-muted hover:text-text']"
          @click="lang = l"
        >{{ l.toUpperCase() }}</button>
      </div>
      <InfoModalPreview
        v-if="isInfo"
        :lang="lang" :icon="state.icon"
        :title-fr="state.titleFr" :title-en="state.titleEn" :subtitle-fr="state.subtitleFr" :subtitle-en="state.subtitleEn"
        :body-fr="state.bodyFr" :body-en="state.bodyEn"
        :primary-label-fr="state.primaryLabelFr" :primary-label-en="state.primaryLabelEn" :primary-kind="state.primaryAction.kind"
        :secondary-enabled="state.secondaryEnabled" :secondary-label-fr="state.secondaryLabelFr" :secondary-label-en="state.secondaryLabelEn"
        :secondary-kind="state.secondaryAction.kind"
        :layout="state.layout" :size-percent="state.sizePercent" :allow-dont-show-again="state.allowDontShowAgain"
        :image-mode="state.imageMode" :image-fit="state.imageFit" :image-url="previewImageUrl"
        :image-alt-fr="state.imageAltFr" :image-alt-en="state.imageAltEn"
      />
      <VideoModalPreview
        v-else
        :lang="lang" :youtube-url="state.youtubeUrl" :duration-seconds="state.durationSeconds"
        :title-fr="state.titleFr" :title-en="state.titleEn" :subtitle-fr="state.subtitleFr" :subtitle-en="state.subtitleEn"
        :primary-label-fr="state.primaryLabelFr" :primary-label-en="state.primaryLabelEn"
        :secondary-label-fr="state.secondaryLabelFr" :secondary-label-en="state.secondaryLabelEn"
        :highlights="state.highlights" :layout="state.layout" :size-percent="state.sizePercent" :allow-dont-show-again="state.allowDontShowAgain"
      />
      <p class="mt-2 text-center text-xs text-text-muted">Aperçu en direct, {{ lang === 'fr' ? 'en français' : 'en anglais' }}.</p>
    </div>
  </form>
</template>
