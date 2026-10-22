import type { QueueCard } from '@/features/overview/composables/useOverview'

const TONE_RANK: Record<QueueCard['tone'], number> = { danger: 0, warning: 1, info: 2, neutral: 3 }

/**
 * Files d'attente par urgence : celles qui contiennent du travail d'abord (les plus graves
 * en tête, puis les plus remplies), les files vides à la suite dans leur ordre d'origine.
 */
export function sortQueues(queues: readonly QueueCard[]): QueueCard[] {
  const withWork = queues.filter(q => q.count > 0)
  const empty = queues.filter(q => q.count <= 0)
  return [
    ...[...withWork].sort((a, b) => TONE_RANK[a.tone] - TONE_RANK[b.tone] || b.count - a.count),
    ...empty,
  ]
}

/** Total des éléments en attente, pour la phrase d'en-tête de la section. */
export function pendingTotal(queues: readonly QueueCard[]): number {
  return queues.reduce((n, q) => n + Math.max(q.count, 0), 0)
}
