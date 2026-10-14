import { Button, Caption1, Input, makeStyles, mergeClasses, Text, tokens } from "@fluentui/react-components";
import {
  ChevronLeft16Regular,
  ChevronRight16Regular,
  DocumentText20Regular,
  Fire20Regular,
  Folder20Regular,
  Search16Regular,
  Star20Regular,
} from "@fluentui/react-icons";
import { type CSSProperties, type KeyboardEvent, type MouseEvent, useEffect, useMemo, useRef, useState } from "react";

import { api, errorMessage, type Folder, type PickerColumn, type PickerNavigation, type Snippet } from "./api";
import { folderPath, siblingsOf, snippetsIn } from "./tree";

const useStyles = makeStyles({
  // A janela é transparente e ocupa a área útil do monitor, recortada pelo backend em volta
  // das colunas visíveis: cada coluna é um cartão com fundo, cantos e sombra próprios.
  // Clicar fora dos cartões, mas dentro do recorte (sombra e intervalos), fecha o menu.
  root: {
    position: "relative",
    width: "100%",
    height: "100%",
    overflow: "hidden",
    color: tokens.colorNeutralForeground1,
    userSelect: "none",
  },
  card: {
    position: "absolute",
    overflow: "hidden",
    borderRadius: tokens.borderRadiusXLarge,
    backgroundColor: tokens.colorNeutralBackground1,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    boxShadow: tokens.shadow16,
  },
  main: {
    display: "grid",
    gridTemplateRows: "auto auto 1fr auto",
  },
  sub: {
    display: "flex",
    flexDirection: "column",
  },
  // Coberta por uma coluna mais nova: some sem sair da árvore, para o campo de busca manter o foco.
  hidden: { opacity: 0, pointerEvents: "none" },
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
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    padding: tokens.spacingHorizontalXS,
    outline: "none",
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
  opener: { backgroundColor: tokens.colorSubtleBackgroundHover },
  icon: { flex: "none", color: tokens.colorNeutralForeground2 },
  folderIcon: { color: tokens.colorPaletteMarigoldForeground1 },
  mostUsedIcon: { color: tokens.colorPaletteDarkOrangeForeground1 },
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
  emptyFolder: { padding: tokens.spacingVerticalM, textAlign: "center", color: tokens.colorNeutralForeground2 },
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
  navigation: PickerNavigation;
}

/** Pastas que só existem no menu, calculadas a cada abertura. */
type Virtual = "most-used" | "favorites";

/** Quantos textos a pasta Mais usados mostra. */
const MOST_USED_LIMIT = 10;

const VIRTUAL_NAMES: Record<Virtual, string> = { "most-used": "Mais usados", favorites: "Favoritos" };

/** Pasta aberta no menu: a raiz (`null`), uma pasta do cadastro ou uma pasta virtual. */
type Place = number | Virtual | null;

type Row =
  | { kind: "folder"; key: string; folder: Folder }
  | { kind: "virtual"; key: string; virtual: Virtual }
  | { kind: "snippet"; key: string; snippet: Snippet; folderName?: string; tip: string };

/** Subcoluna aberta na cascata, com o que o backend precisa para posicioná-la. */
interface OpenColumn {
  place: number | Virtual;
  /** Altura do conteúdo, sem rolagem. */
  contentHeight: number;
  /** Distância do topo da pasta que a abriu ao topo da coluna anterior. */
  anchorY: number;
}

/** Altura de uma linha e margem da lista (preenchimento e bordas do cartão). */
const ROW_HEIGHT = 32;
const LIST_MARGIN = 10;
/** Altura da subcoluna que só mostra "Pasta vazia.". */
const EMPTY_HEIGHT = 56;

const folderKey = (place: number | Virtual) => `folder-${place}`;
const columnId = (column: number) => `picker-column-${column}`;
const rowId = (column: number, key: string) => `picker-${column}-${key}`;

const placeOfRow = (row: Row): number | Virtual | null =>
  row.kind === "folder" ? row.folder.id : row.kind === "virtual" ? row.virtual : null;

/** Textos mais colados, do mais para o menos usado; empates pelo uso mais recente. */
function mostUsed(snippets: Snippet[]): Snippet[] {
  return snippets
    .filter((snippet) => snippet.useCount > 0)
    .sort((a, b) => b.useCount - a.useCount || (b.lastUsedAt ?? "").localeCompare(a.lastUsedAt ?? "") || a.id - b.id)
    .slice(0, MOST_USED_LIMIT);
}

function pathLabel(folders: Folder[], folderId: number | null): string {
  return folderPath(folders, folderId)
    .map((folder) => folder.name)
    .join(" › ");
}

function placeLabel(folders: Folder[], place: number | Virtual): string {
  return typeof place === "number" ? pathLabel(folders, place) : VIRTUAL_NAMES[place];
}

/** Textos de várias pastas (busca, Mais usados, Favoritos) mostram a pasta de cada um. */
function snippetWithFolder(folders: Folder[], snippet: Snippet, prefix: string): Row {
  const path = pathLabel(folders, snippet.folderId);
  return {
    kind: "snippet",
    key: `${prefix}-${snippet.id}`,
    snippet,
    folderName: folders.find((folder) => folder.id === snippet.folderId)?.name,
    tip: path ? `${path}\n\n${snippet.content}` : snippet.content,
  };
}

/** Linhas de uma pasta: as pastas virtuais, as pastas e os textos da raiz, ou o conteúdo dela. */
function contentRows(library: Library | null, place: Place): Row[] {
  if (!library) return [];
  const { folders, snippets, favorites } = library;
  if (place === "most-used") return mostUsed(snippets).map((snippet) => snippetWithFolder(folders, snippet, "most-used"));
  if (place === "favorites") return favorites.map((snippet) => snippetWithFolder(folders, snippet, "favorite"));
  const contents: Row[] = [
    ...siblingsOf(folders, place).map((folder): Row => ({ kind: "folder", key: folderKey(folder.id), folder })),
    ...snippetsIn(snippets, place).map(
      (snippet): Row => ({ kind: "snippet", key: `snippet-${snippet.id}`, snippet, tip: snippet.content }),
    ),
  ];
  if (place !== null) return contents;
  // Na raiz, as pastas virtuais vêm primeiro e somem quando vazias.
  const virtuals: Row[] = [];
  if (mostUsed(snippets).length > 0) virtuals.push({ kind: "virtual", key: folderKey("most-used"), virtual: "most-used" });
  if (favorites.length > 0) virtuals.push({ kind: "virtual", key: folderKey("favorites"), virtual: "favorites" });
  return [...virtuals, ...contents];
}

interface PickerRowProps {
  id: string;
  row: Row;
  selected: boolean;
  /** Pasta cuja coluna está aberta ao lado. */
  opener?: boolean;
  onHover: (event: MouseEvent) => void;
  onClick: () => void;
}

function PickerRow({ id, row, selected, opener, onHover, onClick }: PickerRowProps) {
  const styles = useStyles();
  return (
    <div
      id={id}
      role="option"
      aria-selected={selected}
      className={mergeClasses(styles.row, selected ? styles.selected : opener && styles.opener)}
      title={row.kind === "snippet" ? row.tip : undefined}
      onMouseMove={onHover}
      // Mantém o foco no campo de busca ao clicar numa linha.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {row.kind === "folder" ? (
        <Folder20Regular className={mergeClasses(styles.icon, styles.folderIcon)} />
      ) : row.kind === "virtual" ? (
        row.virtual === "most-used" ? (
          <Fire20Regular className={mergeClasses(styles.icon, styles.mostUsedIcon)} />
        ) : (
          <Star20Regular className={mergeClasses(styles.icon, styles.folderIcon)} />
        )
      ) : (
        <DocumentText20Regular className={styles.icon} />
      )}
      {/* O Text do Fluent quebra linhas por padrão, anulando o nowrap da linha de altura fixa. */}
      <Text wrap={false} className={styles.label}>
        {row.kind === "folder" ? row.folder.name : row.kind === "virtual" ? VIRTUAL_NAMES[row.virtual] : row.snippet.title}
      </Text>
      {row.kind === "snippet" && row.folderName && <Caption1 wrap={false} className={styles.meta}>{row.folderName}</Caption1>}
      {row.kind !== "snippet" && <ChevronRight16Regular className={styles.chevron} />}
    </div>
  );
}

const cardStyle = (column: PickerColumn): CSSProperties => ({
  left: column.x,
  top: column.y,
  width: column.width,
  height: column.height,
});

/**
 * Numeração dos pedidos de layout e última posição do mouse, que ficam fora do estado para sobreviver às
 * renderizações sem provocá-las.
 */
function useAsyncControl() {
  const requests = useRef(0);
  const point = useRef<{ x: number; y: number } | null>(null);
  return useMemo(
    () => ({
      /** Torna obsoletos os pedidos anteriores e devolve o número do novo. */
      invalidate() {
        return ++requests.current;
      },
      isCurrent(request: number) {
        return request === requests.current;
      },
      /** O mouse mudou de lugar? O navegador repete o movimento quando a lista rola sob ele. */
      moved(x: number, y: number) {
        const changed = point.current?.x !== x || point.current?.y !== y;
        point.current = { x, y };
        return changed;
      },
    }),
    [],
  );
}

/**
 * Menu de colagem: busca, favoritos e pastas, para escolher um texto pelo teclado ou mouse.
 * As pastas abrem em colunas ao lado (cascata) ou substituem a lista, conforme a configuração.
 */
function Picker() {
  const styles = useStyles();
  const [library, setLibrary] = useState<Library | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Cada abertura do menu incrementa a versão, que recarrega os dados.
  const [version, setVersion] = useState(0);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ term: string; list: Snippet[] } | null>(null);
  // Pasta mostrada na coluna principal (só muda no modo clique).
  const [folderId, setFolderId] = useState<Place>(null);
  // Subcolunas abertas (cascata) e a posição de todas as colunas na janela, a principal
  // primeiro; a principal vem de cada abertura, nos dois modos de navegação.
  const [subs, setSubs] = useState<OpenColumn[]>([]);
  const [placements, setPlacements] = useState<PickerColumn[]>([]);
  // Coluna que recebe o teclado e a linha selecionada em cada uma; `null` (ou uma linha que
  // não existe mais) seleciona a primeira.
  const [activeColumn, setActiveColumn] = useState(0);
  const [selection, setSelection] = useState<(string | null)[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const pending = useAsyncControl();
  const term = query.trim();
  const cascade = library?.navigation === "cascade";

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let disposed = false;
    api
      .onPickerOpened((main) => {
        pending.invalidate();
        setFolderId(null);
        setSubs([]);
        setPlacements([main]);
        setActiveColumn(0);
        setSelection([]);
        setQuery("");
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
  }, [pending]);

  useEffect(() => {
    let current = true;
    Promise.all([api.listFolders(), api.listAllSnippets(), api.listFavorites(), api.getPickerNavigation()]).then(
      ([folders, snippets, favorites, navigation]) => current && setLibrary({ folders, snippets, favorites, navigation }),
      (reason) => current && setError(errorMessage(reason)),
    );
    inputRef.current?.focus();
    // A janela abre invisível; ao fim do primeiro quadro já desenhado com a raiz, avisa o
    // backend para mostrar a coluna principal, sem o conteúdo da abertura anterior.
    let frame = 0;
    if (version > 0) {
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => void api.pickerReady().catch(() => undefined));
      });
    }
    return () => {
      current = false;
      cancelAnimationFrame(frame);
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

  // Linhas de cada coluna: a principal (busca ou pasta atual) e uma por subcoluna aberta.
  const columnRows = useMemo((): Row[][] => {
    let main: Row[];
    if (term) {
      main =
        library && results?.term === term
          ? results.list.map((snippet) => snippetWithFolder(library.folders, snippet, "result"))
          : [];
    } else {
      main = contentRows(library, folderId);
    }
    return [main, ...subs.map((sub) => contentRows(library, sub.place))];
  }, [library, term, results, folderId, subs]);

  const rowsOf = (column: number) => columnRows[column] ?? [];
  const activeRowOf = (column: number) => {
    const rows = rowsOf(column);
    return rows.find((row) => row.key === selection[column]) ?? rows[0];
  };
  const rows = rowsOf(0);
  const active = activeRowOf(activeColumn);
  const empty = library !== null && library.folders.length === 0 && library.snippets.length === 0;
  const searching = term !== "" && results?.term !== term;

  function select(column: number, key: string | null) {
    setSelection((previous) => {
      const next = Array.from({ length: Math.max(previous.length, column + 1) }, (_, index) => previous[index] ?? null);
      next[column] = key;
      return next;
    });
  }

  /** Pede ao backend a posição das colunas; `null` se um pedido mais novo tomou o lugar. */
  async function requestLayout(columns: OpenColumn[]): Promise<PickerColumn[] | null> {
    const request = pending.invalidate();
    try {
      const placed = await api.layoutPicker(columns.map(({ contentHeight, anchorY }) => ({ contentHeight, anchorY })));
      return pending.isCurrent(request) ? placed : null;
    } catch (reason) {
      if (pending.isCurrent(request)) setError(errorMessage(reason));
      return null;
    }
  }

  /**
   * Abre a coluna da pasta `row`, que está na coluna `column`, no lugar das que já estavam
   * abertas dali em diante. A janela é posicionada antes de a coluna aparecer; devolve
   * `false` se a abertura foi descartada.
   */
  async function openColumn(column: number, row: Row): Promise<boolean> {
    const place = placeOfRow(row);
    if (place === null) return false;
    if (subs[column]?.place === place) return true;
    const rowBox = document.getElementById(rowId(column, row.key))?.getBoundingClientRect();
    const columnBox = document.getElementById(columnId(column))?.getBoundingClientRect();
    const count = contentRows(library, place).length;
    const next: OpenColumn[] = [
      ...subs.slice(0, column),
      {
        place,
        contentHeight: count > 0 ? count * ROW_HEIGHT + LIST_MARGIN : EMPTY_HEIGHT,
        anchorY: rowBox && columnBox ? rowBox.top - columnBox.top : 0,
      },
    ];
    const placed = await requestLayout(next);
    if (!placed) return false;
    setSubs(next);
    setPlacements(placed);
    setSelection((previous) => previous.slice(0, column + 1));
    return true;
  }

  /** Fecha as colunas depois da `column`. */
  function closeAfter(column: number) {
    if (subs.length <= column) return;
    const next = subs.slice(0, column);
    setSubs(next);
    setPlacements((previous) => previous.slice(0, column + 1));
    setSelection((previous) => previous.slice(0, column + 1));
    setActiveColumn((current) => Math.min(current, column));
    // Encolhe a janela e devolve as colunas que estavam cobertas.
    void requestLayout(next).then((placed) => placed && setPlacements(placed));
  }

  async function enterFolder(column: number, row: Row) {
    if (!(await openColumn(column, row))) return;
    setActiveColumn(column + 1);
    select(column + 1, null);
  }

  function openFolder(place: number | Virtual) {
    setFolderId(place);
    select(0, null);
  }

  function goBack() {
    if (folderId === null || !library) return;
    setFolderId(
      typeof folderId === "number"
        ? (library.folders.find((folder) => folder.id === folderId)?.parentId ?? null)
        : null,
    );
    // Volta com a pasta de onde se saiu selecionada.
    select(0, folderKey(folderId));
  }

  function choose(column: number, row: Row) {
    if (row.kind === "snippet") {
      api.chooseSnippet(row.snippet.id).catch((reason) => setError(errorMessage(reason)));
    } else if (cascade) {
      void enterFolder(column, row);
    } else {
      openFolder(placeOfRow(row)!);
    }
  }

  function clickRow(column: number, row: Row) {
    if (row.kind === "snippet" || !cascade) {
      choose(column, row);
      return;
    }
    // Clicar numa pasta abre a coluna na hora, sem entrar nela.
    setActiveColumn(column);
    select(column, row.key);
    void openColumn(column, row);
  }

  function hoverRow(column: number, row: Row, event: MouseEvent) {
    if (!cascade) {
      if (selection[0] !== row.key) select(0, row.key);
      return;
    }
    if (!pending.moved(event.clientX, event.clientY)) return;
    if (activeColumn !== column) setActiveColumn(column);
    if (selection[column] !== row.key) select(column, row.key);
    if (column === 0 && term) return;
    if (row.kind === "snippet") {
      closeAfter(column);
    } else if (subs[column]?.place !== placeOfRow(row)) {
      // Sem atraso: a coluna abre assim que o mouse passa sobre a pasta.
      void openColumn(column, row);
    }
  }

  function move(to: number) {
    const options = rowsOf(activeColumn);
    if (options.length === 0) return;
    select(activeColumn, options[Math.max(0, Math.min(options.length - 1, to))].key);
    if (cascade) closeAfter(activeColumn);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const options = rowsOf(activeColumn);
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
        if (row) choose(activeColumn, row);
        break;
      case "ArrowRight":
        if (!blank) return;
        if (row?.kind === "folder" || row?.kind === "virtual") choose(activeColumn, row);
        break;
      case "ArrowLeft":
      case "Backspace":
        if (!blank) return;
        if (!cascade) {
          goBack();
        } else if (activeColumn > 0) {
          // Fecha a coluna atual e volta à pasta que a abriu.
          const parent = activeColumn - 1;
          select(parent, folderKey(subs[parent].place));
          closeAfter(parent);
          setActiveColumn(parent);
        }
        break;
      case "Escape":
        void api.hidePicker();
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  const activeKey = active?.key;
  useEffect(() => {
    if (activeKey) document.getElementById(rowId(activeColumn, activeKey))?.scrollIntoView?.({ block: "nearest" });
  }, [activeColumn, activeKey]);

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
  const hasOptions = !body && rows.length > 0;
  const mainPlacement = placements[0];

  function renderRows(column: number) {
    return rowsOf(column).map((row) => (
      <PickerRow
        key={row.key}
        id={rowId(column, row.key)}
        row={row}
        selected={column === activeColumn && row === activeRowOf(column)}
        opener={cascade && row.kind !== "snippet" && subs[column]?.place === placeOfRow(row)}
        onHover={(event) => hoverRow(column, row, event)}
        onClick={() => clickRow(column, row)}
      />
    ));
  }

  return (
    <div
      className={styles.root}
      // Clicar na área transparente, fora dos cartões, fecha o menu como clicar fora do recorte.
      onMouseDown={(event) => event.target === event.currentTarget && void api.hidePicker()}
    >
      <div
        id={columnId(0)}
        className={mergeClasses(styles.card, styles.main, mainPlacement?.hidden && styles.hidden)}
        style={mainPlacement ? cardStyle(mainPlacement) : { inset: 0 }}
        aria-hidden={mainPlacement?.hidden || undefined}
      >
        <div className={styles.search}>
          <Input
            ref={inputRef}
            className={styles.input}
            autoFocus
            role="combobox"
            aria-label="Buscar"
            aria-expanded
            aria-controls="picker-list"
            aria-activedescendant={hasOptions && active ? rowId(activeColumn, active.key) : undefined}
            placeholder="Buscar"
            contentBefore={<Search16Regular />}
            value={query}
            onChange={(_, data) => {
              setQuery(data.value);
              select(0, null);
              if (cascade) {
                closeAfter(0);
                setActiveColumn(0);
              }
            }}
            onKeyDown={onKeyDown}
          />
        </div>
        {folderId !== null && !term && library ? (
          <Button className={styles.back} appearance="subtle" icon={<ChevronLeft16Regular />} onClick={goBack}>
            {placeLabel(library.folders, folderId)}
          </Button>
        ) : (
          <div />
        )}
        <div id="picker-list" className={styles.list} role="listbox" aria-label="Textos">
          {body ?? renderRows(0)}
        </div>
        <div className={styles.hints}>
          {(cascade ? !body && !!active : hasOptions) && (
            <Caption1>
              <kbd className={styles.key}>Enter</kbd> colar
            </Caption1>
          )}
          {cascade
            ? !body &&
              !term &&
              active &&
              active.kind !== "snippet" && (
                <Caption1>
                  <kbd className={styles.key}>→</kbd> abrir pasta
                </Caption1>
              )
            : hasOptions &&
              !term && (
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
          {cascade && !term && activeColumn > 0 && (
            <Caption1>
              <kbd className={styles.key}>←</kbd> voltar
            </Caption1>
          )}
          <Caption1 className={styles.hintEnd}>
            <kbd className={styles.key}>Esc</kbd> fechar
          </Caption1>
        </div>
      </div>
      {cascade &&
        subs.map((sub, index) => {
          const column = index + 1;
          const placement = placements[column];
          if (!placement) return null;
          return (
            <div
              key={column}
              id={columnId(column)}
              className={mergeClasses(styles.card, styles.sub, placement.hidden && styles.hidden)}
              style={cardStyle(placement)}
              aria-hidden={placement.hidden || undefined}
            >
              <div
                className={styles.list}
                role="listbox"
                aria-label={library ? placeLabel(library.folders, sub.place) : undefined}
              >
                {rowsOf(column).length === 0 ? <Text className={styles.emptyFolder}>Pasta vazia.</Text> : renderRows(column)}
              </div>
            </div>
          );
        })}
    </div>
  );
}

export default Picker;
