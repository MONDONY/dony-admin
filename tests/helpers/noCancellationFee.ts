import { beforeEach, vi } from 'vitest'
import { paymentsService } from '@/features/payments/services/paymentsService'

/**
 * Specs qui montent le tiroir paiement sans s'intéresser aux frais d'annulation : la carte lit la
 * retenue du colis, on répond « aucune retenue » (404 → null) au lieu de laisser le vrai service
 * appeler le réseau. À appeler au niveau du fichier.
 */
export function stubCancellationFee() {
  beforeEach(() => { vi.spyOn(paymentsService, 'getCancellationFee').mockResolvedValue(null) })
}
