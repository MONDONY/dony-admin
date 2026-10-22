import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'

const queues = ref([
  { id: 'noshows', label: 'No-shows à arbitrer', count: 0, tone: 'warning', href: '/incidents' },
  { id: 'kyc', label: 'Identités à vérifier', count: 4, tone: 'info', href: '/kyc' },
  { id: 'disputes', label: 'Litiges ouverts', count: 2, tone: 'danger', href: '/incidents' },
])
const isLoading = ref(false)
vi.mock('@/features/overview/composables/useOverview', () => ({
  useOverview: () => ({
    data: ref({}), isLoading, error: ref(null), kpis: ref([]), volumes: ref([]), queues, fetchOverview: vi.fn(),
  }),
}))

import OverviewDashboard from '@/features/overview/components/OverviewDashboard.vue'
import OverviewQueueCard from '@/features/overview/components/OverviewQueueCard.vue'
const NuxtLinkStub = { name: 'NuxtLink', template: '<a :href="to"><slot /></a>', props: ['to'] }
const mountIt = () => mount(OverviewDashboard, { global: { stubs: { NuxtLink: NuxtLinkStub } } })

describe('OverviewDashboard : l’à-traiter d’abord', () => {
  it('affiche les files avant les indicateurs, les plus urgentes en tête, les vides à la fin', async () => {
    const w = mountIt()
    await flushPromises()
    const headings = w.findAll('h2').map(h => h.text())
    expect(headings).toEqual(['À traiter', 'Indicateurs', 'Volumes par devise'])
    const ids = w.findAll('[data-test^="queue-"]').map(c => c.attributes('data-test'))
    expect(ids).toEqual(['queue-disputes', 'queue-kyc', 'queue-noshows'])
  })

  it('résume le total en attente', async () => {
    const w = mountIt()
    await flushPromises()
    expect(w.find('[data-test="queues-summary"]').text()).toBe('6 en attente')
  })

  it('dit que tout est à jour quand rien n’attend', async () => {
    const saved = queues.value
    queues.value = saved.map(q => ({ ...q, count: 0 }))
    const w = mountIt()
    await flushPromises()
    expect(w.find('[data-test="queues-summary"]').text()).toContain('tout est à jour')
    queues.value = saved
  })

  it('pas de résumé pendant le chargement', async () => {
    isLoading.value = true
    const w = mountIt()
    await flushPromises()
    expect(w.find('[data-test="queues-summary"]').exists()).toBe(false)
    isLoading.value = false
  })
})

describe('OverviewQueueCard : file vide', () => {
  const card = (count: number) => ({ id: 'x', label: 'File', count, tone: 'danger' as const, href: '/x' })
  const mountCard = (count: number) => mount(OverviewQueueCard, { props: { card: card(count) }, global: { stubs: { NuxtLink: { template: '<a :data-empty="$attrs[\'data-empty\']"><slot /></a>', props: ['to'] } } } })

  it('grise une file à zéro', () => {
    const w = mountCard(0)
    expect(w.find('span.font-bold').classes()).toContain('text-text-muted')
    expect(w.attributes('data-empty')).toBe('true')
  })

  it('garde la couleur de gravité quand il y a du travail', () => {
    const w = mountCard(3)
    expect(w.find('span.font-bold').classes()).toContain('text-danger')
    expect(w.attributes('data-empty')).toBe('false')
  })
})
