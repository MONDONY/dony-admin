export type ExportType = 'transactions' | 'users' | 'disputes' | 'payouts'

export interface ExportFilterState {
  type: ExportType
  from: string | null
  to: string | null
}

export const EXPORT_TYPES: { value: ExportType; label: string }[] = [
  { value: 'transactions', label: 'Transactions' },
  { value: 'users', label: 'Utilisateurs' },
  { value: 'disputes', label: 'Litiges' },
  { value: 'payouts', label: 'Versements fonds de garantie' },
]
