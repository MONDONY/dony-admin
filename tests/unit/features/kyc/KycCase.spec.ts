import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import KycCase from '@/features/kyc/components/KycCase.vue'

const ROW = {
  userId: 'u1', userName: 'Awa Diop', userPhone: '+221 77 *** ** 12', provider: 'DIDIT', kycStatus: 'IN_REVIEW',
  submittedAt: '2026-09-25T10:00:00Z', waitingHours: 50,
}
const KYC = {
  userId: 'u1', kycStatus: 'PENDING', verificationStatus: 'PENDING', stripeSessionId: 'sess_1', stripeStatus: 'In Review',
  stripeCreatedAt: '2026-09-25T09:50:00Z', stripeLastErrorCode: 'selfie_face_mismatch', stripeLastErrorReason: null,
  stripeUnavailable: false, provider: 'DIDIT', providerSessionUrl: 'https://business.didit.me/session/1', history: [],
}

function mountCase(props: Record<string, unknown> = {}) {
  return mount(KycCase, { props: { row: ROW, userId: 'u1', kyc: KYC, loading: false, error: null, ...props } as never })
}

describe('KycCase', () => {
  it('en-tête : nom, statut, fournisseur, retard, téléphone et attente', () => {
    const w = mountCase()
    expect(w.find('[data-test="kyc-case-title"]').text()).toBe('Awa Diop')
    expect(w.find('[data-test="kyc-detail-status"]').text()).toContain('En attente de décision')
    expect(w.find('[data-test="kyc-detail-provider"]').text()).toBe('Didit')
    expect(w.find('[data-test="kyc-case-overdue"]').exists()).toBe(true)
    const sub = w.find('[data-test="kyc-case-subline"]').text()
    expect(sub).toContain('+221 77 *** ** 12')
    expect(sub).toContain('soumise le')
    expect(sub).toContain('2 j 2 h d’attente')
    expect(w.text()).not.toContain('—')
  })

  it('dossier dans les temps : pas de pastille de retard', () => {
    expect(mountCase({ row: { ...ROW, waitingHours: 3 } }).find('[data-test="kyc-case-overdue"]').exists()).toBe(false)
  })

  it('revue manuelle : explique pourquoi, donne ce que dit le fournisseur et le lien de session sécurisé', () => {
    const w = mountCase()
    expect(w.find('[data-test="kyc-why-review"]').text()).toContain('revue manuelle')
    expect(w.find('[data-test="kyc-why-review"]').text()).toContain('ne sont pas stockés chez Yadony')
    expect(w.find('[data-test="kyc-provider-status"]').text()).toBe('In Review')
    expect(w.find('[data-test="kyc-provider-created"]').exists()).toBe(true)
    expect(w.find('[data-test="kyc-provider-error"]').text()).toContain('Selfie différent de la photo du document')
    const link = w.find('[data-test="kyc-provider-link"]')
    expect(link.text()).toBe('Ouvrir la session chez Didit ↗')
    expect(link.attributes('href')).toBe('https://business.didit.me/session/1')
    expect(link.attributes('target')).toBe('_blank')
    expect(link.attributes('rel')).toBe('noopener noreferrer')
    // le lien du bloc d'historique ne doublonne pas
    expect(w.findAll('[data-test="kyc-provider-link"]')).toHaveLength(1)
  })

  it('le motif signalé préfère le texte du fournisseur au code', () => {
    const w = mountCase({ kyc: { ...KYC, stripeLastErrorReason: 'Visage non concordant' } })
    expect(w.find('[data-test="kyc-provider-error"]').text()).toContain('Visage non concordant')
  })

  it('aucune session : rien à décider, statut « aucune pièce »', () => {
    const w = mountCase({
      row: { ...ROW, kycStatus: 'PENDING', queueStatus: 'IN_PROGRESS', waitingHours: null },
      kyc: { userId: 'u1', kycStatus: 'PENDING', verificationStatus: 'PENDING', stripeUnavailable: false },
    })
    expect(w.find('[data-test="kyc-why-no-session"]').text()).toContain('Rien à décider')
    expect(w.find('[data-test="kyc-why-review"]').exists()).toBe(false)
    expect(w.find('[data-test="kyc-provider-status"]').text()).toBe('Aucune pièce envoyée')
    expect(w.find('[data-test="kyc-provider-link"]').exists()).toBe(false)
    expect(w.find('[data-test="kyc-case-overdue"]').exists()).toBe(false)
  })

  it('statut inconnu chez le fournisseur avec une session : « Inconnu »', () => {
    const w = mountCase({ kyc: { ...KYC, stripeStatus: null } })
    expect(w.find('[data-test="kyc-provider-status"]').text()).toBe('Inconnu')
  })

  it('refus : motif lisible et décision admin dans le dossier', () => {
    const w = mountCase({
      row: { ...ROW, kycStatus: 'REJECTED', decisionKind: 'REJECTED', waitingHours: null },
      kyc: {
        ...KYC, kycStatus: 'REJECTED', verificationStatus: 'REJECTED', rejectionCode: 'document_expired',
        rejectionReason: 'Passeport expiré en 2024', decisionKind: 'REJECTED', decidedByAdminEmail: 'a@yadony.com',
        decidedAt: '2026-09-26T09:30:00Z', decisionReason: 'Passeport expiré',
      },
    })
    expect(w.find('[data-test="kyc-detail-status"]').text()).toContain('Refusée')
    expect(w.find('[data-test="kyc-case-decision-badge"]').text()).toBe('Refusée par un admin')
    expect(w.find('[data-test="kyc-detail-rejection"]').text()).toContain('Passeport expiré en 2024')
    expect(w.find('[data-test="kyc-decision-by"]').text()).toContain('a@yadony.com')
    expect(w.find('[data-test="kyc-why-review"]').exists()).toBe(false)
  })

  it('refus sans texte : le code se lit en français', () => {
    const w = mountCase({ kyc: { ...KYC, kycStatus: 'REJECTED', rejectionCode: 'document_expired', rejectionReason: null } })
    expect(w.find('[data-test="kyc-detail-rejection"]').text()).toContain('Document expiré')
  })

  it('sans ligne de file (lien profond) : repli sur l’identifiant, fournisseur du dossier', () => {
    const w = mountCase({ row: null, userId: 'abcdef12-0000' })
    expect(w.find('[data-test="kyc-case-title"]').text()).toBe('Utilisateur abcdef12')
    expect(w.find('[data-test="kyc-detail-provider"]').text()).toBe('Didit')
    expect(w.find('[data-test="kyc-case-subline"]').exists()).toBe(false)
  })

  it('nom absent : repli lisible', () => {
    expect(mountCase({ row: { ...ROW, userName: null } }).find('[data-test="kyc-case-title"]').text()).toBe('Nom non renseigné')
  })

  it('chargement, erreur et fournisseur injoignable', () => {
    expect(mountCase({ kyc: null, loading: true }).find('[data-test="kyc-detail-loading"]').exists()).toBe(true)
    const w = mountCase({ kyc: null, error: 'Utilisateur introuvable' })
    expect(w.find('[data-test="kyc-detail-error"]').text()).toBe('Utilisateur introuvable')
    expect(w.find('[data-test="kyc-provider-facts"]').exists()).toBe(false)
    expect(mountCase({ kyc: { ...KYC, stripeUnavailable: true } }).find('[data-test="kyc-provider-unavailable"]').exists()).toBe(true)
  })

  it('une erreur d’action avec dossier chargé ne masque pas le dossier', () => {
    const w = mountCase({ error: 'Réinitialisation impossible' })
    expect(w.find('[data-test="kyc-detail-error"]').exists()).toBe(false)
    expect(w.find('[data-test="kyc-provider-facts"]').exists()).toBe(true)
  })

  it('aucun dossier choisi', () => {
    const w = mountCase({ row: null, userId: '', kyc: null })
    expect(w.find('[data-test="kyc-case-empty"]').exists()).toBe(true)
  })
})
