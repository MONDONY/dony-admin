import { describe, it, expect } from 'vitest'
import { buildSummary, describeCondition, describeConditions, summaryText, type SummaryInput } from '@/features/video-modals/lib/summary'
import { FEW_RESULTS_DEFAULT } from '@/features/video-modals/types/index'
import { audienceFields, ciRule } from './fixtures'

const base = (over: Partial<SummaryInput> = {}): SummaryInput => ({
  triggers: ['SEARCH_TAB'], situations: [], connectedOnly: false, conditions: null, minAppVersion: null, maxAppVersion: null, platforms: [],
  samplePercent: 100, frequency: 'ONCE', frequencyDays: null, maxDisplays: 1, stopAfterAnswer: true, allowDontShowAgain: false,
  startsAt: null, endsAt: null, ...over,
})
const text = (over: Partial<SummaryInput> = {}) => summaryText(buildSummary(base(over), audienceFields))
const strongs = (over: Partial<SummaryInput> = {}) => buildSummary(base(over), audienceFields).filter(p => p.strong).map(p => p.text)

describe('phrase « En clair » : moment', () => {
  it('délai de 2 secondes après l’arrivée sur un onglet ou l’ouverture de l’app', () => {
    expect(text({ triggers: ['SEARCH_TAB'] })).toContain('Ce modal s’ouvrira 2 secondes après l’arrivée sur l’onglet Rechercher')
    expect(text({ triggers: ['APP_OPEN'] })).toContain('2 secondes après l’ouverture de l’app')
    expect(strongs({ triggers: ['TRACKING_TAB', 'MESSAGES_TAB', 'PROFILE_TAB'] })[0])
      .toBe('2 secondes après l’arrivée sur l’onglet Suivi, l’arrivée sur l’onglet Messages ou l’arrivée sur l’onglet Moi')
    expect(text({ triggers: ['ACTIVITIES_TAB'] })).toContain('l’onglet Activités')
  })

  it('boutons Publier un trajet et Envoyer un colis : sans délai', () => {
    const t = text({ triggers: ['PUBLISH_TRIP'] })
    expect(t).toContain('dès le toucher du bouton « Publier un trajet », sans délai')
    expect(t).not.toContain('2 secondes')
    expect(text({ triggers: ['SEND_PARCEL'] })).toContain('« Envoyer un colis »')
  })

  it('un déclencheur avec délai et un sans délai', () => {
    expect(text({ triggers: ['APP_OPEN', 'SEND_PARCEL'] }))
      .toContain('2 secondes après l’ouverture de l’app, ou dès le toucher du bouton « Envoyer un colis », sans délai')
  })

  it('aucun déclencheur ni situation : invite à choisir', () => {
    expect(text({ triggers: [] })).toContain('à un moment à choisir')
  })

  it('situations : « tant que », toutes vraies, valeurs en clair', () => {
    const t = text({
      triggers: [],
      situations: [
        { kind: 'OFFER_ACCEPTED_UNPAID', value: 6 }, { kind: 'OFFER_UNANSWERED', value: 12 }, { kind: 'COUNTER_OFFER_PENDING', value: 24 },
        { kind: 'KYC_ABANDONED', value: null }, { kind: 'PROFILE_INCOMPLETE', value: null }, { kind: 'FIRST_DELIVERY_NO_REFERRAL', value: null },
        { kind: 'RETURN_AFTER_ABSENCE', value: 14 }, { kind: 'DAYS_SINCE_INSTALL_NO_ACTION', value: 3 },
      ],
    })
    // Sans déclencheur : ouverture de l'app (contrat).
    expect(t).toContain('2 secondes après l’ouverture de l’app, tant qu’une offre acceptée n’est pas payée depuis 6 h et qu’une offre reçue reste sans réponse depuis 12 h')
    for (const piece of [
      'une contre-offre est en attente depuis 24 h', 'la vérification d’identité est commencée puis abandonnée', 'le profil est incomplet',
      'et que la vérification d’identité est commencée', 'et que le profil est incomplet', 'la première livraison est réussie sans parrainage', 'la personne revient après 14 jours d’absence',
      '3 jours se sont écoulés depuis l’installation, sans action',
    ]) expect(t).toContain(piece)
  })

  it('élision : « tant qu’une » devant une voyelle, « tant que » sinon, « et qu’/que » ensuite', () => {
    expect(text({ situations: [{ kind: 'PROFILE_INCOMPLETE', value: null }, { kind: 'OFFER_UNANSWERED', value: 2 }] }))
      .toContain('tant que le profil est incomplet et qu’une offre reçue reste sans réponse depuis 2 h')
    expect(text({ situations: [{ kind: 'OFFER_UNANSWERED', value: 2 }] })).toContain('tant qu’une offre reçue')
    expect(text({ situations: [{ kind: 'OFFER_UNANSWERED', value: 2 }] })).not.toMatch(/tant que une|que une/)
  })

  it('singulier / pluriel : 1 jour, 1 fois, 1 résultat', () => {
    expect(text({ triggers: [], situations: [{ kind: 'RETURN_AFTER_ABSENCE', value: 1 }] })).toContain('après 1 jour d’absence')
    expect(text({ triggers: [], situations: [{ kind: 'DAYS_SINCE_INSTALL_NO_ACTION', value: 1 }] })).toContain('1 jour s’est écoulé depuis l’installation')
    expect(text({ triggers: [], situations: [{ kind: 'DAYS_SINCE_INSTALL_NO_ACTION', value: 0 }] })).toContain('0 jours se sont écoulés')
    expect(text({ triggers: ['TRIP_VIEWED_REPEATEDLY'], triggerOptions: { tripViewedTimes: 1 } })).toContain('du même trajet une fois')
    expect(text({ triggers: ['TRIP_VIEWED_REPEATEDLY'], triggerOptions: { tripViewedTimes: 3 } })).toContain('du même trajet 3 fois')
  })

  it('recherche avec peu de résultats : 1, 2, plus, seuil invalide', () => {
    const t = (n: number | undefined) => text({ triggers: ['SEARCH_FEW_RESULTS'], triggerOptions: n === undefined ? undefined : { fewResultsMax: n } })
    expect(t(1)).toContain('ne renvoie qu’un seul résultat')
    expect(t(2)).toContain('de 1 à 2 résultats')
    expect(t(5)).toContain('de 1 à 5 résultats')
    for (const bad of [0, -3, 2.5, Number.NaN]) {
      expect(t(bad)).toContain(`de 1 à ${FEW_RESULTS_DEFAULT} résultats`)
      expect(t(bad)).not.toContain('de 1 à 0')
    }
    expect(t(undefined)).toContain(`de 1 à ${FEW_RESULTS_DEFAULT} résultats`)
  })

  it('situation sans valeur lisible : points de suspension', () => {
    expect(text({ situations: [{ kind: 'OFFER_ACCEPTED_UNPAID', value: Number.NaN }] })).toContain('depuis … h')
    expect(text({ situations: [{ kind: 'PROFILE_INCOMPLETE', value: null }] })).toContain('l’onglet Rechercher, tant que le profil est incomplet')
  })

  it('situation inconnue : le code est affiché tel quel', () => {
    expect(text({ situations: [{ kind: 'NOPE' as never, value: null }] })).toContain('NOPE')
  })
})

describe('phrase « En clair » : pour qui', () => {
  it('aucune restriction : tout le monde, visiteurs compris', () => {
    expect(strongs()).toContain('tout le monde')
    expect(text()).toContain('pour tout le monde, visiteurs sans compte compris')
  })

  it('situations seules : pas de « tout le monde » (elles excluent les visiteurs)', () => {
    expect(text({ situations: [{ kind: 'PROFILE_INCOMPLETE', value: null }] })).not.toContain('tout le monde')
  })

  it('exemple de la maquette : connectés, conditions, Android, version minimale, tirage', () => {
    const t = text({
      connectedOnly: true, conditions: ciRule(), platforms: ['ANDROID'], minAppVersion: '1.0.6', samplePercent: 50,
    })
    expect(t).toContain('uniquement pour les personnes connectées')
    expect(t).toContain('qui répondent à Pays de résidence est Côte d’Ivoire et Colis envoyés égal à 0')
    expect(t).toContain('sur Android')
    expect(t).toContain('avec l’application 1.0.6 ou plus')
    expect(t).toContain('pour 50 % des personnes concernées')
    expect(strongs({ connectedOnly: true, platforms: ['ANDROID'], samplePercent: 50 })).toEqual(expect.arrayContaining(['connectées', 'Android', '50 %']))
  })

  it('versions : maximale seule, intervalle ; les deux systèmes = tous (rien à dire)', () => {
    expect(text({ maxAppVersion: '1.2.0' })).toContain('1.2.0 ou moins')
    expect(text({ minAppVersion: '1.0.6', maxAppVersion: '1.2.0' })).toContain('de 1.0.6 à 1.2.0')
    expect(text({ platforms: ['ANDROID', 'IOS'] })).not.toContain(', sur ')
    expect(text({ platforms: ['IOS'] })).toContain('sur iPhone')
  })

  it('tirage à 100 % ou illisible : non mentionné', () => {
    expect(text({ samplePercent: 100 })).not.toContain('%')
    expect(text({ samplePercent: Number.NaN })).not.toContain('%')
  })
})

describe('phrase « En clair » : fréquence', () => {
  it('une seule fois (et « jusqu’à 1 fois »)', () => {
    expect(text({ frequency: 'ONCE' })).toContain('Il s’affichera une seule fois.')
    expect(text({ frequency: 'UP_TO_N', maxDisplays: 1 })).toContain('une seule fois')
  })

  it('jusqu’à N fois, avec ou sans arrêt après un bouton', () => {
    expect(text({ frequency: 'UP_TO_N', maxDisplays: 3 })).toContain('jusqu’à 3 fois, et ne revient plus après un bouton touché')
    expect(text({ frequency: 'UP_TO_N', maxDisplays: 3, stopAfterAnswer: false })).toContain('jusqu’à 3 fois, même après un bouton touché')
    expect(text({ frequency: 'UP_TO_N', maxDisplays: Number.NaN })).toContain('jusqu’à … fois')
  })

  it('à chaque fois que l’action se produit', () => {
    expect(text({ frequency: 'EVERY_TIME' })).toContain('à chaque fois que l’action se produit')
  })

  it('à chaque ouverture', () => {
    expect(text({ frequency: 'EVERY_OPEN' })).toContain('à chaque ouverture de l’app')
  })

  it('tous les N jours', () => {
    expect(text({ frequency: 'EVERY_N_DAYS', frequencyDays: 7 })).toContain('au plus une fois tous les 7 jours')
    expect(text({ frequency: 'EVERY_N_DAYS', frequencyDays: 1 })).toContain('au plus une fois par jour')
    expect(text({ frequency: 'EVERY_N_DAYS', frequencyDays: Number.NaN })).toContain('tous les … jours')
  })

  it('fréquence absente : jusqu’à N fois, comme une campagne d’avant', () => {
    expect(text({ frequency: undefined, maxDisplays: 2 })).toContain('jusqu’à 2 fois')
  })

  it('période et case « Ne plus afficher »', () => {
    const start = '2026-11-10T12:00:00.000Z'
    const end = '2026-11-30T12:00:00.000Z'
    expect(text({ startsAt: start, endsAt: end })).toContain(', du 10/11/2026 au 30/11/2026')
    expect(text({ endsAt: end })).toContain(', jusqu’au 30/11/2026')
    expect(text({ startsAt: start })).toContain(', à partir du 10/11/2026')
    expect(text({ startsAt: 'illisible' })).not.toContain('à partir du')
    expect(text({ allowDontShowAgain: true })).toContain('avec une case « Ne plus afficher »')
    expect(text()).not.toContain('Ne plus afficher')
  })
})

describe('conditions en clair', () => {
  it('chaque type de valeur', () => {
    const d = (field: string, operator: string, value: unknown) => describeCondition({ field, operator, value }, audienceFields)
    expect(d('is_pro', 'IS', true)).toBe('Compte GP Pro est oui')
    expect(d('is_pro', 'IS', false)).toBe('Compte GP Pro est non')
    expect(d('country', 'IN', ['CI', 'SN', 'FR'])).toBe('Pays de résidence parmi Côte d’Ivoire, Sénégal ou France')
    expect(d('country', 'IS', 'XX')).toBe('Pays de résidence est XX')
    expect(d('promo', 'EQ', 'NOEL')).toBe('Code promo est « NOEL »')
    expect(d('bids_count', 'EVER', null)).toBe('Colis envoyés au moins une fois')
    expect(d('bids_count', 'GTE', 3)).toBe('Colis envoyés au moins 3')
    expect(d('country', 'IN', 'pas une liste')).toBe('Pays de résidence parmi')
    expect(d('corridor_interest', 'MATCHES', { kind: 'CITY', origin: 'Paris', destination: 'Dakar' })).toBe('Corridor d’intérêt correspond à de Paris vers Dakar')
    expect(d('corridor_interest', 'MATCHES', { kind: 'CITY', origin: 'Paris', destination: '' })).toContain('au départ de Paris')
    expect(d('corridor_interest', 'MATCHES', { kind: 'CITY', origin: '', destination: 'Dakar' })).toContain('à l’arrivée à Dakar')
    expect(d('corridor_interest', 'MATCHES', { kind: 'CITY' })).toBe('Corridor d’intérêt correspond à')
  })

  it('champ ou opérateur absent du catalogue : clés brutes', () => {
    expect(describeCondition({ field: 'inconnu', operator: 'X', value: 5 }, audienceFields)).toBe('inconnu X 5')
    expect(describeCondition({ field: 'inconnu', operator: 'X', value: 5 }, [])).toBe('inconnu X 5')
  })

  it('groupes : « ou », sous-groupe entre parenthèses', () => {
    const parts = describeConditions({
      op: 'OR',
      children: [
        { field: 'is_pro', operator: 'IS', value: true },
        { op: 'AND', children: [{ field: 'country', operator: 'IS', value: 'CI' }, { field: 'bids_count', operator: 'EVER', value: null }] },
      ],
    }, audienceFields)
    expect(summaryText(parts)).toBe('Compte GP Pro est oui ou (Pays de résidence est Côte d’Ivoire et Colis envoyés au moins une fois)')
    expect(describeConditions({ op: 'AND', children: [] }, audienceFields)).toEqual([])
  })
})
