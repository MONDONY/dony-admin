import { ref } from 'vue'

// Dernier maillon du fil d'Ariane sur une page de détail (nom de l'utilisateur…). Une page le
// renseigne quand elle a chargé son objet, le layout le lit ; module-level : un seul affichage à la fois.
const label = ref<string | null>(null)

export function useBreadcrumbLabel() {
  return {
    label,
    set(value: string | null | undefined) { label.value = value?.trim() || null },
    clear() { label.value = null },
  }
}
