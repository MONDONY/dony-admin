<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import ConfirmActionDialog from '@/components/ui/ConfirmActionDialog.vue'
import type { PlatformSetting } from '@/features/settings/types/index'

const props = defineProps<{ settings: PlatformSetting[]; busy?: boolean }>()
const emit = defineEmits<{ update: [key: string, value: string] }>()

/**
 * Libellé et unité lisibles par clé. `urgency_threshold_days` est en **jours** — piège
 * documenté du lot (T14) : ne jamais afficher "heures" ici. Une clé absente de cette table
 * (nouveau réglage backend non encore mappé) retombe sur sa clé brute, sans unité — pas de
 * crash, juste un libellé moins joli.
 */
const SETTING_META: Record<string, { label: string; unit: string }> = {
  commission_rate: { label: 'Taux de commission', unit: '%' },
  urgency_threshold_days: { label: 'Seuil d’urgence', unit: 'jours' },
  reimbursement_cap_eur: { label: 'Plafond de remboursement', unit: '€' },
  sms_enabled: { label: 'SMS activés (authentification par code)', unit: '' },
  pro_enabled: { label: 'Offre PRO ouverte (visible dans l’application)', unit: '' },
  critical_sms_fallback_enabled: {
    label: 'SMS de repli (notifications critiques sans accusé de réception, facturé par envoi)',
    unit: '',
  },
  photo_retention_days_after_delivery: { label: 'Délai de suppression des photos après livraison', unit: 'jours' },
  photo_upload_daily_quota: { label: 'Photos envoyées par utilisateur et par jour', unit: 'photos' },
  tracking_photos_max_per_bid: { label: 'Photos de suivi par colis (sur 24 h)', unit: 'photos' },
  photo_purge_enabled: { label: 'Suppression des photos activée (sinon à blanc)', unit: '' },
  flights_enabled: { label: 'Billets d’avion (onglet Billets visible dans l’application)', unit: '' },
}
function metaFor(key: string) {
  return SETTING_META[key] ?? { label: key, unit: '' }
}

/**
 * `commission_rate` est stocké et servi comme un **taux** (`0.05`), mais se lit et s'édite
 * comme un **pourcentage** (`5 %`). La conversion se fait aux deux bords de ce composant,
 * jamais au milieu : le contrat backend reste intact — c'est cette même valeur, en taux, que
 * `ConfigController` sert à l'application mobile déjà installée, qui ne peut pas être mise à
 * jour à la demande.
 *
 * Sans cette conversion, un administrateur saisissant « 12 » pour 12 % se verrait répondre
 * « le taux doit être compris entre 0 et 30 % » — alors que 12 est bien entre 0 et 30. Le
 * backend borne le TAUX à 0.30.
 */
const PERCENT_KEYS = new Set(['commission_rate'])

/** Taux → pourcentage. L'arrondi absorbe le bruit flottant : `0.05 * 100 === 5.000000000000001`. */
function toDisplay(setting: PlatformSetting): string {
  if (!PERCENT_KEYS.has(setting.key)) return setting.value
  const n = Number(setting.value)
  return Number.isNaN(n) ? setting.value : String(Math.round(n * 10000) / 100)
}

/** Pourcentage → taux, arrondi à 6 décimales pour la même raison. */
function toWire(key: string, raw: string): string {
  if (!PERCENT_KEYS.has(key)) return raw
  const n = Number(raw)
  return Number.isNaN(n) ? raw : String(Number((n / 100).toFixed(6)))
}

// Phrase de double confirmation exigée pour désactiver sms_enabled — ce réglage conditionne
// aussi l'authentification par OTP, donc une friction généralisée à tous les réglages serait
// contre-productive (elle finit cliquée sans être lue) : seul ce geste précis la mérite.
const SMS_DISABLE_PHRASE = 'DESACTIVER SMS'
// Même mécanisme pour l'activation de la purge des photos : elle supprime définitivement des fichiers.
const PURGE_ENABLE_PHRASE = 'ACTIVER PURGE'

/** Bornes entières des réglages photos [min, max], alignées sur le backend (qui reste l'autorité). */
const INT_BOUNDS: Record<string, [number, number]> = {
  photo_retention_days_after_delivery: [1, 365],
  photo_upload_daily_quota: [5, 1000],
  tracking_photos_max_per_bid: [1, 20],
}
function hintFor(key: string): string | null {
  const b = INT_BOUNDS[key]
  return b ? `Entre ${b[0]} et ${b[1]}` : null
}

// Brouillon local par clé, initialisé depuis la valeur courante du réglage la première fois
// qu'elle est vue. On ne réécrase jamais une saisie en cours si le parent republie la même
// liste (ex. après une mise à jour d'un autre réglage).
// Brouillons toujours en texte brut : le champ numérique est lu via `@input` et non `v-model`,
// que Vue caste en Number (« 1e1 » deviendrait 10 et passerait la validation des entiers).
const drafts = reactive<Record<string, string>>({})
function onNumberInput(key: string, e: Event) {
  drafts[key] = (e.target as HTMLInputElement).value
}
watch(
  () => props.settings,
  (list) => {
    for (const s of list) {
      if (!(s.key in drafts)) drafts[s.key] = toDisplay(s)
    }
  },
  { immediate: true },
)

function fmt(d: string) {
  return new Date(d).toLocaleString('fr-FR')
}

/** Bornes documentées du lot : commission entre 0 et 30 %, plafond ≤ 500 €. Le backend reste
 * l'autorité — ce contrôle évite juste l'aller-retour réseau pour une valeur déjà invalide. */
function errorFor(key: string, raw: string | undefined): string | null {
  if (raw === undefined) return null
  const str = String(raw)
  const n = Number(raw)
  if (key === 'commission_rate') {
    if (str.trim() === '' || Number.isNaN(n)) return 'Le taux de commission doit être un nombre.'
    if (n < 0 || n > 30) return 'Le taux de commission doit être compris entre 0 et 30 %.'
  }
  if (key === 'reimbursement_cap_eur') {
    if (str.trim() === '' || Number.isNaN(n)) return 'Le plafond de remboursement doit être un nombre.'
    if (n > 500) return 'Le plafond de remboursement ne peut pas dépasser 500 €.'
  }
  const b = INT_BOUNDS[key]
  if (b) {
    // Chiffres seulement : `Number('1e1')` vaut 10, un entier, mais n'est pas une saisie d'entier.
    if (!/^\d+$/.test(str.trim()) || n < b[0] || n > b[1]) return `Entre ${b[0]} et ${b[1]}`
  }
  return null
}

interface PendingChange {
  key: string
  value: string
  title: string
  message: string
  confirmLabel: string
  doubleConfirm: boolean
  /** Phrase à saisir quand `doubleConfirm` est vrai (par défaut celle des SMS). */
  phrase?: string
  /** Avertissement affiché en rouge sous le message (conséquence irréversible). */
  alert?: string
}
const pending = ref<PendingChange | null>(null)

function requestSave(key: string) {
  const raw = String(drafts[key])
  if (errorFor(key, raw)) return
  // `raw` reste la valeur AFFICHÉE — c'est elle que valide `errorFor` (bornes en %) et elle
  // qu'on relit pour décider de la double confirmation. Seul ce qui part sur le fil est converti.
  const wire = toWire(key, raw)

  if (key === 'sms_enabled') {
    // Seule la désactivation empêche la connexion (OTP) — réactiver n'est pas un geste
    // dangereux, il n'a donc pas à porter la même friction.
    const turningOff = raw === 'false'
    pending.value = {
      key,
      value: wire,
      doubleConfirm: turningOff,
      title: turningOff ? 'Désactiver les SMS' : 'Activer les SMS',
      message: turningOff
        ? 'Désactiver les SMS coupe l’envoi des codes de connexion (OTP) : plus personne, y compris '
          + 'les administrateurs, ne pourra se connecter tant que ce réglage restera désactivé.'
        : 'Les SMS seront réactivés — les codes de connexion (OTP) pourront de nouveau être envoyés.',
      confirmLabel: turningOff ? 'Désactiver' : 'Activer',
    }
    return
  }

  if (key === 'pro_enabled') {
    // Pas de saisie de contrôle : fermer l'offre ne bloque personne (les quotas des comptes
    // standard sont levés en même temps). Mais la conséquence n'est pas évidente depuis un
    // simple « Activé / Désactivé » : elle est dite ici, dans les deux sens.
    const opening = raw === 'true'
    pending.value = {
      key,
      value: wire,
      doubleConfirm: false,
      title: opening ? 'Ouvrir l’offre PRO' : 'Fermer l’offre PRO',
      message: opening
        ? 'L’application affichera les entrées PRO (compte PRO, abonnement) et les quotas des comptes '
          + 'standard (annonces mensuelles, brouillons) seront de nouveau appliqués. '
          + 'Effet au prochain démarrage de l’application chez chaque utilisateur.'
        : 'L’application masquera toute entrée PRO et les quotas des comptes standard ne seront plus '
          + 'appliqués : tout le monde bénéficie des plafonds PRO tant que l’offre reste fermée. '
          + 'Effet au prochain démarrage de l’application chez chaque utilisateur.',
      confirmLabel: opening ? 'Ouvrir' : 'Fermer',
    }
    return
  }

  if (key === 'flights_enabled') {
    // Ni l'un ni l'autre sens ne bloque personne ni ne supprime rien : confirmation simple,
    // qui dit ce que l'utilisateur verra (ou ne verra plus) au prochain démarrage.
    const opening = raw === 'true'
    pending.value = {
      key,
      value: wire,
      doubleConfirm: false,
      title: opening ? 'Activer les billets d’avion' : 'Désactiver les billets d’avion',
      message: opening
        ? 'L’application affichera l’onglet Billets (recherche, bons plans, alertes prix) et la barre '
          + 'du bas passera à six onglets en icônes seules. Les réservations se font chez le partenaire '
          + '(Travelpayouts) : vérifiez que son compte est configuré. '
          + 'Effet au prochain démarrage de l’application chez chaque utilisateur.'
        : 'L’application masquera l’onglet Billets et retrouvera sa barre du bas d’avant (cinq onglets). '
          + 'Les routes des billets répondront « indisponible » et les alertes prix ne seront plus '
          + 'vérifiées ; rien n’est supprimé, elles reprendront si vous réactivez. '
          + 'Effet au prochain démarrage de l’application chez chaque utilisateur.',
      confirmLabel: opening ? 'Activer' : 'Désactiver',
    }
    return
  }

  if (key === 'photo_purge_enabled') {
    const turningOn = raw === 'true'
    pending.value = {
      key,
      value: wire,
      doubleConfirm: turningOn,
      phrase: PURGE_ENABLE_PHRASE,
      title: turningOn ? 'Activer la suppression des photos' : 'Repasser la purge à blanc',
      message: turningOn
        ? 'Consultez d’abord le décompte à blanc de la carte Stockage photos.'
        : 'La purge repasse à blanc : plus rien n’est supprimé (sauf le chat, qui garde sa purge).',
      alert: turningOn
        ? 'Les photos éligibles (colis livrés depuis le délai, orphelins, historique) seront supprimées '
          + 'définitivement de Cloudflare R2.'
        : undefined,
      confirmLabel: turningOn ? 'Activer' : 'Repasser à blanc',
    }
    return
  }

  if (key === 'photo_retention_days_after_delivery') {
    pending.value = {
      key,
      value: wire,
      doubleConfirm: false,
      title: 'Modifier le délai de suppression',
      message: 'Ce délai s’applique aussi aux photos du chat, qui sont supprimées réellement même quand '
        + 'la purge est à blanc.',
      confirmLabel: 'Confirmer',
    }
    return
  }

  pending.value = {
    key,
    value: wire,
    doubleConfirm: false,
    title: 'Confirmer la modification',
    message: `Confirmez la modification de « ${metaFor(key).label} ».`,
    confirmLabel: 'Confirmer',
  }
}

function confirmPending() {
  if (!pending.value) return
  emit('update', pending.value.key, pending.value.value)
  pending.value = null
}
function cancelPending() {
  pending.value = null
}
</script>

<template>
  <div class="space-y-4">
    <div
      v-for="s in settings" :key="s.key"
      class="rounded-card border border-border bg-surface p-4 space-y-3" :data-test="`setting-row-${s.key}`"
    >
      <div class="flex items-center justify-between gap-3">
        <p class="text-sm font-semibold">{{ metaFor(s.key).label }}</p>
        <p class="text-xs text-text-muted" :data-test="`setting-meta-${s.key}`">
          <template v-if="s.updatedAt">Modifié le {{ fmt(s.updatedAt) }} par {{ s.updatedByEmail ?? '—' }}</template>
          <template v-else>Jamais modifié</template>
        </p>
      </div>

      <div class="flex items-center gap-2">
        <select
          v-if="s.type === 'BOOLEAN'"
          v-model="drafts[s.key]" :data-test="`setting-value-${s.key}`" :disabled="busy"
          class="rounded-btn border border-border bg-bg p-2 text-sm disabled:opacity-40"
        >
          <option value="true">Activé</option>
          <option value="false">Désactivé</option>
        </select>
        <template v-else>
          <input
            :value="drafts[s.key]" :data-test="`setting-value-${s.key}`" type="number"
            :step="s.type === 'DECIMAL' ? '0.1' : '1'" :disabled="busy"
            class="w-32 rounded-btn border border-border bg-bg p-2 text-sm tabular-nums disabled:opacity-40"
            @input="onNumberInput(s.key, $event)"
          >
          <span class="text-sm text-text-muted" :data-test="`setting-unit-${s.key}`">{{ metaFor(s.key).unit }}</span>
        </template>

        <button
          type="button" :data-test="`setting-save-${s.key}`"
          :disabled="busy || !!errorFor(s.key, drafts[s.key])"
          class="ml-auto rounded-btn px-4 py-2 text-sm bg-primary text-white disabled:opacity-40 hover:bg-primary/90"
          @click="requestSave(s.key)"
        >Enregistrer</button>
      </div>

      <p v-if="hintFor(s.key) && !errorFor(s.key, drafts[s.key])" class="text-xs text-text-muted" :data-test="`setting-hint-${s.key}`">
        {{ hintFor(s.key) }}
      </p>
      <p v-if="errorFor(s.key, drafts[s.key])" class="text-xs text-danger" :data-test="`setting-error-${s.key}`">
        {{ errorFor(s.key, drafts[s.key]) }}
      </p>
    </div>

    <ConfirmActionDialog
      :open="pending !== null"
      :title="pending?.title ?? ''"
      :message="pending?.message ?? ''"
      :confirm-label="pending?.confirmLabel ?? 'Confirmer'"
      :confirmation-phrase="pending?.doubleConfirm ? (pending.phrase ?? SMS_DISABLE_PHRASE) : undefined"
      :confirmation-label="pending?.doubleConfirm ? `Saisissez « ${pending.phrase ?? SMS_DISABLE_PHRASE} » pour confirmer` : undefined"
      @confirm="confirmPending"
      @cancel="cancelPending"
    >
      <p v-if="pending?.alert" data-test="confirm-alert" role="alert" class="mb-4 text-sm font-medium text-danger text-pretty">
        {{ pending.alert }}
      </p>
    </ConfirmActionDialog>
  </div>
</template>
