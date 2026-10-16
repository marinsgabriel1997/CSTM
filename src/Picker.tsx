import { Button, Caption1, Input, makeStyles, mergeClasses, Text, tokens } from "@fluentui/react-components";
import {
  Chat20Regular,
  ChevronLeft16Regular,
  ChevronRight16Regular,
  Copy16Regular,
  Dismiss16Regular,
  DocumentText20Regular,
  Fire20Regular,
  Folder20Regular,
  History20Regular,
  Markdown20Regular,
  Search16Regular,
  Star20Regular,
  TextClearFormatting20Regular,
  TextEditStyle20Regular,
} from "@fluentui/react-icons";
import {
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type ReactElement,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  api,
  type ClipboardItem,
  errorMessage,
  type Folder,
  type PasteFormat,
  type PickerColumn,
  type PickerNavigation,
  type Snippet,
} from "./api";
import { folderPath, siblingsOf, snippetsIn } from "./tree";

/** Altura mínima da linha, preenchimento vertical, altura de cada linha do título e linhas que cabem antes das reticências. */
const ROW_HEIGHT = 32;
const ROW_PADDING = 6;
const LABEL_LINE_HEIGHT = 20;
/** Altura do botão Copiar (e do espaço reservado para ele) nas linhas de item. */
const COPY_HEIGHT = 24;
const MAX_LABEL_LINES = 2;
/** Largura máxima da pasta/hora ao lado do título. */
const META_MAX_WIDTH = 120;

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
    // Uma linha de texto (20 px) mais o preenchimento dá 32 px (36 px nos itens, pelo botão Copiar);
    // com o título em 2 linhas a linha cresce.
    minHeight: `${ROW_HEIGHT}px`,
    paddingTop: `${ROW_PADDING}px`,
    paddingBottom: `${ROW_PADDING}px`,
    paddingLeft: tokens.spacingHorizontalS,
    paddingRight: tokens.spacingHorizontalS,
    borderRadius: tokens.borderRadiusMedium,
    cursor: "default",
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
  historyIcon: { color: tokens.colorCompoundBrandForeground1 },
  // Miniatura de uma imagem do histórico, no lugar do ícone.
  thumbnail: {
    flex: "none",
    width: "24px",
    height: "20px",
    objectFit: "contain",
    borderRadius: tokens.borderRadiusSmall,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground3,
  },
  // Título em até 2 linhas, com reticências só depois da segunda; `anywhere` quebra palavras sem espaço.
  label: {
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: String(MAX_LABEL_LINES),
    overflowWrap: "anywhere",
    lineHeight: `${LABEL_LINE_HEIGHT}px`,
  },
  meta: {
    flex: "none",
    maxWidth: `${META_MAX_WIDTH}px`,
    overflow: "hidden",
    textOverflow: "ellipsis",
    color: tokens.colorNeutralForeground3,
  },
  chevron: { flex: "none", color: tokens.colorNeutralForeground3 },
  // Botões de modo de colagem por cima do fim da linha selecionada, à esquerda do Copiar. Ficam fora do
  // fluxo do flex para a linha não mudar de altura nem refluir o título ao ser selecionada.
  modes: {
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    // Largura do Copiar (24 px) mais o espaço que sobra à direita dele (preenchimento da linha menos a margem negativa).
    right: `calc(24px + ${tokens.spacingHorizontalXS})`,
    display: "flex",
    alignItems: "center",
    backgroundColor: tokens.colorSubtleBackgroundSelected,
  },
  copy: { flex: "none", minWidth: "24px", height: `${COPY_HEIGHT}px`, marginRight: `calc(-1 * ${tokens.spacingHorizontalXS})` },
  // Reserva o lugar do botão Copiar nas linhas não selecionadas, para o título não refluir ao selecionar.
  copySpace: { flex: "none", width: "24px", height: `${COPY_HEIGHT}px`, marginRight: `calc(-1 * ${tokens.spacingHorizontalXS})` },
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
  /** Modo de colagem padrão dos textos cadastrados. */
  pasteFormat: PasteFormat;
  /** Histórico do clipboard; vazio com a opção desligada. */
  history: ClipboardItem[];
}

/** Pastas que só existem no menu, calculadas a cada abertura. */
type Virtual = "history" | "most-used" | "favorites";

/** Quantos textos a pasta Mais usados mostra. */
const MOST_USED_LIMIT = 10;

const VIRTUAL_NAMES: Record<Virtual, string> = { history: "Histórico", "most-used": "Mais usados", favorites: "Favoritos" };

/** Pasta aberta no menu: a raiz (`null`), uma pasta do cadastro ou uma pasta virtual. */
type Place = number | Virtual | null;

type Row =
  | { kind: "folder"; key: string; folder: Folder }
  | { kind: "virtual"; key: string; virtual: Virtual }
  | { kind: "snippet"; key: string; snippet: Snippet; folderName?: string; tip: string }
  | { kind: "clip"; key: string; item: ClipboardItem };

type SnippetRow = Extract<Row, { kind: "snippet" }>;

/** Linhas que colam ao serem escolhidas: textos cadastrados e itens do histórico. */
type ItemRow = Extract<Row, { kind: "snippet" | "clip" }>;

const isItem = (row: Row | undefined): row is ItemRow => row?.kind === "snippet" || row?.kind === "clip";

const itemTitle = (row: ItemRow) => (row.kind === "snippet" ? row.snippet.title : row.item.title);

/** Hora da cópia; de outro dia, "ontem" ou a data. */
function copiedLabel(iso: string, now = new Date()): string {
  const copied = new Date(iso);
  const day = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const pad = (value: number) => String(value).padStart(2, "0");
  const days = Math.round((day(now) - day(copied)) / 86_400_000);
  if (days === 0) return `${pad(copied.getHours())}:${pad(copied.getMinutes())}`;
  if (days === 1) return "ontem";
  return `${pad(copied.getDate())}/${pad(copied.getMonth() + 1)}`;
}

/** Subcoluna aberta na cascata, com o que o backend precisa para posicioná-la. */
interface OpenColumn {
  place: number | Virtual;
  /** Altura do conteúdo, sem rolagem. */
  contentHeight: number;
  /** Texto do campo de busca da coluna; vazio mostra a pasta inteira. */
  query: string;
}

/** Margem da lista (preenchimento e bordas do cartão). */
const LIST_MARGIN = 10;
/** Altura da subcoluna que só mostra "Pasta vazia.". */
const EMPTY_HEIGHT = 56;
/** Altura do campo de busca da subcoluna: o campo pequeno (24 px), o preenchimento (2 × 8 px) e a borda. */
const SEARCH_HEIGHT = 41;

/**
 * Largura média de um caractere do título (Segoe UI 14 px). A subcoluna só é montada depois de o backend
 * posicioná-la, então a altura não pode ser medida no DOM: é estimada simulando a quebra do título.
 */
const CHAR_WIDTH = 7;
/** Largura média de um caractere da pasta/hora (12 px). */
const META_CHAR_WIDTH = 6;
/** Largura lógica das subcolunas (`SUB_WIDTH` no backend). */
const SUB_WIDTH = 380;
/** Bordas do cartão, preenchimento da lista e da linha, ícone e espaço depois dele. */
const SUB_ROW_CHROME = 2 + 8 + 16 + 20 + 8;
/** Chevron das pastas e espaço antes dele. */
const CHEVRON_WIDTH = 16 + 8;
/** Botão Copiar (sempre reservado nos itens) e espaço antes dele. */
const COPY_WIDTH = 24 - 4 + 8;

/** Linhas que o título ocupa em `width` px, limitadas a `MAX_LABEL_LINES`: quebra nos espaços e, numa palavra maior que a linha, em qualquer ponto. */
function labelLines(title: string, width: number): number {
  const perLine = Math.max(1, Math.floor(width / CHAR_WIDTH));
  let lines = 1;
  let used = 0;
  for (const word of title.split(/\s+/).filter(Boolean)) {
    if (word.length > perLine) {
      if (used > 0) lines += 1;
      lines += Math.floor((word.length - 1) / perLine);
      used = word.length % perLine || perLine;
    } else if (used === 0) {
      used = word.length;
    } else if (used + 1 + word.length <= perLine) {
      used += 1 + word.length;
    } else {
      lines += 1;
      used = word.length;
    }
    if (lines >= MAX_LABEL_LINES) return MAX_LABEL_LINES;
  }
  return lines;
}

/**
 * Altura estimada de uma linha de subcoluna: o título em `lines` linhas ou, nas linhas de item, o botão Copiar
 * (o que for maior), com o preenchimento. Pastas, com o chevron de 16 px, ficam no piso `ROW_HEIGHT`.
 */
function estimateRowHeight(row: Row): number {
  let title: string;
  if (row.kind === "folder") title = row.folder.name;
  else if (row.kind === "virtual") title = VIRTUAL_NAMES[row.virtual];
  else title = itemTitle(row);
  const meta = row.kind === "snippet" ? row.folderName : row.kind === "clip" ? copiedLabel(row.item.copiedAt) : undefined;
  let trailing = isItem(row) ? COPY_WIDTH : CHEVRON_WIDTH;
  if (meta) trailing += Math.min(META_MAX_WIDTH, meta.length * META_CHAR_WIDTH) + 8;
  const lines = labelLines(title, SUB_WIDTH - SUB_ROW_CHROME - trailing);
  const content = Math.max(lines * LABEL_LINE_HEIGHT, isItem(row) ? COPY_HEIGHT : 0);
  return Math.max(ROW_HEIGHT, content + 2 * ROW_PADDING);
}

/** Altura do conteúdo de uma subcoluna, sem rolagem. */
function subColumnContentHeight(rows: Row[]): number {
  const list = rows.length > 0 ? rows.reduce((sum, row) => sum + estimateRowHeight(row), 0) + LIST_MARGIN : EMPTY_HEIGHT;
  return SEARCH_HEIGHT + list;
}

const folderKey = (place: number | Virtual) => `folder-${place}`;
const columnId = (column: number) => `picker-column-${column}`;
const rowId = (column: number, key: string) => `picker-${column}-${key}`;
const listId = (column: number) => (column === 0 ? "picker-list" : `picker-list-${column}`);

const placeOfRow = (row: Row): number | Virtual | null =>
  row.kind === "folder" ? row.folder.id : row.kind === "virtual" ? row.virtual : null;

/** Textos mais colados, do mais para o menos usado; empates pelo uso mais recente. */
function mostUsed(snippets: Snippet[]): Snippet[] {
  return snippets
    .filter((snippet) => snippet.useCount > 0)
    .sort((a, b) => b.useCount - a.useCount || (b.lastUsedAt ?? "").localeCompare(a.lastUsedAt ?? "") || a.id - b.id)
    .slice(0, MOST_USED_LIMIT);
}

const filterKey = (place: number | Virtual, term: string) => `${place}|${term}`;

/** Linhas de uma subcoluna: a pasta inteira ou, com texto no campo, só o que bate com ele. */
function subRows(library: Library | null, sub: OpenColumn, found: { key: string; list: Snippet[] } | undefined): Row[] {
  const term = sub.query.trim();
  const rows = contentRows(library, sub.place);
  if (!term || !library) return rows;
  if (sub.place === "history") {
    return rows.filter((row) => row.kind === "clip" && matchesHistory(row.item, term));
  }
  // Enquanto a resposta não chega, a lista fica vazia.
  if (found?.key !== filterKey(sub.place, term)) return [];
  if (typeof sub.place === "number") {
    return found.list.map((snippet) => {
      const row = snippetWithFolder(library.folders, snippet, "filter");
      // Na pasta da própria coluna, a pasta de cada texto não informa nada.
      return snippet.folderId === sub.place ? { ...row, folderName: undefined } : row;
    });
  }
  // Favoritos e Mais usados: os textos da lista, na ordem da busca.
  const byId = new Map(rows.flatMap((row) => (row.kind === "snippet" ? [[row.snippet.id, row] as const] : [])));
  return found.list.flatMap((snippet) => byId.get(snippet.id) ?? []);
}

function pathLabel(folders: Folder[], folderId: number | null): string {
  return folderPath(folders, folderId)
    .map((folder) => folder.name)
    .join(" › ");
}

/** Minúsculas e sem acentos, como a busca do backend. */
const normalizeText = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Todos os termos devem ser prefixo de alguma palavra do título ou da prévia. */
function matchesHistory(item: ClipboardItem, term: string): boolean {
  const terms = normalizeText(term).split(/\s+/).filter(Boolean);
  const words = normalizeText(`${item.title} ${item.preview}`).split(/[^\p{L}\p{N}]+/u);
  return terms.every((wanted) => words.some((word) => word.startsWith(wanted)));
}

/** Nome curto da pasta, usado no campo de busca da coluna. */
function placeName(folders: Folder[], place: number | Virtual): string {
  return typeof place === "number" ? (folders.find((folder) => folder.id === place)?.name ?? "") : VIRTUAL_NAMES[place];
}

function placeLabel(folders: Folder[], place: number | Virtual): string {
  return typeof place === "number" ? pathLabel(folders, place) : VIRTUAL_NAMES[place];
}

/** Dica nativa de um texto: título, caminho (quando a lista mistura pastas) e conteúdo, separados por linha em branco. */
const snippetTip = (snippet: Snippet, path?: string) =>
  [snippet.title, path, snippet.content].filter((part) => part !== undefined && part !== "").join("\n\n");

/** Textos de várias pastas (busca, Mais usados, Favoritos) mostram a pasta de cada um. */
function snippetWithFolder(folders: Folder[], snippet: Snippet, prefix: string): SnippetRow {
  const path = pathLabel(folders, snippet.folderId);
  return {
    kind: "snippet",
    key: `${prefix}-${snippet.id}`,
    snippet,
    folderName: folders.find((folder) => folder.id === snippet.folderId)?.name,
    tip: snippetTip(snippet, path),
  };
}

/** Linhas de uma pasta: as pastas virtuais, as pastas e os textos da raiz, ou o conteúdo dela. */
function contentRows(library: Library | null, place: Place): Row[] {
  if (!library) return [];
  const { folders, snippets, favorites, history } = library;
  if (place === "history") return history.map((item): Row => ({ kind: "clip", key: `clip-${item.id}`, item }));
  if (place === "most-used") return mostUsed(snippets).map((snippet) => snippetWithFolder(folders, snippet, "most-used"));
  if (place === "favorites") return favorites.map((snippet) => snippetWithFolder(folders, snippet, "favorite"));
  const contents: Row[] = [
    ...siblingsOf(folders, place).map((folder): Row => ({ kind: "folder", key: folderKey(folder.id), folder })),
    ...snippetsIn(snippets, place).map(
      (snippet): Row => ({ kind: "snippet", key: `snippet-${snippet.id}`, snippet, tip: snippetTip(snippet) }),
    ),
  ];
  if (place !== null) return contents;
  // Na raiz, as pastas virtuais vêm primeiro e somem quando vazias.
  const virtuals: Row[] = [];
  if (history.length > 0) virtuals.push({ kind: "virtual", key: folderKey("history"), virtual: "history" });
  if (mostUsed(snippets).length > 0) virtuals.push({ kind: "virtual", key: folderKey("most-used"), virtual: "most-used" });
  if (favorites.length > 0) virtuals.push({ kind: "virtual", key: folderKey("favorites"), virtual: "favorites" });
  return [...virtuals, ...contents];
}

/** Modos de colagem oferecidos em botões, na ordem em que aparecem. */
const PASTE_MODES: { format: PasteFormat; title: string; icon: ReactElement }[] = [
  { format: "markdown", title: "Colar como markdown", icon: <Markdown20Regular /> },
  { format: "plain", title: "Colar sem formatação", icon: <TextClearFormatting20Regular /> },
  { format: "rich", title: "Colar formatado", icon: <TextEditStyle20Regular /> },
  { format: "chat", title: "Colar para o Google Chat", icon: <Chat20Regular /> },
];

interface PickerRowProps {
  id: string;
  row: Row;
  selected: boolean;
  /** Pasta cuja coluna está aberta ao lado. */
  opener?: boolean;
  onHover: (event: MouseEvent) => void;
  onClick: () => void;
  /** Modo de colagem padrão: nos textos cadastrados, os botões de modo oferecem os outros. */
  defaultFormat: PasteFormat;
  /** Cola o texto cadastrado ou do histórico no modo escolhido pelo botão. */
  onPasteAs: (format: PasteFormat) => void;
  /** Copia o texto sem colar; o botão aparece na linha de texto selecionada. */
  onCopy: () => void;
}

function PickerRow({ id, row, selected, opener, onHover, onClick, defaultFormat, onPasteAs, onCopy }: PickerRowProps) {
  const styles = useStyles();
  // Texto cadastrado: os modos além do padrão (Enter usa o padrão). Texto do histórico: todos, pois Enter cola o original.
  const modes =
    row.kind === "snippet"
      ? PASTE_MODES.filter(({ format }) => format !== defaultFormat)
      : row.kind === "clip" && row.item.kind === "text"
        ? PASTE_MODES
        : [];
  return (
    <div
      id={id}
      role="option"
      aria-selected={selected}
      className={mergeClasses(styles.row, selected ? styles.selected : opener && styles.opener)}
      title={row.kind === "snippet" ? row.tip : row.kind === "clip" ? row.item.preview : undefined}
      onMouseMove={onHover}
      // Mantém o foco no campo de busca ao clicar numa linha.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {row.kind === "folder" ? (
        <Folder20Regular className={mergeClasses(styles.icon, styles.folderIcon)} />
      ) : row.kind === "clip" && row.item.thumbnail ? (
        <img className={styles.thumbnail} src={row.item.thumbnail} alt="" />
      ) : row.kind === "virtual" ? (
        row.virtual === "history" ? (
          <History20Regular className={mergeClasses(styles.icon, styles.historyIcon)} />
        ) : row.virtual === "most-used" ? (
          <Fire20Regular className={mergeClasses(styles.icon, styles.mostUsedIcon)} />
        ) : (
          <Star20Regular className={mergeClasses(styles.icon, styles.folderIcon)} />
        )
      ) : (
        <DocumentText20Regular className={styles.icon} />
      )}
      <Text className={styles.label}>
        {row.kind === "folder" ? row.folder.name : row.kind === "virtual" ? VIRTUAL_NAMES[row.virtual] : itemTitle(row)}
      </Text>
      {row.kind === "snippet" && row.folderName && <Caption1 wrap={false} className={styles.meta}>{row.folderName}</Caption1>}
      {row.kind === "clip" && (
        <Caption1 wrap={false} className={styles.meta}>
          {copiedLabel(row.item.copiedAt)}
        </Caption1>
      )}
      {modes.length > 0 && selected && (
        <div className={styles.modes}>
          {modes.map(({ format, title, icon }) => (
            <Button
              key={format}
              size="small"
              appearance="subtle"
              icon={icon}
              aria-label={title}
              title={title}
              // O foco fica no campo de busca, como nas linhas.
              tabIndex={-1}
              onMouseDown={(event) => event.preventDefault()}
              onClick={(event) => {
                event.stopPropagation();
                onPasteAs(format);
              }}
            />
          ))}
        </div>
      )}
      {isItem(row) && !selected && <span className={styles.copySpace} />}
      {isItem(row) && selected && (
        <Button
          className={styles.copy}
          size="small"
          appearance="subtle"
          icon={<Copy16Regular />}
          aria-label={`Copiar ${itemTitle(row)}`}
          title="Copiar (Ctrl+C)"
          // O foco fica no campo de busca, como nas linhas.
          tabIndex={-1}
          onClick={(event) => {
            event.stopPropagation();
            onCopy();
          }}
        />
      )}
      {!isItem(row) && <ChevronRight16Regular className={styles.chevron} />}
    </div>
  );
}

/** Histórico mostrado no menu: nenhum item com a opção desligada. */
async function loadHistory(): Promise<ClipboardItem[]> {
  const [monitoring, history] = await Promise.all([api.getClipboardMonitoring(), api.listClipboardHistory()]);
  return monitoring ? history : [];
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
 * Menu de colagem: busca, histórico do clipboard, favoritos e pastas, para escolher um texto pelo teclado ou mouse.
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
  // Resultado da busca de cada subcoluna (pelo índice da coluna), com a pasta e o termo a que pertence.
  const [subFound, setSubFound] = useState<({ key: string; list: Snippet[] } | undefined)[]>([]);
  // Coluna cujo campo deve receber o foco depois da próxima renderização (um objeto novo a cada pedido).
  const [focusRequest, setFocusRequest] = useState<{ column: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const subInputs = useRef<(HTMLInputElement | null)[]>([]);
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
        setSubFound([]);
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
    Promise.all([
      api.listFolders(),
      api.listAllSnippets(),
      api.listFavorites(),
      api.getPickerNavigation(),
      api.getPasteFormat(),
      loadHistory(),
    ]).then(
      ([folders, snippets, favorites, navigation, pasteFormat, history]) =>
        current && setLibrary({ folders, snippets, favorites, navigation, pasteFormat, history }),
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

  // Uma cópia feita com o menu aberto atualiza o Histórico.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let disposed = false;
    api
      .onClipboardHistoryChanged(() => {
        loadHistory().then(
          (history) => !disposed && setLibrary((previous) => previous && { ...previous, history }),
          () => undefined,
        );
      })
      .then(
        (remove) => (disposed ? remove() : (unlisten = remove)),
        () => undefined,
      );
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

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

  // Busca de cada subcoluna com filtro numa pasta real ou em Favoritos/Mais usados.
  useEffect(() => {
    let current = true;
    subs.forEach((sub, index) => {
      const subTerm = sub.query.trim();
      if (!subTerm || sub.place === "history") return;
      const key = filterKey(sub.place, subTerm);
      api.searchSnippets(subTerm, typeof sub.place === "number" ? sub.place : undefined).then(
        (list) =>
          current &&
          setSubFound((previous) => {
            const next = [...previous];
            next[index + 1] = { key, list };
            return next;
          }),
        (reason) => current && setError(errorMessage(reason)),
      );
    });
    // Descarta respostas de uma busca anterior que cheguem fora de ordem.
    return () => {
      current = false;
    };
  }, [subs, version]);

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
    return [main, ...subs.map((sub, index) => subRows(library, sub, subFound[index + 1]))];
  }, [library, term, results, folderId, subs, subFound]);

  const rowsOf = (column: number) => columnRows[column] ?? [];
  const activeRowOf = (column: number) => {
    const rows = rowsOf(column);
    return rows.find((row) => row.key === selection[column]) ?? rows[0];
  };
  const rows = rowsOf(0);
  const active = activeRowOf(activeColumn);
  // Sem textos cadastrados, o histórico ainda aparece.
  const empty =
    library !== null && library.folders.length === 0 && library.snippets.length === 0 && library.history.length === 0;
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
      const placed = await api.layoutPicker(columns.map(({ contentHeight }) => ({ contentHeight })));
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
    const next: OpenColumn[] = [
      ...subs.slice(0, column),
      {
        place,
        contentHeight: subColumnContentHeight(contentRows(library, place)),
        query: "",
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
    // Entrar na coluna leva o teclado ao campo dela.
    setFocusRequest({ column: column + 1 });
  }

  /** Texto do campo de busca da coluna. */
  const queryOf = (column: number) => (column === 0 ? query : (subs[column - 1]?.query ?? ""));

  /** Muda o filtro de uma subcoluna: fecha as colunas à direita e seleciona o primeiro resultado. */
  function filterColumn(column: number, value: string) {
    closeAfter(column);
    setSubs((previous) => previous.map((sub, index) => (index === column - 1 ? { ...sub, query: value } : sub)));
    select(column, null);
    setActiveColumn(column);
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

  /** Escolhe a linha; sem `format`, vale o modo padrão do texto cadastrado ou o original do histórico. */
  function choose(column: number, row: Row, format?: PasteFormat) {
    if (row.kind === "snippet") {
      api.chooseSnippet(row.snippet.id, format).catch((reason) => setError(errorMessage(reason)));
    } else if (row.kind === "clip") {
      api.pasteClipboardItem(row.item.id, format).catch((reason) => setError(errorMessage(reason)));
    } else if (cascade) {
      void enterFolder(column, row);
    } else {
      openFolder(placeOfRow(row)!);
    }
  }

  /** Fecha o menu deixando o texto (ou o item do histórico) no clipboard, sem colar. */
  function copy(row: Row) {
    const copied =
      row.kind === "snippet"
        ? api.copySnippet(row.snippet.id)
        : row.kind === "clip"
          ? api.copyClipboardItem(row.item.id)
          : null;
    copied?.catch((reason) => setError(errorMessage(reason)));
  }

  function clickRow(column: number, row: Row) {
    if (isItem(row) || !cascade) {
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
    if (isItem(row)) {
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
    const blank = queryOf(activeColumn) === "";
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
          setFocusRequest({ column: parent });
        }
        break;
      case "Escape":
        void api.hidePicker();
        break;
      case "c":
      case "C": {
        // Com um trecho da busca selecionado, Ctrl+C copia o trecho, como em qualquer campo.
        const input = event.currentTarget;
        if (!event.ctrlKey || event.altKey || !isItem(row) || input.selectionStart !== input.selectionEnd) return;
        copy(row);
        break;
      }
      default:
        return;
    }
    event.preventDefault();
  }

  // Leva o foco ao campo pedido, que já existe depois da renderização.
  useEffect(() => {
    if (focusRequest) (focusRequest.column === 0 ? inputRef.current : subInputs.current[focusRequest.column])?.focus();
  }, [focusRequest]);

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

  /** A busca do filtro da coluna ainda não respondeu? */
  function subPending(sub: OpenColumn, column: number) {
    const subTerm = sub.query.trim();
    return subTerm !== "" && sub.place !== "history" && subFound[column]?.key !== filterKey(sub.place, subTerm);
  }

  function renderRows(column: number) {
    return rowsOf(column).map((row) => (
      <PickerRow
        key={row.key}
        id={rowId(column, row.key)}
        row={row}
        selected={column === activeColumn && row === activeRowOf(column)}
        opener={cascade && !isItem(row) && subs[column]?.place === placeOfRow(row)}
        onHover={(event) => hoverRow(column, row, event)}
        onClick={() => clickRow(column, row)}
        defaultFormat={library?.pasteFormat ?? "markdown"}
        onPasteAs={(format) => choose(column, row, format)}
        onCopy={() => copy(row)}
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
            aria-controls={listId(0)}
            aria-activedescendant={hasOptions && activeColumn === 0 && active ? rowId(activeColumn, active.key) : undefined}
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
            onFocus={() => setActiveColumn(0)}
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
        <div id={listId(0)} className={styles.list} role="listbox" aria-label="Textos">
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
              !isItem(active) && (
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
              <div className={styles.search}>
                <Input
                  ref={(element) => {
                    subInputs.current[column] = element;
                  }}
                  className={styles.input}
                  size="small"
                  role="combobox"
                  aria-label={library ? `Buscar em ${placeName(library.folders, sub.place)}` : "Buscar"}
                  aria-expanded
                  aria-controls={listId(column)}
                  aria-activedescendant={column === activeColumn && active ? rowId(column, active.key) : undefined}
                  placeholder={library ? `Buscar em ${placeName(library.folders, sub.place)}` : "Buscar"}
                  contentBefore={<Search16Regular />}
                  contentAfter={
                    sub.query !== "" ? (
                      <Button
                        size="small"
                        appearance="transparent"
                        icon={<Dismiss16Regular />}
                        aria-label="Limpar busca"
                        // O foco fica no campo, como nas linhas.
                        tabIndex={-1}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          filterColumn(column, "");
                          setFocusRequest({ column });
                        }}
                      />
                    ) : undefined
                  }
                  value={sub.query}
                  onChange={(_, data) => filterColumn(column, data.value)}
                  onFocus={() => setActiveColumn(column)}
                  onKeyDown={onKeyDown}
                />
              </div>
              <div
                id={listId(column)}
                className={styles.list}
                role="listbox"
                aria-label={library ? placeLabel(library.folders, sub.place) : undefined}
              >
                {rowsOf(column).length > 0 ? (
                  renderRows(column)
                ) : sub.query.trim() === "" ? (
                  <Text className={styles.emptyFolder}>Pasta vazia.</Text>
                ) : (
                  !subPending(sub, column) && <Text className={styles.emptyFolder}>Nenhum texto encontrado.</Text>
                )}
              </div>
            </div>
          );
        })}
    </div>
  );
}

export default Picker;
