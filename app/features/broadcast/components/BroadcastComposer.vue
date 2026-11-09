<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, toRef, watch } from 'vue'
import ConfirmActionDialog from '@/components/ui/ConfirmActionDialog.vue'
import AudienceRuleBuilder from '@/features/broadcast/components/AudienceRuleBuilder.vue'
import BroadcastRecipientsDrawer from '@/features/broadcast/components/BroadcastRecipientsDrawer.vue'
import BroadcastUserPicker from '@/features/broadcast/components/BroadcastUserPicker.vue'
import { serializeRule } from '@/features/broadcast/composables/audienceRule'
import { messageFor, PRESET_LANGUAGES, withLanguage, type PresetLanguage } from '@/features/broadcast/composables/audiencePresets'
import { useAudienceRule } from '@/features/broadcast/composables/useAudienceRule'
import type {
  AudienceField, AudiencePreset, BroadcastAudience, BroadcastSegment, BroadcastTarget, RuleGroup,
} from '@/features/broadcast/types/index'

type Mode = 'RULES' | 'SEGMENT' | 'USER'
const MODE_LABELS: Record<Mode, string> = {
  RULES: 'Construire une cible',
  SEGMENT: 'Segment enregistré',
  USER: 'Un utilisateur précis',
}
/** Délai après la dernière modification avant de recalculer l'aperçu. */
const PREVIEW_DEBOUNCE_MS = 400

/* eslint-disable no-unused-vars -- noms de paramètres d'un type de fonction */
type SaveSegmentFn = (name: string, description: string | null, rule: RuleGroup) => Promise<string | null>
type UpdateSegmentFn = (id: string, name: string, description: string | null, rule: RuleGroup) => Promise<string | null>
/* eslint-enable no-unused-vars */

const props = withDefaults(defineProps<{
  /** Dernier aperçu reçu (un nouvel objet à chaque réponse), null tant qu'il n'y en a pas. */
  audience: BroadcastAudience | null
  busy?: boolean
  previewing?: boolean
  /** Catalogue des critères de ciblage (back). */
  fields?: AudienceField[]
  segments?: BroadcastSegment[]
  /** Audiences prêtes et modèles de message (back) ; vide tant que le back ne les fournit pas. */
  presets?: AudiencePreset[]
  /** Segment dont la règle est en cours de modification (depuis le panneau des segments). */
  editSegment?: BroadcastSegment | null
  /** Enregistre un segment ; renvoie le message d'erreur à afficher, ou null. */
  saveSegmentFn?: SaveSegmentFn
  updateSegmentFn?: UpdateSegmentFn
  /** Pré-remplissage depuis la fiche utilisateur (`?target=USER&userId=`). */
  initialUserId?: string | null
  /** Nom du destinataire renvoyé par la preview (nouveau back), absent sinon. */
  targetUserName?: string | null
  /**
   * La preview a répondu `targetUserReachable: false` (banni, suppression demandée) : l'envoi est
   * bloqué. Booléen « négatif » exprès : un booléen Vue absent vaut false, soit « pas bloqué ».
   */
  targetUserUnreachable?: boolean
  /** Recherche par nom possible (USER_VIEW) ; sinon seul l'identifiant collé est accepté. */
  canSearchUsers?: boolean
  /** Droit USER_VIEW : la liste nominative et l'export CSV exposent des données personnelles. */
  canViewRecipients?: boolean
}>(), { fields: () => [], segments: () => [], presets: () => [], editSegment: null, initialUserId: null, targetUserName: null, saveSegmentFn: undefined, updateSegmentFn: undefined })
const emit = defineEmits<{
  preview: [target: BroadcastTarget]
  send: [title: string, body: string, target: BroadcastTarget, push: boolean]
  'edit-done': []
}>()

const title = ref('')
const body = ref('')
const mode = ref<Mode>(props.initialUserId ? 'USER' : 'RULES')
const userId = ref(props.initialUserId ?? '')
const segmentId = ref('')
const confirmOpen = ref(false)
const drawerOpen = ref(false)
const viewButton = ref<HTMLButtonElement | null>(null)
async function closeDrawer() {
  drawerOpen.value = false
  await nextTick()
  viewButton.value?.focus()
}
const rule = useAudienceRule(toRef(props, 'fields'))

// Faire aussi sonner les téléphones. Par défaut, seulement pour un message adressé à une
// personne : une diffusion large (concours, info de service) arrive dans la boîte Annonces
// sans réveiller tout le monde. Le défaut suit la cible tant que l'admin n'a pas choisi.
const pushDefaultFor = (m: Mode) => m === 'USER'
const push = ref(pushDefaultFor(mode.value))
const pushTouched = ref(false)
watch(mode, (m) => {
  if (!pushTouched.value) push.value = pushDefaultFor(m)
})

// Seuls les champs pertinents pour le mode choisi entrent dans le ciblage : un champ laissé
// rempli après un changement de mode ne doit pas fuiter dans la requête. Un `RULE` porte soit
// la règle, soit l'identifiant du segment, jamais les deux.
const target = computed<BroadcastTarget>(() => {
  if (mode.value === 'USER') return { type: 'USER', userId: userId.value }
  if (mode.value === 'SEGMENT') return { type: 'RULE', segmentId: segmentId.value }
  return { type: 'RULE', rule: rule.root.value }
})
// Empreinte du ciblage (sans les identifiants locaux des nœuds) : sert à savoir si une
// estimation correspond encore à ce qui partirait.
const targetKey = computed(() => {
  if (mode.value === 'USER') return `U:${userId.value}`
  // updatedAt : un segment modifié ailleurs rend l'estimation périmée (la règle a changé).
  if (mode.value === 'SEGMENT') return `S:${segmentId.value}:${selectedSegment.value?.updatedAt ?? ''}`
  return `R:${JSON.stringify(serializeRule(rule.root.value))}`
})
const previewable = computed(() => {
  if (mode.value === 'USER') return userId.value.trim().length > 0
  if (mode.value === 'SEGMENT') return segmentId.value !== ''
  return rule.isComplete.value
})
const incompleteRule = computed(() => mode.value === 'RULES' && !rule.isComplete.value)

// Aperçu automatique pour les règles et les segments, 400 ms après la dernière modification et
// seulement si la règle est complète. Le mode utilisateur reste manuel : on ne tape pas un
// identifiant partiel contre le back.
const requestedFor = ref<string | null>(null)
let timer: ReturnType<typeof setTimeout> | null = null
function clearTimer() {
  if (timer !== null) clearTimeout(timer)
  timer = null
}
function requestPreview() {
  requestedFor.value = targetKey.value
  emit('preview', target.value)
}
watch([targetKey, previewable, mode], () => {
  clearTimer()
  if (mode.value === 'USER' || !previewable.value) return
  timer = setTimeout(() => { timer = null; requestPreview() }, PREVIEW_DEBOUNCE_MS)
}, { immediate: true })
onBeforeUnmount(clearTimer)

// Le ciblage pour lequel la dernière estimation a été demandée (et non celui d'aujourd'hui :
// l'admin a pu modifier la règle pendant que la réponse voyageait). Un ciblage qui a changé
// depuis rend le compteur mensonger : on le considère alors comme non estimé.
const estimatedFor = ref<string | null>(null)
watch(() => props.audience, (a) => {
  estimatedFor.value = a === null ? null : (requestedFor.value ?? targetKey.value)
}, { immediate: true })
const freshAudience = computed<BroadcastAudience | null>(() =>
  props.audience !== null && estimatedFor.value === targetKey.value ? props.audience : null)
const freshCount = computed<number | null>(() => freshAudience.value?.recipientCount ?? null)
const estimateIsStale = computed(() => props.audience !== null && freshAudience.value === null)
const targetUnreachable = computed(() =>
  mode.value === 'USER' && freshCount.value !== null && props.targetUserUnreachable)
const shownUserName = computed(() =>
  mode.value === 'USER' && freshCount.value !== null && props.targetUserName ? props.targetUserName : null)

const plural = (n: number, one: string, many: string) => (n > 1 ? many : one)
const countLabel = computed(() => {
  const a = freshAudience.value
  if (!a) return ''
  const n = a.recipientCount
  const base = `${n} ${plural(n, 'personne ciblée', 'personnes ciblées')}`
  if (typeof a.pushReachableCount !== 'number') return base
  return `${base}, dont ${a.pushReachableCount} ${plural(a.pushReachableCount, 'joignable', 'joignables')} en push`
})

// Phrase de contrôle exigée pour la cible la plus large : une règle sans condition (tous les
// comptes actifs). Réservée à ce cas : l'imposer partout la banaliserait.
const BROADCAST_ALL_PHRASE = 'DIFFUSER A TOUS'
const needsControlPhrase = computed(() =>
  (mode.value === 'RULES' && rule.conditionCount.value === 0)
  || (mode.value === 'SEGMENT' && selectedSegment.value !== null && countWireConditions(selectedSegment.value.rule) === 0))

// L'estimation fraîche est OBLIGATOIRE avant tout envoi : c'est elle qui oblige à VOIR le
// nombre de personnes touchées avant de s'engager. Une notification push ne se rappelle pas.
const canSend = computed(() =>
  title.value.trim().length > 0
  && body.value.trim().length > 0
  && !props.busy
  && freshCount.value !== null
  && !targetUnreachable.value,
)

function onSendClick() {
  if (canSend.value) confirmOpen.value = true
}

function confirmSend() {
  confirmOpen.value = false
  emit('send', title.value, body.value, target.value, push.value)
}

// Un broadcast est irrattrapable une fois parti : la confirmation nomme toujours le nombre de
// personnes touchées, et celui des téléphones qui sonneront si le push est coché.
const confirmMessage = computed(() => {
  const a = freshAudience.value
  if (!a) {
    return 'Le nombre de destinataires n’a pas été estimé pour ce ciblage. '
      + 'Ce message sera envoyé immédiatement et ne pourra pas être annulé.'
  }
  const n = a.recipientCount
  const pushPart = typeof a.pushReachableCount === 'number' ? ` (${a.pushReachableCount} en push)` : ''
  return `Envoyer à ${n} ${plural(n, 'personne', 'personnes')}${pushPart}. `
    + (push.value ? 'Leur téléphone sonnera. ' : 'Il arrivera dans la boîte Annonces, sans sonnerie. ')
    + 'Cette action est irréversible et ne pourra pas être annulée.'
})

/** Conditions d'une règle JSON du back, sous-groupes compris. */
function countWireConditions(r: unknown): number {
  const children = (r as { children?: unknown } | null)?.children
  if (!Array.isArray(children)) return 0
  return children.reduce<number>((n, c) => n + (Array.isArray((c as { children?: unknown }).children) ? countWireConditions(c) : 1), 0)
}

// Raccourcis : chargent un préréglage dans le constructeur (modifiable ensuite).
const shortcuts = [
  { id: 'all', label: 'Tous', apply: () => rule.presetAll() },
  { id: 'senders', label: 'Expéditeurs', apply: () => rule.presetSenders() },
  { id: 'travelers', label: 'Voyageurs', apply: () => rule.presetTravelers() },
  { id: 'corridor', label: 'Corridor', apply: () => rule.presetCorridor('', '') },
]

// Audiences prêtes : l'audience est chargée dans le constructeur (modifiable ensuite) et le modèle de
// message remplit le titre et le texte. Le texte déjà saisi n'est jamais écrasé en silence : tant que
// titre et texte sont vides ou inchangés depuis le dernier modèle, ils suivent le choix ; sinon le
// bouton « Utiliser le modèle » les remplace à la demande.
const presetKey = ref('')
const presetLang = ref<PresetLanguage>('fr')
const limitToLanguage = ref(true)
const selectedPreset = computed(() => props.presets.find((p) => p.key === presetKey.value) ?? null)
const appliedMessage = ref<{ title: string, body: string }>({ title: '', body: '' })
const messageUntouched = computed(() =>
  (title.value === '' && body.value === '')
  || (title.value === appliedMessage.value.title && body.value === appliedMessage.value.body))
const presetMessage = computed(() => (selectedPreset.value ? messageFor(selectedPreset.value, presetLang.value) : null))

function applyPresetMessage() {
  const m = presetMessage.value
  if (!m) return
  title.value = m.title
  body.value = m.body
  appliedMessage.value = { title: m.title, body: m.body }
}
function applyPresetRule() {
  const p = selectedPreset.value
  if (!p) return
  rule.load(limitToLanguage.value ? withLanguage(p.rule, presetLang.value) : p.rule)
  mode.value = 'RULES'
}
function applyPreset() {
  const wasUntouched = messageUntouched.value
  applyPresetRule()
  if (wasUntouched) applyPresetMessage()
}
watch([presetKey, presetLang, limitToLanguage], () => {
  if (selectedPreset.value) applyPreset()
})
// Un modèle disparu de la liste (rechargement) : on oublie le choix plutôt que d'envoyer à l'aveugle.
watch(() => props.presets, (list) => {
  if (presetKey.value && !list.some((p) => p.key === presetKey.value)) presetKey.value = ''
})

// Mode segment : la règle du segment choisi est copiée dans le constructeur (jamais modifiée sur place).
const selectedSegment = computed(() => props.segments.find((s) => s.id === segmentId.value) ?? null)
// Segment supprimé entre-temps : on oublie le choix, sinon l'envoi partirait vers un 404.
watch(() => props.segments, (list) => {
  if (segmentId.value && !list.some((s) => s.id === segmentId.value)) segmentId.value = ''
})
function editSelectedRules() {
  if (!selectedSegment.value) return
  rule.load(selectedSegment.value.rule)
  mode.value = 'RULES'
}

// Enregistrer la règle courante comme segment.
const saveOpen = ref(false)
const segName = ref('')
const segDescription = ref('')
const segError = ref<string | null>(null)
const segSaving = ref(false)
async function saveSegment() {
  if (!props.saveSegmentFn) return
  segSaving.value = true
  segError.value = await props.saveSegmentFn(segName.value.trim(), segDescription.value.trim() || null, rule.root.value)
  segSaving.value = false
  if (segError.value === null) {
    saveOpen.value = false
    segName.value = ''
    segDescription.value = ''
  }
}

// Modification d'un segment existant (depuis le panneau).
watch(() => props.editSegment, (s) => {
  if (!s) return
  rule.load(s.rule)
  mode.value = 'RULES'
  segError.value = null
}, { immediate: true })
async function updateSegment() {
  const s = props.editSegment
  if (!s || !props.updateSegmentFn) return
  segSaving.value = true
  segError.value = await props.updateSegmentFn(s.id, s.name, s.description, rule.root.value)
  segSaving.value = false
  if (segError.value === null) emit('edit-done')
}

const btn = 'whitespace-nowrap rounded-btn border border-border px-3 py-2 text-sm hover:bg-surface-elevated disabled:opacity-40'
</script>

<template>
  <div class="rounded-card border border-border bg-surface p-6 space-y-4">
    <section
      v-if="presets.length" data-test="presets" aria-label="Audiences prêtes"
      class="space-y-3 rounded-btn border border-border bg-bg p-4"
    >
      <div class="flex flex-wrap items-end gap-3">
        <label class="block min-w-[14rem] flex-1 text-sm text-text-muted">Audience prête
          <select
            v-model="presetKey" data-test="preset-select" :disabled="busy"
            class="mt-1 w-full rounded-btn border border-border bg-surface p-2 text-sm disabled:opacity-40"
          >
            <option value="">Choisir une audience prête…</option>
            <option v-for="p in presets" :key="p.key" :value="p.key">{{ p.label }}</option>
          </select>
        </label>
        <div class="flex gap-2" role="group" aria-label="Langue du message">
          <button
            v-for="l in PRESET_LANGUAGES" :key="l.code" type="button" :data-test="`preset-lang-${l.code}`"
            :aria-pressed="presetLang === l.code" :disabled="busy"
            :class="[btn, presetLang === l.code ? 'border-primary bg-primary/10 text-text' : 'text-text-muted']"
            @click="presetLang = l.code"
          >{{ l.label }}</button>
        </div>
      </div>
      <template v-if="selectedPreset">
        <p data-test="preset-description" class="text-sm text-text-muted text-pretty">{{ selectedPreset.description }}</p>
        <label class="flex items-start gap-2 text-sm text-text">
          <input v-model="limitToLanguage" data-test="preset-limit-language" type="checkbox" :disabled="busy" class="mt-0.5 disabled:opacity-40">
          <span>Limiter aux comptes dont l’application est dans cette langue
            <span class="block text-text-muted text-pretty">Le message est rédigé dans une seule langue : sans cette limite, tout le monde le reçoit dans cette langue.</span>
          </span>
        </label>
        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button" data-test="preset-use-message" :disabled="busy || !presetMessage" :class="btn"
            @click="applyPresetMessage"
          >Utiliser le modèle de message</button>
          <span v-if="!messageUntouched" data-test="preset-message-kept" class="text-sm text-text-muted text-pretty">
            Votre texte a été conservé.
          </span>
        </div>
      </template>
    </section>

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
        v-model="mode" data-test="broadcast-target" :disabled="busy"
        class="mt-1 w-full rounded-btn border border-border bg-bg p-2 text-sm disabled:opacity-40"
      >
        <option v-for="(label, value) in MODE_LABELS" :key="value" :value="value">{{ label }}</option>
      </select>
    </label>

    <div v-if="mode === 'RULES'" class="space-y-3">
      <div v-if="editSegment" data-test="editing-segment" class="flex flex-wrap items-center gap-2 rounded-btn border border-primary/40 bg-primary/10 px-3 py-2 text-sm">
        <span class="text-pretty">Modification de la règle du segment « {{ editSegment.name }} »</span>
        <button type="button" data-test="segment-edit-quit" :class="[btn, 'ml-auto']" @click="emit('edit-done')">Quitter</button>
      </div>

      <div class="flex flex-wrap items-center gap-2" role="group" aria-label="Raccourcis de ciblage">
        <span class="text-sm text-text-muted">Raccourcis</span>
        <button
          v-for="s in shortcuts" :key="s.id" type="button" :data-test="`shortcut-${s.id}`"
          :disabled="busy" :class="btn" @click="s.apply()"
        >{{ s.label }}</button>
      </div>

      <AudienceRuleBuilder :fields="fields" :rule="rule" />

      <p v-if="incompleteRule" data-test="broadcast-incomplete" role="status" class="text-sm text-warning text-pretty">
        Complétez les conditions pour estimer les destinataires.
      </p>

      <div class="flex flex-wrap items-center gap-2">
        <template v-if="editSegment">
          <button
            type="button" data-test="segment-update" :disabled="segSaving || !rule.isComplete.value" :class="btn"
            @click="updateSegment"
          >Mettre à jour le segment</button>
        </template>
        <button
          v-else-if="saveSegmentFn" type="button" data-test="save-segment-open"
          :disabled="busy || !rule.isComplete.value" :aria-expanded="saveOpen" :class="btn"
          @click="saveOpen = !saveOpen"
        >Enregistrer comme segment</button>
      </div>
      <p v-if="editSegment && segError" data-test="segment-save-error" role="alert" class="text-sm text-danger">{{ segError }}</p>

      <div v-if="saveOpen && !editSegment" class="space-y-2 rounded-btn border border-border bg-bg p-3">
        <label class="block text-sm text-text-muted">Nom du segment
          <input
            v-model="segName" data-test="segment-name" type="text" maxlength="80"
            class="mt-1 w-full rounded-btn border border-border bg-surface p-2 text-sm"
          >
        </label>
        <label class="block text-sm text-text-muted">Description (facultative)
          <input
            v-model="segDescription" data-test="segment-description" type="text" maxlength="300"
            class="mt-1 w-full rounded-btn border border-border bg-surface p-2 text-sm"
          >
        </label>
        <p v-if="segError" data-test="segment-save-error" role="alert" class="text-sm text-danger">{{ segError }}</p>
        <div class="flex flex-wrap gap-2">
          <button
            type="button" data-test="segment-save" :disabled="segSaving || !segName.trim()" :class="btn"
            @click="saveSegment"
          >Enregistrer</button>
          <button type="button" data-test="segment-cancel" :class="btn" @click="saveOpen = false; segError = null">Annuler</button>
        </div>
      </div>
    </div>

    <div v-if="mode === 'SEGMENT'" class="space-y-2">
      <label class="block text-sm text-text-muted">Segment
        <select
          v-model="segmentId" data-test="segment-select" :disabled="busy"
          class="mt-1 w-full rounded-btn border border-border bg-bg p-2 text-sm disabled:opacity-40"
        >
          <option value="" disabled>Choisir un segment…</option>
          <option v-for="s in segments" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>
      </label>
      <p v-if="selectedSegment?.description" class="text-sm text-text-muted text-pretty">{{ selectedSegment.description }}</p>
      <button v-if="selectedSegment" type="button" data-test="segment-edit-rules" :disabled="busy" :class="btn" @click="editSelectedRules">Modifier les règles</button>
    </div>

    <BroadcastUserPicker
      v-if="mode === 'USER'" v-model="userId" :can-search="canSearchUsers" :disabled="busy"
    />

    <label class="flex items-start gap-2 text-sm text-text">
      <input
        v-model="push" data-test="broadcast-push" type="checkbox" :disabled="busy"
        class="mt-0.5 disabled:opacity-40" @change="pushTouched = true"
      >
      <span>Faire aussi sonner les téléphones
        <span class="block text-text-muted text-pretty">Sans cette case, le message arrive dans la boîte Annonces de l’app, sans sonnerie.</span>
      </span>
    </label>

    <div class="flex flex-wrap items-center gap-3">
      <button
        type="button" data-test="broadcast-preview" :disabled="busy || previewing || !previewable"
        class="whitespace-nowrap rounded-btn px-4 py-2 text-sm border border-border hover:bg-surface-elevated disabled:opacity-40"
        @click="requestPreview"
      >Estimer les destinataires</button>
      <span v-if="freshCount !== null" data-test="broadcast-recipient-count" class="text-sm text-text-muted tabular-nums">{{ countLabel }}</span>
      <span v-else-if="estimateIsStale" data-test="broadcast-stale-estimate" class="text-sm text-warning">
        Le ciblage a changé : relancez l’estimation.
      </span>
      <span v-else-if="previewing" class="text-sm text-text-muted" role="status">Calcul en cours…</span>
      <button
        v-if="canViewRecipients && mode !== 'USER' && freshCount !== null && freshCount > 0" ref="viewButton" type="button" data-test="view-recipients"
        class="whitespace-nowrap text-sm text-primary underline underline-offset-2" @click="drawerOpen = true"
      >Voir la liste</button>
      <span v-if="shownUserName" data-test="broadcast-target-user-name" class="text-sm font-medium text-text">Destinataire : {{ shownUserName }}</span>
    </div>
    <p
      v-if="targetUnreachable" data-test="broadcast-user-unreachable" role="alert"
      class="rounded-btn border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning text-pretty"
    >Ce compte ne recevra pas la notification.</p>

    <div class="flex justify-end">
      <button
        type="button" data-test="broadcast-send" :disabled="!canSend"
        class="rounded-btn px-4 py-2 text-sm bg-primary text-white disabled:opacity-40 hover:bg-primary/90"
        @click="onSendClick"
      >Envoyer</button>
    </div>

    <BroadcastRecipientsDrawer :open="drawerOpen" :target="target" @close="closeDrawer" />

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
