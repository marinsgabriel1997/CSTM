// Preferências de interface guardadas no armazenamento local do WebView. Não são
// dados do usuário: se faltarem ou estiverem corrompidas, valem os padrões.

export const TREE_WIDTH = { min: 220, max: 480, initial: 290 };

export interface Preferences {
  treeWidth: number;
  /** Pastas recolhidas; as demais aparecem abertas. */
  collapsed: number[];
}

const KEY = "cstm.preferences";

export function clampTreeWidth(width: number): number {
  return Math.round(Math.min(TREE_WIDTH.max, Math.max(TREE_WIDTH.min, width)));
}

export function loadPreferences(): Preferences {
  const defaults: Preferences = { treeWidth: TREE_WIDTH.initial, collapsed: [] };
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Preferences>;
    return {
      treeWidth:
        typeof stored.treeWidth === "number" ? clampTreeWidth(stored.treeWidth) : defaults.treeWidth,
      collapsed: Array.isArray(stored.collapsed)
        ? stored.collapsed.filter((id) => typeof id === "number")
        : defaults.collapsed,
    };
  } catch {
    return defaults;
  }
}

export function savePreferences(preferences: Preferences) {
  try {
    localStorage.setItem(KEY, JSON.stringify(preferences));
  } catch {
    // Sem armazenamento disponível, as preferências valem só nesta sessão.
  }
}
