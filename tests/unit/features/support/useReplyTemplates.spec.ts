import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/features/support/services/supportService')
import { useReplyTemplates } from '@/features/support/composables/useReplyTemplates'
import { supportService } from '@/features/support/services/supportService'
import { QUICK_REPLIES } from '@/features/support/lib/supportWorkbench'
const svc = supportService as any

const tpl = (id: string, label: string) => ({ id, label, content: `Texte ${label}`, sortOrder: 10 })
const httpError = (status: number, data: Record<string, unknown> = {}) => Object.assign(new Error(`${status}`), { statusCode: status, data })

describe('useReplyTemplates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    svc.listTemplates = vi.fn().mockResolvedValue([tpl('a', 'Merci'), tpl('b', 'Clôture')])
    svc.createTemplate = vi.fn().mockResolvedValue({})
    svc.updateTemplate = vi.fn().mockResolvedValue({})
    svc.deleteTemplate = vi.fn().mockResolvedValue(undefined)
  })

  it('avant la lecture : la liste fixe de l’app', () => {
    const t = useReplyTemplates()
    expect(t.options.value).toEqual(QUICK_REPLIES)
    expect(t.loaded.value).toBe(false)
  })

  it('lues sur le serveur : ses réponses, dans son ordre', async () => {
    const t = useReplyTemplates()
    await t.load()
    expect(t.options.value).toEqual([{ label: 'Merci', text: 'Texte Merci' }, { label: 'Clôture', text: 'Texte Clôture' }])
    expect(t.loaded.value).toBe(true)
    expect(t.unavailable.value).toBe(false)
  })

  it('l’équipe les a toutes retirées : liste vide, pas de retour à la liste fixe', async () => {
    svc.listTemplates.mockResolvedValue([])
    const t = useReplyTemplates()
    await t.load()
    expect(t.options.value).toEqual([])
  })

  it('ancien back (404 sans code) : liste fixe, gestion indisponible', async () => {
    svc.listTemplates.mockRejectedValue(httpError(404))
    const t = useReplyTemplates()
    await t.load()
    expect(t.unavailable.value).toBe(true)
    expect(t.loaded.value).toBe(false)
    expect(t.options.value).toEqual(QUICK_REPLIES)
  })

  it('réponse d’une autre forme : traitée comme un ancien back', async () => {
    svc.listTemplates.mockResolvedValue('<html>')
    const t = useReplyTemplates()
    await t.load()
    expect(t.unavailable.value).toBe(true)
    expect(t.options.value).toEqual(QUICK_REPLIES)
  })

  it('panne de lecture : liste fixe conservée, phrase gardée', async () => {
    svc.listTemplates.mockRejectedValue(httpError(500, { detail: 'Base indisponible' }))
    const t = useReplyTemplates()
    await t.load()
    expect(t.error.value).toBe('Base indisponible')
    expect(t.options.value).toEqual(QUICK_REPLIES)
  })

  it('créer, modifier, supprimer : le geste puis la liste relue', async () => {
    const t = useReplyTemplates()
    await t.load()
    svc.listTemplates.mockResolvedValue([tpl('a', 'Merci'), tpl('c', 'Nouveau')])
    expect(await t.create('Nouveau', 'Texte')).toBe(true)
    expect(svc.createTemplate).toHaveBeenCalledWith('Nouveau', 'Texte')
    expect(t.templates.value.map((x) => x.id)).toEqual(['a', 'c'])
    expect(await t.update('c', 'Nouveau !', 'Texte 2')).toBe(true)
    expect(svc.updateTemplate).toHaveBeenCalledWith('c', 'Nouveau !', 'Texte 2')
    expect(await t.remove('c')).toBe(true)
    expect(svc.deleteTemplate).toHaveBeenCalledWith('c')
    expect(t.busy.value).toBe(false)
  })

  it('geste refusé : la phrase du back, la liste intacte', async () => {
    const t = useReplyTemplates()
    await t.load()
    svc.createTemplate.mockRejectedValue(httpError(422, { detail: 'Le libellé est obligatoire.' }))
    expect(await t.create('', 'x')).toBe(false)
    expect(t.error.value).toBe('Le libellé est obligatoire.')
    expect(t.templates.value).toHaveLength(2)
    expect(t.busy.value).toBe(false)
  })
})
