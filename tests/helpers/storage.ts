import { vi } from 'vitest'

/**
 * Stockage du navigateur qui lève à la demande (navigation privée, quota plein).
 *
 * Pourquoi pas `vi.spyOn(Storage.prototype, 'setItem')` : happy-dom lie chaque méthode de Storage
 * à l'instance au premier accès (`ClassMethodBinder`). Dès qu'un test du fichier a appelé
 * `localStorage.setItem`, l'instance porte sa propre copie liée de la méthode d'origine et un
 * espion posé ensuite sur le prototype ne voit plus aucun appel : le test passe sans jamais
 * exercer la branche d'erreur. On remplace donc le stockage entier, le temps du test.
 */
export interface StorageFaults { get?: boolean, set?: boolean, remove?: boolean }

let restoreFns: Array<() => void> = []

function snapshot(real: Storage): Map<string, string> {
  const data = new Map<string, string>()
  for (const k of Object.keys(real)) {
    const v = real.getItem(k)
    if (v !== null) data.set(k, v)
  }
  return data
}

/**
 * Remplace `localStorage` (ou `sessionStorage`) par une copie de son contenu actuel dont les
 * opérations choisies lèvent. Annulé par {@link restoreStorage} (à appeler dans `afterEach`).
 */
export function faultyStorage(
  faults: StorageFaults, which: 'localStorage' | 'sessionStorage' = 'localStorage',
): Storage & { data: Map<string, string> } {
  const real = globalThis[which]
  const data = snapshot(real)
  const fake = {
    data,
    get length() { return data.size },
    key: (i: number) => [...data.keys()][i] ?? null,
    getItem: (k: string) => {
      if (faults.get) throw new DOMException('denied', 'SecurityError')
      return data.has(k) ? data.get(k)! : null
    },
    setItem: (k: string, v: string) => {
      if (faults.set) throw new DOMException('full', 'QuotaExceededError')
      data.set(k, String(v))
    },
    removeItem: (k: string) => {
      if (faults.remove) throw new DOMException('denied', 'SecurityError')
      data.delete(k)
    },
    clear: () => { data.clear() },
  }
  vi.stubGlobal(which, fake)
  restoreFns.push(() => vi.stubGlobal(which, real))
  return fake as unknown as Storage & { data: Map<string, string> }
}

/** Remet le vrai stockage en place. */
export function restoreStorage(): void {
  for (const fn of restoreFns.reverse()) fn()
  restoreFns = []
}
