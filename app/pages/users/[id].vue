<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import StateBlock from '@/components/ui/StateBlock.vue'
import TabBar from '@/components/ui/TabBar.vue'
import UserProfileHeader from '@/features/user-profile/components/UserProfileHeader.vue'
import UserAlertBand from '@/features/user-profile/components/UserAlertBand.vue'
import UserOverviewTab from '@/features/user-profile/components/UserOverviewTab.vue'
import UserParcelsTab from '@/features/user-profile/components/UserParcelsTab.vue'
import UserMoneyTab from '@/features/user-profile/components/UserMoneyTab.vue'
import UserIncidentsTab from '@/features/user-profile/components/UserIncidentsTab.vue'
import UserIdentityTab from '@/features/user-profile/components/UserIdentityTab.vue'
import UserSupportTab from '@/features/user-profile/components/UserSupportTab.vue'
import UserKpiGrid from '@/features/user-profile/components/UserKpiGrid.vue'
import UserActionsMenu from '@/features/user-profile/components/UserActionsMenu.vue'
import UserAccountBanners from '@/features/user-profile/components/UserAccountBanners.vue'
import UserManageTab from '@/features/user-profile/components/UserManageTab.vue'
import { useAccountActions } from '@/features/user-profile/composables/useAccountActions'
import { useUserOverview } from '@/features/user-profile/composables/useUserOverview'
import { buildAlerts } from '@/features/user-profile/lib/userProfileAlerts'
import { visibleTabs, type ProfileTab } from '@/features/user-profile/lib/userProfileTabs'
import { usersService } from '@/features/users/services/usersService'
import { useAuthStore } from '@/stores/auth'
import { extractProblemMessage } from '@/lib/problemDetail'
import { uuidParam } from '@/lib/safeInput'
import type { AdminUserDetail } from '@/features/users/types/index'
import type { UserOverviewKpis } from '@/features/user-profile/types/index'

definePageMeta({ middleware: 'admin-only', permission: 'USER_VIEW', pageTitle: 'Utilisateur', pageSubtitle: 'Fiche complète du compte' })

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const NO_KPIS: UserOverviewKpis = {
  parcelsInProgress: null, activeTrips: null, heldByCurrency: null, openDisputes: null, totalDisputes: null,
  reportsReceived: null, reportsSent: null, reportsPending: null, averageRating: null, ratingCount: null,
}

const userId = computed(() => uuidParam(route.params?.id))
const user = ref<AdminUserDetail | null>(null)
const detailLoading = ref(true)
const detailError = ref<string | null>(null)
const notFound = ref(false)
// Une liaison de synthèse par identifiant : jamais de reste d'un autre compte.
const ovBinding = shallowRef(useUserOverview(''))
const ov = {
  overview: computed(() => ovBinding.value.overview.value),
  isLoading: computed(() => ovBinding.value.isLoading.value),
  error: computed(() => ovBinding.value.error.value),
  unavailable: computed(() => ovBinding.value.unavailable.value),
}

const tabs = computed(() => visibleTabs(p => auth.can(p)))
const tab = computed<ProfileTab>(() => {
  const wanted = route.query?.tab
  return tabs.value.find(t => t.id === wanted)?.id ?? 'overview'
})
function selectTab(id: ProfileTab) {
  void router.replace({ query: { ...route.query, tab: id } })
}

// Gestes sur le compte : la fiche renvoyée remplace `user` seulement si ce compte est encore affiché.
const actions = useAccountActions({
  getId: () => (unmounted ? null : user.value?.id ?? null),
  onUpdate: (detail) => { if (!unmounted && detail.id === user.value?.id) user.value = detail },
})

const alerts = computed(() => user.value ? buildAlerts(user.value, ov.overview.value?.kpis ?? NO_KPIS) : [])

let unmounted = false
let redirected = false
/** Vrai tant que la page est montée ET affiche encore ce compte (réponses tardives ignorées). */
const isCurrent = (id: string) => !unmounted && userId.value === id

/** Relecture silencieuse (après un geste KYC) : la fiche reste affichée, un échec garde les données connues. */
async function refreshDetail() {
  const id = userId.value
  if (!id) return
  try {
    const res = await usersService.get(id)
    if (isCurrent(id)) user.value = res
  } catch { /* données affichées conservées */ }
}

async function loadDetail() {
  const id = userId.value
  if (!id) return
  detailLoading.value = true
  detailError.value = null
  try {
    const res = await usersService.get(id)
    if (isCurrent(id)) user.value = res
  } catch (e) {
    if (!isCurrent(id)) return
    const status = (e as { statusCode?: number, status?: number, response?: { status?: number } })
    if ((status.statusCode ?? status.status ?? status.response?.status) === 404) notFound.value = true
    else detailError.value = extractProblemMessage(e, 'Impossible de charger l’utilisateur')
  } finally {
    if (isCurrent(id)) detailLoading.value = false
  }
}

async function loadOverview() {
  const id = userId.value
  if (!id) return
  await ovBinding.value.load()
  // Backend plus ancien : retour à l'ancien tiroir, une seule fois, sans empiler l'historique,
  // et seulement si l'admin est encore sur cette fiche.
  if (isCurrent(id) && ovBinding.value.unavailable.value && !redirected) {
    redirected = true
    await navigateTo(`/users?open=${id}&legacy=1`, { replace: true })
  }
}

async function loadAll() {
  actions.reset()
  user.value = null
  detailError.value = null
  redirected = false
  const id = userId.value
  notFound.value = id === null
  ovBinding.value = useUserOverview(id ?? '')
  if (!id) { detailLoading.value = false; return }
  await Promise.all([loadDetail(), loadOverview()])
}

onMounted(loadAll)
watch(userId, () => { void loadAll() })
onBeforeUnmount(() => { unmounted = true })
</script>

<template>
  <div class="flex flex-col gap-5">
    <nav aria-label="Fil d’Ariane" class="text-sm text-text-muted">
      <NuxtLink to="/users" class="hover:underline">Utilisateurs</NuxtLink>
    </nav>

    <div v-if="notFound" data-test="user-not-found" class="flex flex-col items-center gap-3 rounded-card border border-border bg-surface p-10 text-center">
      <p class="text-lg font-semibold">Utilisateur introuvable</p>
      <NuxtLink to="/users" data-test="back-to-users" class="rounded-btn border border-border px-3 py-1.5 text-sm hover:bg-surface-elevated">Retour aux utilisateurs</NuxtLink>
    </div>

    <StateBlock v-else-if="!user" :loading="detailLoading" :error="detailError" @retry="loadDetail()" />

    <template v-else>
      <UserProfileHeader :user="user">
        <template #actions>
          <UserActionsMenu
            :key="user.id" :user="user" :busy="actions.busy.value"
            @suspend="actions.suspend" @ban="actions.ban" @unsuspend="actions.unsuspend"
            @suspend-publishing="actions.suspendPublishing" @lift-publishing="actions.liftPublishing"
            @mute-messaging="actions.muteMessaging" @unmute-messaging="actions.unmuteMessaging"
          />
        </template>
      </UserProfileHeader>
      <p
        v-if="actions.error.value" data-test="account-action-error" role="alert"
        class="rounded-btn border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger text-pretty"
      >{{ actions.error.value }}</p>
      <UserAccountBanners
        :key="user.id" :user="user" :busy="actions.busy.value" :error="actions.error.value"
        :cancel-deletion-unavailable="actions.cancelDeletionUnavailable.value"
        :cancel-deletion-reason-error="actions.cancelDeletionReasonError.value"
        @cancel-deletion="actions.cancelDeletion"
      />
      <UserAlertBand :alerts="alerts" />
      <StateBlock v-if="ov.isLoading.value || ov.error.value" :loading="ov.isLoading.value" :error="ov.error.value" @retry="loadOverview" />
      <UserKpiGrid v-if="ov.overview.value" :kpis="ov.overview.value.kpis" />

      <TabBar :tabs="tabs" :model-value="tab" variant="underline" id-prefix="profile-tab" aria-label="Sections de la fiche" @update:model-value="selectTab" />

      <section v-if="tab === 'overview'" id="profile-panel-overview" role="tabpanel" aria-labelledby="profile-tab-overview" data-test="tab-content-overview">
        <UserOverviewTab v-if="ov.overview.value" :in-progress="ov.overview.value.inProgress" :timeline="ov.overview.value.timeline" />
      </section>
      <section v-else-if="tab === 'parcels'" id="profile-panel-parcels" role="tabpanel" aria-labelledby="profile-tab-parcels" data-test="tab-content-parcels">
        <UserParcelsTab :key="user.id" :user-id="user.id" />
      </section>
      <section v-else-if="tab === 'money'" id="profile-panel-money" role="tabpanel" aria-labelledby="profile-tab-money" data-test="tab-content-money">
        <UserMoneyTab :key="user.id" :user-id="user.id" />
      </section>
      <section v-else-if="tab === 'incidents'" id="profile-panel-incidents" role="tabpanel" aria-labelledby="profile-tab-incidents" data-test="tab-content-incidents">
        <UserIncidentsTab :key="user.id" :user-id="user.id" />
      </section>
      <section v-else-if="tab === 'identity'" id="profile-panel-identity" role="tabpanel" aria-labelledby="profile-tab-identity" data-test="tab-content-identity">
        <UserIdentityTab :key="user.id" :user="user" @refresh="refreshDetail" />
      </section>
      <section v-else-if="tab === 'support'" id="profile-panel-support" role="tabpanel" aria-labelledby="profile-tab-support" data-test="tab-content-support">
        <UserSupportTab :key="user.id" :user-id="user.id" />
      </section>
      <section v-else-if="tab === 'manage'" id="profile-panel-manage" role="tabpanel" aria-labelledby="profile-tab-manage" data-test="tab-content-manage">
        <UserManageTab
          :key="user.id" :user="user" :busy="actions.busy.value"
          @set-commission="actions.setCommissionRate" @grant-pro="actions.grantPro" @revoke-pro="actions.revokePro"
          @changed="refreshDetail"
        />
      </section>
    </template>
  </div>
</template>
