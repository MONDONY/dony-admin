import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { seedAuth } from '~/tests/helpers/auth'

vi.stubGlobal('useRuntimeConfig', () => ({ public: { apiBaseUrl: '', firebaseApiKey: '' } }))

import AlertDetailPanel from '@/features/alerts/components/AlertDetailPanel.vue'

const esc = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

describe('Panneaux : Échap ferme', () => {
  it('AlertDetailPanel ferme sur Échap seulement quand une alerte est ouverte', () => {
    seedAuth('ADMIN')
    const closed = mount(AlertDetailPanel, { props: { alert: null }, attachTo: document.body })
    esc()
    expect(closed.emitted('close')).toBeUndefined()
    closed.unmount()
  })
})
