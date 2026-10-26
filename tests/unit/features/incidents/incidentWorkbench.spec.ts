import { describe, it, expect } from 'vitest'
import {
  defaultIncidentKey, disputeIncident, disputeResolutionLabel, disputeSentence, disputeTypeLabel, filterIncidents,
  followingIncidentKey, groupIncidents, hasOwnForm, incidentActionsFor, incidentAge, incidentLabel, incidentNoteError,
  incidentStatusMeta, incidentSubtitle, neighbourIncidentKey, noShowDecisionOf, noShowIncident, noShowNeedsDecision,
  queueOrder, summarizeIncidents,
} from '@/features/incidents/lib/incidentWorkbench'
import { dispute, noShow } from './noShowFixtures'

const NOW = Date.parse('2026-10-26T12:00:00Z')
const H = 3_600_000

describe('libellés', () => {
  it('traduit le type d’un litige, les motifs de l’équipe et les codes inconnus', () => {
    expect(disputeTypeLabel('TRAVELER_DELIVERY_NO_SHOW')).toBe('Voyageur absent à la livraison')
    expect(disputeTypeLabel('SENDER_NO_SHOW_CONTESTED')).toBe('Absence de l’expéditeur contestée')
    expect(disputeTypeLabel('ADMIN_PARCEL_DAMAGED')).toBe('Colis abîmé')
    expect(disputeTypeLabel('ADMIN_NOUVEAU_MOTIF')).toBe('Nouveau motif')
    expect(disputeTypeLabel('WEIRD_TYPE')).toBe('Weird type')
    expect(disputeTypeLabel('')).toBe('Litige')
  })

  it('nomme la résolution d’un litige', () => {
    expect(disputeResolutionLabel('SPLIT')).toBe('Séquestre partagé')
    expect(disputeResolutionLabel('NOUVELLE')).toBe('Nouvelle')
    expect(disputeResolutionLabel(null)).toBeNull()
  })

  it('une phrase dit pourquoi le litige existe', () => {
    expect(disputeSentence(dispute({ type: 'SENDER_NO_SHOW_CONTESTED' }))).toMatch(/conteste l’absence/)
    expect(disputeSentence(dispute({ type: 'TRAVELER_DELIVERY_NO_SHOW' }))).toMatch(/à la livraison/)
    expect(disputeSentence(dispute({ type: 'ADMIN_OTHER' }))).toBe('Koro DIAKITE et Ibra DIANE sont en désaccord sur ce colis.')
    expect(disputeSentence(dispute({ type: 'ADMIN_OTHER', senderName: null, travelerName: null }))).toBe('L’expéditeur et le voyageur sont en désaccord sur ce colis.')
  })
})

describe('construction', () => {
  it('un litige ouvert est à traiter, la clé le distingue d’une absence de même identifiant', () => {
    const d = disputeIncident(dispute({ id: 'x' }))
    const n = noShowIncident(noShow({ id: 'x' }))
    expect(d).toMatchObject({ key: 'dispute:x', kind: 'DISPUTE', todo: true, title: 'Voyageur absent à la livraison' })
    expect(n).toMatchObject({ key: 'noshow:x', kind: 'NOSHOW', todo: true })
    expect(disputeIncident(dispute({ status: 'RESOLVED' })).todo).toBe(false)
  })

  it('une absence attend une décision tant qu’aucun admin n’a tranché', () => {
    expect(noShowNeedsDecision(noShow({ status: 'PENDING_CONFIRMATION' }))).toBe(true)
    expect(noShowNeedsDecision(noShow({ status: 'CONTESTED' }))).toBe(true)
    expect(noShowNeedsDecision(noShow({ status: 'CONFIRMED' }))).toBe(false)
    expect(noShowNeedsDecision(noShow({ status: 'PENDING_CONFIRMATION', adminDecision: 'REJECTED' }))).toBe(false)
  })

  it('le groupe d’une absence suit sa portée, ou son motif sur l’ancien back', () => {
    expect(noShowIncident(noShow({ scope: 'HANDOVER' })).title).toBe('Déclaration d’absence à la remise')
    expect(noShowIncident(noShow({ scope: 'DELIVERY' })).title).toBe('Déclaration d’absence à la livraison')
    expect(noShowIncident(noShow({ scope: null, reason: 'SENDER_NO_SHOW' })).title).toBe('Déclaration d’absence à la remise')
    expect(noShowIncident(noShow({ scope: null, reason: 'TRAVELER_DELIVERY_NO_SHOW' })).title).toBe('Déclaration d’absence à la livraison')
  })
})

describe('lecture d’une ligne', () => {
  it('litige : parties, gel du remboursement, statut', () => {
    const i = disputeIncident(dispute())
    expect(incidentLabel(i)).toBe('Koro DIAKITE → Ibra DIANE')
    expect(incidentSubtitle(i)).toBe('Remboursement gelé')
    expect(incidentSubtitle(disputeIncident(dispute({ refundFrozen: false })))).toBeNull()
    expect(incidentLabel(disputeIncident(dispute({ senderName: null, travelerName: null })))).toBe('— → —')
    expect(incidentStatusMeta(i)).toEqual({ label: 'Ouvert', tone: 'warning' })
  })

  it('absence : phrase, trajet et montant', () => {
    const i = noShowIncident(noShow())
    expect(incidentLabel(i)).toMatch(/Awa D\./)
    expect(incidentSubtitle(i)).toMatch(/Bamako → Abidjan/)
    expect(incidentSubtitle(noShowIncident(noShow({ trip: null, amount: null, paymentMethod: null })))).toBeNull()
    expect(incidentStatusMeta(i).label).toBe('En attente')
  })
})

describe('incidentAge', () => {
  const at = (hoursAgo: number) => new Date(NOW - hoursAgo * H).toISOString()

  it('null pour un incident traité', () => {
    expect(incidentAge(disputeIncident(dispute({ status: 'RESOLVED' })), NOW)).toBeNull()
  })

  it('litige : minutes, heures, jours, et seuils 2 j / 7 j', () => {
    const age = (h: number) => incidentAge(disputeIncident(dispute({ createdAt: at(h) })), NOW)
    expect(age(0.2)).toEqual({ label: '< 1 h', tone: 'neutral' })
    expect(age(5)).toEqual({ label: '5 h', tone: 'neutral' })
    expect(age(3 * 24)).toEqual({ label: '3 j', tone: 'warning' })
    expect(age(9 * 24)).toEqual({ label: '9 j', tone: 'danger' })
  })

  it('date illisible : traité comme neuf', () => {
    expect(incidentAge(disputeIncident(dispute({ createdAt: 'pas une date' })), NOW)).toEqual({ label: '< 1 h', tone: 'neutral' })
  })

  it('absence en attente : le temps qui reste, urgent sous 2 h', () => {
    expect(incidentAge(noShowIncident(noShow({ remainingMinutes: 360 })), NOW)).toEqual({ label: 'reste 6 h', tone: 'warning' })
    expect(incidentAge(noShowIncident(noShow({ remainingMinutes: 30 })), NOW)).toEqual({ label: 'reste 30 min', tone: 'danger' })
    expect(incidentAge(noShowIncident(noShow({ remainingMinutes: 0 })), NOW)).toEqual({ label: 'échu', tone: 'danger' })
  })

  it('absence contestée : son ancienneté, faute de délai', () => {
    const i = noShowIncident(noShow({ status: 'CONTESTED', createdAt: at(9 * 24) }))
    expect(incidentAge(i, NOW)).toEqual({ label: '9 j', tone: 'danger' })
  })
})

describe('groupement et ordre', () => {
  const a = disputeIncident(dispute({ id: 'a', createdAt: '2026-10-17T10:00:00' }))
  const b = disputeIncident(dispute({ id: 'b', createdAt: '2026-10-10T10:00:00' }))
  const c = disputeIncident(dispute({ id: 'c', type: 'ADMIN_PARCEL_LOST', createdAt: '2026-10-25T10:00:00', refundFrozen: false }))
  const urgent = noShowIncident(noShow({ id: 'u', remainingMinutes: 20 }))
  const calm = noShowIncident(noShow({ id: 'k', remainingMinutes: 400, scope: 'DELIVERY' }))
  const done = disputeIncident(dispute({ id: 'z', status: 'RESOLVED', type: 'ADMIN_OTHER' }))

  it('regroupe par nature, du plus ancien au plus récent dans un groupe', () => {
    const groups = groupIncidents([a, b, c], NOW)
    const delivery = groups.find((g) => g.title === 'Voyageur absent à la livraison')!
    expect(delivery.incidents.map((i) => i.id)).toEqual(['b', 'a'])
    expect(groups).toHaveLength(2)
  })

  it('trie les groupes : échéance courte, en retard, à traiter, traité', () => {
    const groups = groupIncidents([done, c, calm, a, urgent], NOW)
    expect(groups.map((g) => g.rank)).toEqual([4, 3, 2, 2, 1])
    expect(groups[0]!.title).toBe('Déclaration d’absence à la remise')
    expect(groups[1]!.title).toBe('Voyageur absent à la livraison')
    expect(queueOrder(groups)[0]!.id).toBe('u')
  })

  it('une absence contestée compte comme en retard', () => {
    const contested = noShowIncident(noShow({ id: 'k2', status: 'CONTESTED', createdAt: '2026-10-26T10:00:00Z' }))
    expect(groupIncidents([contested], NOW)[0]!.rank).toBe(3)
  })
})

describe('filtre', () => {
  const items = [
    disputeIncident(dispute({ id: 'd1' })),
    disputeIncident(dispute({ id: 'd2', senderName: 'Fatou BA', travelerName: 'Omar SY', type: 'ADMIN_PARCEL_LOST' })),
    noShowIncident(noShow({ id: 'n1' })),
  ]

  it('par nature', () => {
    expect(filterIncidents(items, { query: '', kind: 'DISPUTE' }).map((i) => i.id)).toEqual(['d1', 'd2'])
    expect(filterIncidents(items, { query: '', kind: 'NOSHOW' }).map((i) => i.id)).toEqual(['n1'])
    expect(filterIncidents(items, { query: '  ', kind: 'ALL' })).toHaveLength(3)
  })

  it('recherche libre : nom, motif, trajet, colis', () => {
    expect(filterIncidents(items, { query: 'omar', kind: 'ALL' }).map((i) => i.id)).toEqual(['d2'])
    expect(filterIncidents(items, { query: 'perdu', kind: 'ALL' }).map((i) => i.id)).toEqual(['d2'])
    expect(filterIncidents(items, { query: 'abidjan', kind: 'ALL' }).map((i) => i.id)).toEqual(['n1'])
    expect(filterIncidents(items, { query: '89125c9c', kind: 'ALL' })).toHaveLength(3)
    expect(filterIncidents(items, { query: 'introuvable', kind: 'ALL' })).toEqual([])
  })
})

describe('synthèse', () => {
  it('compte ce qui reste à traiter', () => {
    const items = [
      disputeIncident(dispute({ id: 'a', createdAt: '2026-10-10T10:00:00' })),
      disputeIncident(dispute({ id: 'b', createdAt: '2026-10-25T10:00:00', refundFrozen: false })),
      disputeIncident(dispute({ id: 'c', status: 'RESOLVED' })),
      noShowIncident(noShow({ id: 'u', remainingMinutes: 20 })),
      noShowIncident(noShow({ id: 'k', remainingMinutes: 400 })),
      noShowIncident(noShow({ id: 'e', remainingMinutes: 0 })),
      noShowIncident(noShow({ id: 'x', status: 'CONFIRMED' })),
    ]
    expect(summarizeIncidents(items, NOW)).toEqual({ todo: 5, disputes: 2, noshows: 3, late: 2, frozen: 1, urgent: 2 })
  })

  it('rien : tout à zéro', () => {
    expect(summarizeIncidents([], NOW)).toEqual({ todo: 0, disputes: 0, noshows: 0, late: 0, frozen: 0, urgent: 0 })
  })
})

describe('sélection', () => {
  const order = ['a', 'b', 'c'].map((id) => disputeIncident(dispute({ id })))
  it('défaut, voisins et suivant', () => {
    expect(defaultIncidentKey(order)).toBe('dispute:a')
    expect(defaultIncidentKey([])).toBeNull()
    expect(neighbourIncidentKey(order, 'dispute:a', 1)).toBe('dispute:b')
    expect(neighbourIncidentKey(order, 'dispute:a', -1)).toBe('dispute:a')
    expect(neighbourIncidentKey(order, 'dispute:c', 1)).toBe('dispute:c')
    expect(neighbourIncidentKey(order, null, 1)).toBe('dispute:a')
    expect(neighbourIncidentKey([], null, 1)).toBeNull()
    expect(followingIncidentKey(order, 'dispute:a')).toBe('dispute:b')
    expect(followingIncidentKey(order, 'dispute:c')).toBe('dispute:b')
    expect(followingIncidentKey(order.slice(0, 1), 'dispute:a')).toBeNull()
    expect(followingIncidentKey(order, 'inconnu')).toBe('dispute:a')
    expect(followingIncidentKey([], null)).toBeNull()
  })
})

describe('gestes et notes', () => {
  const can = { resolve: true, split: true }

  it('litige ouvert : trancher, partager, fonds de garantie, classer', () => {
    expect(incidentActionsFor(disputeIncident(dispute()), can)).toEqual(['RESOLVED_FOR_SENDER', 'RESOLVED_FOR_TRAVELER', 'SPLIT', 'GUARANTEE', 'DISMISSED'])
  })

  it('partager exige les droits d’argent', () => {
    expect(incidentActionsFor(disputeIncident(dispute()), { resolve: true, split: false })).not.toContain('SPLIT')
  })

  it('sans droit de trancher ou déjà traité : aucun geste', () => {
    expect(incidentActionsFor(disputeIncident(dispute()), { resolve: false, split: true })).toEqual([])
    expect(incidentActionsFor(disputeIncident(dispute({ status: 'RESOLVED' })), can)).toEqual([])
  })

  it('absence : confirmer et rejeter selon ce que le back autorise', () => {
    expect(incidentActionsFor(noShowIncident(noShow()), can)).toEqual(['NOSHOW_CONFIRM', 'NOSHOW_REJECT'])
    expect(incidentActionsFor(noShowIncident(noShow({ canReject: false })), can)).toEqual(['NOSHOW_CONFIRM'])
    expect(incidentActionsFor(noShowIncident(noShow({ canConfirm: false, canReject: false })), can)).toEqual([])
  })

  it('note : 3 à 500 pour un litige, 10 à 500 pour une absence, aucune pour l’ancien back', () => {
    expect(incidentNoteError('ab', 'DISMISSED')).toMatch(/3 caractères/)
    expect(incidentNoteError('abc', 'DISMISSED')).toBeNull()
    expect(incidentNoteError('x'.repeat(501), 'DISMISSED')).toMatch(/500/)
    expect(incidentNoteError('trop court', 'NOSHOW_CONFIRM')).toBeNull()
    expect(incidentNoteError('court', 'NOSHOW_REJECT')).toMatch(/10 caractères/)
    expect(incidentNoteError('x'.repeat(501), 'NOSHOW_REJECT')).toMatch(/500/)
    expect(incidentNoteError('', 'NOSHOW_CONFIRM', true)).toBeNull()
  })

  it('utilitaires de geste', () => {
    expect(hasOwnForm('SPLIT')).toBe(true)
    expect(hasOwnForm('GUARANTEE')).toBe(true)
    expect(hasOwnForm('DISMISSED')).toBe(false)
    expect(noShowDecisionOf('NOSHOW_CONFIRM')).toBe('confirm')
    expect(noShowDecisionOf('NOSHOW_REJECT')).toBe('reject')
  })
})
