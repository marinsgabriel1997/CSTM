/**
 * Item da árvore: pasta, texto (id negativo para texto novo ainda não gravado) ou item do
 * histórico do clipboard. Itens do histórico só aceitam excluir e restaurar; as demais
 * operações da árvore nunca os recebem.
 */
export interface ItemRef {
  kind: "folder" | "snippet" | "clip";
  id: number;
}

/** A própria pasta Histórico da árvore, que não é um item do histórico (ids reais são positivos). */
export const HISTORY_FOLDER: ItemRef = { kind: "clip", id: 0 };

export function isHistoryFolder(item: ItemRef | null): boolean {
  return item?.kind === "clip" && item.id === HISTORY_FOLDER.id;
}

/**
 * A pasta virtual Raiz da árvore: não existe no banco (ids reais de pasta são positivos) e
 * representa a raiz, onde os itens têm `folder_id` nulo. Nunca é um item a operar.
 */
export const ROOT_FOLDER: ItemRef = { kind: "folder", id: 0 };

export function isRootFolder(item: ItemRef | null): boolean {
  return item?.kind === "folder" && item.id === ROOT_FOLDER.id;
}

/** Pastas e textos, sem a pasta Histórico nem os itens dela. */
export function withoutClips(items: ItemRef[]): ItemRef[] {
  return items.filter((item) => item.kind !== "clip");
}

export type ActionKey =
  | "newSnippet"
  | "newFolder"
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
