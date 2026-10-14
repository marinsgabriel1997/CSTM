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
  ArrowExportUp20Regular,
  ArrowImport20Regular,
  Braces20Regular,
  ChevronDown12Regular,
  DocumentAdd20Regular,
  DocumentMultiple20Regular,
  DocumentMultiple24Regular,
  DocumentText20Regular,
  Folder20Regular,
  FolderAdd20Regular,
  FolderOpen20Regular,
  MoreHorizontal20Regular,
  Star16Filled,
  Star16Regular,
} from "@fluentui/react-icons";
import type { ReactNode } from "react";

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
  children,
}: TreePaneProps) {
  const styles = useStyles();

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
            <Button appearance="subtle" aria-label="Importar e exportar" icon={<MoreHorizontal20Regular />} />
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
    </aside>
  );
}

export default TreePane;
