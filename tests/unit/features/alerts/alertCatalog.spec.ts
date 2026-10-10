import { describe, it, expect } from 'vitest'
import { alertFacts, alertGuide, alertLinks, alertSampleRows, alertSummary, entityLink } from '@/features/alerts/lib/alertCatalog'
import type { AdminAlert } from '@/features/alerts/types/index'

const P = '11111111-2222-3333-4444-555555555555'
const B = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const U = '99999999-8888-7777-6666-555555555555'

function alert(type: string, payload: Record<string, unknown> = {}, detail: string | null = null): AdminAlert {
  return { id: 'a1', type, severity: 'WARN', detail, payload, resolved: false, resolvedAt: null, createdAt: '2026-10-06T12:00:00' }
}

describe('alertGuide', () => {
  it('chaque règle de cohérence INV-01…INV-17 a une fiche en clair et finit par la consigne de clôture', () => {
    for (let i = 1; i <= 17; i++) {
      const code = `INV-${String(i).padStart(2, '0')}`
      const g = alertGuide(`MONEY_INVARIANT_${code}`)
      expect(g.title).not.toContain('MONEY_INVARIANT')
      expect(g.category).toContain(code)
      expect(g.actions.length).toBeGreaterThan(1)
      expect(g.actions.at(-1)).toContain('Lignes en faute actuellement')
    }
  })

  it('règle inconnue : fiche par défaut nommée d’après son code', () => {
    expect(alertGuide('MONEY_INVARIANT_INV-99').title).toBe('Règle de cohérence INV-99')
  })

  it('reconnaît les types suffixés d’un identifiant par leur préfixe', () => {
    expect(alertGuide(`PAYOUT_HELD_${P}`).title).toBe('Versement retenu : voyageur gelé')
    expect(alertGuide('PAWAPAY_BALANCE_LOW_XOF').title).toBe('Solde pawaPay bas')
    expect(alertGuide('ESCROW_J48_TIMEOUT').title).toBe('Paiement en séquestre depuis plus de 48 h')
    expect(alertGuide('RETURN_DEADLINE_EXPIRED').actions.length).toBeGreaterThan(1)
    expect(alertGuide(`DELIVERY_PAYMENT_NOT_IN_ESCROW_${P}`).title).toBe('Colis livré sans séquestre')
  })

  it('alertes de séquestre carte : fiches avec étapes concrètes de correction', () => {
    const id = '11111111-2222-3333-4444-555555555555'
    for (const type of ['ESCROW_J48_TIMEOUT', `RECON_STRIPE_${id}`, `ESCROW_CAPTURE_FAILED_${id}`]) {
      const g = alertGuide(type)
      expect(g.actions[0]).toContain('« Resynchroniser avec Stripe »')
      expect(g.actions[1]).toContain('« Forcer le versement au voyageur »')
      expect(g.actions[2]).toContain('Autorisation carte expirée')
    }
    expect(alertGuide(`RECON_STRIPE_${id}`).title).toBe('Écart de rapprochement Stripe')
    expect(alertGuide(`RECON_STRIPE_${id}`).explanation).toContain('SEQUESTRE_NON_CAPTURE')
    expect(alertGuide(`ESCROW_CAPTURE_FAILED_${id}`).title).toBe('Encaissement du séquestre impossible')
  })

  it('libelle les données du rapprochement', () => {
    const facts = alertFacts(alert('RECON_STRIPE_x', { prestataire: 'STRIPE', reference: 'r', ecart: 'AUTORISE_NON_ENREGISTRE', detail: 'd' }))
    expect(facts.map(f => f.label)).toEqual(['Prestataire', 'Référence', 'Écart constaté', 'Détail'])
  })

  it('le préfixe le plus long l’emporte', () => {
    expect(alertGuide('PAYOUT_HOLD_LIFTED').title).toBe('Retenue de versement levée')
  })

  it('type inconnu : titre lisible sans l’identifiant', () => {
    const g = alertGuide(`SOMETHING_ODD_${P}`)
    expect(g.title).toBe('Something odd')
    expect(g.category).toBe('Autre')
  })
})

describe('alertSummary', () => {
  it('reprend la phrase du back', () => {
    expect(alertSummary(alert('X', {}, 'Solde pawaPay XOF sous le seuil'))).toBe('Solde pawaPay XOF sous le seuil')
  })
  it('anciennes alertes sans détail : reconstruit depuis le payload', () => {
    expect(alertSummary(alert('MONEY_INVARIANT_INV-05', { lignesEnFaute: 3 }))).toBe('3 ligne(s) en faute au moment de l’alerte')
    expect(alertSummary(alert('ESCROW_J48_TIMEOUT', { amount: '42.00' }))).toBe('Montant : 42.00')
    expect(alertSummary(alert('PAWAPAY_BALANCE_LOW_XOF', { amount: '10', currency: 'XOF' }))).toBe('Montant : 10 XOF')
    expect(alertSummary(alert('RETURN_DEADLINE_EXPIRED', { returnDeadline: '2026-10-01' }))).toBe('Échéance de retour : 2026-10-01')
    expect(alertSummary(alert('RETURN_DEADLINE_EXPIRED'))).toBe(alertGuide('RETURN_DEADLINE_EXPIRED').explanation)
  })
})

describe('alertLinks / entityLink', () => {
  it('lie paiement, colis et parties, sans doublon', () => {
    const links = alertLinks(alert('PAYOUT_HELD_x', { paymentId: P, bidId: B, travelerId: U, userId: U, reason: 'gel' }))
    expect(links.map(l => l.label)).toEqual(['Ouvrir le paiement', 'Ouvrir le colis', 'Fiche du voyageur'])
    expect(links[0].to).toEqual({ path: '/transactions', query: { open: P } })
    expect(links[1].to).toEqual({ path: '/colis', query: { open: B } })
    expect(links[2].to).toEqual({ path: '/users', query: { query: U, open: U } })
  })

  it('ajoute l’onglet utile pour les règles INV-11 et INV-14', () => {
    expect(alertLinks(alert('MONEY_INVARIANT_INV-14'))[0].to.query).toEqual({ tab: 'wallet-refunds' })
    expect(alertLinks(alert('MONEY_INVARIANT_INV-11'))[0].to.query).toEqual({ tab: 'mobile-money' })
  })

  it('colonnes SQL snake_case et valeurs non-UUID', () => {
    expect(entityLink('payment_id', P)?.to.path).toBe('/transactions')
    expect(entityLink('user_id', U)?.label).toBe('Fiche de l’utilisateur')
    expect(entityLink('senderId', U)?.label).toBe('Fiche de l’expéditeur')
    expect(entityLink('payment_id', 'pas-un-uuid')).toBeNull()
    expect(entityLink('wallet_id', P)).toBeNull()
  })
})

describe('alertFacts / alertSampleRows', () => {
  it('libelle les clés connues, garde les autres, masque les exemples', () => {
    const facts = alertFacts(alert('X', { paymentId: P, custom: 1, vide: null, obj: { a: 1 }, exemples: [{ a: 1 }] }))
    expect(facts).toEqual([
      { key: 'paymentId', label: 'Paiement', value: P },
      { key: 'custom', label: 'custom', value: '1' },
      { key: 'vide', label: 'vide', value: '—' },
      { key: 'obj', label: 'obj', value: '{"a":1}' },
    ])
  })
  it('exemples : uniquement les objets', () => {
    expect(alertSampleRows(alert('X', { exemples: [{ a: 1 }, 'x', null] }))).toEqual([{ a: 1 }])
    expect(alertSampleRows(alert('X'))).toEqual([])
  })
})
