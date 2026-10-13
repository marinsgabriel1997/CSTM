// Implementação em memória de `api` para os testes, imitando os contratos do
// backend usados pela interface: validação, ordenação manual e busca por prefixo.
import type { Api, Folder, Snippet } from "../api";

const TIMESTAMP = "2026-01-01T00:00:00.000Z";

function required(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw `o campo ${field} não pode ficar vazio`;
  return trimmed;
}

function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

function bySortOrder<T extends { id: number; sortOrder: number }>(a: T, b: T): number {
  return a.sortOrder - b.sortOrder || a.id - b.id;
}

export function createFakeApi() {
  const folders: Folder[] = [];
  const snippets: Snippet[] = [];
  let nextId = 1;

  function findFolder(id: number): Folder {
    const folder = folders.find((f) => f.id === id);
    if (!folder) throw "registro não encontrado";
    return folder;
  }

  function findSnippet(id: number): Snippet {
    const snippet = snippets.find((s) => s.id === id);
    if (!snippet) throw "registro não encontrado";
    return snippet;
  }

  function reorder<T extends { id: number; sortOrder: number }>(siblings: T[], item: T, position: number) {
    const others = siblings.filter((s) => s.id !== item.id).sort(bySortOrder);
    others.splice(Math.min(position, others.length), 0, item);
    others.forEach((s, index) => (s.sortOrder = index));
  }

  function nextSortOrder(items: { sortOrder: number }[]): number {
    return items.reduce((max, item) => Math.max(max, item.sortOrder + 1), 0);
  }

  function deleteFolderTree(id: number) {
    for (const child of folders.filter((f) => f.parentId === id)) deleteFolderTree(child.id);
    for (let i = snippets.length - 1; i >= 0; i--) if (snippets[i].folderId === id) snippets.splice(i, 1);
    folders.splice(folders.indexOf(findFolder(id)), 1);
  }

  const api: Api = {
    listFolders: async () => [...folders].sort(bySortOrder).map((f) => ({ ...f })),
    createFolder: async (parentId, name) => {
      name = required(name, "nome");
      if (parentId !== null) findFolder(parentId);
      const folder: Folder = {
        id: nextId++,
        parentId,
        name,
        sortOrder: nextSortOrder(folders.filter((f) => f.parentId === parentId)),
        createdAt: TIMESTAMP,
        updatedAt: TIMESTAMP,
      };
      folders.push(folder);
      return { ...folder };
    },
    renameFolder: async (id, name) => {
      const folder = findFolder(id);
      folder.name = required(name, "nome");
      return { ...folder };
    },
    deleteFolder: async (id) => {
      deleteFolderTree(id);
    },
    moveFolder: async (id, parentId, position) => {
      const folder = findFolder(id);
      for (let current = parentId; current !== null; current = findFolder(current).parentId) {
        if (current === id) throw "uma pasta não pode ser movida para dentro de si mesma ou de uma subpasta";
      }
      folder.parentId = parentId;
      reorder(folders.filter((f) => f.parentId === parentId), folder, position);
    },

    listSnippets: async (folderId) =>
      snippets
        .filter((s) => s.folderId === folderId)
        .sort(bySortOrder)
        .map((s) => ({ ...s })),
    listAllSnippets: async () =>
      [...snippets]
        .sort((a, b) => (a.folderId ?? 0) - (b.folderId ?? 0) || bySortOrder(a, b))
        .map((s) => ({ ...s })),
    listFavorites: async () =>
      snippets
        .filter((s) => s.favorite)
        .sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase()) || a.id - b.id)
        .map((s) => ({ ...s })),
    searchSnippets: async (query) => {
      const terms = normalize(query).split(/\s+/).filter(Boolean);
      if (terms.length === 0) return [];
      return snippets
        .filter((s) => {
          const words = normalize(`${s.title} ${s.content}`).split(/[^\p{L}\p{N}]+/u);
          return terms.every((term) => words.some((word) => word.startsWith(term)));
        })
        .map((s) => ({ ...s }));
    },
    createSnippet: async (folderId, title, content) => {
      title = required(title, "título");
      required(content, "conteúdo");
      if (folderId !== null) findFolder(folderId);
      const snippet: Snippet = {
        id: nextId++,
        folderId,
        title,
        content,
        favorite: false,
        useCount: 0,
        lastUsedAt: null,
        sortOrder: nextSortOrder(snippets.filter((s) => s.folderId === folderId)),
        createdAt: TIMESTAMP,
        updatedAt: TIMESTAMP,
      };
      snippets.push(snippet);
      return { ...snippet };
    },
    updateSnippet: async (id, title, content) => {
      const snippet = findSnippet(id);
      snippet.title = required(title, "título");
      required(content, "conteúdo");
      snippet.content = content;
      return { ...snippet };
    },
    setFavorite: async (id, favorite) => {
      const snippet = findSnippet(id);
      snippet.favorite = favorite;
      return { ...snippet };
    },
    deleteSnippet: async (id) => {
      snippets.splice(snippets.indexOf(findSnippet(id)), 1);
    },
    moveSnippet: async (id, folderId, position) => {
      const snippet = findSnippet(id);
      if (folderId !== null) findFolder(folderId);
      snippet.folderId = folderId;
      reorder(snippets.filter((s) => s.folderId === folderId), snippet, position);
    },

    // Nos testes não há janela nativa: o fechamento nunca é solicitado.
    onCloseRequested: async () => () => {},
    closeWindow: async () => {},
  };

  return { api, folders, snippets };
}
