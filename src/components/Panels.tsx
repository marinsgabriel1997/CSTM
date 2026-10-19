import {
  Button,
  Caption1,
  makeStyles,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  mergeClasses,
  Text,
  tokens,
} from "@fluentui/react-components";
import {
  ArrowCounterclockwise20Regular,
  ArrowExportUp20Regular,
  Braces20Regular,
  ChevronDown12Regular,
  Copy20Regular,
  Cut20Regular,
  Delete20Regular,
  DocumentMultiple20Regular,
  DocumentText20Regular,
  Folder20Regular,
  FolderArrowRight20Regular,
  History20Regular,
  Star12Filled,
  Star20Regular,
} from "@fluentui/react-icons";
import { useState, type KeyboardEvent, type MouseEvent } from "react";

import { includesItem, sameItem, type ActionKey, type ItemRef } from "../actions";
import type { TrashItem } from "../api";

const useStyles = makeStyles({
  panel: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    minHeight: 0,
    height: "100%",
    outline: "none",
  },
  head: {
    display: "flex",
    alignItems: "center",
    flex: "none",
    height: "48px",
    paddingLeft: "28px",
    color: tokens.colorNeutralForeground2,
  },
  doc: {
    flex: 1,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    width: "100%",
    maxWidth: "820px",
    paddingTop: tokens.spacingVerticalS,
    paddingLeft: "28px",
    paddingRight: "28px",
    paddingBottom: tokens.spacingVerticalXL,
  },
  title: {
    margin: 0,
    padding: "4px 0 6px",
    fontSize: "28px",
    fontWeight: tokens.fontWeightSemibold,
    lineHeight: "1.25",
  },
  meta: { color: tokens.colorNeutralForeground2, marginTop: 0, marginBottom: "18px" },
  actions: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS },
  spacer: { flex: 1 },
  list: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    marginTop: "22px",
    borderTop: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    outline: "none",
  },
  row: {
    display: "grid",
    gridTemplateColumns: "20px minmax(0, 1fr) minmax(0, 200px) 20px",
    alignItems: "center",
    columnGap: tokens.spacingHorizontalM,
    minHeight: "36px",
    paddingLeft: tokens.spacingHorizontalS,
    paddingRight: tokens.spacingHorizontalS,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  trashRow: {
    gridTemplateColumns: "20px minmax(0, 1fr) minmax(0, 170px) 120px 64px",
    borderRadius: tokens.borderRadiusMedium,
    cursor: "default",
    userSelect: "none",
    ":hover": { backgroundColor: tokens.colorSubtleBackgroundHover },
    ":hover .cstm-trash-actions": { visibility: "visible" },
  },
  rowSelected: {
    backgroundColor: tokens.colorSubtleBackgroundSelected,
    ":hover": { backgroundColor: tokens.colorSubtleBackgroundSelected },
    "& .cstm-trash-actions": { visibility: "visible" },
  },
  listHead: { minHeight: "28px", color: tokens.colorNeutralForeground3 },
  name: { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  sub: { display: "block", color: tokens.colorNeutralForeground3 },
  from: { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: tokens.colorNeutralForeground2 },
  when: { textAlign: "right", color: tokens.colorNeutralForeground3 },
  folderIcon: { color: tokens.colorPaletteMarigoldForeground1 },
  snippetIcon: { color: tokens.colorNeutralForeground2 },
  star: { color: tokens.colorPaletteMarigoldForeground1 },
  rowActions: { display: "flex", justifyContent: "flex-end", visibility: "hidden" },
  empty: { color: tokens.colorNeutralForeground3, paddingTop: tokens.spacingVerticalL },
});

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/** "2 textos e 1 pasta". */
function describeItems(items: ItemRef[]): string {
  const snippets = items.filter((item) => item.kind === "snippet").length;
  const folders = items.length - snippets;
  return [snippets > 0 && plural(snippets, "texto", "textos"), folders > 0 && plural(folders, "pasta", "pastas")]
    .filter(Boolean)
    .join(" e ");
}

export interface SelectedItem {
  item: ItemRef;
  name: string;
  /** Onde o item está, como "Trabalho › E-mails" ou "Raiz". */
  path: string;
  favorite: boolean;
}

interface SelectionPanelProps {
  items: SelectedItem[];
  /** "Adicionar aos favoritos" ou "Remover dos favoritos"; `null` sem textos na seleção. */
  favoriteLabel: string | null;
  onAction: (key: ActionKey) => void;
  /** Del (lixeira) ou Shift+Del (definitivo). */
  onDelete: (permanent: boolean) => void;
}

/** Painel no lugar do editor quando há mais de um item selecionado, com as ações em lote. */
export function SelectionPanel({ items, favoriteLabel, onAction, onDelete }: SelectionPanelProps) {
  const styles = useStyles();
  return (
    <section
      className={styles.panel}
      aria-label="Seleção"
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key !== "Delete" || event.target !== event.currentTarget) return;
        event.preventDefault();
        onDelete(event.shiftKey);
      }}
    >
      <div className={styles.head}>
        <Text>Seleção</Text>
      </div>
      <div className={styles.doc}>
        <h2 className={styles.title}>{items.length} itens selecionados</h2>
        <p className={styles.meta}>{describeItems(items.map(({ item }) => item))}</p>
        <div className={styles.actions}>
          <Button icon={<FolderArrowRight20Regular />} onClick={() => onAction("move")}>
            Mover para…
          </Button>
          <Button icon={<Cut20Regular />} onClick={() => onAction("cut")}>
            Recortar
          </Button>
          <Button icon={<Copy20Regular />} onClick={() => onAction("copy")}>
            Copiar
          </Button>
          {favoriteLabel && (
            <Button icon={<Star20Regular />} onClick={() => onAction("favorite")}>
              {favoriteLabel}
            </Button>
          )}
          <Menu>
            <MenuTrigger disableButtonEnhancement>
              <Button icon={<ArrowExportUp20Regular />}>
                Exportar <ChevronDown12Regular />
              </Button>
            </MenuTrigger>
            <MenuPopover>
              <MenuList>
                <MenuItem icon={<Braces20Regular />} onClick={() => onAction("exportJson")}>
                  Backup JSON…
                </MenuItem>
                <MenuItem icon={<DocumentMultiple20Regular />} onClick={() => onAction("exportTxt")}>
                  Pastas e arquivos .txt…
                </MenuItem>
              </MenuList>
            </MenuPopover>
          </Menu>
          <Button icon={<Delete20Regular />} onClick={() => onAction("delete")}>
            Excluir
          </Button>
        </div>
        <div className={styles.list} role="list" aria-label="Itens selecionados">
          {items.map(({ item, name, path, favorite }) => (
            <div key={`${item.kind}-${item.id}`} role="listitem" className={styles.row}>
              {item.kind === "folder" ? (
                <Folder20Regular className={styles.folderIcon} />
              ) : (
                <DocumentText20Regular className={styles.snippetIcon} />
              )}
              <Text className={styles.name}>{name}</Text>
              <Caption1 className={styles.from}>{path}</Caption1>
              {favorite ? <Star12Filled className={styles.star} aria-label="Favorito" /> : <span />}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

/** Data e hora locais da exclusão, como "14/10/2026 09:12". */
function deletedLabel(iso: string): string {
  return dateTime.format(new Date(iso)).replace(",", "");
}

function refOf(item: TrashItem): ItemRef {
  return { kind: item.kind, id: item.id };
}

interface TrashPanelProps {
  items: TrashItem[];
  onRestore: (items: ItemRef[]) => void;
  /** Exclui definitivamente (com confirmação). */
  onDelete: (items: ItemRef[]) => void;
  onEmpty: () => void;
}

/** Itens na lixeira, com seleção múltipla, restauração e exclusão definitiva. */
export function TrashPanel({ items, onRestore, onDelete, onEmpty }: TrashPanelProps) {
  const styles = useStyles();
  const [chosen, setChosen] = useState<ItemRef[]>([]);
  const [anchor, setAnchor] = useState<ItemRef | null>(null);
  const refs = items.map(refOf);
  // Itens que saíram da lixeira deixam de contar como selecionados.
  const selected = chosen.filter((item) => includesItem(refs, item));
  const focus = selected.length > 0 ? selected[selected.length - 1] : null;

  function choose(item: ItemRef, event: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }) {
    if (event.shiftKey && anchor && includesItem(refs, anchor)) {
      const [from, to] = [refs.findIndex((ref) => sameItem(ref, anchor)), refs.findIndex((ref) => sameItem(ref, item))];
      setChosen(refs.slice(Math.min(from, to), Math.max(from, to) + 1));
      return;
    }
    setAnchor(item);
    if (event.ctrlKey || event.metaKey) {
      setChosen(includesItem(selected, item) ? selected.filter((ref) => !sameItem(ref, item)) : [...selected, item]);
    } else {
      setChosen([item]);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const at = focus ? refs.findIndex((ref) => sameItem(ref, focus)) : -1;
    const moveTo = (position: number) => {
      const item = refs[Math.max(0, Math.min(refs.length - 1, position))];
      if (item) choose(item, { ctrlKey: false, metaKey: false, shiftKey: event.shiftKey });
    };
    if (event.key === "ArrowDown") moveTo(at + 1);
    else if (event.key === "ArrowUp") moveTo(at < 0 ? refs.length - 1 : at - 1);
    else if (event.key === "Home") moveTo(0);
    else if (event.key === "End") moveTo(refs.length - 1);
    else if (event.key === "Delete" && selected.length > 0) onDelete(selected);
    else if (event.ctrlKey && event.key.toLowerCase() === "a") setChosen(refs);
    else return;
    event.preventDefault();
  }

  const count = plural(items.length, "item", "itens");
  return (
    <section className={styles.panel} aria-label="Lixeira">
      <div className={styles.head}>
        <Text>Lixeira</Text>
      </div>
      <div className={styles.doc}>
        <h2 className={styles.title}>Lixeira</h2>
        <p className={styles.meta}>
          {items.length === 0
            ? "A lixeira está vazia."
            : `${count}. Na lixeira, eles não aparecem no menu de colagem, na busca nem nas exportações.`}
        </p>
        <div className={styles.actions}>
          <Button
            icon={<ArrowCounterclockwise20Regular />}
            disabled={selected.length === 0}
            onClick={() => onRestore(selected)}
          >
            Restaurar
          </Button>
          <Button icon={<Delete20Regular />} disabled={selected.length === 0} onClick={() => onDelete(selected)}>
            Excluir definitivamente
          </Button>
          <span className={styles.spacer} />
          <Button disabled={items.length === 0} onClick={onEmpty}>
            Esvaziar lixeira
          </Button>
        </div>
        {items.length > 0 && (
          <div
            className={styles.list}
            role="listbox"
            aria-label="Itens na lixeira"
            aria-multiselectable
            tabIndex={0}
            onKeyDown={handleKeyDown}
          >
            <div role="presentation" className={mergeClasses(styles.row, styles.trashRow, styles.listHead)}>
              <span />
              <Caption1>Nome</Caption1>
              <Caption1>Estava em</Caption1>
              <Caption1 className={styles.when}>Excluído em</Caption1>
              <span />
            </div>
            {items.map((trashed) => {
              const item = refOf(trashed);
              const isSelected = includesItem(selected, item);
              const contents = describeContents(trashed);
              return (
                <div
                  key={`${item.kind}-${item.id}`}
                  role="option"
                  aria-selected={isSelected}
                  aria-label={trashed.name}
                  className={mergeClasses(styles.row, styles.trashRow, isSelected && styles.rowSelected)}
                  onClick={(event: MouseEvent) => choose(item, event)}
                >
                  {item.kind === "folder" ? (
                    <Folder20Regular className={styles.folderIcon} />
                  ) : item.kind === "clip" ? (
                    <History20Regular className={styles.snippetIcon} />
                  ) : (
                    <DocumentText20Regular className={styles.snippetIcon} />
                  )}
                  <span className={styles.name}>
                    <Text>{trashed.name}</Text>
                    {contents && <Caption1 className={styles.sub}>{contents}</Caption1>}
                  </span>
                  <Caption1 className={styles.from}>
                    {item.kind === "clip" ? "Histórico" : trashed.path.join(" › ") || "Raiz"}
                  </Caption1>
                  <Caption1 className={styles.when}>{deletedLabel(trashed.deletedAt)}</Caption1>
                  <span className={mergeClasses("cstm-trash-actions", styles.rowActions)}>
                    <Button
                      appearance="subtle"
                      size="small"
                      aria-label={`Restaurar “${trashed.name}”`}
                      icon={<ArrowCounterclockwise20Regular />}
                      onClick={(event) => {
                        event.stopPropagation();
                        onRestore([item]);
                      }}
                    />
                    <Button
                      appearance="subtle"
                      size="small"
                      aria-label={`Excluir definitivamente “${trashed.name}”`}
                      icon={<Delete20Regular />}
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete([item]);
                      }}
                    />
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

/** "Pasta com 3 textos e 1 subpasta"; vazio para textos. */
function describeContents(item: TrashItem): string {
  if (item.kind !== "folder") return "";
  const parts = [
    item.snippets > 0 && plural(item.snippets, "texto", "textos"),
    item.folders > 0 && plural(item.folders, "subpasta", "subpastas"),
  ].filter(Boolean);
  return parts.length > 0 ? `Pasta com ${parts.join(" e ")}` : "Pasta vazia";
}
