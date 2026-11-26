<script setup lang="ts">
import { computed, ref } from 'vue'
import ModalShell from '@/features/video-modals/components/ModalShell.vue'
import PhoneFrame from '@/features/video-modals/components/PhoneFrame.vue'
import { localized } from '@/features/video-modals/lib/form'
import { MODAL_ICON_STYLES } from '@/features/video-modals/lib/icons'
import { parcelRoleLabel, screenLabel } from '@/features/video-modals/lib/labels'
import { codeExistsFor, parcelScreenShown, withParcelExamples } from '@/features/video-modals/lib/parcelPreview'
import { PARCEL_ROLES, PARCEL_SCREENS, isParcelStepTrigger, type ImageFit, type ImageMode, type InfoScreen, type ModalIcon, type ModalLayout, type VideoModalActionKind } from '@/features/video-modals/types/index'

/**
 * Aperçu du modal Information tel que l'app le montre : feuille du bas avec halo et icône, titre,
 * sous-titre, texte, puis un ou deux boutons empilés en pleine largeur. Un libellé vide devient
 * « OK » seulement pour l'action Fermer (même repli que le back).
 */
const props = defineProps<{
  lang: 'fr' | 'en'
  icon: ModalIcon
  titleFr: string
  titleEn: string
  subtitleFr: string
  subtitleEn: string
  bodyFr: string
  bodyEn: string
  primaryLabelFr: string
  primaryLabelEn: string
  primaryKind: VideoModalActionKind
  /** Écran du bouton principal : un bouton du colis sans libellé montre le libellé de la liste admin. */
  primaryScreen?: InfoScreen | null
  secondaryScreen?: InfoScreen | null
  /** Au moins une étape du colis est cochée : le sélecteur de rôle de l'aperçu apparaît. */
  parcelSteps?: boolean
  /** Rôles visés par la campagne : seuls ceux-là sont proposés dans l'aperçu (les trois si aucun). */
  parcelRoles?: string[]
  /** Déclencheurs cochés : « Envoyer le code » n'existe pas à l'étape « accepté ». */
  triggers?: string[]
  secondaryEnabled: boolean
  secondaryLabelFr: string
  secondaryLabelEn: string
  secondaryKind: VideoModalActionKind
  layout?: ModalLayout
  sizePercent?: number | null
  imageMode?: ImageMode
  imageFit?: ImageFit
  /** Image envoyée, ou fichier choisi avant la création. */
  imageUrl?: string | null
  imageAltFr?: string
  imageAltEn?: string
  /** Case « Ne plus afficher » sous le texte, avant les boutons. */
  allowDontShowAgain?: boolean
}>()

// Rôle regardé dans l'aperçu : seuls les rôles visés sont proposés, le premier par défaut.
const roleOptions = computed<string[]>(() => ((props.parcelRoles ?? []).length > 0 ? props.parcelRoles! : [...PARCEL_ROLES]))
const picked = ref<string | null>(null)
const role = computed(() => (picked.value && roleOptions.value.includes(picked.value) ? picked.value : roleOptions.value[0]!))
// Sans étape du colis, l'app ne remplit pas les variables : elles restent entre accolades.
const t = (fr: string, en: string) => {
  const text = localized(fr, en, props.lang)
  return props.parcelSteps ? withParcelExamples(text) : text
}
const style = computed(() => MODAL_ICON_STYLES[props.icon] ?? MODAL_ICON_STYLES.INFO)
const title = computed(() => t(props.titleFr, props.titleEn).trim() || (props.lang === 'en' ? 'Modal title' : 'Titre du modal'))
const subtitle = computed(() => t(props.subtitleFr, props.subtitleEn).trim())
const body = computed(() => t(props.bodyFr, props.bodyEn).trim() || (props.lang === 'en' ? 'Modal text.' : 'Texte du modal.'))
function label(fr: string, en: string, kind: VideoModalActionKind, screen?: InfoScreen | null) {
  const own = t(fr, en).trim()
  if (own) return own
  if (kind === 'CLOSE') return 'OK'
  return kind === 'SCREEN' && screen && PARCEL_SCREENS.includes(screen) ? screenLabel(screen) : ''
}
const codeExists = computed(() => codeExistsFor(props.triggers ?? []))
// Même règle que l'app : un bouton du colis qui ne s'applique pas à ce rôle est masqué ; le secondaire remonte,
// sinon le modal garde un seul bouton « OK ».
function shown(kind: VideoModalActionKind, screen?: InfoScreen | null, enabled = true) {
  if (!enabled) return false
  if (!props.parcelSteps || kind !== 'SCREEN' || !screen || !PARCEL_SCREENS.includes(screen)) return true
  return parcelScreenShown(screen, role.value, { codeExists: codeExists.value })
}
const buttons = computed(() => {
  const p = shown(props.primaryKind, props.primaryScreen)
  const sec = shown(props.secondaryKind, props.secondaryScreen, props.secondaryEnabled)
  const first = { fr: props.primaryLabelFr, en: props.primaryLabelEn, kind: props.primaryKind, screen: props.primaryScreen }
  const second = { fr: props.secondaryLabelFr, en: props.secondaryLabelEn, kind: props.secondaryKind, screen: props.secondaryScreen }
  if (p) return { primary: first, secondary: sec ? second : null }
  if (sec) return { primary: second, secondary: null }
  return { primary: { fr: '', en: '', kind: 'CLOSE' as VideoModalActionKind, screen: null }, secondary: null }
})
const primary = computed(() => label(buttons.value.primary.fr, buttons.value.primary.en, buttons.value.primary.kind, buttons.value.primary.screen))
const secondary = computed(() => (buttons.value.secondary ? label(buttons.value.secondary.fr, buttons.value.secondary.en, buttons.value.secondary.kind, buttons.value.secondary.screen) : ''))
// Avertissements sans blocage : le bouton choisi n'apparaîtra pas à certains rôles visés.
const chosen = computed(() => [props.primaryScreen, props.secondaryEnabled ? props.secondaryScreen : null].filter((x): x is InfoScreen => !!x))
const warnSender = computed(() => !!props.parcelSteps && (props.parcelRoles ?? []).length > 0 && !props.parcelRoles!.includes('SENDER')
  && chosen.value.some(s => s === 'PARCEL_QR' || s === 'PARCEL_SEND_CODE'))
const warnCode = computed(() => {
  const steps = (props.triggers ?? []).filter(isParcelStepTrigger)
  return !!props.parcelSteps && chosen.value.includes('PARCEL_SEND_CODE') && steps.length > 0 && steps.every(x => x === 'PARCEL_ACCEPTED')
})
const mode = computed(() => props.imageMode ?? 'NONE')
const imageClass = computed(() => (props.imageFit === 'CONTAIN' ? 'object-contain' : 'object-cover'))
// Texte alternatif : repli sur le titre, comme l'app.
const alt = computed(() => t(props.imageAltFr ?? '', props.imageAltEn ?? '').trim() || title.value)
const placeholder = 'Image'
</script>

<template>
  <div v-if="parcelSteps" data-test="vm-preview-roles" class="mb-3 flex flex-wrap items-center justify-center gap-1" role="group" aria-label="Rôle de l’aperçu">
    <span class="mr-1 text-xs text-text-muted">Aperçu pour :</span>
    <button
      v-for="r in roleOptions" :key="r" type="button" :data-test="`vm-preview-role-${r}`" :aria-pressed="role === r"
      :class="['rounded-full px-3 py-1 text-xs font-semibold transition-colors',
               role === r ? 'bg-primary text-white' : 'bg-surface-elevated text-text-muted hover:text-text']"
      @click="picked = r"
    >{{ parcelRoleLabel(r) }}</button>
  </div>
  <p v-if="warnSender" data-test="vm-preview-warn-sender" class="mb-2 text-center text-xs text-warning text-pretty">
    Les rôles visés n’incluent pas l’expéditeur : le QR et l’envoi du code sont réservés à l’expéditeur, ce bouton n’apparaîtra pas.
  </p>
  <p v-if="warnCode" data-test="vm-preview-warn-code" class="mb-2 text-center text-xs text-warning text-pretty">
    Le code de retrait n’existe pas encore à l’étape « Colis accepté » : « Envoyer le code » n’apparaîtra pas.
  </p>
  <PhoneFrame :lang="lang">
    <ModalShell :layout="layout" :size-percent="sizePercent" :close-label="lang === 'en' ? 'Close' : 'Fermer'">
      <!-- Affiche : l'image occupe tout le modal au-dessus des boutons, ni titre ni texte -->
      <div
        v-if="mode === 'POSTER'" data-test="vm-preview-poster"
        class="relative -mx-4 min-h-[200px] flex-1 overflow-hidden bg-[#F6F7FA]"
        :class="layout === 'FULLSCREEN' ? '' : 'rounded-t-[26px]'"
      >
        <img v-if="imageUrl" :src="imageUrl" :alt="alt" data-test="vm-preview-image" :class="['absolute inset-0 h-full w-full', imageClass]">
        <span v-else class="absolute inset-0 flex items-center justify-center text-sm text-[#5E6788]">{{ placeholder }}</span>
      </div>
      <template v-else>
        <!-- Bannière : au-dessus du titre et du texte, remplace le halo -->
        <div
          v-if="mode === 'TOP'" data-test="vm-preview-banner"
          class="relative -mx-4 h-[132px] shrink-0 overflow-hidden bg-[#F6F7FA]"
          :class="layout === 'FULLSCREEN' ? '' : 'rounded-t-[26px]'"
        >
          <img v-if="imageUrl" :src="imageUrl" :alt="alt" data-test="vm-preview-image" :class="['absolute inset-0 h-full w-full', imageClass]">
          <span v-else class="absolute inset-0 flex items-center justify-center text-sm text-[#5E6788]">{{ placeholder }}</span>
        </div>
        <div
          v-else data-test="vm-preview-halo" class="mx-auto flex h-[84px] w-[84px] shrink-0 items-center justify-center rounded-full"
          :class="layout === 'FULLSCREEN' ? 'mt-3' : '-mt-[30px]'"
          :style="{ background: style.bg }"
        >
          <component :is="style.icon" class="h-10 w-10" :style="{ color: style.fg }" aria-hidden="true" />
        </div>
        <h3 data-test="vm-preview-title" class="mx-1 mb-1.5 mt-3 text-center text-[21px] font-bold leading-tight tracking-tight [text-wrap:balance]">{{ title }}</h3>
        <p v-if="subtitle" data-test="vm-preview-subtitle" class="mb-2 text-center text-[13.5px] text-[#5E6788] [text-wrap:pretty]">{{ subtitle }}</p>
        <div class="min-h-0 flex-1 overflow-y-auto">
          <p data-test="vm-preview-body" class="whitespace-pre-line pb-2 text-center text-[14px] leading-snug text-[#0B1535] [text-wrap:pretty]">{{ body }}</p>
        </div>
      </template>
      <div class="mt-auto flex shrink-0 flex-col gap-2 pt-2">
        <div v-if="allowDontShowAgain" data-test="vm-preview-dontshow" class="flex items-center justify-center gap-2 text-[13px] text-[#5E6788]">
          <span class="h-[18px] w-[18px] rounded-[5px] border-2 border-[#AEB6C9] bg-white" aria-hidden="true" />{{ lang === 'en' ? 'Don’t show again' : 'Ne plus afficher' }}
        </div>
        <div data-test="vm-preview-primary" class="flex h-[46px] items-center justify-center overflow-hidden text-ellipsis whitespace-nowrap rounded-full bg-[#0B5FFF] px-4 text-[15px] font-extrabold text-white">{{ primary }}</div>
        <div v-if="buttons.secondary" data-test="vm-preview-secondary" class="flex h-[46px] items-center justify-center overflow-hidden text-ellipsis whitespace-nowrap rounded-full border-[1.5px] border-[#E3E7F0] bg-white px-4 text-[15px] font-extrabold">{{ secondary }}</div>
      </div>
    </ModalShell>
  </PhoneFrame>
</template>
