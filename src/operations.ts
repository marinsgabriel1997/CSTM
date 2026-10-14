// Ordem dos grupos da árvore (pastas e textos com o mesmo pai) para ordenar, inserir itens
// numa posição e desfazer mudanças, aplicadas pelo backend com `arrangeItems`.
import { includesItem, type ItemRef } from "./actions";
import { api, type Folder, type Snippet } from "./api";
import { siblingsOf, snippetsIn } from "./tree";

export interface GroupOrder {
  parentId: number | null;
  folderIds: number[];
  snippetIds: number[];
}

export type SortKind = "name" | "uses" | "recent";

/** Ordem atual do grupo; textos novos ainda não gravados ficam de fora. */
export function groupOrder(folders: Folder[], snippets: Snippet[], parentId: number | null): GroupOrder {
  return {
    parentId,
    folderIds: siblingsOf(folders, parentId).map((folder) => folder.id),
    snippetIds: snippetsIn(snippets, parentId)
      .filter((snippet) => snippet.id >= 0)
      .map((snippet) => snippet.id),
  };
}

/** Ordem atual de cada grupo, sem repetir. */
export function groupOrders(folders: Folder[], snippets: Snippet[], parents: (number | null)[]): GroupOrder[] {
  return [...new Set(parents)].map((parentId) => groupOrder(folders, snippets, parentId));
}

/** Volta os grupos à ordem guardada, trazendo de volta os itens que saíram deles. */
export async function restoreOrders(orders: GroupOrder[]): Promise<void> {
  for (const order of orders) await api.arrangeItems(order.parentId, order.folderIds, order.snippetIds);
}

/** O grupo com `items` inseridos antes de `before` (ou no fim do seu tipo). */
export function insertInto(order: GroupOrder, items: ItemRef[], before: ItemRef | null): GroupOrder {
  const insert = (ids: number[], kind: ItemRef["kind"]) => {
    const moved = items.filter((item) => item.kind === kind).map((item) => item.id);
    const rest = ids.filter((id) => !moved.includes(id));
    const at = before?.kind === kind && !includesItem(items, before) ? rest.indexOf(before.id) : -1;
    rest.splice(at < 0 ? rest.length : at, 0, ...moved);
    return rest;
  };
  return { parentId: order.parentId, folderIds: insert(order.folderIds, "folder"), snippetIds: insert(order.snippetIds, "snippet") };
}

const collator = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });

/** Ordem do grupo pelo critério: pastas sempre por nome; textos pelo critério, empates por nome. */
export function sortedOrder(
  folders: Folder[],
  snippets: Snippet[],
  parentId: number | null,
  kind: SortKind,
): GroupOrder {
  const byTitle = (a: Snippet, b: Snippet) => collator.compare(a.title, b.title);
  const compare: Record<SortKind, (a: Snippet, b: Snippet) => number> = {
    name: byTitle,
    uses: (a, b) => b.useCount - a.useCount || byTitle(a, b),
    // Textos nunca usados vão para o fim.
    recent: (a, b) => (b.lastUsedAt ?? "").localeCompare(a.lastUsedAt ?? "") || byTitle(a, b),
  };
  return {
    parentId,
    folderIds: siblingsOf(folders, parentId)
      .sort((a, b) => collator.compare(a.name, b.name))
      .map((folder) => folder.id),
    snippetIds: snippetsIn(snippets, parentId)
      .filter((snippet) => snippet.id >= 0)
      .sort(compare[kind])
      .map((snippet) => snippet.id),
  };
}
