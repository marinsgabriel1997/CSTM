/** Item da árvore: pasta ou texto (id negativo para texto novo ainda não gravado). */
export interface ItemRef {
  kind: "folder" | "snippet";
  id: number;
}

export type ActionKey = "rename" | "move" | "up" | "down" | "favorite" | "delete";

export interface ItemAction {
  key: ActionKey;
  label: string;
  disabled?: boolean;
}

export const SHORTCUTS: Partial<Record<ActionKey, string>> = {
  rename: "F2",
  move: "Ctrl+M",
  up: "Alt+↑",
  down: "Alt+↓",
  delete: "Del",
};

export function sameItem(a: ItemRef | null, b: ItemRef | null): boolean {
  return a?.kind === b?.kind && a?.id === b?.id;
}

/** Ação do menu de contexto correspondente a um atalho de teclado na árvore. */
export function shortcutAction(event: {
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}): ActionKey | null {
  const { key, ctrlKey, altKey, shiftKey } = event;
  if (shiftKey) return null;
  if (altKey && !ctrlKey) {
    if (key === "ArrowUp") return "up";
    if (key === "ArrowDown") return "down";
    return null;
  }
  if (ctrlKey) return !altKey && key.toLowerCase() === "m" ? "move" : null;
  if (key === "F2") return "rename";
  if (key === "Delete") return "delete";
  return null;
}
