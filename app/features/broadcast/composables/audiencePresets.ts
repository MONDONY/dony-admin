import type { AudiencePreset, AudiencePresetMessage } from '@/features/broadcast/types/index'
import type { WireCondition, WireGroup } from '@/features/broadcast/composables/audienceRule'

/** Langues des modèles, dans l'ordre d'affichage. Le back fournit `fr` et `en`. */
export const PRESET_LANGUAGES = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'Anglais' },
] as const

export type PresetLanguage = (typeof PRESET_LANGUAGES)[number]['code']

/**
 * Règle de l'audience prête, limitée aux comptes dont l'application est dans la langue du message.
 * La racine d'une audience prête est toujours un ET : on y ajoute la condition « Langue » sans
 * changer la profondeur de la règle. Ne modifie pas l'original.
 */
export function withLanguage(rule: unknown, language: PresetLanguage): WireGroup {
  const root = (rule ?? {}) as { op?: string; children?: unknown[] }
  const children = Array.isArray(root.children) ? (root.children as Array<WireGroup | WireCondition>) : []
  const languageCondition: WireCondition = { field: 'language', operator: 'IN', value: [language] }
  return { op: 'AND', children: [...children, languageCondition] }
}

/** Modèle de message dans la langue demandée, ou null s'il n'existe pas. */
export function messageFor(preset: AudiencePreset, language: PresetLanguage): AudiencePresetMessage | null {
  return preset.messages?.[language] ?? null
}
