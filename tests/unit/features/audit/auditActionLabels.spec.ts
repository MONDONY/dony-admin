import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { auditActionLabel } from '@/features/audit/lib/auditActionLabels'
import AuditTable from '@/features/audit/components/AuditTable.vue'

describe('auditActionLabel', () => {
  it('donne un libellé français aux trois actions DAC7 du contrat', () => {
    expect(auditActionLabel('DAC7_EXPORT_GENERATED')).toBe('Fichier DAC7 généré')
    expect(auditActionLabel('DAC7_STATEMENTS_SENT')).toBe('Récapitulatifs DAC7 envoyés aux voyageurs')
    expect(auditActionLabel('DAC7_TEAM_DECISION')).toBe('Décision de l’équipe sur un voyageur DAC7')
  })

  it('CSV de contrôle et purge du numéro fiscal', () => {
    expect(auditActionLabel('DAC7_CONTROL_CSV_GENERATED')).toBe('CSV de contrôle DAC7 généré')
    expect(auditActionLabel('DAC7_TAX_INFO_PURGED')).toBe('Numéro fiscal purgé')
  })

  it('une autre action DAC7 reste lisible, sans inventer son sens', () => {
    expect(auditActionLabel('DAC7_AUTRE_ACTION')).toBe('DAC7 : DAC7_AUTRE_ACTION')
  })

  it('une action inconnue ou absente n’a pas de libellé', () => {
    expect(auditActionLabel('USER_SUSPENDED')).toBeNull()
    expect(auditActionLabel('')).toBeNull()
    expect(auditActionLabel(null)).toBeNull()
  })
})

describe('AuditTable : libellé DAC7', () => {
  const entry = (action: string) => [{
    id: 'e1', action, entityType: 'DAC7_REPORT', entityId: null, actorId: 'a1', actorName: 'Admin',
    ipAddress: null, payload: null, createdAt: '2026-11-11T10:00:00Z',
  }]

  it('affiche le libellé sous le code, qui reste visible', () => {
    const w = mount(AuditTable, { props: { entries: entry('DAC7_EXPORT_GENERATED'), loading: false } })
    expect(w.text()).toContain('DAC7_EXPORT_GENERATED')
    expect(w.get('[data-test="audit-label-e1"]').text()).toBe('Fichier DAC7 généré')
  })

  it('sans libellé connu, rien de plus que le code', () => {
    const w = mount(AuditTable, { props: { entries: entry('USER_SUSPENDED'), loading: false } })
    expect(w.find('[data-test="audit-label-e1"]').exists()).toBe(false)
  })
})
