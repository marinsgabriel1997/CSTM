import { makeStyles, Toaster, tokens, useId, useToastController } from "@fluentui/react-components";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

import { sameItem, type ActionKey, type ItemAction, type ItemRef } from "./actions";
import { api, END, errorMessage, type Folder, type ShortcutStatus, type Snippet } from "./api";
import { FolderEditor, NoSelection, SnippetEditor, Welcome } from "./components/Editors";
import { ConfirmDialog, ErrorMessage, NoticeToast, type Confirmation } from "./components/Feedback";
import LibraryTree from "./components/LibraryTree";
import MoveDialog from "./components/MoveDialog";
import SettingsDialog from "./components/SettingsDialog";
import StatusBar from "./components/StatusBar";
import TreePane from "./components/TreePane";
import { DraftStore } from "./drafts";
import { clampTreeWidth, loadPreferences, savePreferences, TREE_WIDTH } from "./preferences";
import { searchTerms } from "./search";
import { shortcutLabel } from "./shortcut";
import {
  exportFailure,
  exportNotice,
  importFailure,
  importNotice,
  type ExportFormat,
  type ImportKind,
  type TransferNotice,
} from "./transfer";
import {
  buildTree,
  filterTree,
  folderContents,
  folderOptions,
  folderPath,
  siblingsOf,
  snippetsIn,
  subtreeIds,
  type TreeNode,
} from "./tree";

const SEARCH_DELAY_MS = 200;
/** Tempo de exibição da notificação de importação ou exportação concluída. */
export const NOTICE_DURATION_MS = 4000;
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

/**
 * Registra um aviso da janela nativa e devolve a limpeza para o `useEffect`. O registro é
 * assíncrono, então a remoção também cobre o efeito desfeito antes de ele terminar.
 */
function listenWindow(
  subscribe: (handler: () => void) => Promise<() => void>,
  handler: () => void,
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
  const [selection, setSelection] = useState<ItemRef | null>(null);
  const [query, setQuery] = useState("");
  // Termo efetivamente buscado: acompanha `query` após uma pausa na digitação.
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<{ term: string; ids: Set<number> } | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [preferences, setPreferences] = useState(loadPreferences);
  // Pasta onde uma nova pasta está sendo nomeada (`null` é a raiz).
  const [newFolderIn, setNewFolderIn] = useState<number | null | undefined>(undefined);
  const [renamingFolder, setRenamingFolder] = useState<number | null>(null);
  const [moving, setMoving] = useState<ItemRef | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Atalho do menu de colagem; `null` até carregar (ou fora do Tauri).
  const [shortcut, setShortcut] = useState<ShortcutStatus | null>(null);
  const [shortcutWarningDismissed, setShortcutWarningDismissed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const toasterId = useId("notices");
  const { dispatchToast } = useToastController(toasterId);
  const treeRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  // Campo do editor que recebe o foco após a próxima renderização.
  const focusRequest = useRef<"title" | null>(null);

  useEffect(() => {
    let current = true;
    Promise.all([api.listFolders(), api.listAllSnippets()]).then(
      ([folderList, snippetList]) => {
        if (!current) return;
        setFolders(folderList);
        setSnippets(snippetList);
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

  useEffect(() => savePreferences(preferences), [preferences]);

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

  useEffect(() => listenWindow(api.onSettingsRequested, () => setSettingsOpen(true)), []);

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

  // O atalho fica sem registro também durante a gravação de um novo, com o diálogo aberto.
  const shortcutWarning =
    shortcut && !shortcut.registered && !shortcutWarningDismissed && !settingsOpen
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

  function select(item: ItemRef | null) {
    store.open(item?.kind === "snippet" ? item.id : null);
    setSelection(item);
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

  function actionsFor(item: ItemRef): ItemAction[] {
    if (item.kind === "folder") {
      const folder = folders.find((candidate) => candidate.id === item.id);
      if (!folder) return [];
      const siblings = siblingsOf(folders, folder.parentId);
      const index = siblings.findIndex((sibling) => sibling.id === folder.id);
      return [
        { key: "rename", label: "Renomear" },
        { key: "move", label: "Mover para…" },
        { key: "up", label: "Mover para cima", disabled: index <= 0 },
        { key: "down", label: "Mover para baixo", disabled: index >= siblings.length - 1 },
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
      { key: "rename", label: "Renomear" },
      { key: "move", label: "Mover para…" },
      { key: "up", label: "Mover para cima", disabled: isNew || index <= 0 },
      { key: "down", label: "Mover para baixo", disabled: isNew || index >= siblings.length - 1 },
      {
        key: "favorite",
        label: snippet.favorite ? "Remover dos favoritos" : "Adicionar aos favoritos",
        disabled: isNew,
      },
      { key: "delete", label: "Excluir" },
    ];
  }

  function runAction(item: ItemRef, key: ActionKey) {
    switch (key) {
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
        setMoving(item);
        break;
      case "up":
      case "down":
        reorder(item, key === "up" ? -1 : 1);
        break;
      case "favorite":
        toggleFavorite(item.id);
        break;
      case "exportJson":
      case "exportTxt":
        void runExport(key === "exportJson" ? "json" : "txt", item.id);
        break;
      case "delete":
        confirmDelete(item);
        break;
    }
  }

  function reorder(item: ItemRef, delta: number) {
    if (item.kind === "folder") {
      const folder = folders.find((candidate) => candidate.id === item.id);
      if (!folder) return;
      const index = siblingsOf(folders, folder.parentId).findIndex((sibling) => sibling.id === folder.id);
      attempt(() => api.moveFolder(folder.id, folder.parentId, index + delta));
    } else {
      const snippet = snippets.find((candidate) => candidate.id === item.id);
      if (!snippet) return;
      const index = snippetsIn(snippets, snippet.folderId).findIndex((sibling) => sibling.id === snippet.id);
      attempt(() => api.moveSnippet(snippet.id, snippet.folderId, index + delta));
    }
  }

  function moveItem(item: ItemRef, folderId: number | null) {
    setMoving(null);
    reveal(folderId);
    if (item.kind === "folder") {
      attempt(() => api.moveFolder(item.id, folderId, END));
      return;
    }
    store.setFolder(item.id, folderId);
    if (item.id >= 0) attempt(() => api.moveSnippet(item.id, folderId, END));
  }

  function toggleFavorite(id: number) {
    const snippet = snippets.find((candidate) => candidate.id === id);
    if (snippet) attempt(() => api.setFavorite(id, !snippet.favorite));
  }

  /** Notificação no canto inferior direito; as de sucesso somem sozinhas, as de erro ficam até serem fechadas. */
  function notify(notice: TransferNotice) {
    dispatchToast(<NoticeToast notice={notice} />, {
      intent: notice.intent,
      timeout: notice.intent === "success" ? NOTICE_DURATION_MS : -1,
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

  /** Exporta a pasta `folderId` ou, com `null`, a biblioteca inteira. */
  async function runExport(format: ExportFormat, folderId: number | null) {
    // A exportação lê o banco: as edições pendentes são gravadas antes.
    await store.flushAll();
    try {
      const summary = await (format === "json" ? api.exportJson(folderId) : api.exportTxt(folderId));
      if (summary) notify(exportNotice(summary));
    } catch (reason) {
      notify(exportFailure(errorMessage(reason)));
    }
  }

  function confirmDelete(item: ItemRef) {
    if (item.kind === "folder") {
      const folder = folders.find((candidate) => candidate.id === item.id);
      if (!folder) return;
      const contents = folderContents(folders, snippets, folder.id);
      setConfirmation({
        title: `Excluir a pasta “${folder.name}”?`,
        message: (
          <>
            {(contents.folders > 0 || contents.snippets > 0) && (
              <>
                Também serão excluídos:
                <ul className={styles.deleteList}>
                  {contents.folders > 0 && <li>{plural(contents.folders, "subpasta", "subpastas")}</li>}
                  {contents.snippets > 0 && (
                    <li>
                      {plural(contents.snippets, "texto", "textos")}
                      {contents.favorites > 0 &&
                        `, incluindo ${plural(contents.favorites, "favorito", "favoritos")}`}
                    </li>
                  )}
                </ul>
              </>
            )}
            Esta ação não pode ser desfeita.
          </>
        ),
        confirmLabel: "Excluir",
        danger: true,
        onConfirm: () => {
          setConfirmation(null);
          const removed = subtreeIds(folders, folder.id);
          const inside = (folderId: number | null) => folderId !== null && removed.has(folderId);
          for (const draft of store.getSnapshot().values()) {
            if (inside(draft.folderId)) store.remove(draft.id);
          }
          if ((selectedFolder && removed.has(selectedFolder.id)) || (openSnippet && inside(openSnippet.folderId))) {
            select(null);
          }
          attempt(() => api.deleteFolder(folder.id));
        },
      });
      return;
    }
    const snippet = displaySnippets.find((candidate) => candidate.id === item.id);
    if (!snippet) return;
    setConfirmation({
      title: `Excluir o texto “${snippet.title.trim() || "Sem título"}”?`,
      message: "Esta ação não pode ser desfeita.",
      confirmLabel: "Excluir",
      danger: true,
      onConfirm: () => {
        setConfirmation(null);
        store.remove(snippet.id);
        if (sameItem(selection, item)) select(null);
        if (snippet.id >= 0) attempt(() => api.deleteSnippet(snippet.id));
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
  const movingFolder = moving?.kind === "folder" ? folders.find((folder) => folder.id === moving.id) : undefined;
  const movingSnippet =
    moving?.kind === "snippet" ? displaySnippets.find((snippet) => snippet.id === moving.id) : undefined;

  let editor;
  if (empty) {
    editor = <Welcome />;
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
    <div className={styles.app} onKeyDown={handleKeyDown}>
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
          onExport={(format) => void runExport(format, null)}
        >
          <LibraryTree
            treeRef={treeRef}
            nodes={nodes}
            selection={selection}
            isOpen={isOpen}
            terms={searching ? searchTerms(searchTerm) : []}
            drafts={drafts}
            newFolderIn={newFolderIn}
            renamingFolder={renamingFolder}
            actionsFor={actionsFor}
            onSelect={select}
            onToggle={toggleFolder}
            onAction={runAction}
            onSubmitName={submitName}
            onCancelName={cancelName}
            onOpenEditor={() => contentRef.current?.focus()}
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
        <main className={styles.editorPane}>{editor}</main>
      </div>
      <StatusBar
        drafts={[...drafts.values()]}
        openId={openSnippet?.id ?? null}
        titleOf={(id) => displaySnippets.find((snippet) => snippet.id === id)?.title.trim() || "Sem título"}
        snippetCount={snippets.length}
        folderCount={folders.length}
        onRetry={(id) => void store.retry(id)}
        onOpenSettings={shortcut ? () => setSettingsOpen(true) : undefined}
      />
      {moving && (movingFolder || movingSnippet) && (
        <MoveDialog
          name={movingFolder?.name ?? (movingSnippet?.title.trim() || "Sem título")}
          rootLabel={movingFolder ? "Raiz" : "Sem pasta"}
          options={
            movingFolder
              ? folderOptions(folders).filter((option) => !subtreeIds(folders, movingFolder.id).has(option.id))
              : folderOptions(folders)
          }
          current={movingFolder ? movingFolder.parentId : (movingSnippet?.folderId ?? null)}
          onMove={(folderId) => moveItem(moving, folderId)}
          onCancel={() => setMoving(null)}
        />
      )}
      <ConfirmDialog confirmation={confirmation} onCancel={() => setConfirmation(null)} />
      {settingsOpen && shortcut && (
        <SettingsDialog
          shortcut={shortcut}
          onShortcutChange={(status) => {
            setShortcut(status);
            setShortcutWarningDismissed(false);
          }}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      <Toaster toasterId={toasterId} position="bottom-end" offset={TOASTER_OFFSET} />
      {(error || shortcutWarning) && (
        <div className={styles.messages}>
          {error && <ErrorMessage message={error} onClose={() => setError(null)} />}
          {shortcutWarning && (
            <ErrorMessage
              intent="warning"
              message={shortcutWarning}
              action={{ label: "Alterar atalho", onClick: () => setSettingsOpen(true) }}
              onClose={() => setShortcutWarningDismissed(true)}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default App;
