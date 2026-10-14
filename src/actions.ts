/** Item da árvore: pasta ou texto (id negativo para texto novo ainda não gravado). */
export interface ItemRef {
  kind: "folder" | "snippet";
  id: number;
}

export type ActionKey =
  | "cut"
  | "copy"
  | "paste"
  | "rename"
  | "move"
  | "up"
  | "down"
  | "favorite"
  | "sortName"
  | "sortUses"
  | "sortRecent"
  | "exportJson"
  | "exportTxt"
  | "delete";

export interface ItemAction {
  key: ActionKey;
  label: string;
  disabled?: boolean;
}

/** Somente atalhos que funcionam igual em qualquer programa do Windows. */
export const SHORTCUTS: Partial<Record<ActionKey, string>> = {
  cut: "Ctrl+X",
  copy: "Ctrl+C",
  paste: "Ctrl+V",
  rename: "F2",
  delete: "Del",
};

export function sameItem(a: ItemRef | null, b: ItemRef | null): boolean {
  return a?.kind === b?.kind && a?.id === b?.id;
}

export function includesItem(items: readonly ItemRef[], item: ItemRef | null): boolean {
  return items.some((candidate) => sameItem(candidate, item));
}
