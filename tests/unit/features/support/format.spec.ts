import { describe, it, expect } from 'vitest'
import { STATUS_LABELS, statusTone, formatDate } from '@/features/support/utils/format'
import type { SupportTicketStatus } from '@/features/support/types/index'

describe('STATUS_LABELS', () => {
  it('traduit chacun des cinq statuts du backend', () => {
    expect(STATUS_LABELS).toEqual({
      NEW: 'Nouveau',
      ASSIGNED: 'Assigné',
      WAITING_USER: 'Attente utilisateur',
      WAITING_SUPPORT: 'Attente support',
      RESOLVED: 'Résolu',
    })
  })
})

describe('statusTone', () => {
  // Le ton porte l'urgence pour l'admin qui balaie la file : un ticket que
  // personne n'a pris (NEW) ou qui attend une reponse de notre cote
  // (WAITING_SUPPORT) doit ressortir, pas un ticket qui attend l'utilisateur.
  it('signale en danger un ticket que personne n’a encore pris', () => {
    expect(statusTone('NEW')).toBe('danger')
  })

  it('signale en warning un ticket qui attend une réponse du support', () => {
    expect(statusTone('WAITING_SUPPORT')).toBe('warning')
  })

  it('signale en succès un ticket résolu', () => {
    expect(statusTone('RESOLVED')).toBe('success')
  })

  it.each<SupportTicketStatus>(['ASSIGNED', 'WAITING_USER'])(
    'retombe sur info pour %s, qui n’appelle aucune action immédiate',
    (status) => {
      expect(statusTone(status)).toBe('info')
    },
  )
})

describe('formatDate', () => {
  it('rend un tiret cadratin quand la date est absente', () => {
    expect(formatDate(null)).toBe('—')
  })

  it('rend un tiret cadratin plutôt que « Invalid Date » sur une chaîne illisible', () => {
    expect(formatDate('pas-une-date')).toBe('—')
  })

  it('formate une date ISO en jour/mois et heure', () => {
    // Heure UTC fixe : le formatage depend du fuseau du runner, on verifie donc
    // la forme (JJ/MM HH:MM) et non une valeur horaire absolue.
    expect(formatDate('2026-09-05T14:30:00Z')).toMatch(/^\d{2}\/\d{2} \d{2}:\d{2}$/)
  })
})
