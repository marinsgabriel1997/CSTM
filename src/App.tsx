import { makeStyles, mergeClasses, Toaster, tokens, useId, useToastController } from "@fluentui/react-components";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

import { includesItem, sameItem, type ActionKey, type ItemAction, type ItemRef } from "./actions";
import {
  api,
  errorMessage,
  type AvailableUpdate,
  type Folder,
  type Page,
  type ShortcutStatus,
  type Snippet,
  type TrashItem,
} from "./api";
import AboutPage from "./components/AboutPage";
import { FolderEditor, NoSelection, SnippetEditor, Welcome } from "./components/Editors";
import { ConfirmDialog, ErrorMessage, NoticeToast, type Confirmation } from "./components/Feedback";
import HelpPage from "./components/HelpPage";
import LibraryTree, { type DropTarget, type SelectMode } from "./components/LibraryTree";
import MoveDialog from "./components/MoveDialog";
import { SelectionPanel, TrashPanel } from "./components/Panels";
import SettingsPage from "./components/SettingsPage";
import StatusBar from "./components/StatusBar";
import TreePane from "./components/TreePane";
import UpdateBar from "./components/UpdateBar";
import { DraftStore } from "./drafts";
import { capitalize, type Notice } from "./notice";
import {
  groupOrder,
  groupOrders,
  insertInto,
  restoreOrders,
  sortedOrder,
  type SortKind,
} from "./operations";
import { clampTreeWidth, loadPreferences, savePreferences, TREE_WIDTH } from "./preferences";
import { searchTerms } from "./search";
import { DEFAULT_SHORTCUT, shortcutLabel } from "./shortcut";
import {
  exportFailure,
  exportNotice,
  importFailure,
  importNotice,
  type ExportFormat,
  type ImportKind,
} from "./transfer";
import {
  buildTree,
  filterTree,
  folderContents,
  folderOptions,
  folderPath,
  parentOf,
  siblingsOf,
  snippetsIn,
  subtreeIds,
  topLevel,
  visibleItems,
  type TreeNode,
} from "./tree";

const SEARCH_DELAY_MS = 200;
/** Tempo de exibição das notificações de sucesso, como a de importação ou exportação concluída. */
export const NOTICE_DURATION_MS = 4000;
/** A notificação da lixeira fica um pouco mais, para dar tempo de usar o Desfazer. */
export const TRASH_NOTICE_MS = 6000;
/** Operações guardadas para o Ctrl+Z enquanto o aplicativo está aberto. */
export const UNDO_LIMIT = 50;
/** Distância das notificações à borda: acima da barra inferior. */
const TOASTER_OFFSET = { horizontal: 16, vertical: 40 };
const DIVIDER_KEY_STEP = 16;

const useStyles = makeStyles({
  app: {
    position: "relative",
    display: "grid",
    gridTemplateRows: "1fr 28px",
    height: "100%",
    backgroundColor: tokens.colorNeutralBackground3,
    color: tokens.colorNeutralForeground1,
  },
  // Com o aviso de atualização, uma linha automática no topo empurra o corpo e a barra inferior.
  appWithUpdate: { gridTemplateRows: "auto 1fr 28px" },
  body: {
    display: "grid",
    minHeight: 0,
  },
  divider: {
    position: "relative",
    cursor: "col-resize",
    outline: "none",
    "::after": {
      content: '""',
      position: "absolute",
      top: 0,
      bottom: 0,
      left: "2px",
      width: "1px",
    },
    ":hover::after": { backgroundColor: tokens.colorCompoundBrandStroke },
    ":focus-visible::after": { backgroundColor: tokens.colorCompoundBrandStroke },
  },
  editorPane: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    minHeight: 0,
    backgroundColor: tokens.colorNeutralBackground1,
    borderTop: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    borderLeft: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    borderTopLeftRadius: tokens.borderRadiusXLarge,
  },
  messages: {
    position: "absolute",
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    top: tokens.spacingVerticalM,
    left: "50%",
    transform: "translateX(-50%)",
    width: "min(560px, 90%)",
    boxShadow: tokens.shadow16,
  },
  deleteList: { marginTop: tokens.spacingVerticalXS, marginBottom: tokens.spacingVerticalS },
});

/** Ordem provisória que coloca textos novos no fim da pasta, na ordem de criação. */
const DRAFT_ORDER = 1e12;

function countSnippets(nodes: TreeNode[]): number {
  return nodes.reduce((total, node) => total + (node.kind === "snippet" ? 1 : countSnippets(node.children)), 0);
}

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/** Campo onde Ctrl+C, Ctrl+X, Ctrl+V e Ctrl+Z pertencem ao texto, não aos itens. */
function isEditable(target: EventTarget): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

/** "Usado 12 vezes · último uso em 10/10/2026" ou "Ainda não usado". */
function usageLabel(snippet: Snippet): string {
  if (snippet.useCount === 0 || !snippet.lastUsedAt) return "Ainda não usado";
  const date = new Date(snippet.lastUsedAt).toLocaleDateString("pt-BR");
  return `Usado ${plural(snippet.useCount, "vez", "vezes")} · último uso em ${date}`;
}

/** Desfaz uma operação da árvore. */
interface UndoEntry {
  run: () => Promise<void>;
}

/** Itens recortados (movidos ao colar) ou copiados (duplicados ao colar). */
interface Marked {
  mode: "cut" | "copy";
  items: ItemRef[];
}

/**
 * Registra um aviso da janela nativa e devolve a limpeza para o `useEffect`. O registro é
 * assíncrono, então a remoção também cobre o efeito desfeito antes de ele terminar.
 */
function listenWindow<Args extends unknown[]>(
  subscribe: (handler: (...args: Args) => void) => Promise<() => void>,
  handler: (...args: Args) => void,
): () => void {
  let unlisten: (() => void) | undefined;
  let disposed = false;
  subscribe(handler).then(
    (remove) => (disposed ? remove() : (unlisten = remove)),
    // Fora do Tauri (frontend no navegador) não há janela nativa para ouvir.
    () => undefined,
  );
  return () => {
    disposed = true;
    unlisten?.();
  };
}

function App() {
  const styles = useStyles();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [loaded, setLoaded] = useState(false);
  // Incrementado após cada alteração estrutural para recarregar pastas e textos.
  const [version, setVersion] = useState(0);
  const [store] = useState(() => new DraftStore());
  const drafts = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const [trash, setTrash] = useState<TrashItem[]>([]);
  // Item com o foco: aberto no editor quando é o único selecionado.
  const [selection, setSelection] = useState<ItemRef | null>(null);
  // Seleção múltipla (dois itens ou mais); vazia quando só `selection` está selecionado.
  const [multi, setMulti] = useState<ItemRef[]>([]);
  // Início do intervalo selecionado com Shift.
  const anchor = useRef<ItemRef | null>(null);
  const [trashOpen, setTrashOpen] = useState(false);
  const [marked, setMarked] = useState<Marked | null>(null);
  const [dragging, setDragging] = useState<ItemRef[] | null>(null);
  const undoStack = useRef<UndoEntry[]>([]);
  const itemShortcut = useRef<(event: globalThis.KeyboardEvent) => void>(() => undefined);
  const [query, setQuery] = useState("");
  // Termo efetivamente buscado: acompanha `query` após uma pausa na digitação.
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<{ term: string; ids: Set<number> } | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [preferences, setPreferences] = useState(loadPreferences);
  // Pasta onde uma nova pasta está sendo nomeada (`null` é a raiz).
  const [newFolderIn, setNewFolderIn] = useState<number | null | undefined>(undefined);
  const [renamingFolder, setRenamingFolder] = useState<number | null>(null);
  const [moving, setMoving] = useState<ItemRef[] | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Atalho do menu de colagem; `null` até carregar (ou fora do Tauri).
  const [shortcut, setShortcut] = useState<ShortcutStatus | null>(null);
  const [shortcutWarningDismissed, setShortcutWarningDismissed] = useState(false);
  // Versão nova a avisar; `null` sem versão nova ou depois de dispensada.
  const [update, setUpdate] = useState<AvailableUpdate | null>(null);
  // Página aberta no lugar do editor (Configurações, Ajuda ou Sobre); `null` mostra o editor.
  const [page, setPage] = useState<Page | null>(null);
  const toasterId = useId("notices");
  const { dispatchToast } = useToastController(toasterId);
  const treeRef = useRef<HTMLDivElement>(null);
  const paneRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  // Campo do editor que recebe o foco após a próxima renderização.
  const focusRequest = useRef<"title" | null>(null);

  useEffect(() => {
    let current = true;
    Promise.all([api.listFolders(), api.listAllSnippets(), api.listTrash()]).then(
      ([folderList, snippetList, trashList]) => {
        if (!current) return;
        setFolders(folderList);
        setSnippets(snippetList);
        setTrash(trashList);
        setLoaded(true);
      },
      (reason) => current && setError(errorMessage(reason)),
    );
    return () => {
      current = false;
    };
  }, [version]);

  useEffect(() => {
    let current = true;
    api.getShortcut().then(
      (status) => current && setShortcut(status),
      // Fora do Tauri (frontend no navegador) não há atalho global.
      () => undefined,
    );
    return () => {
      current = false;
    };
  }, []);

  // Assina o aviso antes de consultar, para não perder uma versão encontrada nesse intervalo.
  useEffect(() => {
    let current = true;
    const stop = listenWindow(api.onUpdateAvailable, (available) => setUpdate(available));
    api.getAvailableUpdate().then(
      (available) => current && available && setUpdate((found) => found ?? available),
      // Fora do Tauri (frontend no navegador) não há verificação de atualização.
      () => undefined,
    );
    return () => {
      current = false;
      stop();
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(query.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!searchTerm) return;
    let current = true;
    api.searchSnippets(searchTerm).then(
      (found) => current && setResults({ term: searchTerm, ids: new Set(found.map((snippet) => snippet.id)) }),
      (reason) => current && setError(errorMessage(reason)),
    );
    // Descarta respostas de uma busca anterior que cheguem fora de ordem.
    return () => {
      current = false;
    };
  }, [searchTerm, version]);

  // Gravações automáticas atualizam só o texto gravado, sem recarregar tudo.
  useEffect(
    () =>
      store.onSaved((previousId, snippet) => {
        setSnippets((list) =>
          previousId < 0 ? [...list, snippet] : list.map((item) => (item.id === snippet.id ? snippet : item)),
        );
        setSelection((current) =>
          current?.kind === "snippet" && current.id === previousId ? { kind: "snippet", id: snippet.id } : current,
        );
      }),
    [store],
  );

  // Na primeira execução do aplicativo, a Ajuda abre sozinha.
  useEffect(() => {
    let current = true;
    api.takeHelpPrompt().then(
      (first) => current && first && setPage("help"),
      () => undefined,
    );
    return () => {
      current = false;
    };
  }, []);

  useEffect(() => savePreferences(preferences), [preferences]);

  // F1 abre a Ajuda de qualquer lugar da janela.
  useEffect(() => {
    const listener = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "F1") return;
      event.preventDefault();
      setPage("help");
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  useEffect(() => {
    const listener = (event: globalThis.KeyboardEvent) => itemShortcut.current(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  useEffect(() => {
    const flush = () => void store.flushAll();
    window.addEventListener("blur", flush);
    return () => window.removeEventListener("blur", flush);
  }, [store]);

  // O aplicativo continua na bandeja: fechar a janela só a oculta, e os rascunhos que
  // não puderem ser gravados ficam em memória.
  useEffect(
    () =>
      listenWindow(api.onCloseRequested, () => {
        void api.hideWindow();
        void store.flushAll();
      }),
    [store],
  );

  // O pedido da bandeja sempre abre a página, sem alternar.
  useEffect(() => listenWindow(api.onPageRequested, (requested) => setPage(requested)), []);

  // "Sair" na bandeja grava o que estiver pendente e pede confirmação se algo não puder ser gravado.
  useEffect(
    () =>
      listenWindow(api.onQuitRequested, async () => {
        await store.flushAll();
        if (!store.hasUnsaved()) {
          void api.exitApp();
          return;
        }
        void api.showWindow();
        setConfirmation({
          title: "Sair sem salvar?",
          message:
            "Há textos com alterações que não puderam ser salvas (título ou conteúdo vazio, ou erro ao gravar). Se sair agora, essas alterações serão perdidas.",
          confirmLabel: "Sair sem salvar",
          danger: true,
          onConfirm: () => {
            setConfirmation(null);
            void api.exitApp();
          },
        });
      }),
    [store],
  );

  useEffect(() => {
    if (focusRequest.current === "title") titleRef.current?.focus();
    focusRequest.current = null;
  });

  // O atalho fica sem registro também durante a gravação de um novo, com a página de Configurações aberta.
  const shortcutWarning =
    shortcut && !shortcut.registered && !shortcutWarningDismissed && page !== "settings"
      ? `O atalho ${shortcutLabel(shortcut.shortcut)} não pôde ser registrado; outro programa pode estar usando-o.`
      : null;

  // Textos como aparecem na tela: com as edições ainda não gravadas e os textos novos.
  const displaySnippets = useMemo(() => {
    const list = snippets.map((snippet) => {
      const draft = drafts.get(snippet.id);
      return draft ? { ...snippet, title: draft.title, content: draft.content } : snippet;
    });
    for (const draft of drafts.values()) {
      if (draft.id >= 0) continue;
      list.push({
        id: draft.id,
        folderId: draft.folderId,
        title: draft.title,
        content: draft.content,
        favorite: false,
        useCount: 0,
        lastUsedAt: null,
        sortOrder: DRAFT_ORDER - draft.id,
        createdAt: "",
        updatedAt: "",
      });
    }
    return list;
  }, [snippets, drafts]);

  const searching = searchTerm !== "";
  const resultIds = searching ? (results?.ids ?? new Set<number>()) : null;
  const filtering = resultIds !== null || favoritesOnly;
  const fullTree = useMemo(() => buildTree(folders, displaySnippets), [folders, displaySnippets]);
  const nodes = filtering
    ? filterTree(
        fullTree,
        (snippet) => (!resultIds || resultIds.has(snippet.id)) && (!favoritesOnly || snippet.favorite),
      )
    : fullTree;
  const collapsed = new Set(preferences.collapsed);
  // Durante a busca ou o filtro, as pastas com resultados ficam abertas.
  const isOpen = (folderId: number) => filtering || !collapsed.has(folderId);

  const selectedFolder =
    selection?.kind === "folder" ? folders.find((folder) => folder.id === selection.id) : undefined;
  const openSnippet =
    selection?.kind === "snippet" ? displaySnippets.find((snippet) => snippet.id === selection.id) : undefined;
  const openDraft = openSnippet && drafts.get(openSnippet.id);
  const empty = loaded && folders.length === 0 && displaySnippets.length === 0 && newFolderIn === undefined;
  const exists = (item: ItemRef) =>
    item.kind === "folder"
      ? folders.some((folder) => folder.id === item.id)
      : displaySnippets.some((snippet) => snippet.id === item.id);
  // Itens que saíram da árvore (excluídos, por exemplo) deixam de contar como selecionados.
  const multiSelection = multi.filter(exists);
  const selectedItems = multiSelection.length > 1 ? multiSelection : selection ? [selection] : [];
  // Ordem de toda a árvore, para as operações tratarem os itens na ordem da tela.
  const treeOrder = useMemo(() => visibleItems(fullTree, () => true), [fullTree]);

  function inTreeOrder(items: ItemRef[]): ItemRef[] {
    const position = (item: ItemRef) => treeOrder.findIndex((candidate) => sameItem(candidate, item));
    return [...items].sort((a, b) => position(a) - position(b));
  }

  /** Itens a operar: na ordem da tela, sem os que já vão junto com uma pasta da lista. */
  function prepare(items: ItemRef[]): ItemRef[] {
    return inTreeOrder(topLevel(items, folders, displaySnippets));
  }

  function nameOf(item: ItemRef): string {
    if (item.kind === "folder") return folders.find((folder) => folder.id === item.id)?.name ?? "";
    return displaySnippets.find((snippet) => snippet.id === item.id)?.title.trim() || "Sem título";
  }

  function targetFolder(): number | null {
    if (selection?.kind === "folder") return selectedFolder ? selection.id : null;
    return openSnippet?.folderId ?? null;
  }

  function reload() {
    setVersion((current) => current + 1);
  }

  async function attempt<T>(action: () => Promise<T>): Promise<T | undefined> {
    try {
      return await action();
    } catch (reason) {
      setError(errorMessage(reason));
      return undefined;
    } finally {
      reload();
    }
  }

  async function openRelease(target: AvailableUpdate) {
    try {
      await api.openRelease(target.url);
    } catch (reason) {
      setError(`Não foi possível abrir a página da release: ${errorMessage(reason)}`);
    }
  }

  async function dismissUpdate(target: AvailableUpdate) {
    try {
      await api.dismissUpdate(target.version);
      setUpdate((current) => (current?.version === target.version ? null : current));
    } catch (reason) {
      setError(`Não foi possível dispensar o aviso: ${errorMessage(reason)}`);
    }
  }

  function togglePage(target: Page) {
    setPage((current) => (current === target ? null : target));
  }

  function select(item: ItemRef | null) {
    setPage(null);
    store.open(item?.kind === "snippet" ? item.id : null);
    setSelection(item);
    setMulti([]);
    setTrashOpen(false);
    anchor.current = item;
  }

  /** Seleciona vários itens; com um só, volta à seleção simples. */
  function selectMany(items: ItemRef[], focus: ItemRef | null = items[items.length - 1] ?? null) {
    if (items.length <= 1) {
      const kept = anchor.current;
      select(items[0] ?? null);
      anchor.current = kept ?? items[0] ?? null;
      return;
    }
    // O editor dá lugar ao painel da seleção: as pendências são gravadas.
    store.open(null);
    setPage(null);
    setSelection(focus);
    setMulti(items);
    setTrashOpen(false);
  }

  function selectWith(item: ItemRef, mode: SelectMode) {
    if (mode === "single") {
      select(item);
      return;
    }
    if (mode === "toggle") {
      const next = includesItem(selectedItems, item)
        ? selectedItems.filter((candidate) => !sameItem(candidate, item))
        : [...selectedItems, item];
      anchor.current = item;
      selectMany(next, includesItem(next, item) ? item : (next[next.length - 1] ?? null));
      return;
    }
    const visible = visibleItems(nodes, isOpen);
    const from = visible.findIndex((candidate) => sameItem(candidate, anchor.current ?? selection));
    const to = visible.findIndex((candidate) => sameItem(candidate, item));
    selectMany(from < 0 || to < 0 ? [item] : visible.slice(Math.min(from, to), Math.max(from, to) + 1), item);
  }

  function selectAll() {
    const visible = visibleItems(nodes, isOpen);
    selectMany(visible, selection && includesItem(visible, selection) ? selection : (visible[0] ?? null));
  }

  /** Esc desfaz o recorte, se houver; senão, volta a seleção a um item. */
  function escape() {
    if (marked?.mode === "cut") setMarked(null);
    else if (multiSelection.length > 1) select(selection);
  }

  /** Abre as pastas até `folderId` para que o item criado ou movido fique visível. */
  function reveal(folderId: number | null) {
    const path = new Set(folderPath(folders, folderId).map((folder) => folder.id));
    setPreferences((current) => ({ ...current, collapsed: current.collapsed.filter((id) => !path.has(id)) }));
  }

  /** Itens novos precisam aparecer na árvore: busca e filtro são encerrados. */
  function clearFilters() {
    setQuery("");
    setSearchTerm("");
    setFavoritesOnly(false);
  }

  function newSnippet(folderId: number | null = targetFolder()) {
    clearFilters();
    reveal(folderId);
    select({ kind: "snippet", id: store.create(folderId) });
    focusRequest.current = "title";
  }

  function newFolder(parentId: number | null = targetFolder()) {
    clearFilters();
    reveal(parentId);
    setPage(null);
    setRenamingFolder(null);
    setNewFolderIn(parentId);
  }

  async function submitName(name: string) {
    treeRef.current?.focus();
    if (newFolderIn !== undefined) {
      const parentId = newFolderIn;
      setNewFolderIn(undefined);
      const folder = await attempt(() => api.createFolder(parentId, name));
      if (folder) select({ kind: "folder", id: folder.id });
    } else if (renamingFolder !== null) {
      const id = renamingFolder;
      setRenamingFolder(null);
      await attempt(() => api.renameFolder(id, name));
    }
  }

  function cancelName() {
    setNewFolderIn(undefined);
    setRenamingFolder(null);
    treeRef.current?.focus();
  }

  function toggleFolder(folderId: number, open: boolean) {
    setPreferences((current) => ({
      ...current,
      collapsed: open
        ? current.collapsed.filter((id) => id !== folderId)
        : [...current.collapsed.filter((id) => id !== folderId), folderId],
    }));
  }

  /** O item faz parte de uma seleção múltipla: as ações valem para todos os selecionados. */
  function inSelection(item: ItemRef): boolean {
    return selectedItems.length > 1 && includesItem(selectedItems, item);
  }

  const clipboardActions = (disabled = false): ItemAction[] => [
    { key: "cut", label: "Recortar", disabled },
    { key: "copy", label: "Copiar", disabled },
    { key: "paste", label: "Colar", disabled: marked === null },
  ];

  /** Textos gravados entre os itens. */
  function snippetsOf(items: ItemRef[]): Snippet[] {
    return items.flatMap((item) =>
      item.kind === "snippet" ? snippets.filter((snippet) => snippet.id === item.id) : [],
    );
  }

  /** "Adicionar aos favoritos" ou, se todos os textos já são favoritos, "Remover"; `null` sem textos. */
  function favoriteLabel(items: ItemRef[]): string | null {
    const texts = snippetsOf(items);
    if (texts.length === 0) return null;
    return texts.every((snippet) => snippet.favorite) ? "Remover dos favoritos" : "Adicionar aos favoritos";
  }

  function actionsFor(item: ItemRef): ItemAction[] {
    if (inSelection(item)) {
      const favorite = favoriteLabel(selectedItems);
      return [
        ...clipboardActions(),
        { key: "move", label: "Mover para…" },
        ...(favorite ? [{ key: "favorite", label: favorite } as ItemAction] : []),
        { key: "exportJson", label: "Backup JSON…" },
        { key: "exportTxt", label: "Pastas e arquivos .txt…" },
        { key: "delete", label: "Excluir" },
      ];
    }
    if (item.kind === "folder") {
      const folder = folders.find((candidate) => candidate.id === item.id);
      if (!folder) return [];
      const siblings = siblingsOf(folders, folder.parentId);
      const index = siblings.findIndex((sibling) => sibling.id === folder.id);
      return [
        ...clipboardActions(),
        { key: "rename", label: "Renomear" },
        { key: "move", label: "Mover para…" },
        { key: "up", label: "Mover para cima", disabled: filtering || index <= 0 },
        { key: "down", label: "Mover para baixo", disabled: filtering || index >= siblings.length - 1 },
        { key: "sortName", label: "Por nome (A–Z)", disabled: filtering },
        { key: "sortUses", label: "Por mais usados", disabled: filtering },
        { key: "sortRecent", label: "Por uso mais recente", disabled: filtering },
        { key: "exportJson", label: "Backup JSON…" },
        { key: "exportTxt", label: "Pastas e arquivos .txt…" },
        { key: "delete", label: "Excluir" },
      ];
    }
    const snippet = displaySnippets.find((candidate) => candidate.id === item.id);
    if (!snippet) return [];
    const isNew = snippet.id < 0;
    const siblings = snippetsIn(snippets, snippet.folderId);
    const index = siblings.findIndex((sibling) => sibling.id === snippet.id);
    return [
      ...clipboardActions(isNew),
      { key: "rename", label: "Renomear" },
      { key: "move", label: "Mover para…" },
      { key: "up", label: "Mover para cima", disabled: isNew || filtering || index <= 0 },
      { key: "down", label: "Mover para baixo", disabled: isNew || filtering || index >= siblings.length - 1 },
      {
        key: "favorite",
        label: snippet.favorite ? "Remover dos favoritos" : "Adicionar aos favoritos",
        disabled: isNew,
      },
      { key: "delete", label: "Excluir" },
    ];
  }

  function menuHeaderFor(item: ItemRef): string | undefined {
    return inSelection(item) ? `${selectedItems.length} itens selecionados` : undefined;
  }

  const SORTS: Partial<Record<ActionKey, SortKind>> = { sortName: "name", sortUses: "uses", sortRecent: "recent" };

  function runAction(item: ItemRef, key: ActionKey) {
    const items = inSelection(item) ? selectedItems : [item];
    switch (key) {
      case "cut":
      case "copy":
        mark(key, items);
        break;
      case "paste":
        void paste();
        break;
      case "rename":
        select(item);
        if (item.kind === "folder") {
          setNewFolderIn(undefined);
          setRenamingFolder(item.id);
        } else {
          focusRequest.current = "title";
        }
        break;
      case "move":
        setMoving(prepare(items));
        break;
      case "up":
      case "down":
        reorder(item, key === "up" ? -1 : 1);
        break;
      case "favorite":
        if (items.length > 1) void favoriteAll(items);
        else toggleFavorite(item.id);
        break;
      case "sortName":
      case "sortUses":
      case "sortRecent":
        sortGroup(item.id, SORTS[key]!);
        break;
      case "exportJson":
      case "exportTxt":
        void runExport(key === "exportJson" ? "json" : "txt", items);
        break;
      case "delete":
        void trashItems(items);
        break;
    }
  }

  function pushUndo(entry: UndoEntry) {
    const stack = undoStack.current;
    stack.push(entry);
    if (stack.length > UNDO_LIMIT) stack.shift();
  }

  /** Desfaz a última operação (ou `entry`, pelo botão da notificação), se ainda estiver na pilha. */
  async function undo(entry?: UndoEntry) {
    const stack = undoStack.current;
    const index = entry ? stack.lastIndexOf(entry) : stack.length - 1;
    if (index < 0) return;
    const [target] = stack.splice(index, 1);
    try {
      await target.run();
    } catch (reason) {
      notify({ intent: "error", title: "Não foi possível desfazer.", details: `${capitalize(errorMessage(reason))}.` });
    } finally {
      reload();
    }
  }

  function reorder(item: ItemRef, delta: number) {
    if (item.kind === "folder") {
      const folder = folders.find((candidate) => candidate.id === item.id);
      if (!folder) return;
      const before = groupOrder(folders, snippets, folder.parentId);
      const index = before.folderIds.indexOf(folder.id);
      attempt(async () => {
        await api.moveFolder(folder.id, folder.parentId, index + delta);
        pushUndo({ run: () => restoreOrders([before]) });
      });
    } else {
      const snippet = snippets.find((candidate) => candidate.id === item.id);
      if (!snippet) return;
      const before = groupOrder(folders, snippets, snippet.folderId);
      const index = before.snippetIds.indexOf(snippet.id);
      attempt(async () => {
        await api.moveSnippet(snippet.id, snippet.folderId, index + delta);
        pushUndo({ run: () => restoreOrders([before]) });
      });
    }
  }

  /** Move os itens para `parentId`, antes de `before` ou no fim do grupo. */
  async function moveItems(items: ItemRef[], parentId: number | null, before: ItemRef | null = null) {
    const top = prepare(items);
    for (const item of top) if (item.kind === "snippet" && item.id < 0) store.setFolder(item.id, parentId);
    const saved = top.filter((item) => item.id >= 0);
    reveal(parentId);
    if (saved.length === 0) return;
    const sources = saved.map((item) => parentOf(item, folders, snippets) ?? null);
    const orders = groupOrders(folders, snippets, [parentId, ...sources]);
    const target = insertInto(orders[0], saved, before);
    await attempt(async () => {
      await api.arrangeItems(parentId, target.folderIds, target.snippetIds);
      pushUndo({ run: () => restoreOrders(orders) });
    });
  }

  /** Copia os itens para `parentId` (duplica, na mesma pasta), antes de `before` ou no fim do grupo. */
  async function copyItems(items: ItemRef[], parentId: number | null, before: ItemRef | null = null) {
    const top = prepare(items).filter((item) => item.id >= 0);
    if (top.length === 0) return;
    // A cópia é feita a partir do banco: as edições pendentes são gravadas antes.
    await store.flushAll();
    const order = groupOrder(folders, snippets, parentId);
    const copies = await attempt(async () => {
      const copies = await api.copyItems(top, parentId);
      if (before) {
        const target = insertInto(order, copies, before);
        await api.arrangeItems(parentId, target.folderIds, target.snippetIds);
      }
      pushUndo({ run: () => api.deleteItems(copies) });
      return copies;
    });
    if (!copies) return;
    reveal(parentId);
    selectMany(copies);
  }

  /** Recorta ou copia os itens para colar depois; copiar um único texto também leva o conteúdo ao clipboard. */
  function mark(mode: Marked["mode"], items: ItemRef[]) {
    const saved = prepare(items).filter((item) => item.id >= 0);
    if (saved.length === 0) return;
    setMarked({ mode, items: saved });
    if (mode === "copy" && saved.length === 1 && saved[0].kind === "snippet") {
      const content = displaySnippets.find((snippet) => snippet.id === saved[0].id)?.content;
      if (content) void navigator.clipboard?.writeText(content).catch(() => undefined);
    }
  }

  /** Destino do Colar: o do Novo; com um item marcado selecionado, a pasta dele (o que duplica). */
  function pasteTarget(): number | null {
    if (marked && selection && includesItem(marked.items, selection)) {
      return parentOf(selection, folders, displaySnippets) ?? null;
    }
    return targetFolder();
  }

  async function paste() {
    if (!marked || trashOpen) return;
    const parentId = pasteTarget();
    if (marked.mode === "cut") {
      setMarked(null);
      await moveItems(marked.items, parentId);
    } else {
      await copyItems(marked.items, parentId);
    }
  }

  function toggleFavorite(id: number) {
    const snippet = snippets.find((candidate) => candidate.id === id);
    if (snippet) attempt(() => api.setFavorite(id, !snippet.favorite));
  }

  /** Favorita os textos da seleção (ou desfavorita, se todos já são favoritos). */
  async function favoriteAll(items: ItemRef[]) {
    const texts = snippetsOf(items);
    const favorite = texts.some((snippet) => !snippet.favorite);
    await attempt(async () => {
      for (const snippet of texts) await api.setFavorite(snippet.id, favorite);
      pushUndo({
        run: async () => {
          for (const snippet of texts) await api.setFavorite(snippet.id, snippet.favorite);
        },
      });
    });
  }

  /** Reorganiza uma vez os itens diretos da pasta (`null` = raiz). */
  function sortGroup(parentId: number | null, kind: SortKind) {
    const before = groupOrder(folders, snippets, parentId);
    const sorted = sortedOrder(folders, snippets, parentId, kind);
    attempt(async () => {
      await api.arrangeItems(parentId, sorted.folderIds, sorted.snippetIds);
      pushUndo({ run: () => restoreOrders([before]) });
    });
  }

  /** Itens arrastados: a seleção, se o arrasto começa nela; senão, só o item. */
  function startDrag(item: ItemRef): ItemRef[] {
    if (!includesItem(selectedItems, item)) select(item);
    const items = prepare(includesItem(selectedItems, item) ? selectedItems : [item]).filter((i) => i.id >= 0);
    setDragging(items);
    return items;
  }

  function canDropInto(folderId: number | null): boolean {
    if (!dragging || folderId === null) return true;
    return !dragging.some((item) => item.kind === "folder" && subtreeIds(folders, item.id).has(folderId));
  }

  async function dropItems(target: DropTarget, copy: boolean) {
    const items = dragging;
    setDragging(null);
    if (!items) return;
    const [parentId, before] = target.kind === "into" ? [target.folderId, null] : [target.parentId, target.before];
    if (copy) await copyItems(items, parentId, before);
    else await moveItems(items, parentId, before);
  }

  /** Notificação no canto inferior direito; as de erro ficam até serem fechadas. */
  function notify(notice: Notice, duration = NOTICE_DURATION_MS) {
    dispatchToast(<NoticeToast notice={notice} />, {
      intent: notice.intent,
      timeout: notice.intent === "error" ? -1 : duration,
      pauseOnHover: true,
    });
  }

  async function runImport(kind: ImportKind) {
    const folderId = targetFolder();
    const path = folderPath(folders, folderId).map((folder) => folder.name);
    try {
      const summary = await (kind === "txt"
        ? api.importTxtFiles(folderId)
        : kind === "json"
          ? api.importJson(folderId)
          : api.importFolder(folderId, kind === "folder"));
      if (!summary) return;
      clearFilters();
      reveal(folderId);
      notify(importNotice(summary, path.length > 0 ? path.join(" › ") : null));
    } catch (reason) {
      notify(importFailure(errorMessage(reason)));
    } finally {
      reload();
    }
  }

  /** Exporta os itens ou, sem itens, a biblioteca inteira. */
  async function runExport(format: ExportFormat, items: ItemRef[]) {
    // A exportação lê o banco: as edições pendentes são gravadas antes.
    await store.flushAll();
    const selected = prepare(items).filter((item) => item.id >= 0);
    try {
      const summary = await (format === "json" ? api.exportJson(selected) : api.exportTxt(selected));
      if (summary) notify(exportNotice(summary));
    } catch (reason) {
      notify(exportFailure(errorMessage(reason)));
    }
  }

  /**
   * Tira os itens da árvore: os textos novos ainda não gravados são descartados, e a seleção
   * passa ao item seguinte. Devolve os itens gravados, que o backend deve remover.
   */
  function detach(items: ItemRef[]): ItemRef[] {
    const removed = new Set(items.flatMap((item) => (item.kind === "folder" ? [...subtreeIds(folders, item.id)] : [])));
    const inside = (folderId: number | null) => folderId !== null && removed.has(folderId);
    const gone = (item: ItemRef) =>
      includesItem(items, item) ||
      (item.kind === "folder" && removed.has(item.id)) ||
      inside(parentOf(item, folders, displaySnippets) ?? null);
    for (const draft of store.getSnapshot().values()) {
      if (inside(draft.folderId) || includesItem(items, { kind: "snippet", id: draft.id })) store.remove(draft.id);
    }
    if (selectedItems.some(gone)) {
      const visible = visibleItems(nodes, isOpen);
      const first = visible.findIndex(gone);
      const remaining = visible.filter((item) => !gone(item));
      select(remaining[Math.min(Math.max(first, 0), remaining.length - 1)] ?? null);
    }
    return items.filter((item) => item.id >= 0);
  }

  /** Del: move para a lixeira, sem confirmação, com Desfazer na notificação. */
  async function trashItems(items: ItemRef[]) {
    if (items.length === 0) return;
    await store.flushAll();
    const top = prepare(items);
    const sources = top.filter((item) => item.id >= 0).map((item) => parentOf(item, folders, snippets) ?? null);
    const orders = groupOrders(folders, snippets, sources);
    const saved = detach(top);
    if (saved.length === 0) return;
    await attempt(async () => {
      await api.trashItems(saved);
      const entry: UndoEntry = {
        run: async () => {
          await api.restoreItems(saved);
          await restoreOrders(orders);
        },
      };
      pushUndo(entry);
      notify(
        {
          intent: "info",
          icon: "trash",
          title: `${plural(saved.length, "item movido", "itens movidos")} para a lixeira.`,
          action: { label: "Desfazer", onClick: () => void undo(entry) },
        },
        TRASH_NOTICE_MS,
      );
    });
  }

  /** O que vai junto com os itens: subpastas e textos das pastas, e os textos. */
  function contentsMessage(items: ItemRef[]) {
    let subfolders = 0;
    let texts = 0;
    let favorites = 0;
    for (const item of items) {
      if (item.kind === "folder") {
        const contents = folderContents(folders, snippets, item.id);
        subfolders += contents.folders;
        texts += contents.snippets;
        favorites += contents.favorites;
      }
    }
    if (subfolders === 0 && texts === 0) return null;
    return (
      <>
        Também serão excluídos:
        <ul className={styles.deleteList}>
          {subfolders > 0 && <li>{plural(subfolders, "subpasta", "subpastas")}</li>}
          {texts > 0 && (
            <li>
              {plural(texts, "texto", "textos")}
              {favorites > 0 && `, incluindo ${plural(favorites, "favorito", "favoritos")}`}
            </li>
          )}
        </ul>
      </>
    );
  }

  /** Shift+Del: exclui definitivamente, após confirmar. */
  function confirmPermanentDelete(items: ItemRef[]) {
    const top = prepare(items);
    if (top.length === 0) return;
    const [first] = top;
    setConfirmation({
      title:
        top.length > 1
          ? `Excluir definitivamente ${top.length} itens?`
          : `Excluir definitivamente ${first.kind === "folder" ? "a pasta" : "o texto"} “${nameOf(first)}”?`,
      message: (
        <>
          {contentsMessage(top)}
          Esta ação não pode ser desfeita. Para poder recuperar depois, use Excluir (Del), que move para a lixeira.
        </>
      ),
      confirmLabel: "Excluir definitivamente",
      danger: true,
      onConfirm: () => {
        setConfirmation(null);
        const saved = detach(top);
        if (saved.length > 0) attempt(() => api.deleteItems(saved));
      },
    });
  }

  function restoreFromTrash(items: ItemRef[]) {
    attempt(() => api.restoreItems(items));
  }

  function confirmDeleteFromTrash(items: ItemRef[]) {
    const names = trash.filter((item) => includesItem(items, item)).map((item) => item.name);
    setConfirmation({
      title: names.length === 1 ? `Excluir definitivamente “${names[0]}”?` : `Excluir definitivamente ${names.length} itens?`,
      message: "Esta ação não pode ser desfeita.",
      confirmLabel: "Excluir definitivamente",
      danger: true,
      onConfirm: () => {
        setConfirmation(null);
        attempt(() => api.deleteItems(items));
      },
    });
  }

  function confirmEmptyTrash() {
    const trashedFolders = trash.filter((item) => item.kind === "folder");
    const inside = trashedFolders.reduce((total, item) => total + item.snippets, 0);
    const including =
      trashedFolders.length > 0
        ? `, incluindo ${plural(trashedFolders.length, "pasta", "pastas")}${inside > 0 ? ` com ${plural(inside, "texto", "textos")}` : ""}`
        : "";
    setConfirmation({
      title: "Esvaziar a lixeira?",
      message: `${trash.length === 1 ? "O item da lixeira será excluído" : `Os ${trash.length} itens da lixeira serão excluídos`} definitivamente${including}. Esta ação não pode ser desfeita.`,
      confirmLabel: "Esvaziar lixeira",
      danger: true,
      onConfirm: () => {
        setConfirmation(null);
        attempt(() => api.emptyTrash());
      },
    });
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (confirmation || moving || !event.ctrlKey || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === "n") {
      event.preventDefault();
      if (event.shiftKey) newFolder();
      else newSnippet();
    } else if (key === "s" && !event.shiftKey) {
      event.preventDefault();
      if (!openSnippet) return;
      if (openDraft?.status === "error") void store.retry(openSnippet.id);
      else void store.flush(openSnippet.id);
    }
  }

  /** Ctrl+C, Ctrl+X, Ctrl+V e Ctrl+Z sobre os itens; nos campos de texto, ficam com o próprio campo. */
  function handleItemShortcut(event: globalThis.KeyboardEvent) {
    if (confirmation || moving || event.defaultPrevented) return;
    // Com uma página aberta, Ctrl+C e afins valem para o texto dela, não para os itens da árvore.
    if (page && event.target instanceof Node && paneRef.current?.contains(event.target)) return;
    if (!event.ctrlKey || event.altKey || event.shiftKey || isEditable(event.target as EventTarget)) return;
    const key = event.key.toLowerCase();
    if (!["c", "x", "v", "z"].includes(key)) return;
    event.preventDefault();
    if (key === "z") void undo();
    else if (key === "v") void paste();
    else mark(key === "x" ? "cut" : "copy", selectedItems);
  }

  // Na janela toda, para valerem também com o foco fora da árvore (por exemplo, após fechar um menu).
  useEffect(() => {
    itemShortcut.current = handleItemShortcut;
  });

  function startResize(event: PointerEvent<HTMLDivElement>) {
    const divider = event.currentTarget;
    divider.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startWidth = preferences.treeWidth;
    const move = (moveEvent: globalThis.PointerEvent) =>
      setPreferences((current) => ({
        ...current,
        treeWidth: clampTreeWidth(startWidth + moveEvent.clientX - startX),
      }));
    const stop = () => {
      divider.removeEventListener("pointermove", move);
      divider.removeEventListener("pointerup", stop);
    };
    divider.addEventListener("pointermove", move);
    divider.addEventListener("pointerup", stop);
  }

  const path = folderPath(folders, targetFolder());
  const targetLabel = path.length > 0 ? `Em ${path.map((folder) => folder.name).join(" › ")}` : "Na raiz";
  const movingParents = new Set((moving ?? []).map((item) => parentOf(item, folders, displaySnippets) ?? null));

  let editor;
  if (page === "settings" && shortcut) {
    editor = (
      <SettingsPage
        shortcut={shortcut}
        onShortcutChange={(status) => {
          setShortcut(status);
          setShortcutWarningDismissed(false);
        }}
      />
    );
  } else if (page === "help") {
    editor = <HelpPage shortcut={shortcutLabel(shortcut?.shortcut ?? DEFAULT_SHORTCUT)} />;
  } else if (page === "about") {
    editor = <AboutPage />;
  } else if (trashOpen) {
    editor = (
      <TrashPanel
        items={trash}
        onRestore={restoreFromTrash}
        onDelete={confirmDeleteFromTrash}
        onEmpty={confirmEmptyTrash}
      />
    );
  } else if (empty) {
    editor = <Welcome />;
  } else if (selectedItems.length > 1) {
    const items = inTreeOrder(selectedItems);
    editor = (
      <SelectionPanel
        items={items.map((item) => {
          const path = folderPath(folders, parentOf(item, folders, displaySnippets) ?? null);
          return {
            item,
            name: nameOf(item),
            path: path.map((folder) => folder.name).join(" › ") || "Raiz",
            favorite: snippetsOf([item]).some((snippet) => snippet.favorite),
          };
        })}
        favoriteLabel={favoriteLabel(items)}
        onAction={(key) => runAction(items[0], key)}
        onDelete={(permanent) => (permanent ? confirmPermanentDelete(items) : void trashItems(items))}
      />
    );
  } else if (selectedFolder) {
    editor = (
      <FolderEditor
        folder={selectedFolder}
        path={folderPath(folders, selectedFolder.parentId)}
        contents={folderContents(folders, snippets, selectedFolder.id)}
        actions={actionsFor({ kind: "folder", id: selectedFolder.id })}
        onAction={(key) => runAction({ kind: "folder", id: selectedFolder.id }, key)}
        onRename={(name) => attempt(() => api.renameFolder(selectedFolder.id, name))}
        onSelectFolder={(id) => select({ kind: "folder", id })}
        onNewSnippet={() => newSnippet(selectedFolder.id)}
        onNewFolder={() => newFolder(selectedFolder.id)}
      />
    );
  } else if (openSnippet) {
    const item: ItemRef = { kind: "snippet", id: openSnippet.id };
    editor = (
      <SnippetEditor
        path={folderPath(folders, openSnippet.folderId)}
        title={openSnippet.title}
        content={openSnippet.content}
        status={openDraft?.status ?? "saved"}
        error={openDraft?.error ?? null}
        favorite={openSnippet.favorite}
        usage={usageLabel(openSnippet)}
        isNew={openSnippet.id < 0}
        titleRef={titleRef}
        contentRef={contentRef}
        actions={actionsFor(item)}
        onAction={(key) => runAction(item, key)}
        onChange={(changes) =>
          store.edit(
            openSnippet.id,
            snippets.find((snippet) => snippet.id === openSnippet.id),
            changes,
          )
        }
        onSelectFolder={(id) => select({ kind: "folder", id })}
        onToggleFavorite={() => toggleFavorite(openSnippet.id)}
        onRetry={() => void store.retry(openSnippet.id)}
      />
    );
  } else {
    editor = <NoSelection />;
  }

  return (
    <div className={mergeClasses(styles.app, update !== null && styles.appWithUpdate)} onKeyDown={handleKeyDown}>
      {update && (
        <UpdateBar
          update={update}
          onOpenRelease={() => void openRelease(update)}
          onDismiss={() => void dismissUpdate(update)}
        />
      )}
      <div
        className={styles.body}
        style={{ gridTemplateColumns: `${preferences.treeWidth}px 5px minmax(0, 1fr)` }}
      >
        <TreePane
          query={query}
          onQueryChange={setQuery}
          favoritesOnly={favoritesOnly}
          onFavoritesOnlyChange={setFavoritesOnly}
          resultCount={resultIds && countSnippets(nodes)}
          empty={empty}
          noMatches={
            filtering && nodes.length === 0 ? (searching ? "Nenhum resultado." : "Nenhum favorito ainda.") : null
          }
          targetLabel={targetLabel}
          onNewSnippet={() => newSnippet()}
          onNewFolder={() => newFolder()}
          onImport={(kind) => void runImport(kind)}
          onExport={(format) => void runExport(format, [])}
          onSort={(kind) => sortGroup(null, kind)}
          canSort={!filtering}
          onExpandAll={() => setPreferences((current) => ({ ...current, collapsed: [] }))}
          onCollapseAll={() => setPreferences((current) => ({ ...current, collapsed: folders.map((f) => f.id) }))}
          trashCount={trash.length}
          trashSelected={trashOpen}
          onSelectTrash={() => {
            select(null);
            setTrashOpen(true);
          }}
          dragging={dragging !== null}
          onDropOnTrash={() => {
            const items = dragging;
            setDragging(null);
            if (items) void trashItems(items);
          }}
        >
          <LibraryTree
            treeRef={treeRef}
            nodes={nodes}
            selection={selection}
            selected={selectedItems}
            cut={marked?.mode === "cut" ? marked.items : []}
            isOpen={isOpen}
            terms={searching ? searchTerms(searchTerm) : []}
            drafts={drafts}
            newFolderIn={newFolderIn}
            renamingFolder={renamingFolder}
            canArrange={!filtering}
            dragging={dragging}
            canDropInto={canDropInto}
            actionsFor={actionsFor}
            menuHeaderFor={menuHeaderFor}
            onSelect={selectWith}
            onSelectAll={selectAll}
            onEscape={escape}
            onDelete={(permanent) =>
              permanent ? confirmPermanentDelete(selectedItems) : void trashItems(selectedItems)
            }
            onToggle={toggleFolder}
            onAction={runAction}
            onSubmitName={submitName}
            onCancelName={cancelName}
            onOpenEditor={() => contentRef.current?.focus()}
            onDragStart={startDrag}
            onDragEnd={() => setDragging(null)}
            onDrop={(target, copy) => void dropItems(target, copy)}
          />
        </TreePane>
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Largura da árvore"
          aria-valuenow={preferences.treeWidth}
          aria-valuemin={TREE_WIDTH.min}
          aria-valuemax={TREE_WIDTH.max}
          tabIndex={0}
          className={styles.divider}
          onPointerDown={startResize}
          onKeyDown={(event) => {
            const delta =
              event.key === "ArrowLeft" ? -DIVIDER_KEY_STEP : event.key === "ArrowRight" ? DIVIDER_KEY_STEP : 0;
            if (!delta) return;
            event.preventDefault();
            setPreferences((current) => ({ ...current, treeWidth: clampTreeWidth(current.treeWidth + delta) }));
          }}
        />
        <main ref={paneRef} className={styles.editorPane}>{editor}</main>
      </div>
      <StatusBar
        drafts={[...drafts.values()]}
        openId={openSnippet?.id ?? null}
        titleOf={(id) => displaySnippets.find((snippet) => snippet.id === id)?.title.trim() || "Sem título"}
        snippetCount={snippets.length}
        folderCount={folders.length}
        onRetry={(id) => void store.retry(id)}
        page={page}
        onTogglePage={togglePage}
        canOpenSettings={shortcut !== null}
      />
      {moving && moving.length > 0 && (
        <MoveDialog
          title={moving.length === 1 ? `Mover “${nameOf(moving[0])}”` : `Mover ${moving.length} itens`}
          rootLabel={moving.some((item) => item.kind === "folder") ? "Raiz" : "Sem pasta"}
          options={folderOptions(folders).filter(
            (option) =>
              !moving.some((item) => item.kind === "folder" && subtreeIds(folders, item.id).has(option.id)),
          )}
          current={movingParents.size === 1 ? [...movingParents][0] : undefined}
          onMove={(folderId) => {
            setMoving(null);
            void moveItems(moving, folderId);
          }}
          onCancel={() => setMoving(null)}
        />
      )}
      <ConfirmDialog confirmation={confirmation} onCancel={() => setConfirmation(null)} />
      <Toaster toasterId={toasterId} position="bottom-end" offset={TOASTER_OFFSET} />
      {(error || shortcutWarning) && (
        <div className={styles.messages}>
          {error && <ErrorMessage message={error} onClose={() => setError(null)} />}
          {shortcutWarning && (
            <ErrorMessage
              intent="warning"
              message={shortcutWarning}
              action={{ label: "Alterar atalho", onClick: () => setPage("settings") }}
              onClose={() => setShortcutWarningDismissed(true)}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default App;
