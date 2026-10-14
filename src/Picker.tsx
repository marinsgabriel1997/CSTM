import { Button, Caption1, Input, makeStyles, mergeClasses, Text, tokens } from "@fluentui/react-components";
import {
  ChevronLeft16Regular,
  ChevronRight16Regular,
  DocumentText20Regular,
  Folder20Regular,
  Search16Regular,
} from "@fluentui/react-icons";
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";

import { api, errorMessage, type Folder, type Snippet } from "./api";
import { folderPath, siblingsOf, snippetsIn } from "./tree";

const useStyles = makeStyles({
  picker: {
    height: "100%",
    display: "grid",
    gridTemplateRows: "auto auto 1fr auto",
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorNeutralForeground1,
    userSelect: "none",
  },
  search: {
    padding: tokens.spacingHorizontalS,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  input: { width: "100%" },
  back: {
    justifyContent: "flex-start",
    margin: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalXS} 0`,
    fontWeight: tokens.fontWeightSemibold,
  },
  list: {
    overflowY: "auto",
    padding: tokens.spacingHorizontalXS,
    outline: "none",
  },
  section: {
    display: "block",
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalS} ${tokens.spacingVerticalXS}`,
    color: tokens.colorNeutralForeground3,
    fontWeight: tokens.fontWeightSemibold,
  },
  row: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    height: "32px",
    paddingLeft: tokens.spacingHorizontalS,
    paddingRight: tokens.spacingHorizontalS,
    borderRadius: tokens.borderRadiusMedium,
    cursor: "default",
    whiteSpace: "nowrap",
  },
  selected: {
    backgroundColor: tokens.colorSubtleBackgroundSelected,
    "::before": {
      content: '""',
      position: "absolute",
      left: 0,
      top: "9px",
      bottom: "9px",
      width: "3px",
      borderRadius: tokens.borderRadiusSmall,
      backgroundColor: tokens.colorCompoundBrandForeground1,
    },
  },
  icon: { flex: "none", color: tokens.colorNeutralForeground2 },
  folderIcon: { color: tokens.colorPaletteMarigoldForeground1 },
  label: { flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" },
  meta: {
    maxWidth: "120px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    color: tokens.colorNeutralForeground3,
  },
  chevron: { flex: "none", color: tokens.colorNeutralForeground3 },
  message: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: tokens.spacingVerticalM,
    padding: `${tokens.spacingVerticalXXL} ${tokens.spacingHorizontalL}`,
    textAlign: "center",
    color: tokens.colorNeutralForeground2,
  },
  error: { color: tokens.colorPaletteRedForeground1 },
  hints: {
    display: "flex",
    gap: tokens.spacingHorizontalM,
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalM}`,
    borderTop: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    color: tokens.colorNeutralForeground3,
  },
  hintEnd: { marginLeft: "auto" },
  key: {
    padding: `0 ${tokens.spacingHorizontalXS}`,
    borderRadius: tokens.borderRadiusSmall,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke1}`,
    color: tokens.colorNeutralForeground2,
    fontFamily: "inherit",
  },
});

interface Library {
  folders: Folder[];
  snippets: Snippet[];
  favorites: Snippet[];
}

type Row =
  | { kind: "section"; label: string }
  | { kind: "folder"; key: string; folder: Folder }
  | { kind: "snippet"; key: string; snippet: Snippet; folderName?: string; tip: string };

type Option = Exclude<Row, { kind: "section" }>;

const folderKey = (id: number) => `folder-${id}`;

function pathLabel(folders: Folder[], folderId: number | null): string {
  return folderPath(folders, folderId)
    .map((folder) => folder.name)
    .join(" › ");
}

/** Menu de colagem: busca, favoritos e pastas, para escolher um texto pelo teclado ou mouse. */
function Picker() {
  const styles = useStyles();
  const [library, setLibrary] = useState<Library | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Cada abertura do menu incrementa a versão, que recarrega os dados.
  const [version, setVersion] = useState(0);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ term: string; list: Snippet[] } | null>(null);
  const [folderId, setFolderId] = useState<number | null>(null);
  // Linha selecionada; `null` (ou uma linha que não existe mais) seleciona a primeira.
  const [selected, setSelected] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const term = query.trim();

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let disposed = false;
    api
      .onPickerOpened(() => {
        setFolderId(null);
        setQuery("");
        setSelected(null);
        setError(null);
        setVersion((value) => value + 1);
      })
      .then(
        (remove) => (disposed ? remove() : (unlisten = remove)),
        // Fora do Tauri (frontend no navegador) não há aviso de abertura.
        () => undefined,
      );
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    let current = true;
    Promise.all([api.listFolders(), api.listAllSnippets(), api.listFavorites()]).then(
      ([folders, snippets, favorites]) => current && setLibrary({ folders, snippets, favorites }),
      (reason) => current && setError(errorMessage(reason)),
    );
    inputRef.current?.focus();
    return () => {
      current = false;
    };
  }, [version]);

  useEffect(() => {
    if (!term) return;
    let current = true;
    api.searchSnippets(term).then(
      (list) => current && setResults({ term, list }),
      (reason) => current && setError(errorMessage(reason)),
    );
    // Descarta respostas de uma busca anterior que cheguem fora de ordem.
    return () => {
      current = false;
    };
  }, [term, version]);

  const rows = useMemo((): Row[] => {
    if (!library) return [];
    const { folders, snippets, favorites } = library;
    if (term) {
      if (results?.term !== term) return [];
      return results.list.map((snippet) => {
        const path = pathLabel(folders, snippet.folderId);
        return {
          kind: "snippet",
          key: `result-${snippet.id}`,
          snippet,
          folderName: folders.find((folder) => folder.id === snippet.folderId)?.name,
          tip: path ? `${path}\n\n${snippet.content}` : snippet.content,
        };
      });
    }
    const contents: Row[] = [
      ...siblingsOf(folders, folderId).map((folder): Row => ({ kind: "folder", key: folderKey(folder.id), folder })),
      ...snippetsIn(snippets, folderId).map(
        (snippet): Row => ({ kind: "snippet", key: `snippet-${snippet.id}`, snippet, tip: snippet.content }),
      ),
    ];
    if (folderId !== null) return contents;
    return [
      ...(favorites.length
        ? [
            { kind: "section", label: "Favoritos" } as Row,
            ...favorites.map(
              (snippet): Row => ({ kind: "snippet", key: `favorite-${snippet.id}`, snippet, tip: snippet.content }),
            ),
          ]
        : []),
      { kind: "section", label: "Todos" },
      ...contents,
    ];
  }, [library, term, results, folderId]);

  const options = rows.filter((row): row is Option => row.kind !== "section");
  const active = options.find((row) => row.key === selected) ?? options[0];
  const empty = library !== null && library.folders.length === 0 && library.snippets.length === 0;
  const searching = term !== "" && results?.term !== term;

  function openFolder(id: number) {
    setFolderId(id);
    setSelected(null);
  }

  function goBack() {
    if (folderId === null || !library) return;
    setFolderId(library.folders.find((folder) => folder.id === folderId)?.parentId ?? null);
    // Volta com a pasta de onde se saiu selecionada.
    setSelected(folderKey(folderId));
  }

  function choose(row: Option) {
    if (row.kind === "folder") openFolder(row.folder.id);
    else if (row.kind === "snippet") api.chooseSnippet(row.snippet.id).catch((reason) => setError(errorMessage(reason)));
  }

  function move(to: number) {
    if (options.length === 0) return;
    setSelected(options[Math.max(0, Math.min(options.length - 1, to))].key);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const position = active ? options.indexOf(active) : -1;
    const row = active;
    const blank = query === "";
    switch (event.key) {
      case "ArrowDown":
        move(position + 1);
        break;
      case "ArrowUp":
        move(position - 1);
        break;
      case "Home":
        if (!blank) return;
        move(0);
        break;
      case "End":
        if (!blank) return;
        move(options.length - 1);
        break;
      case "Enter":
        if (row) choose(row);
        break;
      case "ArrowRight":
        if (!blank) return;
        if (row?.kind === "folder") openFolder(row.folder.id);
        break;
      case "ArrowLeft":
      case "Backspace":
        if (!blank) return;
        goBack();
        break;
      case "Escape":
        void api.hidePicker();
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  useEffect(() => {
    if (active) document.getElementById(`picker-${active.key}`)?.scrollIntoView?.({ block: "nearest" });
  }, [active]);

  function renderBody() {
    if (error) return <Text className={mergeClasses(styles.message, styles.error)}>{error}</Text>;
    if (empty) {
      return (
        <div className={styles.message}>
          <Text>Nenhum texto cadastrado.</Text>
          <Button
            appearance="primary"
            onClick={() => {
              void api.hidePicker();
              void api.showWindow();
            }}
          >
            Abrir cadastro
          </Button>
        </div>
      );
    }
    if (term && !searching && rows.length === 0) return <Text className={styles.message}>Nenhum texto encontrado.</Text>;
    if (folderId !== null && rows.length === 0) return <Text className={styles.message}>Pasta vazia.</Text>;
    return null;
  }

  const body = renderBody();
  const hasOptions = !body && options.length > 0;

  return (
    <div className={styles.picker}>
      <div className={styles.search}>
        <Input
          ref={inputRef}
          className={styles.input}
          autoFocus
          role="combobox"
          aria-label="Buscar"
          aria-expanded
          aria-controls="picker-list"
          aria-activedescendant={hasOptions && active ? `picker-${active.key}` : undefined}
          placeholder="Buscar"
          contentBefore={<Search16Regular />}
          value={query}
          onChange={(_, data) => {
            setQuery(data.value);
            setSelected(null);
          }}
          onKeyDown={onKeyDown}
        />
      </div>
      {folderId !== null && !term && library ? (
        <Button className={styles.back} appearance="subtle" icon={<ChevronLeft16Regular />} onClick={goBack}>
          {pathLabel(library.folders, folderId)}
        </Button>
      ) : (
        <div />
      )}
      <div id="picker-list" className={styles.list} role="listbox" aria-label="Textos">
        {body ??
          rows.map((row) =>
            row.kind === "section" ? (
              <Caption1 key={`section-${row.label}`} className={styles.section} role="presentation">
                {row.label}
              </Caption1>
            ) : (
              <div
                key={row.key}
                id={`picker-${row.key}`}
                role="option"
                aria-selected={row === active}
                className={mergeClasses(styles.row, row === active && styles.selected)}
                title={row.kind === "snippet" ? row.tip : undefined}
                onMouseMove={() => row !== active && setSelected(row.key)}
                // Mantém o foco no campo de busca ao clicar numa linha.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(row)}
              >
                {row.kind === "folder" ? (
                  <Folder20Regular className={mergeClasses(styles.icon, styles.folderIcon)} />
                ) : (
                  <DocumentText20Regular className={styles.icon} />
                )}
                <Text className={styles.label}>{row.kind === "folder" ? row.folder.name : row.snippet.title}</Text>
                {row.kind === "snippet" && row.folderName && (
                  <Caption1 className={styles.meta}>{row.folderName}</Caption1>
                )}
                {row.kind === "folder" && <ChevronRight16Regular className={styles.chevron} />}
              </div>
            ),
          )}
      </div>
      <div className={styles.hints}>
        {hasOptions && (
          <Caption1>
            <kbd className={styles.key}>Enter</kbd> colar
          </Caption1>
        )}
        {hasOptions && !term && (
          <Caption1>
            {folderId === null ? (
              <>
                <kbd className={styles.key}>→</kbd> abrir pasta
              </>
            ) : (
              <>
                <kbd className={styles.key}>←</kbd> voltar
              </>
            )}
          </Caption1>
        )}
        <Caption1 className={styles.hintEnd}>
          <kbd className={styles.key}>Esc</kbd> fechar
        </Caption1>
      </div>
    </div>
  );
}

export default Picker;
