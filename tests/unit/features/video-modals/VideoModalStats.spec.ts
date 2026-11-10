import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import VideoModalStats from '@/features/video-modals/components/VideoModalStats.vue'

const stats = { shown: 10, opened: 4, completed: 2, dismissed: 3 }

describe('VideoModalStats', () => {
  it('vidéo (et type absent) : quatre tuiles inchangées', () => {
    for (const type of [undefined, 'VIDEO'] as const) {
      const w = mount(VideoModalStats, { props: { stats, type } })
      expect(w.findAll('[data-test^="vm-stat-"]')).toHaveLength(4)
      expect(w.text()).toContain('vidéo ouverte')
      expect(w.text()).toContain('vue en entier')
    }
  })

  it('information : « bouton touché », « vue en entier » masquée', () => {
    const w = mount(VideoModalStats, { props: { stats, type: 'INFO' } })
    expect(w.findAll('[data-test^="vm-stat-"]')).toHaveLength(3)
    expect(w.text()).toContain('bouton touché')
    expect(w.find('[data-test="vm-stat-completed"]').exists()).toBe(false)
    expect(w.text()).not.toContain('vidéo ouverte')
  })

  it('statistiques absentes : zéros', () => {
    const w = mount(VideoModalStats, { props: { stats: null, type: 'INFO', compact: true } })
    expect(w.get('[data-test="vm-stats-compact"]').text()).toContain('0 bouton touché')
  })
})
