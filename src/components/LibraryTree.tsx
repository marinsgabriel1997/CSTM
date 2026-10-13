import { makeStyles, mergeClasses, tokens, type PositioningVirtualElement } from "@fluentui/react-components";
import {
  ChevronDown12Regular,
  ChevronRight12Regular,
  DocumentText20Regular,
  Folder20Regular,
  FolderOpen20Regular,
  Star12Filled,
} from "@fluentui/react-icons";
import { useState, type KeyboardEvent, type MouseEvent, type ReactNode, type RefObject } from "react";

import { sameItem, shortcutAction, type ActionKey, type ItemAction, type ItemRef } from "../actions";
import type { Snippet } from "../api";
import type { Draft } from "../drafts";
import { excerpt, highlight, titleMatches, type Part } from "../search";
import type { TreeNode } from "../tree";
import InlineName from "./InlineName";
import { ItemContextMenu, ItemMenuButton } from "./ItemMenu";

const INDENT = 18;

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
});

type Row =
  | { kind: "folder"; node: Extract<TreeNode, { kind: "folder" }>; depth: number; parentId: number | null }
  | { kind: "snippet"; snippet: Snippet; depth: number; parentId: number | null }
  | { kind: "new-folder"; depth: number; parentId: number | null };

function refOf(row: Row): ItemRef | null {
  if (row.kind === "folder") return { kind: "folder", id: row.node.folder.id };
  if (row.kind === "snippet") return { kind: "snippet", id: row.snippet.id };
  return null;
}

function rowId(item: ItemRef): string {
  return `tree-${item.kind}-${item.id}`;
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
  selection: ItemRef | null;
  isOpen: (folderId: number) => boolean;
  /** Termos da busca ativa, para destacar nos nomes e trechos. */
  terms: string[];
  drafts: ReadonlyMap<number, Draft>;
  /** Pasta onde uma nova pasta está sendo nomeada (`null` é a raiz); `undefined` se nenhuma. */
  newFolderIn: number | null | undefined;
  renamingFolder: number | null;
  actionsFor: (item: ItemRef) => ItemAction[];
  onSelect: (item: ItemRef) => void;
  onToggle: (folderId: number, open: boolean) => void;
  onAction: (item: ItemRef, key: ActionKey) => void;
  onSubmitName: (name: string) => void;
  onCancelName: () => void;
  onOpenEditor: () => void;
}

function LibraryTree({
  treeRef,
  nodes,
  selection,
  isOpen,
  terms,
  drafts,
  newFolderIn,
  renamingFolder,
  actionsFor,
  onSelect,
  onToggle,
  onAction,
  onSubmitName,
  onCancelName,
  onOpenEditor,
}: LibraryTreeProps) {
  const styles = useStyles();
  const [menu, setMenu] = useState<{ item: ItemRef; target: HTMLElement | PositioningVirtualElement } | null>(
    null,
  );
  const [focused, setFocused] = useState(false);
  const rows = visibleRows(nodes, isOpen, newFolderIn);
  const items = rows.map(refOf);
  const index = items.findIndex((item) => sameItem(item, selection));

  function selectAt(position: number) {
    const item = items[position];
    if (item) onSelect(item);
  }

  function step(from: number, delta: number) {
    for (let at = from + delta; at >= 0 && at < items.length; at += delta) {
      if (items[at]) return selectAt(at);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // Teclas digitadas no nome em edição pertencem ao campo.
    if (event.target !== event.currentTarget) return;
    const row = rows[index];
    const action = shortcutAction(event);
    if (action && selection) {
      event.preventDefault();
      const available = actionsFor(selection).find((candidate) => candidate.key === action);
      if (available && !available.disabled) onAction(selection, action);
      return;
    }
    switch (event.key) {
      case "ArrowDown":
        step(index, 1);
        break;
      case "ArrowUp":
        step(index < 0 ? items.length : index, -1);
        break;
      case "Home":
        step(-1, 1);
        break;
      case "End":
        step(items.length, -1);
        break;
      case "ArrowRight":
        if (row?.kind === "folder" && row.node.children.length > 0) {
          if (!isOpen(row.node.folder.id)) onToggle(row.node.folder.id, true);
          else step(index, 1);
        }
        break;
      case "ArrowLeft":
        if (row?.kind === "folder" && isOpen(row.node.folder.id) && row.node.children.length > 0) {
          onToggle(row.node.folder.id, false);
        } else if (row && row.parentId !== null) {
          onSelect({ kind: "folder", id: row.parentId });
        }
        break;
      case "Enter":
        if (row?.kind === "folder") onToggle(row.node.folder.id, !isOpen(row.node.folder.id));
        else if (row?.kind === "snippet") onOpenEditor();
        break;
      case "ContextMenu":
        if (selection) openMenuAtRow(selection);
        break;
      case "F10":
        if (!event.shiftKey || !selection) return;
        openMenuAtRow(selection);
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  function openMenuAtRow(item: ItemRef) {
    const element = document.getElementById(rowId(item));
    if (element) setMenu({ item, target: element });
  }

  function renderRow(row: Row): ReactNode {
    const indent = { paddingLeft: `${8 + row.depth * INDENT}px` };
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
    const selected = sameItem(item, selection);
    const className = mergeClasses(
      styles.row,
      selected && styles.selected,
      selected && focused && styles.focusRing,
    );
    const common = {
      id: rowId(item),
      role: "treeitem",
      "aria-level": row.depth + 1,
      "aria-selected": selected,
      className,
      style: indent,
      onClick: () => onSelect(item),
      onContextMenu: (event: MouseEvent) => {
        event.preventDefault();
        onSelect(item);
        const { clientX: x, clientY: y } = event;
        setMenu({ item, target: { getBoundingClientRect: () => new DOMRect(x, y, 0, 0) } });
      },
    };
    const more = (
      <ItemMenuButton
        label="Mais ações"
        className={mergeClasses("cstm-row-more", styles.more)}
        actions={actionsFor(item)}
        onAction={(key) => onAction(item, key)}
      />
    );

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
            <span className={styles.label}>
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
        <span className={styles.label}>
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
        {snippet.favorite && <Star12Filled className={styles.star} aria-label="Favorito" />}
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
        tabIndex={0}
        className={styles.tree}
        aria-activedescendant={selection && index >= 0 ? rowId(selection) : undefined}
        onKeyDown={handleKeyDown}
        onFocus={(event) => event.target === event.currentTarget && setFocused(true)}
        onBlur={() => setFocused(false)}
      >
        {rows.map(renderRow)}
      </div>
      {menu && (
        <ItemContextMenu
          target={menu.target}
          actions={actionsFor(menu.item)}
          onAction={(key) => onAction(menu.item, key)}
          onClose={() => setMenu(null)}
        />
      )}
    </>
  );
}

export default LibraryTree;
