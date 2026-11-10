<script setup lang="ts">
import AudienceRuleBuilder from '@/features/broadcast/components/AudienceRuleBuilder.vue'
import type { useAudienceRule } from '@/features/broadcast/composables/useAudienceRule'
import type { AudienceField } from '@/features/broadcast/types/index'
import ActiveSwitch from '@/features/video-modals/components/ActiveSwitch.vue'
import { MODAL_PLATFORMS, PLATFORM_LABELS, SAMPLE_MAX, SAMPLE_MIN, type ModalPlatform } from '@/features/video-modals/types/index'

/**
 * « Pour qui ? » : les conditions de la page Communications (même constructeur de règles, même catalogue
 * de champs), plus trois réglages propres aux modals, stockés à part de l'arbre de règles : version de
 * l'app, système et tirage au sort.
 */
defineProps<{
  fields: AudienceField[]
  rule: ReturnType<typeof useAudienceRule>
  catalogLoading: boolean
  catalogError: string | null
  /** Conditions, situations, tirage ou « connectées seulement » : les visiteurs sans compte ne voient pas ce modal. */
  visitorsExcluded: boolean
  errors: Partial<Record<'conditions' | 'minAppVersion' | 'maxAppVersion' | 'platforms' | 'samplePercent', string | undefined>>
}>()
const emit = defineEmits<{ 'reload-catalog': [] }>()

const connectedOnly = defineModel<boolean>('connectedOnly', { required: true })
const minAppVersion = defineModel<string>('minAppVersion', { required: true })
const maxAppVersion = defineModel<string>('maxAppVersion', { required: true })
const platforms = defineModel<ModalPlatform[]>('platforms', { required: true })
const samplePercent = defineModel<number | string>('samplePercent', { required: true })

function togglePlatform(p: ModalPlatform) {
  platforms.value = platforms.value.includes(p) ? platforms.value.filter(x => x !== p) : [...platforms.value, p]
}
function onSample(e: Event) {
  const raw = (e.target as HTMLInputElement).value
  samplePercent.value = raw === '' ? '' : Number(raw)
}

const inputClass = 'rounded-btn border border-border bg-bg p-2 text-sm'
const errClass = 'mt-1 text-xs text-danger'
const rowClass = 'flex flex-wrap items-center gap-2 rounded-btn bg-surface-elevated p-2.5 text-sm'
</script>

<template>
  <fieldset data-test="vm-who">
    <legend class="sr-only">Pour qui ?</legend>
    <p class="mb-3 text-xs text-text-muted text-pretty">
      Les mêmes conditions que la page Communications, que vous combinez en « toutes » (ET) ou « au moins une » (OU).
      En plus : version de l’app, système et tirage au sort.
    </p>

    <div v-if="catalogLoading" data-test="vm-catalog-loading" role="status" class="rounded-btn border border-border px-3 py-2 text-sm text-text-muted">
      Chargement des conditions…
    </div>
    <div
      v-else-if="catalogError && fields.length === 0" data-test="vm-catalog-error" role="alert"
      class="flex flex-wrap items-center justify-between gap-2 rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
    >
      <span>{{ catalogError }}</span>
      <button
        type="button" data-test="vm-catalog-retry"
        class="whitespace-nowrap rounded-btn border border-danger/40 px-3 py-1 text-sm hover:bg-danger/10"
        @click="emit('reload-catalog')"
      >Réessayer</button>
    </div>
    <AudienceRuleBuilder v-else :fields="fields" :rule="rule" />
    <p v-if="errors.conditions" data-test="vm-conditions-error" :class="errClass">{{ errors.conditions }}</p>

    <div class="mt-4 space-y-2" data-test="vm-extra-rules">
      <p class="text-xs font-bold uppercase tracking-wide text-text-muted">En plus, propre aux modals</p>

      <div :class="rowClass">
        <b class="w-44 shrink-0">Version de l’application</b>
        <label class="flex items-center gap-1.5">au moins
          <input v-model="minAppVersion" data-test="vm-min-version" type="text" inputmode="decimal" placeholder="1.0.6" autocomplete="off" :class="[inputClass, 'w-24 tabular-nums']">
        </label>
        <label class="flex items-center gap-1.5">au plus
          <input v-model="maxAppVersion" data-test="vm-max-version" type="text" inputmode="decimal" placeholder="1.2.0" autocomplete="off" :class="[inputClass, 'w-24 tabular-nums']">
        </label>
        <span class="text-xs text-text-muted">Format 1.2.3, facultatif.</span>
      </div>
      <p v-if="errors.minAppVersion" data-test="vm-min-version-error" :class="errClass">{{ errors.minAppVersion }}</p>
      <p v-if="errors.maxAppVersion" data-test="vm-max-version-error" :class="errClass">{{ errors.maxAppVersion }}</p>

      <div :class="rowClass" role="group" aria-label="Système">
        <b class="w-44 shrink-0">Système</b>
        <label
          v-for="p in MODAL_PLATFORMS" :key="p" :data-test="`vm-platform-${p}`"
          :class="['inline-flex cursor-pointer items-center gap-2 rounded-full border-2 px-3.5 py-1 text-sm font-semibold focus-within:outline focus-within:outline-2 focus-within:outline-primary',
                   platforms.includes(p) ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-bg hover:bg-surface-elevated']"
        >
          <input type="checkbox" class="sr-only" :checked="platforms.includes(p)" @change="togglePlatform(p)">
          {{ PLATFORM_LABELS[p] }}
        </label>
        <span class="text-xs text-text-muted">Aucun coché : tous les systèmes.</span>
      </div>
      <p v-if="errors.platforms" :class="errClass">{{ errors.platforms }}</p>

      <div :class="rowClass">
        <b class="w-44 shrink-0">Tirage au sort</b>
        <span>pour</span>
        <input
          :value="samplePercent" data-test="vm-sample" type="number" :min="SAMPLE_MIN" :max="SAMPLE_MAX" step="1" aria-label="Pourcentage de personnes tirées"
          :class="[inputClass, 'w-20 text-center font-bold tabular-nums text-accent']" @input="onSample"
        >
        <span>% des personnes</span>
        <span class="text-xs text-text-muted text-pretty">Stable : une même personne a toujours le même résultat pour cette campagne.</span>
      </div>
      <p v-if="errors.samplePercent" data-test="vm-sample-error" :class="errClass">{{ errors.samplePercent }}</p>
    </div>

    <div class="mt-4 flex items-center justify-between gap-4 rounded-btn border border-border px-4 py-3">
      <span class="text-sm">
        <b class="block font-semibold">Seulement les personnes connectées</b>
        <span class="text-xs text-text-muted">Les conditions reposent sur le compte : un visiteur sans compte ne voit pas ce modal.</span>
      </span>
      <ActiveSwitch v-model="connectedOnly" data-test="vm-connected-only" label="Seulement les personnes connectées" />
    </div>
    <p data-test="vm-visitors-note" class="mt-2 text-xs text-text-muted text-pretty">
      <template v-if="visitorsExcluded">Les visiteurs sans compte ne verront pas ce modal (conditions, situations, tirage ou option ci-dessus).</template>
      <template v-else>Sans condition ni tirage, ce modal reste visible aux visiteurs sans compte.</template>
    </p>
  </fieldset>
</template>
