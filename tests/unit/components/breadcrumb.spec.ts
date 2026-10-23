import { describe, it, expect } from 'vitest'
import { buildCrumbs, backTarget, canGoBackInApp } from '@/components/layout/breadcrumb'

describe('buildCrumbs', () => {
  it('page de premier niveau : Accueil › domaine › page, la page n’est pas un lien', () => {
    expect(buildCrumbs('/colis', 'Colis')).toEqual([
      { label: 'Accueil', to: '/' },
      { label: 'Activité' },
      { label: 'Colis' },
    ])
  })

  it('page de détail : la liste devient un lien, le dernier maillon est le titre', () => {
    expect(buildCrumbs('/users/abc-123', 'Utilisateur')).toEqual([
      { label: 'Accueil', to: '/' },
      { label: 'Comptes' },
      { label: 'Utilisateurs', to: '/users' },
      { label: 'Utilisateur' },
    ])
  })

  it('le libellé de détail (nom du compte) remplace le titre de page', () => {
    const crumbs = buildCrumbs('/users/abc-123', 'Utilisateur', 'Awa Diallo')
    expect(crumbs.at(-1)).toEqual({ label: 'Awa Diallo' })
  })

  it('sans titre ni libellé, pas de maillon vide', () => {
    expect(buildCrumbs('/users/abc-123')).toHaveLength(3)
  })

  it('le libellé de détail est ignoré sur une page de premier niveau', () => {
    expect(buildCrumbs('/users', 'Utilisateurs', 'Awa Diallo').map(c => c.label)).toEqual(['Accueil', 'Comptes', 'Utilisateurs'])
  })

  it('/users/rgpd est sa propre entrée, pas un détail de Utilisateurs', () => {
    const crumbs = buildCrumbs('/users/rgpd', 'Demandes RGPD')
    expect(crumbs.map(c => c.label)).toEqual(['Accueil', 'Comptes', 'Demandes RGPD'])
    expect(crumbs.at(-1)?.to).toBeUndefined()
  })

  it('vide sur l’accueil, hors menu et sans chemin', () => {
    expect(buildCrumbs('/', 'Vue d’ensemble')).toEqual([])
    expect(buildCrumbs('/change-password', 'x')).toEqual([])
    expect(buildCrumbs(undefined)).toEqual([])
  })
})

describe('backTarget', () => {
  it('la liste dont la page est un détail', () => {
    expect(backTarget('/users/abc-123')).toBe('/users')
  })
  it('rien sur une page de premier niveau, l’accueil ou hors menu', () => {
    expect(backTarget('/users')).toBeNull()
    expect(backTarget('/users/rgpd')).toBeNull()
    expect(backTarget('/')).toBeNull()
    expect(backTarget('/change-password')).toBeNull()
    expect(backTarget(undefined)).toBeNull()
  })
})

describe('canGoBackInApp', () => {
  it('oui quand le navigateur connaît la page précédente de l’admin', () => {
    expect(canGoBackInApp({ back: '/users?query=awa' }, '/users/abc')).toBe(true)
  })
  it('non à la première visite (state.back nul) ou sans état', () => {
    expect(canGoBackInApp({ back: null }, '/users/abc')).toBe(false)
    expect(canGoBackInApp(null, '/users/abc')).toBe(false)
    expect(canGoBackInApp(undefined, '/users/abc')).toBe(false)
  })
  it('non si la page précédente n’est pas un chemin de l’admin ou si c’est la page elle-même', () => {
    expect(canGoBackInApp({ back: 'https://exemple.fr' }, '/users/abc')).toBe(false)
    expect(canGoBackInApp({ back: '/users/abc' }, '/users/abc')).toBe(false)
  })
})
