import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import SupportTicketThread from '@/features/support/components/SupportTicketThread.vue'
import { seedAuth } from '~/tests/helpers/auth'

// `seedAuth` cree l'admin `u1` : un ticket assigne a `u1` est donc « le mien ».
const base = {
  id: 't1',
  userId: 'u9',
  userDisplayName: 'Awa Diop',
  category: 'PAIEMENT',
  subject: 'Mon remboursement n’arrive pas',
  status: 'NEW',
  priority: 'NORMAL',
  assignedAdminId: null,
  assignedAdminEmail: null,
  createdAt: '2026-09-01T10:00:00Z',
  lastMessageAt: '2026-09-02T08:30:00Z',
  resolvedAt: null,
  messages: [],
}

const mine = {
  ...base,
  status: 'ASSIGNED',
  assignedAdminId: 'u1',
  assignedAdminEmail: 'admin@yadony.com',
}

const someoneElses = {
  ...base,
  status: 'ASSIGNED',
  assignedAdminId: 'u2',
  assignedAdminEmail: 'sofia@yadony.com',
}

const mountThread = (ticket: unknown, acting = false, actionError: string | null = null) =>
  mount(SupportTicketThread, { props: { ticket, acting, actionError } as never })

describe('SupportTicketThread', () => {
  beforeEach(() => seedAuth('ADMIN'))

  it('affiche l’en-tête du ticket et émet close sur la croix', async () => {
    const w = mountThread(base)
    expect(w.text()).toContain('Mon remboursement n’arrive pas')
    expect(w.text()).toContain('Awa Diop')

    await w.find('[aria-label="Fermer le détail"]').trigger('click')
    expect(w.emitted('close')).toHaveLength(1)
  })

  describe('assignation', () => {
    it('propose « M’assigner » sur un ticket libre', async () => {
      const w = mountThread(base)
      const btn = w.findAll('button').find(b => b.text().includes('M\'assigner'))!
      await btn.trigger('click')
      expect(w.emitted('assign')![0]).toEqual(['t1'])
    })

    it('propose « Reprendre » sur le ticket d’un collègue, et réassigne vers soi', async () => {
      const w = mountThread(someoneElses)
      const btn = w.findAll('button').find(b => b.text().includes('Reprendre'))!
      await btn.trigger('click')
      // Reprendre = se reassigner le ticket : il n'existe pas d'UI de
      // reassignation vers un tiers, l'admin ne peut prendre que pour lui-meme.
      expect(w.emitted('reassign')![0]).toEqual(['t1', 'u1'])
    })

    it('ne propose ni « M’assigner » ni « Reprendre » sur son propre ticket', () => {
      const w = mountThread(mine)
      const labels = w.findAll('button').map(b => b.text())
      expect(labels.some(l => l.includes('M\'assigner'))).toBe(false)
      expect(labels.some(l => l.includes('Reprendre'))).toBe(false)
    })

    it('masque toutes les actions à un rôle sans SUPPORT_TICKET_MANAGE', () => {
      seedAuth('SUPPORT', { SUPPORT_TICKET_MANAGE: false })
      const w = mountThread(base)
      expect(w.findAll('button').some(b => b.text().includes('M\'assigner'))).toBe(false)
      expect(w.find('textarea').exists()).toBe(false)
    })
  })

  describe('réponse', () => {
    it('n’ouvre le champ de réponse que sur un ticket qui m’est assigné', () => {
      expect(mountThread(mine).find('textarea').exists()).toBe(true)
      expect(mountThread(someoneElses).find('textarea').exists()).toBe(false)
    })

    it('invite à s’assigner le ticket quand on ne l’a pas', () => {
      expect(mountThread(someoneElses).text()).toMatch(/Assignez-vous ce ticket/i)
    })

    it('émet reply avec le contenu saisi puis vide le brouillon', async () => {
      const w = mountThread(mine)
      await w.find('textarea').setValue('  Bonjour, je regarde cela.  ')
      await w.findAll('button').find(b => b.text() === 'Répondre')!.trigger('click')

      // Le contenu part debarrasse de ses espaces de bord.
      expect(w.emitted('reply')![0]).toEqual(['t1', 'Bonjour, je regarde cela.'])
      expect((w.find('textarea').element as HTMLTextAreaElement).value).toBe('')
    })

    it('garde le bouton Répondre inerte tant que le brouillon est vide ou blanc', async () => {
      const w = mountThread(mine)
      const btn = () => w.findAll('button').find(b => b.text().includes('Répondre'))!
      expect(btn().attributes('disabled')).toBeDefined()

      await w.find('textarea').setValue('   ')
      expect(btn().attributes('disabled')).toBeDefined()
    })

    it('n’envoie rien pendant qu’une action est déjà en cours', async () => {
      const w = mountThread(mine, true)
      await w.find('textarea').setValue('Bonjour')
      await w.findAll('button').find(b => b.text().includes('Envoi'))!.trigger('click')
      expect(w.emitted('reply')).toBeUndefined()
    })
  })

  describe('résolution', () => {
    it('émet resolve sur son propre ticket', async () => {
      const w = mountThread(mine)
      await w.findAll('button').find(b => b.text().includes('Marquer résolu'))!.trigger('click')
      expect(w.emitted('resolve')![0]).toEqual(['t1'])
    })

    it('ferme toute action sur un ticket résolu', () => {
      const resolved = { ...mine, status: 'RESOLVED', resolvedAt: '2026-09-03T12:00:00Z' }
      const w = mountThread(resolved)
      expect(w.text()).toMatch(/plus aucune action possible/i)
      expect(w.find('textarea').exists()).toBe(false)
      expect(w.findAll('button').some(b => b.text().includes('Marquer résolu'))).toBe(false)
    })
  })

  describe('fil de messages', () => {
    it('annonce un fil vide', () => {
      expect(mountThread(base).text()).toMatch(/Aucun message/i)
    })

    it('attribue chaque message à son auteur', () => {
      const withMessages = {
        ...mine,
        messages: [
          { id: 'm1', authorType: 'USER', content: 'Bonjour', createdAt: '2026-09-01T10:00:00Z' },
          { id: 'm2', authorType: 'ADMIN', content: 'Nous regardons', createdAt: '2026-09-01T11:00:00Z' },
        ],
      }
      const w = mountThread(withMessages)
      expect(w.text()).toContain('Bonjour')
      expect(w.text()).toContain('Nous regardons')
      expect(w.text()).toContain('Support')
      expect(w.text()).toContain('Awa Diop')
    })
  })

  it('affiche l’erreur d’action renvoyée par le serveur', () => {
    const w = mountThread(base, false, 'Ticket déjà assigné à un autre admin.')
    expect(w.text()).toContain('Ticket déjà assigné à un autre admin.')
  })

  describe('pieces jointes', () => {
    it('rend la grille de vignettes pour un message avec des images', () => {
      const withAttachments = {
        ...mine,
        messages: [
          {
            id: 'm1',
            authorType: 'USER',
            content: '',
            createdAt: '2026-09-01T10:00:00Z',
            attachments: [
              { id: 'a1', url: 'https://signed/1', contentType: 'image/jpeg' },
            ],
          },
        ],
      }
      const w = mountThread(withAttachments)
      expect(w.findAll('img')).toHaveLength(1)
      expect(w.findAll('img')[0].attributes('src')).toBe('https://signed/1')
    })

    it('pas de paragraphe vide quand contenu textuel absent', () => {
      const imageOnly = {
        ...mine,
        messages: [
          {
            id: 'm1',
            authorType: 'USER',
            content: '',
            createdAt: '2026-09-01T10:00:00Z',
            attachments: [
              { id: 'a1', url: 'https://signed/1', contentType: 'image/jpeg' },
            ],
          },
        ],
      }
      const w = mountThread(imageOnly)
      const paras = w.findAll('p.whitespace-pre-wrap')
      expect(paras).toHaveLength(0)
    })
  })
})
