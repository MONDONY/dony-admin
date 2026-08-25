import { describe, it, expect } from 'vitest'
import { userIdentityLabel } from '@/features/users/userIdentity'

describe('userIdentityLabel', () => {
  it('affiche l\'email quand il existe', () => {
    expect(userIdentityLabel({ email: 'jean@x.fr', id: 'abcdef12-3456' }))
      .toEqual({ text: 'jean@x.fr', isFallback: false })
  })

  // Compte anonymisé ou inscrit par téléphone : l'admin doit quand même
  // pouvoir désigner la ligne qu'il a sous les yeux.
  it('retombe sur les huit premiers caractères de l\'identifiant', () => {
    expect(userIdentityLabel({ email: null, id: 'abcdef12-3456-7890' }))
      .toEqual({ text: 'abcdef12', isFallback: true })
  })

  it('traite une chaîne vide comme un email absent', () => {
    expect(userIdentityLabel({ email: '', id: 'abcdef12-3456' }).isFallback).toBe(true)
  })

  it('ne rend jamais une étiquette vide', () => {
    expect(userIdentityLabel({ email: null, id: 'x' }).text).not.toBe('')
  })
})
