import type { Component } from 'vue'
import { Car, Plane, Route, Ship } from 'lucide-vue-next'

/** Valeur du filtre de mode des listes admin : `ALL` = aucun filtre, `ANY` = demande « peu importe » (mode null). */
export type TransportModeFilter = 'ALL' | 'PLANE' | 'BOAT' | 'CAR' | 'ANY'

/** Libellés par mode (CAR et BUS sont regroupés sous « Route »). Mode inconnu : valeur brute humanisée. */
const LABELS: Record<string, string> = {
  PLANE: 'Avion', BOAT: 'Bateau', CAR: 'Route', BUS: 'Route', TRAIN: 'Train', OTHER: 'Autre',
}

function humanize(code: string): string {
  const words = code.replace(/_/g, ' ').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** Libellé du mode d'un trajet ; null quand le serveur n'envoie pas de mode (repli neutre, jamais l'avion). */
export function tripTransportLabel(mode: string | null | undefined): string | null {
  if (!mode) return null
  return LABELS[mode] ?? humanize(mode)
}

/** Libellé du mode d'une demande : null = « Peu importe », champ absent = vide, inconnu = valeur brute. */
export function requestTransportLabel(mode: string | null | undefined): string {
  if (mode === undefined) return ''
  if (mode === null || mode === '') return 'Peu importe'
  return LABELS[mode] ?? mode
}

const ICONS: Record<string, Component> = { PLANE: Plane, BOAT: Ship, CAR: Car, BUS: Car }

/** Icône du mode ; Route (neutre) pour train, autre, inconnu ou absent. */
export function transportModeIcon(mode: string | null | undefined): Component {
  return (mode && ICONS[mode]) || Route
}

export interface ModeFilterOption { value: TransportModeFilter; label: string }

export const TRIP_MODE_FILTERS: ModeFilterOption[] = [
  { value: 'ALL', label: 'Tous' },
  { value: 'PLANE', label: 'Avion' },
  { value: 'BOAT', label: 'Bateau' },
  { value: 'CAR', label: 'Route' },
]

export const REQUEST_MODE_FILTERS: ModeFilterOption[] = [
  ...TRIP_MODE_FILTERS,
  { value: 'ANY', label: 'Peu importe' },
]

function matchesFilter(mode: string | null, filter: TransportModeFilter): boolean {
  if (filter === 'ANY') return mode === null
  if (filter === 'CAR') return mode === 'CAR' || mode === 'BUS'
  return mode === filter
}

/**
 * Vrai quand le serveur n'a pas appliqué le filtre posé (ancien back) : une ligne ne le respecte pas,
 * ou la clé `transportMode` manque alors qu'un filtre est actif.
 */
export function modeFilterIgnored(
  items: { transportMode?: string | null }[],
  filter: TransportModeFilter,
): boolean {
  if (filter === 'ALL') return false
  return items.some((item) => item.transportMode === undefined || !matchesFilter(item.transportMode, filter))
}
