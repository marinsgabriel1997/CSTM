import {
  Button,
  Caption1,
  makeStyles,
  Menu,
  MenuDivider,
  MenuGroupHeader,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  mergeClasses,
  SearchBox,
  Subtitle2,
  Text,
  ToggleButton,
  tokens,
} from "@fluentui/react-components";
import {
  Add20Regular,
  ArrowCollapseAll20Regular,
  ArrowExpandAll20Regular,
  ArrowExportUp20Regular,
  ArrowImport20Regular,
  ArrowSort20Regular,
  Braces20Regular,
  ChevronDown12Regular,
  Delete20Regular,
  DocumentAdd20Regular,
  DocumentMultiple20Regular,
  DocumentMultiple24Regular,
  DocumentText20Regular,
  Folder20Regular,
  FolderAdd20Regular,
  FolderOpen20Regular,
  History20Regular,
  MoreHorizontal20Regular,
  Star16Filled,
  Star16Regular,
  Star20Regular,
  TextSortAscending20Regular,
} from "@fluentui/react-icons";
import { useState, type ReactNode } from "react";

import type { SortKind } from "../operations";
import type { ExportFormat, ImportKind } from "../transfer";

const useStyles = makeStyles({
  pane: {
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
    minWidth: 0,
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    paddingLeft: tokens.spacingHorizontalS,
    paddingRight: tokens.spacingHorizontalXS,
  },
  head: {
    display: "flex",
    gap: tokens.spacingHorizontalS,
    paddingRight: tokens.spacingHorizontalXS,
    paddingBottom: tokens.spacingVerticalS,
  },
  search: { flex: 1, minWidth: 0 },
  filters: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    paddingRight: tokens.spacingHorizontalS,
    paddingBottom: tokens.spacingVerticalXS,
  },
  favoriteOn: { color: tokens.colorPaletteMarigoldForeground1 },
  results: { marginLeft: "auto", color: tokens.colorNeutralForeground3 },
  empty: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: tokens.spacingVerticalS,
    paddingLeft: tokens.spacingHorizontalXXL,
    paddingRight: tokens.spacingHorizontalXXL,
    paddingBottom: "40px",
    textAlign: "center",
    color: tokens.colorNeutralForeground2,
  },
  emptyIcon: { color: tokens.colorNeutralForeground3 },
  emptyActions: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: tokens.spacingHorizontalS,
    marginTop: tokens.spacingVerticalS,
  },
  noWrap: { whiteSpace: "nowrap", flex: "none" },
  chevron: { marginLeft: tokens.spacingHorizontalXS },
  emptyIconSize: { width: "40px", height: "40px" },
  noMatches: {
    paddingTop: tokens.spacingVerticalL,
    paddingLeft: tokens.spacingHorizontalM,
    color: tokens.colorNeutralForeground3,
  },
  // Lixeira fixa no fim da árvore, fora da rolagem.
  trashArea: {
    flex: "none",
    marginTop: tokens.spacingVerticalXS,
    marginRight: tokens.spacingHorizontalXS,
    paddingTop: tokens.spacingVerticalXS,
    borderTop: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  trash: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    minHeight: "32px",
    paddingLeft: "30px",
    paddingRight: tokens.spacingHorizontalS,
    borderRadius: tokens.borderRadiusMedium,
    cursor: "default",
    userSelect: "none",
    outline: "none",
    color: tokens.colorNeutralForeground1,
    ":hover": { backgroundColor: tokens.colorSubtleBackgroundHover },
    ":focus-visible": {
      outline: `${tokens.strokeWidthThick} solid ${tokens.colorStrokeFocus2}`,
      outlineOffset: "-2px",
    },
  },
  trashSelected: {
    backgroundColor: tokens.colorSubtleBackgroundSelected,
    ":hover": { backgroundColor: tokens.colorSubtleBackgroundSelected },
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
  trashDrop: {
    backgroundColor: tokens.colorBrandBackground2,
    outline: `${tokens.strokeWidthThin} solid ${tokens.colorCompoundBrandStroke}`,
    outlineOffset: "-1px",
  },
  trashIcon: { flex: "none", color: tokens.colorNeutralForeground2 },
  trashLabel: { flex: 1 },
  trashCount: { color: tokens.colorNeutralForeground3 },
});

interface TreePaneProps {
  query: string;
  onQueryChange: (query: string) => void;
  favoritesOnly: boolean;
  onFavoritesOnlyChange: (favoritesOnly: boolean) => void;
  /** Quantidade de resultados da busca ativa; `null` sem busca. */
  resultCount: number | null;
  /** Biblioteca vazia: mostra a chamada de primeiro uso no lugar da árvore. */
  empty: boolean;
  /** Mensagem quando a busca ou o filtro não deixam nenhum item. */
  noMatches: string | null;
  /** Onde os itens novos serão criados, como "Trabalho › E-mails". */
  targetLabel: string;
  onNewSnippet: () => void;
  onNewFolder: () => void;
  onImport: (kind: ImportKind) => void;
  /** Exporta a biblioteca inteira. */
  onExport: (format: ExportFormat) => void;
  /** Ordena a raiz; indisponível com a busca ou o filtro ativos. */
  onSort: (kind: SortKind) => void;
  canSort: boolean;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  trashCount: number;
  trashSelected: boolean;
  onSelectTrash: () => void;
  /** Há itens sendo arrastados, que podem ser soltos na Lixeira. */
  dragging: boolean;
  onDropOnTrash: () => void;
  children: ReactNode;
}

function TreePane({
  query,
  onQueryChange,
  favoritesOnly,
  onFavoritesOnlyChange,
  resultCount,
  empty,
  noMatches,
  targetLabel,
  onNewSnippet,
  onNewFolder,
  onImport,
  onExport,
  onSort,
  canSort,
  onExpandAll,
  onCollapseAll,
  trashCount,
  trashSelected,
  onSelectTrash,
  dragging,
  onDropOnTrash,
  children,
}: TreePaneProps) {
  const styles = useStyles();
  const [dropOnTrash, setDropOnTrash] = useState(false);

  return (
    <aside className={styles.pane} aria-label="Textos e pastas">
      <div className={styles.head}>
        <SearchBox
          className={styles.search}
          aria-label="Buscar"
          placeholder="Buscar"
          value={query}
          onChange={(_, data) => onQueryChange(data.value)}
        />
        <Menu>
          <MenuTrigger disableButtonEnhancement>
            <Button appearance="primary" icon={<Add20Regular />}>
              Novo
              <ChevronDown12Regular className={styles.chevron} />
            </Button>
          </MenuTrigger>
          <MenuPopover>
            <MenuList>
              <MenuItem icon={<DocumentAdd20Regular />} secondaryContent="Ctrl+N" onClick={onNewSnippet}>
                Novo texto
              </MenuItem>
              <MenuItem icon={<FolderAdd20Regular />} secondaryContent="Ctrl+Shift+N" onClick={onNewFolder}>
                Nova pasta
              </MenuItem>
              <MenuDivider />
              <MenuGroupHeader>{targetLabel}</MenuGroupHeader>
            </MenuList>
          </MenuPopover>
        </Menu>
        <Menu>
          <MenuTrigger disableButtonEnhancement>
            <Button appearance="subtle" aria-label="Mais opções" icon={<MoreHorizontal20Regular />} />
          </MenuTrigger>
          <MenuPopover>
            <MenuList>
              <Menu>
                <MenuTrigger disableButtonEnhancement>
                  <MenuItem icon={<ArrowImport20Regular />}>Importar</MenuItem>
                </MenuTrigger>
                <MenuPopover>
                  <MenuList>
                    <MenuItem icon={<DocumentText20Regular />} onClick={() => onImport("txt")}>
                      Arquivos .txt…
                    </MenuItem>
                    <MenuItem icon={<Folder20Regular />} onClick={() => onImport("folder")}>
                      Pasta…
                    </MenuItem>
                    <MenuItem icon={<FolderOpen20Regular />} onClick={() => onImport("folderContents")}>
                      Conteúdo de uma pasta…
                    </MenuItem>
                    <MenuItem icon={<Braces20Regular />} onClick={() => onImport("json")}>
                      Backup JSON…
                    </MenuItem>
                    <MenuDivider />
                    <MenuGroupHeader>{targetLabel}</MenuGroupHeader>
                  </MenuList>
                </MenuPopover>
              </Menu>
              <Menu>
                <MenuTrigger disableButtonEnhancement>
                  <MenuItem icon={<ArrowExportUp20Regular />}>Exportar tudo</MenuItem>
                </MenuTrigger>
                <MenuPopover>
                  <MenuList>
                    <MenuItem icon={<Braces20Regular />} onClick={() => onExport("json")}>
                      Backup JSON…
                    </MenuItem>
                    <MenuItem icon={<DocumentMultiple20Regular />} onClick={() => onExport("txt")}>
                      Pastas e arquivos .txt…
                    </MenuItem>
                  </MenuList>
                </MenuPopover>
              </Menu>
              <MenuDivider />
              <Menu>
                <MenuTrigger disableButtonEnhancement>
                  <MenuItem icon={<ArrowSort20Regular />} disabled={!canSort}>
                    Ordenar a raiz
                  </MenuItem>
                </MenuTrigger>
                <MenuPopover>
                  <MenuList>
                    <MenuItem icon={<TextSortAscending20Regular />} onClick={() => onSort("name")}>
                      Por nome (A–Z)
                    </MenuItem>
                    <MenuItem icon={<Star20Regular />} onClick={() => onSort("uses")}>
                      Por mais usados
                    </MenuItem>
                    <MenuItem icon={<History20Regular />} onClick={() => onSort("recent")}>
                      Por uso mais recente
                    </MenuItem>
                  </MenuList>
                </MenuPopover>
              </Menu>
              <MenuDivider />
              <MenuItem icon={<ArrowExpandAll20Regular />} onClick={onExpandAll}>
                Expandir tudo
              </MenuItem>
              <MenuItem icon={<ArrowCollapseAll20Regular />} onClick={onCollapseAll}>
                Recolher tudo
              </MenuItem>
            </MenuList>
          </MenuPopover>
        </Menu>
      </div>

      {empty ? (
        <div className={styles.empty}>
          <DocumentMultiple24Regular className={mergeClasses(styles.emptyIcon, styles.emptyIconSize)} />
          <Subtitle2>Nenhum texto ainda</Subtitle2>
          <Text>Crie um texto para colar em qualquer programa, ou uma pasta para organizar.</Text>
          <div className={styles.emptyActions}>
            <Button
              appearance="primary"
              className={styles.noWrap}
              icon={<DocumentAdd20Regular />}
              onClick={onNewSnippet}
            >
              Novo texto
            </Button>
            <Button className={styles.noWrap} icon={<FolderAdd20Regular />} onClick={onNewFolder}>
              Nova pasta
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className={styles.filters}>
            <ToggleButton
              size="small"
              shape="circular"
              checked={favoritesOnly}
              icon={favoritesOnly ? <Star16Filled className={styles.favoriteOn} /> : <Star16Regular />}
              onClick={() => onFavoritesOnlyChange(!favoritesOnly)}
            >
              Favoritos
            </ToggleButton>
            {resultCount !== null && (
              <Caption1 className={styles.results}>
                {resultCount} {resultCount === 1 ? "resultado" : "resultados"}
              </Caption1>
            )}
          </div>
          {noMatches ? <Text className={styles.noMatches}>{noMatches}</Text> : children}
        </>
      )}
      {(!empty || trashCount > 0) && (
        <div className={styles.trashArea}>
          <div
            role="button"
            tabIndex={0}
            aria-pressed={trashSelected}
            aria-label={`Lixeira, ${trashCount} ${trashCount === 1 ? "item" : "itens"}`}
            className={mergeClasses(
              styles.trash,
              trashSelected && styles.trashSelected,
              dropOnTrash && styles.trashDrop,
            )}
            onClick={onSelectTrash}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              onSelectTrash();
            }}
            onDragOver={(event) => {
              if (!dragging) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              setDropOnTrash(true);
            }}
            onDragLeave={() => setDropOnTrash(false)}
            onDrop={(event) => {
              setDropOnTrash(false);
              if (!dragging) return;
              event.preventDefault();
              onDropOnTrash();
            }}
          >
            <Delete20Regular className={styles.trashIcon} />
            <span className={styles.trashLabel}>Lixeira</span>
            {trashCount > 0 && <Caption1 className={styles.trashCount}>{trashCount}</Caption1>}
          </div>
        </div>
      )}
    </aside>
  );
}

export default TreePane;
