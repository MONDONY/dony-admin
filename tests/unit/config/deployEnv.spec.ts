import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { resolveIdleMinutes } from '@/features/mobile/lib/lockState'

// Chaque valeur publique de runtimeConfig doit arriver jusqu'au conteneur : une variable absente du
// .env écrit par le déploiement reste vide en recette comme en prod (le push ne s'activait jamais).

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')

function publicKeys(): string[] {
  const src = read('nuxt.config.ts')
  const block = src.slice(src.indexOf('public: {'), src.indexOf('}', src.indexOf('public: {')))
  return [...block.matchAll(/^\s*(\w+):/gm)].map(m => m[1]!).filter(k => k !== 'public')
}
const envName = (key: string) => `NUXT_PUBLIC_${key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase()}`

describe('public runtime config reaches the deployment', () => {
  it('reads the keys of runtimeConfig.public (sanity)', () => {
    expect(publicKeys()).toEqual(expect.arrayContaining(['firebaseVapidKey', 'firebaseMessagingSenderId', 'apiBaseUrl', 'idleLockMinutes']))
  })

  it.each(publicKeys().map(envName))('deploy.yml writes %s from the environment variables', (name) => {
    expect(read('.github/workflows/deploy.yml')).toContain(`${name}=\${{ vars.${name} }}`)
  })

  it.each(publicKeys().map(envName))('.env.example lists %s', (name) => {
    expect(read('.env.example')).toMatch(new RegExp(`^${name}=`, 'm'))
  })

  // Variable facultative : absente de l'environnement GitHub, le .env reçoit une valeur vide.
  // Nuxt la passe telle quelle (chaîne vide) à runtimeConfig, le résolveur retombe sur 30 minutes.
  it('NUXT_PUBLIC_IDLE_LOCK_MINUTES is optional: default 30 in nuxt.config, an empty value falls back to 30', () => {
    expect(read('nuxt.config.ts')).toMatch(/^\s*idleLockMinutes: 30,$/m)
    expect(resolveIdleMinutes('')).toBe(30)
    expect(resolveIdleMinutes(undefined)).toBe(30)
  })

  it('.env.example documents the unit and the bounds of NUXT_PUBLIC_IDLE_LOCK_MINUTES, in French', () => {
    const lines = read('.env.example').split('\n')
    const i = lines.findIndex(l => l.startsWith('NUXT_PUBLIC_IDLE_LOCK_MINUTES='))
    expect(lines[i - 1]).toMatch(/^#.*minutes.*5.*720.*30/)
  })
})
