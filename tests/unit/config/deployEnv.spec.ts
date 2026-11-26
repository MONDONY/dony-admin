import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

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
    expect(publicKeys()).toEqual(expect.arrayContaining(['firebaseVapidKey', 'firebaseMessagingSenderId', 'apiBaseUrl']))
  })

  it.each(publicKeys().map(envName))('deploy.yml writes %s from the environment variables', (name) => {
    expect(read('.github/workflows/deploy.yml')).toContain(`${name}=\${{ vars.${name} }}`)
  })

  it.each(publicKeys().map(envName))('.env.example lists %s', (name) => {
    expect(read('.env.example')).toMatch(new RegExp(`^${name}=`, 'm'))
  })
})
