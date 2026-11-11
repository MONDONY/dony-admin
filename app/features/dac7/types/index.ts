/**
 * Déclaration DAC7 côté administration (droit DAC7_REPORT).
 *
 * Contrat : lot 3b du back (`/admin/dac7/**`). Le back sérialise en NON_NULL : un champ nul est
 * ABSENT du JSON, et une ancienne version du back peut en omettre d'autres. Tout est donc
 * optionnel ici, et aucun type ne porte jamais le numéro fiscal, la date de naissance ni l'adresse.
 */

type Tone = 'success' | 'danger' | 'warning' | 'info' | 'neutral'
type Meta = { label: string; tone: Tone }

export type Dac7Filter = 'ALL' | 'MISSING_TAX_INFO' | 'IDENTITY_REVIEW' | 'UNKNOWN_RESIDENCE' | 'NON_DECLARABLE'
export type Dac7ExportMode = 'FULL' | 'PARTIAL'

/** Options facultatives de l'export (le serveur applique ses valeurs par défaut quand elles manquent). */
export interface Dac7ExportOptions {
  /** Numéro d'ordre de la déclaration (0 par défaut). */
  sequence?: number
  /** Reprendre aussi les voyageurs déjà exportés cette année (mode Partiel). */
  includeAlreadyExported?: boolean
}

export interface Dac7Totals {
  operations?: number
  netEur?: number
  commissionEur?: number
}

export interface Dac7Overview {
  year?: number
  /** Collecte allumée côté back (YADONY_DAC7_ENABLED). */
  enabled?: boolean
  /** Rappels automatiques allumés (YADONY_DAC7_REMINDERS_ENABLED). */
  remindersEnabled?: boolean
  declarableSellers?: number
  withTaxInfo?: number
  missingTaxInfo?: number
  identityReview?: number
  unknownResidence?: number
  nonDeclarable?: number
  refundsToReconcile?: number
  pendingSplits?: number
  anomalies?: number
  /** Remboursements à réconcilier + anomalies : ne bloquent pas l'export, à vérifier avant de déposer. */
  warnings?: number
  invalidPartnerJurisdictions?: string[]
  totals?: Dac7Totals
  eurComplete?: boolean
  commissionComplete?: boolean
  exportReady?: boolean
  blockers?: string[]
}

export interface Dac7Seller {
  userId: string
  displayName?: string | null
  residenceCountry?: string | null
  residencyStatus?: string | null
  taxInfoProvided?: boolean
  /** COMPLETE | INCOMPLETE | UNAVAILABLE (lecture d'identité en panne : réessayer plus tard). */
  identityStatus?: string | null
  solicitation?: string | null
  remindersSent?: number
  lastDiligenceAt?: string | null
  operations?: number
  netEur?: number
  commissionEur?: number
  eurComplete?: boolean
  commissionComplete?: boolean
  /** Déjà retenu dans un export de l'année (déclarables seulement). */
  alreadyExported?: boolean
}

export interface Dac7DiligenceEntry {
  at?: string | null
  action?: string | null
  channel?: string | null
  actorName?: string | null
  note?: string | null
}

export interface Dac7RefundRow {
  travelerId?: string | null
  displayName?: string | null
  source?: string | null
  sourceId?: string | null
  currency?: string | null
  amount?: number
  amountEur?: number | null
  operationPaidAt?: string | null
  operationYear?: number
  refundedAt?: string | null
  refundYear?: number
  beforeRelease?: boolean
  refundDateEstimated?: boolean
}

export interface Dac7AnomalyRow {
  type?: string | null
  travelerId?: string | null
  displayName?: string | null
  source?: string | null
  sourceId?: string | null
  currency?: string | null
  day?: string | null
}

export interface Dac7StatementsResult { sent?: number; skipped?: number }

/** Fichier rendu par l'export, avec ce que les en-têtes de réponse en disent. */
export interface Dac7FileResult {
  blob: Blob
  filename: string
  /** Vrai quand le serveur n'a pas donné de nom : `filename` est alors un nom de repli sans extension. */
  filenameFallback: boolean
  /** Voyageurs laissés de côté (mode Partiel) ; null si l'en-tête est absent. */
  excluded: number | null
  /** `X-Dac7-Warnings` : remboursements à réconcilier + anomalies ; null si l'en-tête est absent. */
  warnings: number | null
  /** true / false d'après `X-Dac7-Encrypted` ; null si l'en-tête n'est pas lisible. */
  encrypted: boolean | null
}

export const DAC7_UNAVAILABLE = 'Non disponible sur cette version du serveur'
export const DAC7_NOTE_MAX = 500
export const DAC7_FIRST_YEAR = 2023

export const DAC7_FILTERS: { value: Dac7Filter; label: string }[] = [
  { value: 'ALL', label: 'Tous' },
  { value: 'MISSING_TAX_INFO', label: 'Numéro fiscal manquant' },
  { value: 'IDENTITY_REVIEW', label: 'Identité à revoir' },
  { value: 'UNKNOWN_RESIDENCE', label: 'Résidence inconnue' },
  { value: 'NON_DECLARABLE', label: 'Non déclarables' },
]

export const DAC7_BLOCKER_CODES = [
  'IDENTITY_INCOMPLETE', 'TAX_INFO_MISSING', 'EUR_INCOMPLETE', 'COMMISSION_INCOMPLETE',
  'INVALID_PARTNER_JURISDICTION', 'NO_SELLERS', 'OPERATOR_CONFIG_MISSING',
  'IDENTITY_UNAVAILABLE', 'PENDING_SPLITS', 'XSD_INVALID',
] as const

const BLOCKERS: Record<string, { title: string; explanation: string }> = {
  IDENTITY_INCOMPLETE: {
    title: 'Identité incomplète',
    explanation: 'Au moins un voyageur à déclarer n’a pas toutes ses données d’identité (date de naissance, adresse). '
      + 'On ne les redemande jamais au voyageur : regardez le filtre « Identité à revoir » et décidez cas par cas.',
  },
  TAX_INFO_MISSING: {
    title: 'Numéro fiscal manquant',
    explanation: 'Au moins un voyageur à déclarer n’a pas fourni son numéro fiscal. '
      + 'Relancez-le depuis le tableau, ou exportez en mode Partiel : il sera alors laissé de côté.',
  },
  EUR_INCOMPLETE: {
    title: 'Montants en euros incomplets',
    explanation: 'Aucun taux de change connu pour au moins une opération : son montant en euros manque. '
      + 'Voyez l’onglet Anomalies pour trouver la devise et le jour concernés.',
  },
  COMMISSION_INCOMPLETE: {
    title: 'Commission introuvable',
    explanation: 'La commission d’au moins un colis réglé en espèces est introuvable et comptée à zéro. '
      + 'Voyez l’onglet Anomalies avant de déclarer.',
  },
  INVALID_PARTNER_JURISDICTION: {
    title: 'Pays partenaire invalide',
    explanation: 'La configuration contient un code de pays partenaire invalide, ignoré par le calcul. '
      + 'Il faut le corriger côté serveur avant tout export complet.',
  },
  NO_SELLERS: {
    title: 'Aucun voyageur à déclarer',
    explanation: 'Aucun voyageur déclarable n’a eu d’opération cette année : il n’y a rien à exporter.',
  },
  OPERATOR_CONFIG_MISSING: {
    title: 'Société déclarante non configurée',
    explanation: 'Les informations de la société déclarante ne sont pas configurées côté serveur : contactez l’équipe technique.',
  },
  IDENTITY_UNAVAILABLE: {
    title: 'Vérification d’identité indisponible',
    explanation: 'La vérification d’identité est temporairement indisponible pour certains voyageurs : réessayez plus tard.',
  },
  PENDING_SPLITS: {
    title: 'Partages en attente de versement',
    explanation: 'Des partages de colis décidés par l’équipe n’ont pas encore été versés aux voyageurs : attendez la fin des transferts.',
  },
  XSD_INVALID: {
    title: 'Fichier non conforme au format',
    explanation: 'Le fichier n’est pas conforme au format de la DGFiP pour certains voyageurs : voir la liste.',
  },
}

/** Les seuls blocages que le mode Partiel contourne : ils concernent des voyageurs, qu'il met de côté. */
const PARTIAL_CAN_HELP = new Set(['IDENTITY_INCOMPLETE', 'TAX_INFO_MISSING', 'IDENTITY_UNAVAILABLE', 'PENDING_SPLITS', 'XSD_INVALID'])

/**
 * Vrai quand proposer le mode Partiel est honnête : au moins un blocage, tous connus et tous
 * contournables. Un blocage inconnu, `NO_SELLERS` ou `OPERATOR_CONFIG_MISSING` est refusé aussi en Partiel.
 */
export function partialMayHelp(codes: readonly string[]): boolean {
  return codes.length > 0 && codes.every(c => PARTIAL_CAN_HELP.has(c))
}

export interface BlockerInfo { code: string; title: string; explanation: string; known: boolean }

export function blockerInfo(code: string): BlockerInfo {
  const known = BLOCKERS[code]
  if (known) return { code, ...known, known: true }
  return {
    code, title: `Blocage non reconnu : ${code}`, known: false,
    explanation: 'Ce blocage n’est pas connu de cette version de l’admin. Il empêche l’export : contactez l’équipe technique.',
  }
}

const RESIDENCY: Record<string, Meta> = {
  DECLARABLE: { label: 'Déclarable', tone: 'success' },
  NON_DECLARABLE: { label: 'Non déclarable', tone: 'neutral' },
  RESIDENCE_INCONNUE: { label: 'Résidence inconnue', tone: 'warning' },
}
export function residencyMeta(s: string | null | undefined): Meta {
  if (!s) return { label: 'Inconnu', tone: 'neutral' }
  return RESIDENCY[s] ?? { label: s, tone: 'neutral' }
}

const IDENTITY: Record<string, Meta> = {
  COMPLETE: { label: 'Complète', tone: 'success' },
  INCOMPLETE: { label: 'À revoir', tone: 'warning' },
  UNAVAILABLE: { label: 'Indisponible', tone: 'warning' },
}
/** Phrase d'aide sous le badge d'identité, quand il y en a une. */
export function identityHint(s: string | null | undefined): string | null {
  return s === 'UNAVAILABLE' ? 'Lecture d’identité indisponible, réessayez plus tard' : null
}
export function identityMeta(s: string | null | undefined): Meta {
  if (!s) return { label: 'Inconnue', tone: 'neutral' }
  return IDENTITY[s] ?? { label: s, tone: 'neutral' }
}

const SOLLICITATION: Record<string, Meta> = {
  SOLLICITER: { label: 'À solliciter', tone: 'warning' },
  DEJA_FOURNI: { label: 'Déjà fourni', tone: 'success' },
  NE_PAS_SOLLICITER: { label: 'Ne pas solliciter', tone: 'neutral' },
}
export function solicitationMeta(s: string | null | undefined): Meta {
  if (!s) return { label: 'Inconnu', tone: 'neutral' }
  return SOLLICITATION[s] ?? { label: s, tone: 'neutral' }
}

const DILIGENCE: Record<string, string> = {
  REQUEST: 'Demande envoyée',
  REMINDER_1: 'Premier rappel',
  REMINDER_2: 'Second rappel',
  PROVIDED: 'Numéro fiscal fourni',
  TEAM_DECISION: 'Décision de l’équipe',
}
export function diligenceActionLabel(a: string | null | undefined): string {
  if (!a) return 'Action inconnue'
  return DILIGENCE[a] ?? a
}

const ANOMALIES: Record<string, string> = {
  EXCHANGE_RATE_MISSING: 'Taux de change inconnu : montant en euros manquant',
  COMMISSION_UNKNOWN: 'Commission introuvable : comptée à zéro',
  REFUND_DATE_ESTIMATED: 'Date de remboursement estimée',
  DELIVERY_DATE_ESTIMATED: 'Date de livraison estimée',
  TRAVELER_UNKNOWN: 'Paiement versé sans voyageur retrouvé',
  RATE_DATE_ESTIMATED: 'Taux du jour non publié : dernier taux connu utilisé',
}
export function anomalyTypeLabel(t: string | null | undefined): string {
  if (!t) return 'Anomalie'
  return ANOMALIES[t] ?? t
}

const SOURCES: Record<string, string> = {
  PAYMENT: 'Paiement', CASH: 'Espèces', SUPPLEMENT: 'Supplément', AMENDMENT: 'Modification',
}
export function refundSourceLabel(s: string | null | undefined): string {
  if (!s) return 'Inconnue'
  return SOURCES[s] ?? s
}

/** Valeur vide affichée en toutes lettres : jamais un tiret, qui prête au doute. */
export const NOT_AVAILABLE = 'n/d'

const EUR = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
export function eurLabel(n: number | null | undefined): string {
  return n == null ? NOT_AVAILABLE : EUR.format(n)
}

export function countLabel(n: number | null | undefined): string {
  return n == null ? NOT_AVAILABLE : String(n)
}

export function noteValid(note: string): boolean {
  const n = note.trim().length
  return n >= 1 && n <= DAC7_NOTE_MAX
}

/** Messages des 409 métier : le serveur peut en écrire un `detail`, ceux-ci sont le repli et l'emportent. */
const CODE_MESSAGES: Record<string, string> = {
  'dac7-not-solicitable': 'Ce voyageur ne peut pas être sollicité : il a déjà fourni son numéro fiscal, n’est pas concerné ou n’a pas à être relancé.',
  'dac7-remind-too-soon': 'Ce voyageur a déjà été relancé il y a moins de 7 jours. Un seul rappel manuel est permis par semaine.',
  'dac7-export-blocked': 'L’export complet est bloqué : des points restent à régler.',
  'dac7-year-not-closed': 'Le récapitulatif d’une année ne peut être envoyé qu’après la fin de cette année.',
  'dac7-unencrypted-not-allowed': 'L’export non chiffré est refusé en production : configurez la clé de la DGFiP.',
  'dac7-note-sensitive': 'La note semble contenir un numéro : retirez-le.',
  'dac7-reminders-exhausted': 'Demande et deux rappels déjà envoyés.',
  'dac7-collection-disabled': 'La collecte est éteinte : aucun message ne peut être envoyé.',
}
export function dac7CodeMessage(code: string | null | undefined): string | null {
  return code ? CODE_MESSAGES[code] ?? null : null
}

/**
 * Années proposées : l'année UTC courante et les deux précédentes (jamais avant 2023), la plus
 * récente d'abord. Le back refuse une année supérieure à l'année UTC (422) : on n'en propose pas.
 */
export function yearOptions(utcYear: number): number[] {
  const top = Math.max(utcYear, DAC7_FIRST_YEAR)
  const out: number[] = []
  for (let y = top; y > top - 3 && y >= DAC7_FIRST_YEAR; y--) out.push(y)
  return out
}

/** Années terminées (strictement avant l'année UTC), les trois dernières, la plus récente d'abord. */
export function closedYears(utcYear: number): number[] {
  const out: number[] = []
  for (let y = utcYear - 1; y > utcYear - 4 && y >= DAC7_FIRST_YEAR; y--) out.push(y)
  return out
}

/** Année UTC de l'instant donné, celle que le serveur compare. */
export function currentUtcYear(now: Date = new Date()): number {
  return now.getUTCFullYear()
}

/**
 * Année affichée à l'ouverture : l'année courante, sauf en janvier où la déclaration due le 31
 * janvier concerne l'année écoulée. Jamais au-delà de l'année UTC, jamais avant 2023.
 */
export function defaultYear(now: Date = new Date()): number {
  const y = currentUtcYear(now)
  return Math.max(now.getUTCMonth() === 0 ? y - 1 : y, DAC7_FIRST_YEAR)
}

export function fmtDateTime(d: string | null | undefined): string {
  if (!d) return NOT_AVAILABLE
  const t = Date.parse(d)
  return Number.isNaN(t) ? NOT_AVAILABLE : new Date(t).toLocaleString('fr-FR')
}
export function fmtDay(d: string | null | undefined): string {
  if (!d) return NOT_AVAILABLE
  const t = Date.parse(d)
  return Number.isNaN(t) ? NOT_AVAILABLE : new Date(t).toLocaleDateString('fr-FR')
}
