import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import LoginLeftPanel from '@/features/auth/components/LoginLeftPanel.vue'

type Rgb = [number, number, number]

function hexToRgb(hex: string): Rgb {
  return [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16)) as Rgb
}

function blend(foreground: Rgb, background: Rgb, alpha: number): Rgb {
  return foreground.map((channel, index) =>
    channel * alpha + background[index] * (1 - alpha),
  ) as Rgb
}

function luminance(rgb: Rgb): number {
  const [red, green, blue] = rgb.map((channel) => {
    const value = channel / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

function contrastRatio(foreground: Rgb, background: Rgb): number {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
  return (lighter + 0.05) / (darker + 0.05)
}

function cssVariables(selector: ':root' | '.dark'): Record<string, string> {
  const css = readFileSync('assets/css/main.css', 'utf8')
  const escapedSelector = selector.replace('.', '\\.')
  const block = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, 's'))?.[1] ?? ''
  return Object.fromEntries(
    [...block.matchAll(/(--[\w-]+):\s*(#[\dA-F]{6});/gi)].map((match) => [match[1], match[2]]),
  )
}

describe('LoginLeftPanel', () => {
  it('renders the Yadony ADMIN logo', () => {
    const wrapper = mount(LoginLeftPanel)
    expect(wrapper.find('img[alt="Yadony"]').attributes('src')).toBe('/logos/logo-yadony.png')
    expect(wrapper.text()).toContain('ADMIN')
  })

  it('renders the ADMIN badge', () => {
    const wrapper = mount(LoginLeftPanel)
    expect(wrapper.text()).toContain('ADMIN')
  })

  it('keeps the ADMIN badge readable in light and dark themes', () => {
    const wrapper = mount(LoginLeftPanel)
    const badge = wrapper.findAll('span').find((span) => span.text() === 'ADMIN')
    const style = badge?.attributes('style') ?? ''
    const textToken = style.match(/color:\s*var\((--[\w-]+)\)/)?.[1] ?? ''

    for (const selector of [':root', '.dark'] as const) {
      const variables = cssVariables(selector)
      const foreground = hexToRgb(variables[textToken])
      const badgeBackground = blend(
        hexToRgb(variables['--primary']),
        hexToRgb(variables['--bg']),
        0.15,
      )
      expect(contrastRatio(foreground, badgeBackground)).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('renders the securise mascot image', () => {
    const wrapper = mount(LoginLeftPanel)
    const img = wrapper.find('img[src="/mascots/securise.png"]')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('/mascots/securise.png')
    expect(img.attributes('alt')).toBe('Mascotte Yadony avec médaillon de validation et valise')
  })

  it('ships the full-size security mascot asset', () => {
    const mascot = readFileSync('public/mascots/securise.png')
    expect(mascot.readUInt32BE(16)).toBe(768)
    expect(mascot.readUInt32BE(20)).toBe(768)
  })

  it('renders 3 security reassurance items', () => {
    const wrapper = mount(LoginLeftPanel)
    const items = wrapper.findAll('[data-test="security-item"]')
    expect(items).toHaveLength(3)
  })

  it('mentions Stripe in the first security item', () => {
    const wrapper = mount(LoginLeftPanel)
    const items = wrapper.findAll('[data-test="security-item"]')
    expect(items[0].text()).toContain('Stripe')
  })

  it('mentions KYC in the second security item', () => {
    const wrapper = mount(LoginLeftPanel)
    const items = wrapper.findAll('[data-test="security-item"]')
    expect(items[1].text()).toContain('KYC')
  })

  it('mentions SMS in the third security item', () => {
    const wrapper = mount(LoginLeftPanel)
    const items = wrapper.findAll('[data-test="security-item"]')
    expect(items[2].text()).toContain('SMS')
  })
})
