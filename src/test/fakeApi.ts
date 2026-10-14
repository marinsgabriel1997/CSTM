// Implementação em memória de `api` para os testes, imitando os contratos do
// backend usados pela interface: validação, ordenação manual, busca por prefixo e lixeira.
import type { ItemRef } from "../actions";
import type {
  Api,
  ClipboardItem,
  Folder,
  PickerColumn,
  PickerNavigation,
  PickerSubcolumn,
  ShortcutStatus,
  Snippet,
  ThemeChoice,
  TransferSummary,
  TrashItem,
} from "../api";
import { DEFAULT_SHORTCUT } from "../shortcut";

const TIMESTAMP = "2026-01-01T00:00:00.000Z";
/** Coluna principal do menu de colagem quando a abertura não diz onde: no canto da janela. */
const DEFAULT_MAIN: PickerColumn = { x: 0, y: 0, width: 340, height: 440, hidden: false };

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

export interface TransferCall {
  command: "importTxtFiles" | "importFolder" | "importJson" | "exportJson" | "exportTxt";
  /** Destino da importação. */
  folderId?: number | null;
  includeRoot?: boolean;
  /** Itens exportados (vazio = biblioteca inteira). */
  items?: ItemRef[];
}

const FOLDER_CYCLE = "uma pasta não pode ser movida para dentro de si mesma ou de uma subpasta";

export function createFakeApi() {
  const folders: Folder[] = [];
  const snippets: Snippet[] = [];
  let nextId = 1;
  // Avisos da janela nativa registrados pela interface, disparados pelos testes.
  const closeListeners = new Set<() => void>();
  const quitListeners = new Set<() => void>();
  const pickerListeners = new Set<(main: PickerColumn) => void>();
  const settingsListeners = new Set<() => void>();
  const shortcut: ShortcutStatus = { shortcut: DEFAULT_SHORTCUT, registered: true };
  /** Atalhos que o "Windows" recusa, como se outro programa os usasse. */
  const takenShortcuts = new Set<string>();
  let navigation: PickerNavigation = "cascade";
  let theme: ThemeChoice = "system";
  const themeListeners = new Set<(theme: ThemeChoice) => void>();
  /** Inicialização com o Windows, como no registro; `failure` simula a recusa do Windows. */
  const autostart: { enabled: boolean; failure: string | null } = { enabled: false, failure: null };
  /** Histórico do clipboard, do mais recente para o mais antigo; `failure` simula um erro do backend. */
  const history: ClipboardItem[] = [];
  const historyState: { monitoring: boolean; failure: string | null } = { monitoring: true, failure: null };
  const historyListeners = new Set<() => void>();
  /** Itens do histórico colados e copiados pelo menu, na ordem. */
  const historyPasted: number[] = [];
  const historyCopied: number[] = [];
  /** Pedidos de layout do menu de colagem, na ordem. */
  const layouts: PickerSubcolumn[][] = [];
  /** Coluna principal da última abertura do menu e quantas vezes o menu avisou que desenhou. */
  let main: PickerColumn = { ...DEFAULT_MAIN };
  const picker = { readies: 0 };
  /** Conteúdos entregues pelo menu de colagem, na ordem. */
  const delivered: string[] = [];
  /** Conteúdos copiados pelo menu de colagem, sem colar, na ordem. */
  const copied: string[] = [];
  /** Importações e exportações pedidas, na ordem. */
  const transfers: TransferCall[] = [];
  // Simula o seletor e o backend; por padrão, o seletor é cancelado.
  const transfer: { handle: (call: TransferCall) => TransferSummary | null | Promise<TransferSummary | null> } = {
    handle: () => null,
  };
  /** Itens na lixeira (`folder-1`, `snippet-2`) e a data da exclusão. */
  const trashed = new Map<string, string>();
  let clock = 0;

  const trashKey = (item: ItemRef) => `${item.kind}-${item.id}`;
  const isTrashed = (kind: ItemRef["kind"], id: number) => trashed.has(trashKey({ kind, id }));

  /** Pasta (ou raiz) visível: nem ela nem uma pasta acima está na lixeira. */
  function isLiveFolder(id: number | null): boolean {
    for (let current = id; current !== null; ) {
      const folder = folders.find((f) => f.id === current);
      if (!folder || isTrashed("folder", current)) return false;
      current = folder.parentId;
    }
    return true;
  }

  const liveFolders = () => folders.filter((f) => isLiveFolder(f.id));
  const liveSnippets = () => snippets.filter((s) => !isTrashed("snippet", s.id) && isLiveFolder(s.folderId));
  const childFolders = (parentId: number | null) =>
    folders.filter((f) => f.parentId === parentId && !isTrashed("folder", f.id)).sort(bySortOrder);
  const childSnippets = (folderId: number | null) =>
    snippets.filter((s) => s.folderId === folderId && !isTrashed("snippet", s.id)).sort(bySortOrder);

  function isSelfOrDescendant(folderId: number | null, ancestor: number): boolean {
    for (let current = folderId; current !== null; current = findFolder(current).parentId) {
      if (current === ancestor) return true;
    }
    return false;
  }

  function nameOf(item: ItemRef): string {
    return item.kind === "folder" ? findFolder(item.id).name : findSnippet(item.id).title;
  }

  function parentOf(item: ItemRef): number | null {
    return item.kind === "folder" ? findFolder(item.id).parentId : findSnippet(item.id).folderId;
  }

  function copyName(kind: ItemRef["kind"], parentId: number | null, name: string): string {
    const names = kind === "folder" ? childFolders(parentId).map((f) => f.name) : childSnippets(parentId).map((s) => s.title);
    const taken = new Set(names.map((n) => n.toLowerCase()));
    const base = `${name} - Cópia`;
    let candidate = base;
    for (let number = 2; taken.has(candidate.toLowerCase()); number++) candidate = `${base} (${number})`;
    return candidate;
  }

  function copyFolder(id: number, parentId: number | null, name: string): number {
    const copy: Folder = {
      id: nextId++,
      parentId,
      name,
      sortOrder: nextSortOrder(folders.filter((f) => f.parentId === parentId)),
      createdAt: TIMESTAMP,
      updatedAt: TIMESTAMP,
    };
    folders.push(copy);
    for (const child of childFolders(id)) copyFolder(child.id, copy.id, child.name);
    for (const snippet of childSnippets(id)) copySnippet(snippet.id, copy.id, snippet.title);
    return copy.id;
  }

  function copySnippet(id: number, folderId: number | null, title: string): number {
    const copy: Snippet = {
      ...findSnippet(id),
      id: nextId++,
      folderId,
      title,
      favorite: false,
      useCount: 0,
      lastUsedAt: null,
      sortOrder: nextSortOrder(snippets.filter((s) => s.folderId === folderId)),
    };
    snippets.push(copy);
    return copy.id;
  }

  /** Subpastas e textos que voltam junto com a pasta. */
  function contents(id: number): { folders: number; snippets: number } {
    const total = { folders: 0, snippets: childSnippets(id).length };
    for (const child of childFolders(id)) {
      const inner = contents(child.id);
      total.folders += 1 + inner.folders;
      total.snippets += inner.snippets;
    }
    return total;
  }

  function folderNames(folderId: number | null): string[] {
    const names: string[] = [];
    for (let current = folderId; current !== null; current = findFolder(current).parentId) {
      names.unshift(findFolder(current).name);
    }
    return names;
  }

  function removeItem(item: ItemRef) {
    if (item.kind === "folder") {
      if (folders.some((f) => f.id === item.id)) deleteFolderTree(item.id);
    } else {
      const index = snippets.findIndex((s) => s.id === item.id);
      if (index >= 0) snippets.splice(index, 1);
    }
    trashed.delete(trashKey(item));
  }

  /** Coloca `ids` no início do grupo, nessa ordem, e os demais itens do grupo depois. */
  function place<T extends { id: number; sortOrder: number }>(
    group: T[],
    ids: number[],
    find: (id: number) => T,
    setParent: (item: T) => void,
  ) {
    const listed = ids.map(find);
    listed.forEach(setParent);
    const rest = group.filter((item) => !ids.includes(item.id));
    [...listed, ...rest].forEach((item, index) => (item.sortOrder = index));
  }

  async function runTransfer(call: TransferCall) {
    transfers.push(call);
    return transfer.handle(call);
  }

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
    for (let i = snippets.length - 1; i >= 0; i--) {
      if (snippets[i].folderId === id) {
        trashed.delete(trashKey({ kind: "snippet", id: snippets[i].id }));
        snippets.splice(i, 1);
      }
    }
    folders.splice(folders.indexOf(findFolder(id)), 1);
    trashed.delete(trashKey({ kind: "folder", id }));
  }

  const api: Api = {
    listFolders: async () => liveFolders().sort(bySortOrder).map((f) => ({ ...f })),
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
    moveFolder: async (id, parentId, position) => {
      const folder = findFolder(id);
      if (isSelfOrDescendant(parentId, id)) throw FOLDER_CYCLE;
      folder.parentId = parentId;
      reorder(childFolders(parentId), folder, position);
    },

    listSnippets: async (folderId) =>
      liveSnippets()
        .filter((s) => s.folderId === folderId)
        .sort(bySortOrder)
        .map((s) => ({ ...s })),
    listAllSnippets: async () =>
      liveSnippets()
        .sort((a, b) => (a.folderId ?? 0) - (b.folderId ?? 0) || bySortOrder(a, b))
        .map((s) => ({ ...s })),
    listFavorites: async () =>
      liveSnippets()
        .filter((s) => s.favorite)
        .sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase()) || a.id - b.id)
        .map((s) => ({ ...s })),
    searchSnippets: async (query) => {
      const terms = normalize(query).split(/\s+/).filter(Boolean);
      if (terms.length === 0) return [];
      return liveSnippets()
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
      reorder(childSnippets(folderId), snippet, position);
    },

    trashItems: async (items) => {
      items.forEach(nameOf);
      // Como no backend, os itens excluídos juntos têm a mesma data.
      const now = new Date(Date.UTC(2026, 0, 1) + clock++ * 1000).toISOString();
      for (const item of items) {
        if (!trashed.has(trashKey(item))) trashed.set(trashKey(item), now);
      }
    },
    restoreItems: async (items) => {
      items.forEach(nameOf);
      for (const item of items) trashed.delete(trashKey(item));
      for (const item of items) {
        const origin = parentOf(item);
        const parentId = origin !== null && isLiveFolder(origin) ? origin : null;
        if (item.kind === "folder") {
          const folder = findFolder(item.id);
          folder.parentId = parentId;
          folder.sortOrder = nextSortOrder(folders.filter((f) => f.parentId === parentId));
        } else {
          const snippet = findSnippet(item.id);
          snippet.folderId = parentId;
          snippet.sortOrder = nextSortOrder(snippets.filter((s) => s.folderId === parentId));
        }
      }
    },
    deleteItems: async (items) => {
      items.forEach(removeItem);
    },
    emptyTrash: async () => {
      for (const key of [...trashed.keys()]) {
        const [kind, id] = key.split("-");
        removeItem({ kind: kind as ItemRef["kind"], id: Number(id) });
      }
    },
    listTrash: async () => {
      const items: TrashItem[] = [...trashed].map(([key, deletedAt]) => {
        const [kind, id] = key.split("-") as [ItemRef["kind"], string];
        const item = { kind, id: Number(id) };
        const inside = kind === "folder" ? contents(item.id) : { folders: 0, snippets: 0 };
        return { ...item, name: nameOf(item), path: folderNames(parentOf(item)), deletedAt, ...inside };
      });
      return items.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt) || a.kind.localeCompare(b.kind) || a.id - b.id);
    },
    copyItems: async (items, parentId) => {
      if (parentId !== null) findFolder(parentId);
      return items.map((item) => {
        if (item.kind === "folder" && isSelfOrDescendant(parentId, item.id)) {
          throw "uma pasta não pode ser copiada para dentro de si mesma ou de uma subpasta";
        }
        const name = parentOf(item) === parentId ? copyName(item.kind, parentId, nameOf(item)) : nameOf(item);
        const id = item.kind === "folder" ? copyFolder(item.id, parentId, name) : copySnippet(item.id, parentId, name);
        return { kind: item.kind, id };
      });
    },
    arrangeItems: async (parentId, folderIds, snippetIds) => {
      if (parentId !== null) {
        findFolder(parentId);
        if (folderIds.some((id) => isSelfOrDescendant(parentId, id))) throw FOLDER_CYCLE;
      }
      place(childFolders(parentId), folderIds, findFolder, (f) => (f.parentId = parentId));
      place(childSnippets(parentId), snippetIds, findSnippet, (s) => (s.folderId = parentId));
    },

    onCloseRequested: async (onClose) => subscribe(closeListeners, onClose),
    onQuitRequested: async (onQuit) => subscribe(quitListeners, onQuit),
    hideWindow: async () => {},
    showWindow: async () => {},
    exitApp: async () => {},
    onSettingsRequested: async (onOpen) => subscribe(settingsListeners, onOpen),
    getShortcut: async () => ({ ...shortcut }),
    setShortcut: async (value) => {
      if (takenShortcuts.has(value)) throw "o atalho não pôde ser registrado: HotKey already registered";
      Object.assign(shortcut, { shortcut: value, registered: true });
      return { ...shortcut };
    },
    suspendShortcut: async () => {
      shortcut.registered = false;
      return { ...shortcut };
    },
    resumeShortcut: async () => {
      shortcut.registered = !takenShortcuts.has(shortcut.shortcut);
      return { ...shortcut };
    },
    getTheme: async () => theme,
    setTheme: async (value) => {
      theme = value;
      themeListeners.forEach((listener) => listener(theme));
      return theme;
    },
    onThemeChanged: async (onChange) => subscribe(themeListeners, onChange),
    getAutostart: async () => autostart.enabled,
    setAutostart: async (enabled) => {
      if (autostart.failure) throw autostart.failure;
      autostart.enabled = enabled;
      return autostart.enabled;
    },
    getPickerNavigation: async () => navigation,
    setPickerNavigation: async (value) => {
      navigation = value;
      return navigation;
    },
    // Layout determinístico e simples: a principal onde a abertura a colocou e cada subcoluna
    // à direita da anterior, com o topo na pasta; não imita a falta de espaço da tela.
    layoutPicker: async (columns) => {
      layouts.push(columns);
      const placed: PickerColumn[] = [{ ...main }];
      for (const [index, column] of columns.entries()) {
        const parent = placed[index];
        placed.push({
          x: parent.x + parent.width + 2,
          y: Math.max(0, parent.y + column.anchorY - 5),
          width: 300,
          height: column.contentHeight,
          hidden: false,
        });
      }
      return placed;
    },
    onPickerOpened: async (onOpen) => subscribe(pickerListeners, onOpen),
    pickerReady: async () => {
      picker.readies += 1;
    },
    hidePicker: async () => {},
    chooseSnippet: async (id) => {
      const snippet = findSnippet(id);
      delivered.push(snippet.content);
      // Como no backend, a colagem conta como uso.
      snippet.useCount += 1;
      snippet.lastUsedAt = new Date(Date.UTC(2026, 0, 1) + clock++ * 1000).toISOString();
    },
    copySnippet: async (id) => {
      const snippet = findSnippet(id);
      copied.push(snippet.content);
      // Copiar pelo menu também conta como uso.
      snippet.useCount += 1;
      snippet.lastUsedAt = new Date(Date.UTC(2026, 0, 1) + clock++ * 1000).toISOString();
    },
    listClipboardHistory: async () => history.map((item) => ({ ...item })),
    pasteClipboardItem: async (id) => {
      historyPasted.push(id);
      toTop(id);
    },
    copyClipboardItem: async (id) => {
      historyCopied.push(id);
      toTop(id);
    },
    clearClipboardHistory: async () => {
      if (historyState.failure) throw historyState.failure;
      const count = history.length;
      history.length = 0;
      historyChanged();
      return count;
    },
    getClipboardMonitoring: async () => historyState.monitoring,
    setClipboardMonitoring: async (enabled) => {
      if (historyState.failure) throw historyState.failure;
      historyState.monitoring = enabled;
      historyChanged();
      return enabled;
    },
    onClipboardHistoryChanged: async (onChange) => subscribe(historyListeners, onChange),
    importTxtFiles: (folderId) => runTransfer({ command: "importTxtFiles", folderId }),
    importFolder: (folderId, includeRoot) => runTransfer({ command: "importFolder", folderId, includeRoot }),
    importJson: (folderId) => runTransfer({ command: "importJson", folderId }),
    exportJson: (items) => runTransfer({ command: "exportJson", items }),
    exportTxt: (items) => runTransfer({ command: "exportTxt", items }),
  };

  /** Como no backend, o item usado sobe para o topo do histórico. */
  function toTop(id: number) {
    const index = history.findIndex((item) => item.id === id);
    if (index < 0) throw "registro não encontrado";
    history.unshift(...history.splice(index, 1));
    historyChanged();
  }

  function historyChanged() {
    historyListeners.forEach((listener) => listener());
  }

  /** Simula uma cópia em outro programa entrando no topo do histórico. */
  function copyElsewhere(item: Partial<ClipboardItem> & Pick<ClipboardItem, "title">) {
    const entry: ClipboardItem = {
      id: nextId++,
      kind: "text",
      preview: item.title,
      thumbnail: null,
      width: null,
      height: null,
      // Meio-dia local: a data mostrada no menu é a mesma em qualquer fuso.
      copiedAt: new Date(2026, 0, 1, 12, 0, clock++).toISOString(),
      ...item,
    };
    history.unshift(entry);
    historyChanged();
    return entry;
  }

  function subscribe<T>(listeners: Set<T>, listener: T) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  /** Simula o usuário fechando a janela (X ou Alt+F4). */
  function requestClose() {
    closeListeners.forEach((listener) => listener());
  }

  /** Simula o usuário escolhendo "Sair" na bandeja. */
  function requestQuit() {
    quitListeners.forEach((listener) => listener());
  }

  /** Simula o atalho abrindo o menu de colagem, com a coluna principal em `at`. */
  function openPicker(at: Partial<PickerColumn> = {}) {
    main = { ...DEFAULT_MAIN, ...at };
    pickerListeners.forEach((listener) => listener(main));
  }

  /** Simula o item "Configurações" da bandeja. */
  function requestSettings() {
    settingsListeners.forEach((listener) => listener());
  }

  return {
    api,
    folders,
    snippets,
    delivered,
    copied,
    autostart,
    history,
    historyState,
    historyPasted,
    historyCopied,
    copyElsewhere,
    layouts,
    picker,
    /** Define a navegação nas pastas como se tivesse sido escolhida nas Configurações. */
    setNavigation: (value: PickerNavigation) => {
      navigation = value;
    },
    transfers,
    transfer,
    shortcut,
    takenShortcuts,
    requestClose,
    requestQuit,
    openPicker,
    requestSettings,
  };
}
