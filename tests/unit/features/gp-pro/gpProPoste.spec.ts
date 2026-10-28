import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { seedAuth } from '~/tests/helpers/auth'

const svc = vi.hoisted(() => ({ approve: vi.fn(), reject: vi.fn() }))
vi.mock('@/features/gp-pro/services/gpProService', () => ({ gpProService: svc }))

import GpProQueue from '@/features/gp-pro/components/GpProQueue.vue'
import GpProApplicationCase from '@/features/gp-pro/components/GpProApplicationCase.vue'
import GpProDecisionPanel from '@/features/gp-pro/components/GpProDecisionPanel.vue'
import GpProReviewCase from '@/features/gp-pro/components/GpProReviewCase.vue'
import GpProReviewPanel from '@/features/gp-pro/components/GpProReviewPanel.vue'

const NuxtLink = { props: ['to'], template: '<a :data-to="to"><slot /></a>' }
const global = { stubs: { NuxtLink } }
const REASON = 'Plusieurs litiges récents'
const NOW = Date.parse('2026-10-28T12:00:00Z')

const ROWS = [
  { applicationId: 'a1', userId: 'u1', displayName: 'Awa Diop', source: 'SIGNUP', travelFrequency: 'WEEKLY', documentCount: 0, createdAt: '2026-10-23T12:00:00Z' },
  { applicationId: 'a2', userId: 'u2', source: 'PROFILE', travelFrequency: 'MONTHLY', documentCount: 2 },
]
const REVIEW = [{
  userId: 'u1', displayName: 'Moussa Ba', detectedAt: '2026-10-22T12:00:00Z', reasons: ['LOW_RATING', 'INACTIVE'],
  flags: [{ flagId: 'f1', reason: 'LOW_RATING' }, { flagId: 'f2', reason: 'INACTIVE' }],
}, { userId: 'u2' }]

describe('GpProQueue', () => {
  const mountQueue = (props: Record<string, unknown> = {}) =>
    mount(GpProQueue, { props: { scope: 'demandes', applications: ROWS, review: REVIEW, loading: false, now: NOW, ...props } as never })

  it('demandes : fréquence, origine, ancienneté ; justificatifs absents sans alerte ; sélection au clic', async () => {
    const w = mountQueue()
    const row = w.get('[data-test="gp-pro-row-a1"]')
    expect(row.text()).toContain('Awa Diop')
    expect(row.text()).toContain('Chaque semaine · Inscription')
    expect(w.get('[data-test="gp-pro-age-a1"]').text()).toBe('5 j')
    expect(w.find('[data-test="gp-pro-age-a2"]').exists()).toBe(false)
    expect(w.get('[data-test="gp-pro-docs-a1"]').text()).toBe('Aucun justificatif')
    expect(w.get('[data-test="gp-pro-docs-a2"]').text()).toBe('2 justificatifs')
    expect(w.get('[data-test="gp-pro-row-a2"]').text()).toContain('Nom non renseigné')
    await w.get('[data-test="open-a1"]').trigger('click')
    await w.get('[data-test="open-a2"]').trigger('click')
    expect(w.emitted('select')).toEqual([['a1'], ['a2']])
  })

  it('un seul justificatif : singulier ; ligne ouverte repérée', () => {
    const w = mountQueue({ applications: [{ ...ROWS[0], documentCount: 1 }], selectedId: 'a1' })
    expect(w.get('[data-test="gp-pro-docs-a1"]').text()).toBe('1 justificatif')
    expect(w.get('[data-test="gp-pro-row-a1"]').attributes('data-selected')).toBe('true')
    expect(w.get('[data-test="open-a1"]').attributes('aria-current')).toBe('true')
  })

  it('demandes : chargement, erreur avec Réessayer, file vide', async () => {
    expect(mountQueue({ applications: [], loading: true }).text()).toContain('Chargement')
    expect(mountQueue({ applications: [] }).find('[data-test="gp-pro-empty"]').exists()).toBe(true)
    const failed = mountQueue({ applications: [], error: 'Base indisponible' })
    expect(failed.text()).toContain('Base indisponible')
    await failed.get('[data-test="state-retry"]').trigger('click')
    expect(failed.emitted('retry')).toHaveLength(1)
  })

  it('à revoir : motifs de chaque alerte, ancienneté, sélection', async () => {
    const w = mountQueue({ scope: 'revue', selectedId: 'u1' })
    const row = w.get('[data-test="gp-pro-review-u1"]')
    expect(row.text()).toContain('Moussa Ba')
    expect(row.text()).toContain('Notes récentes sous 4/5')
    expect(row.text()).toContain('Aucun trajet depuis 8 semaines')
    expect(row.text()).toContain('6 j')
    expect(row.attributes('data-selected')).toBe('true')
    expect(w.get('[data-test="gp-pro-review-u2"]').text()).toContain('Nom non renseigné')
    await w.get('[data-test="open-u2"]').trigger('click')
    expect(w.emitted('select')).toEqual([['u2']])
  })

  it('à revoir : chargement, erreur, liste vide', async () => {
    expect(mountQueue({ scope: 'revue', review: [], loading: true }).text()).toContain('Chargement')
    expect(mountQueue({ scope: 'revue', review: [] }).find('[data-test="gp-pro-review-empty"]').exists()).toBe(true)
    const failed = mountQueue({ scope: 'revue', review: [], error: 'Panne' })
    await failed.get('[data-test="state-retry"]').trigger('click')
    expect(failed.emitted('retry')).toHaveLength(1)
  })
})

const DETAIL = {
  applicationId: 'a1', userId: 'u1', displayName: 'Awa Diop', status: 'PENDING', source: 'PROFILE',
  travelFrequency: 'WEEKLY', commercialName: 'Awa Transport', createdAt: '2026-10-23T12:00:00Z', kycStatus: 'VERIFIED',
  publishedTrips: 12, tripsLast56Days: 4, completedDeliveries: 30, averageRating: 4.62, lastFiveRatings: [5, 4, 5, 5, 4],
  openDisputes: 0, openReports: 0, memberSince: '2025-01-01T00:00:00Z',
  documents: [{ id: 'd1', type: 'BUSINESS_REGISTRATION', url: 'https://r2.example/presigned?x=1' }],
}

describe('GpProApplicationCase', () => {
  const mountCase = (props: Record<string, unknown> = {}) => mount(GpProApplicationCase, {
    props: { row: ROWS[0], applicationId: 'a1', detail: DETAIL, loading: false, error: null, now: NOW, ...props } as never,
  })

  it('en-tête, demande, profil et justificatifs en liens externes sûrs', async () => {
    const w = mountCase()
    expect(w.get('[data-test="gp-pro-case-title"]').text()).toBe('Awa Diop')
    expect(w.get('[data-test="gp-pro-detail-status"]').text()).toContain('À examiner')
    expect(w.get('[data-test="gp-pro-case-subline"]').text()).toContain('5 j d’attente')
    expect(w.get('[data-test="gp-pro-detail-frequency"]').text()).toBe('Chaque semaine')
    expect(w.get('[data-test="gp-pro-detail-commercial"]').text()).toBe('Awa Transport')
    expect(w.get('[data-test="gp-pro-detail-kyc"]').text()).toBe('Vérifiée')
    expect(w.get('[data-test="gp-pro-detail-rating"]').text()).toBe('4.6 / 5')
    expect(w.get('[data-test="gp-pro-detail-last-five"]').text()).toBe('5 · 4 · 5 · 5 · 4')
    const doc = w.get('[data-test="gp-pro-doc-d1"]')
    expect(doc.text()).toBe('Registre d’entreprise ↗')
    expect(doc.attributes('rel')).toBe('noopener noreferrer')
    expect(doc.attributes('target')).toBe('_blank')
    await w.get('[data-test="gp-pro-detail-refresh"]').trigger('click')
    expect(w.emitted('refresh')).toHaveLength(1)
    expect(w.text()).not.toContain('—')
  })

  it('profil sain : message rassurant, aucun point d’attention', () => {
    const w = mountCase()
    expect(w.find('[data-test="gp-pro-attention-none"]').exists()).toBe(true)
    expect(w.find('[data-test="gp-pro-attention"]').exists()).toBe(false)
  })

  it('points d’attention : identité, litiges, signalements, note et ligne en rouge', () => {
    const w = mountCase({ detail: { ...DETAIL, kycStatus: 'REJECTED', openDisputes: 1, openReports: 2, averageRating: 3.2 } })
    expect(w.get('[data-test="gp-pro-attention"]').text()).toContain('4 points à regarder')
    for (const k of ['kyc', 'disputes', 'reports', 'rating']) expect(w.find(`[data-test="gp-pro-attention-${k}"]`).exists()).toBe(true)
    expect(w.get('[data-test="gp-pro-detail-disputes"]').classes()).toContain('text-danger')
    expect(w.get('[data-test="gp-pro-detail-reports"]').classes()).toContain('text-danger')
    expect(w.get('[data-test="gp-pro-detail-kyc"]').text()).toBe('Refusée')
  })

  it('un seul point : formulation au singulier', () => {
    const w = mountCase({ detail: { ...DETAIL, openDisputes: 1 } })
    expect(w.get('[data-test="gp-pro-attention"]').text()).toContain('Un point à regarder')
  })

  it('sans justificatif ni note ni nom commercial ni ligne de file : mentions neutres', () => {
    const w = mountCase({
      row: null, applicationId: 'abcdef12-0000',
      detail: { ...DETAIL, documents: undefined, commercialName: undefined, averageRating: undefined, lastFiveRatings: undefined, displayName: undefined, memberSince: undefined, kycStatus: undefined, createdAt: undefined },
    })
    expect(w.get('[data-test="gp-pro-detail-no-documents"]').text()).toContain('facultatifs')
    expect(w.get('[data-test="gp-pro-detail-commercial"]').text()).toBe('Non renseigné')
    expect(w.get('[data-test="gp-pro-detail-rating"]').text()).toBe('Aucune note')
    expect(w.get('[data-test="gp-pro-detail-last-five"]').text()).toBe('Aucune')
    expect(w.get('[data-test="gp-pro-detail-kyc"]').text()).toBe('Inconnue')
    expect(w.get('[data-test="gp-pro-case-title"]').text()).toBe('Demande abcdef12')
    expect(w.find('[data-test="gp-pro-case-subline"]').exists()).toBe(false)
  })

  it('nom pris sur la ligne de file quand la fiche n’en a pas', () => {
    expect(mountCase({ detail: { ...DETAIL, displayName: undefined } }).get('[data-test="gp-pro-case-title"]').text()).toBe('Awa Diop')
  })

  it('demande décidée : pas d’attente affichée', () => {
    const w = mountCase({ detail: { ...DETAIL, status: 'APPROVED' } })
    expect(w.get('[data-test="gp-pro-detail-status"]').text()).toContain('Acceptée')
    expect(w.get('[data-test="gp-pro-case-subline"]').text()).not.toContain('d’attente')
  })

  it('chargement, erreur sans fiche, erreur de relecture avec fiche', () => {
    expect(mountCase({ detail: null, loading: true }).find('[data-test="gp-pro-detail-loading"]').exists()).toBe(true)
    expect(mountCase({ detail: null, error: 'Introuvable' }).get('[data-test="gp-pro-detail-error"]').text()).toBe('Introuvable')
    const w = mountCase({ error: 'Relecture échouée' })
    expect(w.get('[data-test="gp-pro-detail-refresh-error"]').text()).toBe('Relecture échouée')
    expect(w.find('[data-test="gp-pro-detail-frequency"]').exists()).toBe(true)
  })
})

describe('GpProDecisionPanel', () => {
  beforeEach(() => { seedAuth('ADMIN'); Object.values(svc).forEach((f) => f.mockReset()) })
  const mountPanel = (detail: Record<string, unknown> = DETAIL) => mount(GpProDecisionPanel, {
    props: { applicationId: 'a1', detail: detail as never, title: 'Awa Diop' }, global,
  })
  // eslint-disable-next-line no-unused-vars -- paramètre d'un type de fonction, pas une variable
  type Exposed = { startDecision: (kind: 'approve' | 'reject') => void; dialogOpen: () => boolean }
  const exposed = (w: ReturnType<typeof mountPanel>) => w.vm as unknown as Exposed

  it('accepter : appelle le back puis émet decided', async () => {
    svc.approve.mockResolvedValue(undefined)
    const w = mountPanel()
    await w.get('[data-test="gp-pro-approve"]').trigger('click')
    await w.get('[data-test="gp-pro-dialog-submit"]').trigger('click')
    await flushPromises()
    expect(svc.approve).toHaveBeenCalledWith('a1')
    expect(w.emitted('decided')).toHaveLength(1)
    expect(w.find('[data-test="gp-pro-dialog"]').exists()).toBe(false)
  })

  it('refuser : motif transmis ; un conflit garde le dialogue ouvert et demande une relecture', async () => {
    svc.reject.mockRejectedValueOnce({ statusCode: 409, data: { code: 'gp-pro-application-not-pending' } })
    const w = mountPanel()
    await w.get('[data-test="gp-pro-reject"]').trigger('click')
    await w.get('[data-test="gp-pro-text"]').setValue(REASON)
    await w.get('[data-test="gp-pro-dialog-submit"]').trigger('click')
    await flushPromises()
    expect(svc.reject).toHaveBeenCalledWith('a1', REASON)
    expect(w.emitted('stale')).toHaveLength(1)
    expect(w.get('[data-test="gp-pro-dialog-error"]').text()).toContain('déjà été décidée')
    await w.get('[data-test="gp-pro-dialog-cancel"]').trigger('click')
    expect(w.find('[data-test="gp-pro-dialog"]').exists()).toBe(false)
  })

  it('ancien back : décisions masquées, mention discrète', async () => {
    svc.approve.mockRejectedValueOnce({ statusCode: 404, data: {} })
    const w = mountPanel()
    await w.get('[data-test="gp-pro-approve"]').trigger('click')
    await w.get('[data-test="gp-pro-dialog-submit"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="gp-pro-actions-unavailable"]').exists()).toBe(true)
    expect(w.find('[data-test="gp-pro-approve"]').exists()).toBe(false)
    expect(w.find('[data-test="gp-pro-dialog"]').exists()).toBe(false)
  })

  it('identité non vérifiée : acceptation verrouillée et expliquée, refus possible', () => {
    const w = mountPanel({ ...DETAIL, kycStatus: 'REJECTED' })
    expect(w.get('[data-test="gp-pro-approve"]').attributes('disabled')).toBeDefined()
    expect(w.get('[data-test="gp-pro-approve"]').text()).toContain('Verrouillé')
    expect(w.get('[data-test="gp-pro-approve-kyc-hint"]').text()).toContain('Refuser reste possible')
    expect(w.get('[data-test="gp-pro-reject"]').attributes('disabled')).toBeUndefined()
  })

  it('demande déjà décidée : pas de bloc décision, le lien vers le compte reste', () => {
    const w = mountPanel({ ...DETAIL, status: 'APPROVED' })
    expect(w.find('[data-test="gp-pro-actions"]').exists()).toBe(false)
    expect(w.get('[data-test="gp-pro-user-link"]').attributes('data-to')).toBe('/users?open=u1')
  })

  it('sans GP_PRO_REVIEW : aucun bouton de décision', () => {
    seedAuth('SUPPORT')
    expect(mountPanel().find('[data-test="gp-pro-approve"]').exists()).toBe(false)
  })

  it('raccourcis : startDecision ouvre accepter ou refuser quand le bouton est offert', async () => {
    const w = mountPanel()
    expect(exposed(w).dialogOpen()).toBe(false)
    exposed(w).startDecision('approve')
    await flushPromises()
    expect(exposed(w).dialogOpen()).toBe(true)
    expect(w.get('[data-test="gp-pro-dialog-submit"]').text()).toBe('Accepter')
    await w.get('[data-test="gp-pro-dialog-cancel"]').trigger('click')
    expect(exposed(w).dialogOpen()).toBe(false)
    exposed(w).startDecision('reject')
    await flushPromises()
    expect(w.get('[data-test="gp-pro-dialog-submit"]').text()).toBe('Refuser')
  })

  it('raccourcis : accepter reste fermé sans identité vérifiée, tout l’est sans droit ou hors attente', () => {
    const noKyc = mountPanel({ ...DETAIL, kycStatus: 'REJECTED' })
    exposed(noKyc).startDecision('approve')
    expect(exposed(noKyc).dialogOpen()).toBe(false)
    exposed(noKyc).startDecision('reject')
    expect(exposed(noKyc).dialogOpen()).toBe(true)
    const done = mountPanel({ ...DETAIL, status: 'APPROVED' })
    exposed(done).startDecision('reject')
    expect(exposed(done).dialogOpen()).toBe(false)
    seedAuth('SUPPORT')
    const support = mountPanel()
    exposed(support).startDecision('approve')
    expect(exposed(support).dialogOpen()).toBe(false)
  })
})

describe('GpProReviewCase', () => {
  const mountCase = (props: Record<string, unknown> = {}) => mount(GpProReviewCase, {
    props: { row: REVIEW[0], userId: 'u1', canDismiss: true, now: NOW, ...props } as never,
  })

  it('nom, nombre et motif des alertes, ancienneté, écarter une alerte', async () => {
    const w = mountCase()
    expect(w.get('[data-test="gp-pro-review-title"]').text()).toBe('Moussa Ba')
    expect(w.get('[data-test="gp-pro-review-count"]').text()).toBe('2 alertes')
    expect(w.get('[data-test="gp-pro-review-since"]').text()).toContain('6 j')
    expect(w.get('[data-test="gp-pro-flag-f1"]').text()).toContain('Notes récentes sous 4/5')
    expect(w.get('[data-test="gp-pro-flag-f2"]').text()).toContain('Aucun trajet depuis 8 semaines')
    await w.get('[data-test="gp-pro-dismiss-f2"]').trigger('click')
    expect(w.emitted('dismiss')).toEqual([['f2']])
    expect(w.text()).toContain('Une alerte ne retire jamais le badge')
  })

  it('une seule alerte : singulier', () => {
    const w = mountCase({ row: { ...REVIEW[0], flags: [{ flagId: 'f1', reason: 'LOW_RATING' }] } })
    expect(w.get('[data-test="gp-pro-review-count"]').text()).toBe('1 alerte')
  })

  it('sans droit : pas de bouton Écarter ; occupé : désactivé ; erreur affichée', () => {
    expect(mountCase({ canDismiss: false }).find('[data-test="gp-pro-dismiss-f1"]').exists()).toBe(false)
    expect(mountCase({ busy: true }).get('[data-test="gp-pro-dismiss-f1"]').attributes('disabled')).toBeDefined()
    expect(mountCase({ error: 'Alerte close' }).get('[data-test="gp-pro-review-error"]').text()).toBe('Alerte close')
  })

  it('titulaire sans nom ni date ni alerte ; ligne absente (lien profond)', () => {
    const bare = mountCase({ row: REVIEW[1], userId: 'u2' })
    expect(bare.get('[data-test="gp-pro-review-title"]').text()).toBe('Nom non renseigné')
    expect(bare.get('[data-test="gp-pro-review-count"]').text()).toBe('0 alerte')
    expect(bare.find('[data-test="gp-pro-review-since"]').exists()).toBe(false)
    const gone = mountCase({ row: null, userId: 'abcdef12-0000' })
    expect(gone.get('[data-test="gp-pro-review-title"]').text()).toBe('Titulaire abcdef12')
    expect(gone.get('[data-test="gp-pro-review-gone"]').exists()).toBe(true)
  })
})

describe('GpProReviewPanel', () => {
  it('retrait du badge et fiche utilisateur, sans bouton de retrait direct', () => {
    const w = mount(GpProReviewPanel, { props: { row: REVIEW[0], userId: 'u1' } as never, global })
    expect(w.get('[data-test="gp-pro-review-remove-link"]').attributes('data-to')).toBe('/users?open=u1')
    expect(w.get('[data-test="gp-pro-review-open-u1"]').attributes('data-to')).toBe('/users?open=u1')
    expect(w.get('[data-test="gp-pro-review-account"]').text()).toContain('Moussa Ba')
  })

  it('ligne absente : repli sur l’identifiant', () => {
    const w = mount(GpProReviewPanel, { props: { row: null, userId: 'abcdef12-0000' } as never, global })
    expect(w.get('[data-test="gp-pro-review-account"]').text()).toContain('Titulaire abcdef12')
  })
})
