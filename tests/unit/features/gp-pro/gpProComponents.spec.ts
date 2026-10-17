import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { seedAuth } from '~/tests/helpers/auth'

const svc = vi.hoisted(() => ({
  approve: vi.fn(), reject: vi.fn(), grant: vi.fn(), revoke: vi.fn(),
}))
vi.mock('@/features/gp-pro/services/gpProService', () => ({ gpProService: svc }))

import GpProDecisionDialog from '@/features/gp-pro/components/GpProDecisionDialog.vue'
import GpProApplicationsTable from '@/features/gp-pro/components/GpProApplicationsTable.vue'
import GpProReviewTable from '@/features/gp-pro/components/GpProReviewTable.vue'
import GpProDetailPanel from '@/features/gp-pro/components/GpProDetailPanel.vue'
import UserGpProSection from '@/features/gp-pro/components/UserGpProSection.vue'

const NuxtLink = { props: ['to'], template: '<a :data-to="to"><slot /></a>' }
const global = { stubs: { NuxtLink } }
const REASON = 'Plusieurs litiges récents'

describe('GpProDecisionDialog', () => {
  const mountDialog = (mode: string, extra: Record<string, unknown> = {}) =>
    mount(GpProDecisionDialog, { props: { open: true, mode, userName: 'Awa Diop', ...extra } })

  it('fermé : rien n’est rendu', () => {
    expect(mount(GpProDecisionDialog, { props: { open: false, mode: 'approve', userName: 'A' } }).html()).not.toContain('gp-pro-dialog')
  })

  it('accepter : pas de saisie, soumission directe', async () => {
    const w = mountDialog('approve')
    expect(w.find('[data-test="gp-pro-text"]').exists()).toBe(false)
    await w.get('[data-test="gp-pro-dialog-submit"]').trigger('click')
    expect(w.emitted('submit')?.[0]).toEqual([''])
  })

  it('refuser : motif de 10 caractères minimum, envoyé à l’utilisateur', async () => {
    const w = mountDialog('reject')
    const submit = w.get('[data-test="gp-pro-dialog-submit"]')
    await w.get('[data-test="gp-pro-text"]').setValue('court')
    expect(submit.attributes('disabled')).toBeDefined()
    expect(w.get('[data-test="gp-pro-hint"]').text()).toContain('Au moins 10')
    await submit.trigger('click')
    expect(w.emitted('submit')).toBeUndefined()
    await w.get('[data-test="gp-pro-text"]').setValue(`  ${REASON}  `)
    expect(w.get('[data-test="gp-pro-hint"]').text()).toContain('Envoyé à l’utilisateur')
    await submit.trigger('click')
    expect(w.emitted('submit')?.[0]).toEqual([REASON])
  })

  it('motif trop long : refusé, compteur en rouge', async () => {
    const w = mountDialog('revoke')
    await w.get('[data-test="gp-pro-text"]').setValue('x'.repeat(1001))
    expect(w.get('[data-test="gp-pro-hint"]').text()).toContain('Pas plus de 1000')
    expect(w.get('[data-test="gp-pro-count"]').classes()).toContain('text-danger')
    expect(w.get('[data-test="gp-pro-dialog-submit"]').attributes('disabled')).toBeDefined()
  })

  it('accorder : note facultative et interne', async () => {
    const w = mountDialog('grant')
    expect(w.get('[data-test="gp-pro-hint"]').text()).toContain('Note interne')
    await w.get('[data-test="gp-pro-dialog-submit"]').trigger('click')
    expect(w.emitted('submit')?.[0]).toEqual([''])
    await w.get('[data-test="gp-pro-text"]').setValue('x'.repeat(1001))
    expect(w.get('[data-test="gp-pro-dialog-submit"]').attributes('disabled')).toBeDefined()
  })

  it('occupé : bouton désactivé ; erreur affichée ; annuler', async () => {
    const w = mountDialog('approve', { busy: true, error: 'Refusé par le serveur' })
    expect(w.get('[data-test="gp-pro-dialog-submit"]').text()).toBe('En cours…')
    expect(w.get('[data-test="gp-pro-dialog-submit"]').attributes('disabled')).toBeDefined()
    expect(w.get('[data-test="gp-pro-dialog-error"]').text()).toBe('Refusé par le serveur')
    await w.get('[data-test="gp-pro-dialog-cancel"]').trigger('click')
    expect(w.emitted('cancel')).toHaveLength(1)
  })
})

describe('GpProApplicationsTable', () => {
  const ROWS = [
    { applicationId: 'a1', userId: 'u1', displayName: 'Awa Diop', source: 'SIGNUP', travelFrequency: 'WEEKLY', documentCount: 0, createdAt: '2026-10-17T10:00:00Z' },
    { applicationId: 'a2', userId: 'u2', source: 'PROFILE', travelFrequency: 'MONTHLY', documentCount: 2 },
  ]

  it('une ligne par demande ; justificatifs absents sans alerte ; sélection au clic et au clavier', async () => {
    const w = mount(GpProApplicationsTable, { props: { items: ROWS, loading: false } })
    expect(w.get('[data-test="gp-pro-row-a1"]').text()).toContain('Chaque semaine')
    expect(w.get('[data-test="gp-pro-docs-a1"]').text()).toBe('Aucun')
    expect(w.get('[data-test="gp-pro-docs-a2"]').text()).toBe('2 joints')
    expect(w.get('[data-test="gp-pro-row-a2"]').text()).toContain('Nom non renseigné')
    await w.get('[data-test="gp-pro-row-a1"]').trigger('click')
    await w.get('[data-test="gp-pro-row-a2"]').trigger('keydown.enter')
    expect(w.emitted('select')).toEqual([['a1'], ['a2']])
  })

  it('un seul justificatif : singulier', () => {
    const w = mount(GpProApplicationsTable, { props: { items: [{ ...ROWS[0], documentCount: 1 }], loading: false } })
    expect(w.get('[data-test="gp-pro-docs-a1"]').text()).toBe('1 joint')
  })

  it('chargement, puis file vide', () => {
    expect(mount(GpProApplicationsTable, { props: { items: [], loading: true } }).text()).toContain('Chargement')
    expect(mount(GpProApplicationsTable, { props: { items: [], loading: false } }).find('[data-test="gp-pro-empty"]').exists()).toBe(true)
  })
})

describe('GpProReviewTable', () => {
  const ROWS = [{
    userId: 'u1', displayName: 'Moussa Ba', detectedAt: '2026-10-10T00:00:00Z', reasons: ['LOW_RATING', 'INACTIVE'],
    flags: [{ flagId: 'f1', reason: 'LOW_RATING' }, { flagId: 'f2', reason: 'INACTIVE' }],
  }, { userId: 'u2' }]

  it('motifs, lien vers la fiche, écarter une alerte', async () => {
    const w = mount(GpProReviewTable, { props: { items: ROWS, loading: false, canDismiss: true }, global })
    expect(w.get('[data-test="gp-pro-review-u1"]').text()).toContain('Notes récentes sous 4/5')
    expect(w.get('[data-test="gp-pro-review-open-u1"]').attributes('data-to')).toBe('/users?open=u1')
    expect(w.get('[data-test="gp-pro-review-u2"]').text()).toContain('Nom non renseigné')
    await w.get('[data-test="gp-pro-dismiss-f2"]').trigger('click')
    expect(w.emitted('dismiss')).toEqual([['f2']])
  })

  it('sans droit : pas de bouton Écarter ; chargement ; liste vide', () => {
    expect(mount(GpProReviewTable, { props: { items: ROWS, loading: false, canDismiss: false }, global })
      .find('[data-test="gp-pro-dismiss-f1"]').exists()).toBe(false)
    expect(mount(GpProReviewTable, { props: { items: [], loading: true, canDismiss: true }, global }).text()).toContain('Chargement')
    expect(mount(GpProReviewTable, { props: { items: [], loading: false, canDismiss: true }, global })
      .find('[data-test="gp-pro-review-empty"]').exists()).toBe(true)
  })
})

const DETAIL = {
  applicationId: 'a1', userId: 'u1', displayName: 'Awa Diop', status: 'PENDING', source: 'PROFILE',
  travelFrequency: 'WEEKLY', commercialName: 'Awa Transport', createdAt: '2026-10-15T10:00:00Z', kycStatus: 'VERIFIED',
  publishedTrips: 12, tripsLast56Days: 4, completedDeliveries: 30, averageRating: 4.62, lastFiveRatings: [5, 4, 5, 5, 4],
  openDisputes: 1, openReports: 0, memberSince: '2025-01-01T00:00:00Z',
  documents: [{ id: 'd1', type: 'BUSINESS_REGISTRATION', url: 'https://r2.example/presigned?x=1' }],
}

describe('GpProDetailPanel', () => {
  beforeEach(() => { seedAuth('ADMIN'); Object.values(svc).forEach((f) => f.mockReset()) })
  const mountPanel = (props: Record<string, unknown> = {}) => mount(GpProDetailPanel, {
    props: { applicationId: 'a1', detail: DETAIL, loading: false, error: null, ...props }, global,
  })

  it('montre la demande, le profil et les justificatifs en liens externes sûrs', async () => {
    const w = mountPanel()
    expect(w.get('#gp-pro-detail-title').text()).toBe('Awa Diop')
    expect(w.get('[data-test="gp-pro-user-link"]').attributes('data-to')).toBe('/users?open=u1')
    expect(w.get('[data-test="gp-pro-detail-frequency"]').text()).toBe('Chaque semaine')
    expect(w.get('[data-test="gp-pro-detail-commercial"]').text()).toBe('Awa Transport')
    expect(w.get('[data-test="gp-pro-detail-kyc"]').text()).toBe('Vérifiée')
    expect(w.get('[data-test="gp-pro-detail-rating"]').text()).toBe('4.6 / 5')
    expect(w.get('[data-test="gp-pro-detail-last-five"]').text()).toBe('5 · 4 · 5 · 5 · 4')
    const doc = w.get('[data-test="gp-pro-doc-d1"]')
    expect(doc.text()).toBe('Registre d’entreprise')
    expect(doc.attributes('rel')).toBe('noopener noreferrer')
    expect(doc.attributes('target')).toBe('_blank')
    await w.get('[data-test="gp-pro-detail-refresh"]').trigger('click')
    expect(w.emitted('refresh')).toHaveLength(1)
  })

  it('sans justificatif ni note ni nom commercial : mentions neutres', () => {
    const w = mountPanel({ detail: { ...DETAIL, documents: undefined, commercialName: undefined, averageRating: undefined, lastFiveRatings: undefined, displayName: undefined } })
    expect(w.get('[data-test="gp-pro-detail-no-documents"]').text()).toContain('facultatifs')
    expect(w.get('[data-test="gp-pro-detail-commercial"]').text()).toBe('Non renseigné')
    expect(w.get('[data-test="gp-pro-detail-rating"]').text()).toBe('Aucune note')
    expect(w.get('[data-test="gp-pro-detail-last-five"]').text()).toBe('Aucune')
    expect(w.get('#gp-pro-detail-title').text()).toBe('Demande a1')
  })

  it('chargement, erreur sans fiche, erreur de relecture', () => {
    expect(mountPanel({ detail: null, loading: true }).find('[data-test="gp-pro-detail-loading"]').exists()).toBe(true)
    expect(mountPanel({ detail: null, error: 'Introuvable' }).get('[data-test="gp-pro-detail-error"]').text()).toBe('Introuvable')
    expect(mountPanel({ error: 'Relecture échouée' }).get('[data-test="gp-pro-detail-refresh-error"]').text()).toBe('Relecture échouée')
  })

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

  it('refuser : motif transmis ; un refus du back garde le dialogue ouvert et relit sur conflit', async () => {
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

  it('identité non vérifiée : acceptation désactivée et expliquée', () => {
    const w = mountPanel({ detail: { ...DETAIL, kycStatus: 'REJECTED' } })
    expect(w.get('[data-test="gp-pro-approve"]').attributes('disabled')).toBeDefined()
    expect(w.find('[data-test="gp-pro-approve-kyc-hint"]').exists()).toBe(true)
    expect(w.get('[data-test="gp-pro-detail-kyc"]').text()).toBe('REJECTED')
  })

  it('demande déjà décidée : pas de bloc décision ; statut KYC absent', () => {
    const w = mountPanel({ detail: { ...DETAIL, status: 'APPROVED', kycStatus: undefined } })
    expect(w.find('[data-test="gp-pro-actions"]').exists()).toBe(false)
    expect(w.get('[data-test="gp-pro-detail-kyc"]').text()).toBe('Inconnue')
  })

  it('sans GP_PRO_REVIEW : aucun bouton de décision', () => {
    seedAuth('SUPPORT')
    expect(mountPanel().find('[data-test="gp-pro-approve"]').exists()).toBe(false)
  })

  it('fermer : bouton et clic sur le fond', async () => {
    const w = mountPanel()
    await w.get('[data-test="gp-pro-detail-close"]').trigger('click')
    await w.get('[data-test="gp-pro-detail-overlay"]').trigger('click')
    expect(w.emitted('close')).toHaveLength(2)
  })
})

describe('UserGpProSection', () => {
  beforeEach(() => Object.values(svc).forEach((f) => f.mockReset()))
  const BASE = { userId: 'u1', userName: 'Awa Diop', gpPro: false, kycStatus: 'VERIFIED', status: 'ACTIVE' }
  const mountSection = (props: Record<string, unknown> = {}) => mount(UserGpProSection, { props: { ...BASE, ...props } })

  it('accorder sans demande, note facultative transmise', async () => {
    svc.grant.mockResolvedValue(undefined)
    const w = mountSection()
    expect(w.get('[data-test="gp-pro-state"]').text()).toBe('non attribué')
    await w.get('[data-test="action-grant-gp-pro"]').trigger('click')
    await w.get('[data-test="gp-pro-text"]').setValue('Connu du terrain')
    await w.get('[data-test="gp-pro-dialog-submit"]').trigger('click')
    await flushPromises()
    expect(svc.grant).toHaveBeenCalledWith('u1', 'Connu du terrain')
    expect(w.emitted('changed')).toHaveLength(1)
  })

  it('accorder sans note : null envoyé', async () => {
    svc.grant.mockResolvedValue(undefined)
    const w = mountSection()
    await w.get('[data-test="action-grant-gp-pro"]').trigger('click')
    await w.get('[data-test="gp-pro-dialog-submit"]').trigger('click')
    await flushPromises()
    expect(svc.grant).toHaveBeenCalledWith('u1', null)
  })

  it('identité non vérifiée ou compte inactif : attribution désactivée et expliquée', () => {
    const noKyc = mountSection({ kycStatus: 'PENDING' })
    expect(noKyc.get('[data-test="action-grant-gp-pro"]').attributes('disabled')).toBeDefined()
    expect(noKyc.get('[data-test="gp-pro-grant-blocked"]').text()).toContain('Identité non vérifiée')
    expect(mountSection({ status: 'BANNED' }).get('[data-test="gp-pro-grant-blocked"]').text()).toContain('Compte inactif')
  })

  it('retirer avec motif ; badge actif affiché avec sa date', async () => {
    svc.revoke.mockResolvedValue(undefined)
    const w = mountSection({ gpPro: true, gpProGrantedAt: '2026-09-01T00:00:00Z' })
    expect(w.get('[data-test="gp-pro-state"]').text()).toContain('actif depuis le')
    await w.get('[data-test="action-revoke-gp-pro"]').trigger('click')
    await w.get('[data-test="gp-pro-text"]').setValue(REASON)
    await w.get('[data-test="gp-pro-dialog-submit"]').trigger('click')
    await flushPromises()
    expect(svc.revoke).toHaveBeenCalledWith('u1', REASON)
    expect(w.emitted('changed')).toHaveLength(1)
  })

  it('conflit : la fiche est relue, l’erreur reste lisible après fermeture du dialogue', async () => {
    svc.revoke.mockRejectedValueOnce({ statusCode: 409, data: { code: 'gp-pro-not-active' } })
    const w = mountSection({ gpPro: true })
    await w.get('[data-test="action-revoke-gp-pro"]').trigger('click')
    await w.get('[data-test="gp-pro-text"]').setValue(REASON)
    await w.get('[data-test="gp-pro-dialog-submit"]').trigger('click')
    await flushPromises()
    expect(w.emitted('changed')).toHaveLength(1)
    await w.get('[data-test="gp-pro-dialog-cancel"]').trigger('click')
    expect(w.get('[data-test="gp-pro-section-error"]').text()).toContain('n’est plus actif')
  })

  it('ancien back : gestes masqués, mention discrète', async () => {
    svc.grant.mockRejectedValueOnce({ statusCode: 405, data: {} })
    const w = mountSection()
    await w.get('[data-test="action-grant-gp-pro"]').trigger('click')
    await w.get('[data-test="gp-pro-dialog-submit"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="gp-pro-section-unavailable"]').exists()).toBe(true)
    expect(w.find('[data-test="action-grant-gp-pro"]').exists()).toBe(false)
  })
})
