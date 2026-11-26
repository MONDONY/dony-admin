<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { identityLine, recipientName } from '@/features/mobile/lib/mobileNotify'
import { useMobileNotifyOne } from '@/features/mobile/composables/useMobileNotifyOne'

definePageMeta({ layout: 'mobile', middleware: 'admin-only', permission: 'NOTIFICATION_SEND', pageTitle: 'Diffuser' })

const {
  canSearch, step, recipient, account, identity, term, title, body, busy, error, pickError, sentTo, canReview, canConfirm,
  unreachableReason, lockSeconds, results, searching, searched, searchError,
  titleMax, bodyMax, setTerm, choose, changeRecipient, retryAccount, review, backToEdit, confirm, resendAnyway, backToForm, reset,
} = useMobileNotifyOne()

// L'auth n'existe que côté client : la note « droit supplémentaire » attend le montage, pour que le rendu
// serveur et l'hydratation soient identiques.
const mounted = ref(false)
onMounted(() => { mounted.value = true })

const field = 'min-h-[44px] w-full rounded-xl border border-border bg-surface px-3 text-base text-text'
const secondary = 'min-h-[44px] w-full whitespace-nowrap rounded-xl border border-border bg-surface px-4 text-sm font-semibold text-text disabled:opacity-60'
const primary = 'min-h-[44px] w-full whitespace-nowrap rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:opacity-60'
</script>

<template>
  <div class="space-y-4">
    <h2 class="font-display text-lg font-bold text-text">Envoyer une notification</h2>

    <section v-if="step === 'sent'" data-test="notify-sent" class="space-y-3 rounded-xl border border-border bg-surface px-3 py-4" role="status">
      <p class="font-semibold text-text">Notification envoyée</p>
      <p data-test="notify-sent-to" class="text-sm text-text-muted">à {{ sentTo }}</p>
      <button type="button" data-test="notify-new" :class="primary" @click="reset">Nouvelle notification</button>
    </section>

    <section v-else-if="step === 'uncertain'" data-test="notify-uncertain" class="space-y-3 rounded-xl border border-warning bg-surface px-3 py-4" role="alert">
      <p data-test="notify-error" class="text-sm text-text">{{ error }}</p>
      <button type="button" data-test="notify-back-form" :class="primary" @click="backToForm">Revenir au formulaire</button>
      <button type="button" data-test="notify-resend" :disabled="lockSeconds > 0" :class="secondary" @click="resendAnyway">
        {{ lockSeconds > 0 ? `Renvoyer quand même (${lockSeconds} s)` : 'Renvoyer quand même' }}
      </button>
    </section>

    <section v-else-if="step === 'confirm'" data-test="notify-confirm" class="space-y-3 rounded-xl border border-border bg-surface px-3 py-4" aria-label="Confirmation">
      <p class="text-sm text-text-muted">Vérifiez avant l’envoi. Une notification ne se rappelle pas.</p>
      <dl class="space-y-2 text-sm">
        <div><dt class="text-text-muted">À qui</dt><dd data-test="confirm-recipient" class="font-semibold text-text">{{ recipient?.name }}</dd><dd data-test="confirm-identity" class="text-text-muted">{{ identity }}</dd></div>
        <div><dt class="text-text-muted">Compte</dt><dd data-test="confirm-account" class="font-semibold text-text">{{ account.label }}</dd></div>
        <div><dt class="text-text-muted">Titre</dt><dd data-test="confirm-title" class="break-words font-semibold text-text">{{ title.trim() }}</dd></div>
        <div><dt class="text-text-muted">Message</dt><dd data-test="confirm-body" class="whitespace-pre-wrap break-words text-text">{{ body.trim() }}</dd></div>
      </dl>
      <p v-if="unreachableReason" data-test="confirm-blocked" class="text-sm text-danger" role="alert">{{ unreachableReason }}</p>
      <button v-if="account.state === 'unknown'" type="button" data-test="notify-account-retry" :class="secondary" @click="retryAccount">Réessayer</button>
      <button type="button" data-test="notify-confirm-send" :disabled="!canConfirm" :class="primary" @click="confirm">{{ busy ? 'Envoi…' : 'Confirmer l’envoi' }}</button>
      <button type="button" data-test="notify-edit" :disabled="busy" :class="secondary" @click="backToEdit">Modifier</button>
    </section>

    <template v-else>
      <p v-if="error" data-test="notify-error" class="text-sm text-danger" role="alert">{{ error }}</p>

      <section class="space-y-2 rounded-xl border border-border bg-surface px-3 py-3" aria-labelledby="notify-who">
        <h3 id="notify-who" class="text-sm font-semibold text-text">À qui</h3>
        <p v-if="mounted && !canSearch" data-test="notify-no-userview" class="text-sm text-text-muted" role="note">La recherche d’un utilisateur demande un droit supplémentaire</p>
        <template v-else-if="recipient">
          <p data-test="notify-recipient" class="font-semibold text-text">{{ recipient.name }}</p>
          <p data-test="notify-recipient-identity" class="text-sm text-text-muted">{{ identity }}</p>
          <p data-test="notify-account" class="text-sm text-text-muted">{{ account.label }}</p>
          <button type="button" data-test="notify-change" :class="secondary" @click="changeRecipient">Changer</button>
        </template>
        <template v-else>
          <label for="notify-search" class="sr-only">Nom ou identifiant</label>
          <input
            id="notify-search" type="search" data-test="notify-search" :value="term" autocomplete="off"
            placeholder="Nom ou identifiant" :class="field" @input="setTerm(($event.target as HTMLInputElement).value)"
          >
          <p v-if="searching" class="text-sm text-text-muted">Recherche…</p>
          <p v-if="searchError || pickError" data-test="notify-search-error" class="text-sm text-danger" role="alert">{{ pickError || searchError }}</p>
          <p v-else-if="searched && !results.length" data-test="notify-search-empty" class="text-sm text-text-muted">Aucun utilisateur trouvé.</p>
          <ul v-if="results.length" class="space-y-2">
            <li v-for="u in results" :key="u.id">
              <button
                type="button" data-test="notify-result"
                class="min-h-[44px] w-full rounded-xl border border-border bg-bg px-3 py-2 text-left text-sm text-text"
                @click="choose(u)"
              ><span class="block font-semibold">{{ recipientName(u) }}</span><span data-test="notify-result-identity" class="block text-text-muted">{{ identityLine(u.id, u.email) }}</span></button>
            </li>
          </ul>
        </template>
      </section>

      <section class="space-y-2 rounded-xl border border-border bg-surface px-3 py-3">
        <label for="notify-title" class="text-sm font-semibold text-text">Titre</label>
        <input id="notify-title" v-model="title" data-test="notify-title" type="text" :maxlength="titleMax" placeholder="Titre de la notification" :class="field">
      </section>

      <section class="space-y-2 rounded-xl border border-border bg-surface px-3 py-3">
        <label for="notify-body" class="text-sm font-semibold text-text">Message</label>
        <textarea id="notify-body" v-model="body" data-test="notify-body" rows="5" :maxlength="bodyMax" placeholder="Corps du message" :class="field" />
      </section>

      <p class="text-sm text-text-muted">Vérifiez le destinataire et le message avant d’envoyer. L’envoi à plusieurs personnes reste sur l’ordinateur.</p>

      <button type="button" data-test="notify-review" :disabled="!canReview" :class="primary" @click="review">Envoyer à 1 personne</button>
    </template>
  </div>
</template>
