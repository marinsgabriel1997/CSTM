import { includesItem, type ItemRef } from "./actions";
import type { Folder, Snippet } from "./api";

/** Item da árvore única: pastas primeiro, depois textos, cada grupo na ordem manual. */
export type TreeNode =
  | { kind: "folder"; folder: Folder; children: TreeNode[] }
  | { kind: "snippet"; snippet: Snippet };

/** Opção de pasta para seletores, com a profundidade para indentar o nome. */
export interface FolderOption {
  id: number;
  name: string;
  depth: number;
}

/** O que uma pasta contém, incluindo todas as subpastas. */
export interface FolderContents {
  folders: number;
  snippets: number;
  favorites: number;
}

function byOrder<T extends { id: number; sortOrder: number }>(a: T, b: T): number {
  return a.sortOrder - b.sortOrder || a.id - b.id;
}

/** Pastas com o mesmo pai, na ordem manual. */
export function siblingsOf(folders: Folder[], parentId: number | null): Folder[] {
  return folders.filter((folder) => folder.parentId === parentId).sort(byOrder);
}

/** Textos da mesma pasta, na ordem manual. */
export function snippetsIn(snippets: Snippet[], folderId: number | null): Snippet[] {
  return snippets.filter((snippet) => snippet.folderId === folderId).sort(byOrder);
}

/** Monta a árvore a partir das listas planas devolvidas pelo backend. */
export function buildTree(folders: Folder[], snippets: Snippet[]): TreeNode[] {
  const build = (parentId: number | null): TreeNode[] => [
    ...siblingsOf(folders, parentId).map(
      (folder): TreeNode => ({ kind: "folder", folder, children: build(folder.id) }),
    ),
    ...snippetsIn(snippets, parentId).map((snippet): TreeNode => ({ kind: "snippet", snippet })),
  ];
  return build(null);
}

/** Mantém os textos aceitos por `keep` e somente as pastas que levam a algum deles. */
export function filterTree(nodes: TreeNode[], keep: (snippet: Snippet) => boolean): TreeNode[] {
  return nodes.flatMap((node): TreeNode[] => {
    if (node.kind === "snippet") return keep(node.snippet) ? [node] : [];
    const children = filterTree(node.children, keep);
    return children.length > 0 ? [{ ...node, children }] : [];
  });
}

/** A pasta `id` e todas as que estão abaixo dela. */
export function subtreeIds(folders: Folder[], id: number): Set<number> {
  const ids = new Set([id]);
  for (const folder of siblingsOf(folders, id)) {
    for (const descendant of subtreeIds(folders, folder.id)) ids.add(descendant);
  }
  return ids;
}

/** Pastas da raiz até `folderId`, inclusive; vazio para a raiz. */
export function folderPath(folders: Folder[], folderId: number | null): Folder[] {
  const path: Folder[] = [];
  for (let id = folderId; id !== null; ) {
    const folder = folders.find((f) => f.id === id);
    if (!folder) break;
    path.unshift(folder);
    id = folder.parentId;
  }
  return path;
}

export function folderContents(folders: Folder[], snippets: Snippet[], id: number): FolderContents {
  const ids = subtreeIds(folders, id);
  const inside = snippets.filter((snippet) => snippet.folderId !== null && ids.has(snippet.folderId));
  return {
    folders: ids.size - 1,
    snippets: inside.length,
    favorites: inside.filter((snippet) => snippet.favorite).length,
  };
}

/** Pastas em ordem de exibição da árvore, para seletores. */
export function folderOptions(folders: Folder[], parentId: number | null = null, depth = 0): FolderOption[] {
  return siblingsOf(folders, parentId).flatMap((folder) => [
    { id: folder.id, name: folder.name, depth },
    ...folderOptions(folders, folder.id, depth + 1),
  ]);
}

/** Itens na ordem da tela: cada pasta seguida do seu conteúdo, quando aberta. */
export function visibleItems(nodes: TreeNode[], isOpen: (folderId: number) => boolean): ItemRef[] {
  return nodes.flatMap((node): ItemRef[] =>
    node.kind === "snippet"
      ? [{ kind: "snippet", id: node.snippet.id }]
      : [
          { kind: "folder", id: node.folder.id },
          ...(isOpen(node.folder.id) ? visibleItems(node.children, isOpen) : []),
        ],
  );
}

/** Pasta onde o item está (`null` = raiz); `undefined` se o item não existe mais. */
export function parentOf(item: ItemRef, folders: Folder[], snippets: Snippet[]): number | null | undefined {
  if (item.kind === "clip") return undefined;
  return item.kind === "folder"
    ? folders.find((folder) => folder.id === item.id)?.parentId
    : snippets.find((snippet) => snippet.id === item.id)?.folderId;
}

/** Os itens, sem os que já vão junto com uma pasta também presente na lista. */
export function topLevel(items: ItemRef[], folders: Folder[], snippets: Snippet[]): ItemRef[] {
  return items.filter((item) => {
    for (let parent = parentOf(item, folders, snippets); parent != null; ) {
      if (includesItem(items, { kind: "folder", id: parent })) return false;
      parent = folders.find((folder) => folder.id === parent)?.parentId;
    }
    return true;
  });
}
