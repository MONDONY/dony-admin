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

// Brouillon local par clé, initialisé depuis la valeur courante du réglage la première fois
// qu'elle est vue. On ne réécrase jamais une saisie en cours si le parent republie la même
// liste (ex. après une mise à jour d'un autre réglage).
// Type `string | number` : Vue caste automatiquement le v-model d'un <input type="number">
// en Number dès que l'utilisateur saisit — la valeur initiale (venue du back) reste, elle,
// une string. On normalise via String(...) partout où la valeur ressort du composant.
const drafts = reactive<Record<string, string | number>>({})
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
function errorFor(key: string, raw: string | number | undefined): string | null {
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
  return null
}

interface PendingChange {
  key: string
  value: string
  title: string
  message: string
  confirmLabel: string
  doubleConfirm: boolean
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
            v-model="drafts[s.key]" :data-test="`setting-value-${s.key}`" type="number"
            :step="s.type === 'DECIMAL' ? '0.1' : '1'" :disabled="busy"
            class="w-32 rounded-btn border border-border bg-bg p-2 text-sm tabular-nums disabled:opacity-40"
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

      <p v-if="errorFor(s.key, drafts[s.key])" class="text-xs text-danger" :data-test="`setting-error-${s.key}`">
        {{ errorFor(s.key, drafts[s.key]) }}
      </p>
    </div>

    <ConfirmActionDialog
      :open="pending !== null"
      :title="pending?.title ?? ''"
      :message="pending?.message ?? ''"
      :confirm-label="pending?.confirmLabel ?? 'Confirmer'"
      :confirmation-phrase="pending?.doubleConfirm ? SMS_DISABLE_PHRASE : undefined"
      :confirmation-label="pending?.doubleConfirm ? `Saisissez « ${SMS_DISABLE_PHRASE} » pour confirmer` : undefined"
      @confirm="confirmPending"
      @cancel="cancelPending"
    />
  </div>
</template>
