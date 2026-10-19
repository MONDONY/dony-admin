import type { CommissionGrid, SimulationResponse, SimulationRow } from '@/features/commission-grid/types/index'

export const GRID: CommissionGrid = {
  id: 'g-current', effectiveFrom: '2026-10-01T08:00:00',
  tiers: [{ fromEur: 0, rate: 0.07 }, { fromEur: 100, rate: 0.06 }, { fromEur: 300, rate: 0.05 }],
  minimums: { EUR: 1, XOF: 650, XAF: 650, USD: 1.1, CAD: 1.5, GBP: 0.9, CHF: 0.95 },
}
export const SCHEDULED: CommissionGrid = { ...GRID, id: 'g-next', effectiveFrom: '2026-12-01T08:00:00' }

export function row(net: number, current: number, next: number, minimumApplied = false): SimulationRow {
  return {
    net,
    current: { commission: current, gross: net + current },
    draft: { commission: next, gross: net + next, minimumApplied },
    rails: [
      { rail: 'CARD_STANDARD', providerCost: 0.6, marginExVat: 0.5667 },
      { rail: 'CASH', providerCost: 0.27, marginExVat: -0.1 },
    ],
  }
}

export function simulation(rows: SimulationRow[], warnings: string[] = []): SimulationResponse {
  return { rows, warnings, connectActiveAccountMonthly: 2 }
}

/** Erreur ofetch : statut + corps ProblemDetail. */
export function httpError(status: number, data: Record<string, unknown> = {}) {
  return Object.assign(new Error(`${status}`), { statusCode: status, data })
}
