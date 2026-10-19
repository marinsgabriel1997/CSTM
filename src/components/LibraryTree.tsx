import { Caption1, makeStyles, mergeClasses, tokens, type PositioningVirtualElement } from "@fluentui/react-components";
import {
  ChevronDown12Regular,
  ChevronRight12Regular,
  DocumentText20Regular,
  Folder20Regular,
  FolderOpen20Regular,
  History20Regular,
  Star12Filled,
} from "@fluentui/react-icons";
import {
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from "react";

import { HISTORY_FOLDER, includesItem, sameItem, type ActionKey, type ItemAction, type ItemRef } from "../actions";
import type { ClipboardItem, Snippet } from "../api";
import { copiedLabel } from "../clipboardHistory";
import type { Draft } from "../drafts";
import { excerpt, highlight, titleMatches, type Part } from "../search";
import type { TreeNode } from "../tree";
import InlineName from "./InlineName";
import { ItemContextMenu, ItemMenuButton } from "./ItemMenu";

const INDENT = 18;
/** Tempo parado sobre uma pasta fechada, ao arrastar, até ela abrir. */
export const DRAG_OPEN_DELAY_MS = 700;
/** Faixa junto às bordas da árvore que a rola durante o arrasto. */
const SCROLL_EDGE = 24;
const SCROLL_STEP = 12;
/** Pausa na digitação que recomeça a busca pelas primeiras letras. */
const TYPE_AHEAD_RESET_MS = 1000;

const useStyles = makeStyles({
  tree: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    paddingRight: tokens.spacingHorizontalXS,
    outline: "none",
  },
  row: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    minHeight: "32px",
    paddingTop: "4px",
    paddingBottom: "4px",
    paddingRight: "4px",
    borderRadius: tokens.borderRadiusMedium,
    color: tokens.colorNeutralForeground1,
    cursor: "default",
    userSelect: "none",
    ":hover": { backgroundColor: tokens.colorSubtleBackgroundHover },
    ":hover .cstm-row-more": { visibility: "visible" },
  },
  selected: {
    backgroundColor: tokens.colorSubtleBackgroundSelected,
    ":hover": { backgroundColor: tokens.colorSubtleBackgroundSelected },
    "& .cstm-row-more": { visibility: "visible" },
    // Marca de destaque à esquerda, como na navegação do Windows 11.
    "::before": {
      content: '""',
      position: "absolute",
      left: 0,
      top: "50%",
      width: "3px",
      height: "16px",
      marginTop: "-8px",
      borderRadius: "2px",
      backgroundColor: tokens.colorCompoundBrandStroke,
    },
  },
  focusRing: {
    outline: `${tokens.strokeWidthThick} solid ${tokens.colorStrokeFocus2}`,
    outlineOffset: "-2px",
  },
  // Itens recortados ficam esmaecidos até serem colados.
  cut: { "& > svg, & > .cstm-row-label, & > .cstm-row-star": { opacity: 0.45 } },
  dropInto: {
    backgroundColor: tokens.colorBrandBackground2,
    outline: `${tokens.strokeWidthThin} solid ${tokens.colorCompoundBrandStroke}`,
    outlineOffset: "-1px",
    ":hover": { backgroundColor: tokens.colorBrandBackground2 },
  },
  dropLine: {
    "::after": {
      content: '""',
      position: "absolute",
      left: "var(--cstm-indent)",
      right: "4px",
      height: "2px",
      borderRadius: "1px",
      backgroundColor: tokens.colorCompoundBrandStroke,
    },
  },
  dropBefore: { "::after": { top: "-1px" } },
  dropAfter: { "::after": { bottom: "-1px" } },
  twisty: {
    width: "16px",
    height: "16px",
    flex: "none",
    display: "grid",
    placeItems: "center",
    color: tokens.colorNeutralForeground3,
  },
  folderIcon: { flex: "none", color: tokens.colorPaletteMarigoldForeground1 },
  snippetIcon: { flex: "none", color: tokens.colorNeutralForeground2 },
  label: { flex: 1, minWidth: 0 },
  name: { display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  untitled: { fontStyle: "italic", color: tokens.colorNeutralForeground3 },
  draft: { fontStyle: "italic", color: tokens.colorNeutralForeground2 },
  excerpt: {
    display: "block",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
  mark: {
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
    fontWeight: tokens.fontWeightSemibold,
    borderRadius: "2px",
  },
  star: { flex: "none", color: tokens.colorPaletteMarigoldForeground1 },
  dot: { width: "7px", height: "7px", borderRadius: "50%", flex: "none" },
  dotPending: { backgroundColor: tokens.colorNeutralForeground3 },
  dotWarning: { backgroundColor: tokens.colorStatusWarningForeground1 },
  dotError: { backgroundColor: tokens.colorStatusDangerForeground1 },
  more: { visibility: "hidden", flex: "none" },
  thumbnail: {
    width: "20px",
    height: "20px",
    flex: "none",
    objectFit: "cover",
    borderRadius: tokens.borderRadiusSmall,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  copiedAt: { flex: "none", paddingLeft: tokens.spacingHorizontalXS, color: tokens.colorNeutralForeground3 },
});

type Row =
  | { kind: "folder"; node: Extract<TreeNode, { kind: "folder" }>; depth: number; parentId: number | null }
  | { kind: "snippet"; snippet: Snippet; depth: number; parentId: number | null }
  | { kind: "new-folder"; depth: number; parentId: number | null }
  | { kind: "history"; depth: number; parentId: null }
  | { kind: "clip"; clip: ClipboardItem; depth: number; parentId: null };

/** A pasta Histórico no topo da árvore: os itens (mais recente primeiro) e se está aberta. */
export interface HistoryFolder {
  clips: ClipboardItem[];
  open: boolean;
}

/** Como a seleção muda com o clique ou a tecla: só o item, alternar (Ctrl) ou intervalo (Shift). */
export type SelectMode = "single" | "toggle" | "range";

/** Onde os itens arrastados seriam soltos: dentro de uma pasta ou numa posição de um grupo. */
export type DropTarget =
  | { kind: "into"; folderId: number }
  | { kind: "line"; parentId: number | null; before: ItemRef | null };

/** Destino em exibição: o alvo e a linha que o indica. */
type DropView = { target: DropTarget; row: ItemRef; place: "into" | "before" | "after" };

function refOf(row: Row): ItemRef | null {
  if (row.kind === "folder") return { kind: "folder", id: row.node.folder.id };
  if (row.kind === "snippet") return { kind: "snippet", id: row.snippet.id };
  if (row.kind === "history") return HISTORY_FOLDER;
  if (row.kind === "clip") return { kind: "clip", id: row.clip.id };
  return null;
}

function labelOf(row: Row): string {
  if (row.kind === "folder") return row.node.folder.name;
  if (row.kind === "snippet") return row.snippet.title.trim() || "Sem título";
  if (row.kind === "history") return "Histórico";
  if (row.kind === "clip") return row.clip.title;
  return "";
}

function rowId(item: ItemRef): string {
  return `tree-${item.kind}-${item.id}`;
}

function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/** Linhas da pasta Histórico, no topo da árvore. */
function historyRows(history: HistoryFolder | null): Row[] {
  if (!history) return [];
  return [
    { kind: "history", depth: 0, parentId: null },
    ...(history.open
      ? history.clips.map((clip): Row => ({ kind: "clip", clip, depth: 1, parentId: null }))
      : []),
  ];
}

/** Linhas visíveis, na ordem da tela; a pasta em criação entra depois das pastas do grupo. */
function visibleRows(
  nodes: TreeNode[],
  isOpen: (folderId: number) => boolean,
  newFolderIn: number | null | undefined,
  parentId: number | null = null,
  depth = 0,
): Row[] {
  const rows: Row[] = [];
  for (const node of nodes) {
    if (node.kind === "folder") {
      rows.push({ kind: "folder", node, depth, parentId });
      if (isOpen(node.folder.id) || newFolderIn === node.folder.id) {
        rows.push(...visibleRows(node.children, isOpen, newFolderIn, node.folder.id, depth + 1));
      }
    }
  }
  if (newFolderIn === parentId) rows.push({ kind: "new-folder", depth, parentId });
  for (const node of nodes) {
    if (node.kind === "snippet") rows.push({ kind: "snippet", snippet: node.snippet, depth, parentId });
  }
  return rows;
}

function Highlighted({ parts, markClass }: { parts: Part[]; markClass: string }) {
  return parts.map((part, index) =>
    part.match ? (
      <mark key={index} className={markClass}>
        {part.text}
      </mark>
    ) : (
      part.text
    ),
  );
}

interface LibraryTreeProps {
  treeRef: RefObject<HTMLDivElement | null>;
  nodes: TreeNode[];
  /** A pasta Histórico; `null` quando não aparece (desligado, vazio ou com busca ou filtro ativos). */
  history: HistoryFolder | null;
  onToggleHistory: (open: boolean) => void;
  /** Item com o foco, aberto no editor quando é o único selecionado. */
  selection: ItemRef | null;
  /** Todos os itens selecionados, incluindo o do foco. */
  selected: ItemRef[];
  /** Itens recortados, aguardando colar. */
  cut: ItemRef[];
  isOpen: (folderId: number) => boolean;
  /** Termos da busca ativa, para destacar nos nomes e trechos. */
  terms: string[];
  drafts: ReadonlyMap<number, Draft>;
  /** Pasta onde uma nova pasta está sendo nomeada (`null` é a raiz); `undefined` se nenhuma. */
  newFolderIn: number | null | undefined;
  renamingFolder: number | null;
  /** Arrastar e reordenar: desligados com a busca ou o filtro ativos, pois a ordem mostrada é parcial. */
  canArrange: boolean;
  /** Itens sendo arrastados, se houver. */
  dragging: ItemRef[] | null;
  /** Se os itens arrastados podem ir para a pasta (`null` é a raiz). */
  canDropInto: (folderId: number | null) => boolean;
  actionsFor: (item: ItemRef) => ItemAction[];
  /** Título do menu de contexto, como "3 itens selecionados". */
  menuHeaderFor: (item: ItemRef) => string | undefined;
  onSelect: (item: ItemRef, mode: SelectMode) => void;
  onSelectAll: () => void;
  onEscape: () => void;
  /** Del (lixeira) ou Shift+Del (definitivo) sobre a seleção. */
  onDelete: (permanent: boolean) => void;
  onToggle: (folderId: number, open: boolean) => void;
  onAction: (item: ItemRef, key: ActionKey) => void;
  onSubmitName: (name: string) => void;
  onCancelName: () => void;
  onOpenEditor: () => void;
  /** Começo de um arrasto a partir do item; devolve os itens arrastados. */
  onDragStart: (item: ItemRef) => ItemRef[];
  onDragEnd: () => void;
  /** Itens soltos; `copy` com Ctrl pressionado. */
  onDrop: (target: DropTarget, copy: boolean) => void;
}

function LibraryTree({
  treeRef,
  nodes,
  history,
  onToggleHistory,
  selection,
  selected,
  cut,
  isOpen,
  terms,
  drafts,
  newFolderIn,
  renamingFolder,
  canArrange,
  dragging,
  canDropInto,
  actionsFor,
  menuHeaderFor,
  onSelect,
  onSelectAll,
  onEscape,
  onDelete,
  onToggle,
  onAction,
  onSubmitName,
  onCancelName,
  onOpenEditor,
  onDragStart,
  onDragEnd,
  onDrop,
}: LibraryTreeProps) {
  const styles = useStyles();
  const [menu, setMenu] = useState<{ item: ItemRef; target: HTMLElement | PositioningVirtualElement } | null>(
    null,
  );
  const [focused, setFocused] = useState(false);
  const [drop, setDrop] = useState<DropView | null>(null);
  const opening = useRef<{ folderId: number; timer: ReturnType<typeof setTimeout> } | null>(null);
  const typed = useRef({ text: "", time: 0 });
  const rows = [...historyRows(history), ...visibleRows(nodes, isOpen, newFolderIn)];
  const items = rows.map(refOf);
  const index = items.findIndex((item) => sameItem(item, selection));

  function selectAt(position: number, mode: SelectMode = "single") {
    const item = items[position];
    if (item) onSelect(item, mode);
  }

  function step(from: number, delta: number, mode: SelectMode) {
    for (let at = from + delta; at >= 0 && at < items.length; at += delta) {
      if (items[at]) return selectAt(at, mode);
    }
  }

  /** Salta para o próximo item que começa com as letras digitadas em sequência. */
  function typeAhead(char: string, now: number) {
    const text = now - typed.current.time < TYPE_AHEAD_RESET_MS ? typed.current.text + char : char;
    typed.current = { text, time: now };
    // Uma letra procura a partir do próximo item; mais letras refinam a partir do atual.
    const start = text.length === 1 ? index + 1 : Math.max(index, 0);
    for (let offset = 0; offset < rows.length; offset++) {
      const at = (start + offset) % rows.length;
      if (items[at] && fold(labelOf(rows[at])).startsWith(fold(text))) return selectAt(at);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // Teclas digitadas no nome em edição pertencem ao campo.
    if (event.target !== event.currentTarget) return;
    const row = rows[index];
    const mode: SelectMode = event.shiftKey ? "range" : "single";
    const plain = !event.ctrlKey && !event.altKey && !event.metaKey;
    switch (event.key) {
      case "ArrowDown":
        step(index, 1, mode);
        break;
      case "ArrowUp":
        step(index < 0 ? items.length : index, -1, mode);
        break;
      case "Home":
        step(-1, 1, mode);
        break;
      case "End":
        step(items.length, -1, mode);
        break;
      case "ArrowRight":
        if (row?.kind === "history") {
          if (history && !history.open) onToggleHistory(true);
          else step(index, 1, "single");
        } else if (row?.kind === "folder" && row.node.children.length > 0) {
          if (!isOpen(row.node.folder.id)) onToggle(row.node.folder.id, true);
          else step(index, 1, "single");
        }
        break;
      case "ArrowLeft":
        if (row?.kind === "history") {
          if (history?.open) onToggleHistory(false);
        } else if (row?.kind === "clip") {
          onSelect(HISTORY_FOLDER, "single");
        } else if (row?.kind === "folder" && isOpen(row.node.folder.id) && row.node.children.length > 0) {
          onToggle(row.node.folder.id, false);
        } else if (row && row.parentId !== null) {
          onSelect({ kind: "folder", id: row.parentId }, "single");
        }
        break;
      case "Enter":
        if (row?.kind === "folder") onToggle(row.node.folder.id, !isOpen(row.node.folder.id));
        else if (row?.kind === "history") onToggleHistory(!history?.open);
        else if (row?.kind === "snippet" || row?.kind === "clip") onOpenEditor();
        break;
      case "Escape":
        onEscape();
        break;
      case "F2": {
        if (!selection) return;
        const rename = actionsFor(selection).find((action) => action.key === "rename");
        if (rename && !rename.disabled) onAction(selection, "rename");
        break;
      }
      case "Delete":
        if (event.ctrlKey || event.altKey) return;
        onDelete(event.shiftKey);
        break;
      case "ContextMenu":
        if (selection && selection.kind !== "clip") openMenuAtRow(selection);
        break;
      case "F10":
        if (!event.shiftKey || !selection) return;
        if (selection.kind === "clip") break;
        openMenuAtRow(selection);
        break;
      default:
        if (event.ctrlKey && !event.altKey && event.key.toLowerCase() === "a") {
          onSelectAll();
          break;
        }
        if (plain && event.key.length === 1 && event.key !== " ") {
          typeAhead(event.key, event.timeStamp);
          break;
        }
        return;
    }
    event.preventDefault();
  }

  function openMenuAtRow(item: ItemRef) {
    const element = document.getElementById(rowId(item));
    if (element) setMenu({ item, target: element });
  }

  function stopOpening() {
    if (opening.current) clearTimeout(opening.current.timer);
    opening.current = null;
  }

  function clearDrop() {
    stopOpening();
    setDrop(null);
  }

  /** Destino do arrasto sobre a linha, pela altura do ponteiro; `null` se não aceita. */
  function dropAt(row: Row, item: ItemRef, event: DragEvent): DropView | null {
    // A pasta Histórico e os itens dela não recebem itens soltos.
    if (!dragging || row.kind === "history" || row.kind === "clip") return null;
    const rect = event.currentTarget.getBoundingClientRect();
    const offset = rect.height > 0 ? (event.clientY - rect.top) / rect.height : 0.5;
    const into: DropView | null =
      row.kind === "folder" && !includesItem(dragging, item) && canDropInto(row.node.folder.id)
        ? { target: { kind: "into", folderId: row.node.folder.id }, row: item, place: "into" }
        : null;
    // A linha de inserção só vale entre itens do mesmo tipo dos arrastados.
    const lineAllowed =
      canArrange && dragging.every((dragged) => dragged.kind === item.kind) && canDropInto(row.parentId);
    const edge = row.kind === "folder" ? 0.25 : 0.5;
    const place = offset < edge ? "before" : offset > 1 - edge ? "after" : "into";
    if (place === "into" || !lineAllowed) return into;
    if (place === "before") return { target: { kind: "line", parentId: row.parentId, before: item }, row: item, place };
    // Depois do item: antes do próximo do mesmo grupo e tipo, ou no fim do grupo.
    const position = rows.indexOf(row);
    const next = rows
      .slice(position + 1)
      .find((candidate) => candidate.depth <= row.depth && (candidate.depth < row.depth || candidate.kind === row.kind));
    const before = next && next.depth === row.depth && next.parentId === row.parentId ? refOf(next) : null;
    return { target: { kind: "line", parentId: row.parentId, before }, row: item, place };
  }

  function handleDragOver(row: Row, item: ItemRef, event: DragEvent<HTMLDivElement>) {
    const view = dropAt(row, item, event);
    if (!view) {
      clearDrop();
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = event.ctrlKey ? "copy" : "move";
    setDrop((current) =>
      current && sameItem(current.row, view.row) && current.place === view.place ? current : view,
    );
    // Uma pasta fechada abre depois de um instante com o ponteiro parado sobre ela.
    const folderId = row.kind === "folder" && view.place === "into" && !isOpen(row.node.folder.id) ? row.node.folder.id : null;
    if (opening.current?.folderId === folderId) return;
    stopOpening();
    if (folderId !== null) {
      opening.current = { folderId, timer: setTimeout(() => onToggle(folderId, true), DRAG_OPEN_DELAY_MS) };
    }
  }

  function handleDrop(row: Row, item: ItemRef, event: DragEvent<HTMLDivElement>) {
    const view = dropAt(row, item, event);
    clearDrop();
    if (!view) return;
    event.preventDefault();
    onDrop(view.target, event.ctrlKey);
  }

  function handleDragStart(item: ItemRef, label: string, event: DragEvent<HTMLDivElement>) {
    const dragged = onDragStart(item);
    event.dataTransfer.effectAllowed = "copyMove";
    event.dataTransfer.setData("application/x-cstm-items", JSON.stringify(dragged));
    // Indicador junto ao ponteiro: o nome do item ou a quantidade arrastada.
    const ghost = document.createElement("div");
    ghost.textContent = dragged.length > 1 ? `${dragged.length} itens` : label;
    Object.assign(ghost.style, {
      position: "fixed",
      top: "-100px",
      padding: "4px 10px",
      borderRadius: "4px",
      font: "12px 'Segoe UI', sans-serif",
      background: "#ffffff",
      color: "#1a1a1a",
      border: "1px solid rgba(0, 0, 0, 0.14)",
    });
    document.body.appendChild(ghost);
    event.dataTransfer.setDragImage?.(ghost, 12, 12);
    setTimeout(() => ghost.remove());
  }

  function handleTreeDragOver(event: DragEvent<HTMLDivElement>) {
    if (!dragging) return;
    // Rola a árvore quando o ponteiro chega perto das bordas.
    const tree = event.currentTarget;
    const rect = tree.getBoundingClientRect();
    if (event.clientY - rect.top < SCROLL_EDGE) tree.scrollTop -= SCROLL_STEP;
    else if (rect.bottom - event.clientY < SCROLL_EDGE) tree.scrollTop += SCROLL_STEP;
  }

  function renderRow(row: Row): ReactNode {
    const padding = `${8 + row.depth * INDENT}px`;
    // A linha de inserção começa no recuo do item.
    const indent = { paddingLeft: padding, "--cstm-indent": padding } as CSSProperties;
    if (row.kind === "new-folder") {
      return (
        <div key="new-folder" role="none" className={styles.row} style={indent}>
          <span className={styles.twisty} />
          <Folder20Regular className={styles.folderIcon} />
          <InlineName label="Nome da nova pasta" initial="Nova pasta" onSubmit={onSubmitName} onCancel={onCancelName} />
        </div>
      );
    }
    const item = refOf(row)!;
    const isSelected = includesItem(selected, item);
    const dropHere = drop && sameItem(drop.row, item) ? drop.place : null;
    const className = mergeClasses(
      styles.row,
      isSelected && styles.selected,
      sameItem(item, selection) && focused && styles.focusRing,
      includesItem(cut, item) && styles.cut,
      dropHere === "into" && styles.dropInto,
      dropHere === "before" && mergeClasses(styles.dropLine, styles.dropBefore),
      dropHere === "after" && mergeClasses(styles.dropLine, styles.dropAfter),
    );
    const label = labelOf(row);
    const draggable =
      canArrange && (row.kind === "folder" || row.kind === "snippet") && item.id >= 0 && renamingFolder !== item.id;
    const common = {
      id: rowId(item),
      role: "treeitem",
      "aria-level": row.depth + 1,
      "aria-selected": isSelected,
      className,
      style: indent,
      draggable,
      onClick: (event: MouseEvent) => {
        // Um clique recomeça a busca pelas primeiras letras.
        typed.current = { text: "", time: 0 };
        onSelect(item, event.ctrlKey || event.metaKey ? "toggle" : event.shiftKey ? "range" : "single");
      },
      onContextMenu: (event: MouseEvent) => {
        event.preventDefault();
        // O Histórico não tem menu de contexto.
        if (item.kind === "clip") {
          onSelect(item, "single");
          return;
        }
        // Dentro da seleção, o menu age sobre todos os itens selecionados.
        if (!includesItem(selected, item) || selected.length < 2) onSelect(item, "single");
        const { clientX: x, clientY: y } = event;
        setMenu({ item, target: { getBoundingClientRect: () => new DOMRect(x, y, 0, 0) } });
      },
      onDragStart: (event: DragEvent<HTMLDivElement>) => handleDragStart(item, label, event),
      onDragEnd: () => {
        clearDrop();
        onDragEnd();
      },
      onDragOver: (event: DragEvent<HTMLDivElement>) => handleDragOver(row, item, event),
      onDrop: (event: DragEvent<HTMLDivElement>) => handleDrop(row, item, event),
    };
    const more = (
      <ItemMenuButton
        label="Mais ações"
        className={mergeClasses("cstm-row-more", styles.more)}
        header={menuHeaderFor(item)}
        actions={actionsFor(item)}
        onAction={(key) => onAction(item, key)}
      />
    );

    if (row.kind === "history") {
      const open = history?.open ?? false;
      return (
        <div key={common.id} {...common} aria-label="Histórico" aria-expanded={open}>
          <span
            className={styles.twisty}
            onClick={(event) => {
              event.stopPropagation();
              onToggleHistory(!open);
            }}
          >
            {open ? <ChevronDown12Regular /> : <ChevronRight12Regular />}
          </span>
          <History20Regular className={styles.folderIcon} />
          <span className={mergeClasses("cstm-row-label", styles.label)}>
            <span className={styles.name}>Histórico</span>
          </span>
        </div>
      );
    }

    if (row.kind === "clip") {
      const { clip } = row;
      return (
        <div key={common.id} {...common} aria-label={clip.title}>
          <span className={styles.twisty} />
          {clip.thumbnail ? (
            <img className={styles.thumbnail} src={clip.thumbnail} alt="" />
          ) : (
            <DocumentText20Regular className={styles.snippetIcon} />
          )}
          <span className={mergeClasses("cstm-row-label", styles.label)}>
            <span className={styles.name}>{clip.title}</span>
          </span>
          <Caption1 className={styles.copiedAt}>{copiedLabel(clip.copiedAt)}</Caption1>
        </div>
      );
    }

    if (row.kind === "folder") {
      const { folder, children } = row.node;
      const open = isOpen(folder.id) && children.length > 0;
      return (
        <div key={common.id} {...common} aria-label={folder.name} aria-expanded={children.length > 0 ? open : undefined}>
          <span
            className={styles.twisty}
            onClick={(event) => {
              event.stopPropagation();
              if (children.length > 0) onToggle(folder.id, !open);
            }}
          >
            {children.length > 0 && (open ? <ChevronDown12Regular /> : <ChevronRight12Regular />)}
          </span>
          {open ? <FolderOpen20Regular className={styles.folderIcon} /> : <Folder20Regular className={styles.folderIcon} />}
          {renamingFolder === folder.id ? (
            <InlineName label="Novo nome da pasta" initial={folder.name} onSubmit={onSubmitName} onCancel={onCancelName} />
          ) : (
            <span className={mergeClasses("cstm-row-label", styles.label)}>
              <span className={styles.name}>{folder.name}</span>
            </span>
          )}
          {more}
        </div>
      );
    }

    const { snippet } = row;
    const draft = drafts.get(snippet.id);
    const title = snippet.title.trim();
    const showExcerpt = terms.length > 0 && !titleMatches(title, terms);
    const dot =
      draft?.status === "pending" || draft?.status === "saving"
        ? styles.dotPending
        : draft?.status === "invalid"
          ? styles.dotWarning
          : draft?.status === "error"
            ? styles.dotError
            : null;
    return (
      <div key={common.id} {...common} aria-label={title || "Sem título"}>
        <span className={styles.twisty} />
        <DocumentText20Regular className={styles.snippetIcon} />
        <span className={mergeClasses("cstm-row-label", styles.label)}>
          <span className={mergeClasses(styles.name, snippet.id < 0 && styles.draft, !title && styles.untitled)}>
            {title ? <Highlighted parts={highlight(title, terms)} markClass={styles.mark} /> : "Sem título"}
          </span>
          {showExcerpt && (
            <span className={styles.excerpt}>
              <Highlighted parts={excerpt(snippet.content, terms)} markClass={styles.mark} />
            </span>
          )}
        </span>
        {dot && <span className={mergeClasses(styles.dot, dot)} />}
        {snippet.favorite && (
          <Star12Filled className={mergeClasses("cstm-row-star", styles.star)} aria-label="Favorito" />
        )}
        {more}
      </div>
    );
  }

  return (
    <>
      <div
        ref={treeRef}
        role="tree"
        aria-label="Biblioteca"
        aria-multiselectable
        tabIndex={0}
        className={styles.tree}
        aria-activedescendant={selection && index >= 0 ? rowId(selection) : undefined}
        onKeyDown={handleKeyDown}
        onFocus={(event) => event.target === event.currentTarget && setFocused(true)}
        onBlur={() => setFocused(false)}
        onDragOver={handleTreeDragOver}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) clearDrop();
        }}
      >
        {rows.map(renderRow)}
      </div>
      {menu && (
        <ItemContextMenu
          target={menu.target}
          header={menuHeaderFor(menu.item)}
          actions={actionsFor(menu.item)}
          onAction={(key) => onAction(menu.item, key)}
          onClose={() => setMenu(null)}
        />
      )}
    </>
  );
}

export default LibraryTree;
