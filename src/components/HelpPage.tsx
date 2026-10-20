import {
  Button,
  CounterBadge,
  makeStyles,
  MessageBar,
  MessageBarActions,
  MessageBarBody,
  mergeClasses,
  SearchBox,
  Subtitle2,
  Tab,
  TabList,
  Text,
  Title3,
  tokens,
} from "@fluentui/react-components";
import { ArrowDown20Regular, ArrowUp20Regular } from "@fluentui/react-icons";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { ADVANCED_SECTIONS, BASIC_STEPS, HELP_IMPORT_SECTION, HELP_IMPORT_TIP, HELP_INTRO } from "../helpContent";
import Page from "./Page";

const useStyles = makeStyles({
  // Fica parado no topo da área que rola (a Page). O fundo é o mesmo do painel do editor e a
  // margem negativa cobre o padding superior da Page, para o texto não aparecer por cima.
  header: {
    position: "sticky",
    top: 0,
    zIndex: 1,
    marginTop: `calc(-1 * ${tokens.spacingVerticalXXL})`,
    paddingTop: tokens.spacingVerticalXXL,
    marginBottom: tokens.spacingVerticalL,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  title: { marginBottom: tokens.spacingVerticalL },
  searchRow: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalXS, marginBottom: tokens.spacingVerticalS },
  searchBox: { flex: 1, minWidth: 0 },
  counter: {
    minWidth: "88px",
    textAlign: "end",
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase200,
    whiteSpace: "nowrap",
  },
  tabLabel: { display: "inline-flex", alignItems: "center", gap: tokens.spacingHorizontalXS },
  // Realce das ocorrências: tokens nos tons de amarelo, que se adaptam ao tema. A atual usa
  // amarelo forte e texto preto fixos, legíveis nos dois temas.
  hit: {
    backgroundColor: tokens.colorPaletteYellowBackground2,
    color: "inherit",
    borderRadius: "2px",
  },
  hitCurrent: { backgroundColor: "#FFB900", color: "#000000" },
  tip: { marginBottom: tokens.spacingVerticalL },
  intro: { display: "block", marginBottom: tokens.spacingVerticalM },
  steps: {
    listStyleType: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalM,
  },
  step: { display: "flex", gap: tokens.spacingHorizontalM, alignItems: "flex-start" },
  // minWidth 0 deixa a coluna encolher, para a imagem respeitar a largura disponível.
  stepBody: { flex: 1, minWidth: 0 },
  number: {
    flex: "none",
    width: "24px",
    height: "24px",
    display: "grid",
    placeItems: "center",
    borderRadius: tokens.borderRadiusCircular,
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
  },
  stepTitle: { display: "block", fontWeight: tokens.fontWeightSemibold },
  // O cabeçalho é sticky (título, busca e abas, cerca de 150px): sem a margem, a rolagem até a
  // seção a deixaria escondida sob ele.
  section: { marginBottom: tokens.spacingVerticalL, scrollMarginTop: "160px" },
  sectionTitle: { display: "block", marginBottom: tokens.spacingVerticalXS },
  paragraph: { display: "block", marginBottom: tokens.spacingVerticalS, color: tokens.colorNeutralForeground2 },
  // Só maxWidth: a imagem nunca amplia além do tamanho natural. As imagens são do tema claro;
  // a borda as separa do fundo escuro, sem inverter cores.
  image: {
    display: "block",
    maxWidth: "100%",
    height: "auto",
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalM,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusLarge,
  },
  // Cor fixa nos dois temas: é a mesma das marcações desenhadas nas imagens.
  marker: {
    display: "inline-grid",
    placeItems: "center",
    width: "18px",
    height: "18px",
    marginInline: "2px",
    verticalAlign: "1px",
    borderRadius: tokens.borderRadiusCircular,
    backgroundColor: "#D13438",
    color: "#FFFFFF",
    fontSize: "11px",
    fontWeight: tokens.fontWeightBold,
    lineHeight: 1,
  },
  key: {
    padding: `1px ${tokens.spacingHorizontalXS}`,
    fontFamily: "inherit",
    fontSize: tokens.fontSizeBase200,
    borderRadius: tokens.borderRadiusMedium,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke1}`,
    borderBottomWidth: tokens.strokeWidthThick,
    backgroundColor: tokens.colorNeutralBackground3,
  },
});

type HelpTab = "basic" | "advanced";

/** Remove acentos e maiúsculas, para a busca ignorá-los. */
function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** Posições das ocorrências de `query` (já normalizada) em `text`; vazio se a normalização mudar o tamanho. */
function findHits(text: string, query: string): number[] {
  if (!query) return [];
  const folded = fold(text);
  // Texto com acentos decompostos mudaria as posições; não ocorre nos textos da Ajuda.
  if (folded.length !== text.length) return [];
  const found: number[] = [];
  for (let at = folded.indexOf(query); at !== -1; at = folded.indexOf(query, at + query.length)) found.push(at);
  return found;
}

const MARKUP = /(\*\*[^*]+\*\*|`[^`]+`|\[\d\])/;

/** Trechos pesquisáveis de um texto com marcação, na ordem de exibição (sem as marcações [n]). */
function searchablePieces(text: string, shortcut: string): string[] {
  return text
    .replace(/{atalho}/g, shortcut)
    .split(MARKUP)
    .flatMap((part) => {
      if (part.startsWith("**")) return [part.slice(2, -2)];
      if (part.startsWith("`")) return [part.slice(1, -1)];
      return /^\[\d\]$/.test(part) ? [] : [part];
    });
}

/** Textos de cada aba, na ordem em que aparecem na tela. */
function tabTexts(tab: HelpTab): string[] {
  if (tab === "basic") return [HELP_IMPORT_TIP, HELP_INTRO, ...BASIC_STEPS.flatMap((step) => [step.title, step.text])];
  return ADVANCED_SECTIONS.flatMap((section) => [section.title, ...section.paragraphs]);
}

function countHits(tab: HelpTab, query: string, shortcut: string): number {
  return tabTexts(tab).reduce(
    (total, text) => total + searchablePieces(text, shortcut).reduce((sum, piece) => sum + findHits(piece, query).length, 0),
    0,
  );
}

/** Estado de realce de uma renderização: termo, ocorrência atual e contador global (na ordem do DOM). */
interface Highlighter {
  query: string;
  current: number;
  /** Reserva `count` índices globais e devolve o primeiro (as ocorrências são desenhadas na ordem do DOM). */
  take: (count: number) => number;
  currentRef: (element: HTMLElement | null) => void;
  hitClass: string;
  currentClass: string;
}

/** Divide o texto em partes com e sem correspondência, envolvendo as ocorrências em <mark>. */
function Highlighted({ text, highlighter }: { text: string; highlighter?: Highlighter }) {
  const positions = highlighter ? findHits(text, highlighter.query) : [];
  if (!highlighter || positions.length === 0) return <>{text}</>;
  const nodes: ReactNode[] = [];
  const first = highlighter.take(positions.length);
  let last = 0;
  for (const [position, at] of positions.entries()) {
    if (at > last) nodes.push(text.slice(last, at));
    const index = first + position;
    const isCurrent = index === highlighter.current;
    nodes.push(
      <mark
        key={at}
        ref={isCurrent ? highlighter.currentRef : undefined}
        className={isCurrent ? mergeClasses(highlighter.hitClass, highlighter.currentClass) : highlighter.hitClass}
      >
        {text.slice(at, at + highlighter.query.length)}
      </mark>,
    );
    last = at + highlighter.query.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return <>{nodes}</>;
}

/** Converte a marcação dos textos (negrito, tecla, {atalho} e marcações [n]) em elementos React, sem HTML bruto. */
function Marked({
  text,
  shortcut,
  keyClass,
  markerClass,
  highlighter,
}: {
  text: string;
  shortcut: string;
  keyClass: string;
  markerClass: string;
  highlighter?: Highlighter;
}) {
  const parts = text.replace(/{atalho}/g, shortcut).split(MARKUP);
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith("**")) {
          return (
            <strong key={index}>
              <Highlighted text={part.slice(2, -2)} highlighter={highlighter} />
            </strong>
          );
        }
        if (part.startsWith("`")) {
          return (
            <kbd key={index} className={keyClass}>
              <Highlighted text={part.slice(1, -1)} highlighter={highlighter} />
            </kbd>
          );
        }
        if (/^\[\d\]$/.test(part)) {
          const n = part.slice(1, -1);
          return (
            <span key={index} role="img" aria-label={`marcação ${n}`} className={markerClass}>
              {n}
            </span>
          );
        }
        return <Highlighted key={index} text={part} highlighter={highlighter} />;
      })}
    </>
  );
}

interface HelpPageProps {
  /** Atalho do menu de colagem, já formatado para exibição. */
  shortcut: string;
}

/** Página Ajuda: aba Básico (primeiros passos) e aba Avançado (demais funcionalidades), com busca nas duas. */
function HelpPage({ shortcut }: HelpPageProps) {
  const styles = useStyles();
  const [tab, setTab] = useState<HelpTab>("basic");
  const [query, setQuery] = useState("");
  // Índice global da ocorrência atual: as do Básico primeiro, depois as do Avançado.
  const [current, setCurrent] = useState(0);
  // Muda a cada digitação ou passo, para rolar até a ocorrência atual (a troca manual de aba não rola).
  const [scrollToken, setScrollToken] = useState(0);
  const currentElement = useRef<HTMLElement | null>(null);
  // Seção do Avançado a levar à vista depois que a aba abrir (vem da faixa do Básico).
  const sectionToShow = useRef<string | null>(null);
  const advancedPanel = useRef<HTMLDivElement | null>(null);

  const term = fold(query.trim());
  const counts = useMemo(
    () => ({ basic: countHits("basic", term, shortcut), advanced: countHits("advanced", term, shortcut) }),
    [term, shortcut],
  );
  const total = counts.basic + counts.advanced;
  const safeCurrent = current < total ? current : 0;

  useEffect(() => {
    // scrollIntoView não existe no jsdom.
    currentElement.current?.scrollIntoView?.({ block: "center" });
  }, [scrollToken]);

  useEffect(() => {
    if (!sectionToShow.current || tab !== "advanced") return;
    // scrollIntoView não existe no jsdom.
    advancedPanel.current?.querySelector(`[data-section="${sectionToShow.current}"]`)?.scrollIntoView?.({ block: "start" });
    sectionToShow.current = null;
  }, [tab]);

  const showImportSection = () => {
    setTab("advanced");
    sectionToShow.current = HELP_IMPORT_SECTION;
  };

  const changeQuery = (value: string) => {
    setQuery(value);
    const newTerm = fold(value.trim());
    const basic = countHits("basic", newTerm, shortcut);
    const advanced = countHits("advanced", newTerm, shortcut);
    // A primeira da aba aberta, se houver; senão, a primeira de todas.
    const index = tab === "advanced" && advanced > 0 ? basic : 0;
    setCurrent(index);
    if (basic + advanced > 0) setTab(index < basic ? "basic" : "advanced");
    setScrollToken((n) => n + 1);
  };

  const step = (delta: number) => {
    if (total === 0) return;
    const next = (safeCurrent + delta + total) % total;
    setCurrent(next);
    setTab(next < counts.basic ? "basic" : "advanced");
    setScrollToken((n) => n + 1);
  };

  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      step(event.shiftKey ? -1 : 1);
    } else if (event.key === "Escape" && query) {
      // Só limpa o termo; não deixa o Esc chegar a quem fecharia a página ou a janela.
      event.preventDefault();
      event.stopPropagation();
      changeQuery("");
    }
  };

  // Um contador novo por renderização, para numerar as ocorrências na ordem em que são desenhadas.
  const counter = { next: tab === "basic" ? 0 : counts.basic };
  const highlighter: Highlighter | undefined = term
    ? {
        query: term,
        current: safeCurrent,
        take: (count) => {
          const first = counter.next;
          counter.next += count;
          return first;
        },
        currentRef: (element) => {
          currentElement.current = element;
        },
        hitClass: styles.hit,
        currentClass: styles.hitCurrent,
      }
    : undefined;
  const marked = (text: string): ReactNode => (
    <Marked text={text} shortcut={shortcut} keyClass={styles.key} markerClass={styles.marker} highlighter={highlighter} />
  );
  const plain = (text: string): ReactNode => <Highlighted text={text} highlighter={highlighter} />;

  const tabLabel = (label: string, count: number) => (
    <span className={styles.tabLabel}>
      {label}
      {term && <CounterBadge count={count} showZero size="small" color={count > 0 ? "brand" : "informative"} />}
    </span>
  );

  // 2x: as capturas têm o dobro de pixels. Sem `src`, o navegador usa a candidata 2x e a mostra na
  // metade do tamanho; com `src`, ele seria a candidata 1x e a imagem apareceria ampliada.
  const image = (img: { src: string; alt: string }) => (
    <img className={styles.image} srcSet={`${img.src} 2x`} alt={img.alt} loading="lazy" />
  );

  return (
    <Page title="Ajuda" hideTitle>
      <div className={styles.header}>
        <Title3 as="h1" className={styles.title}>
          Ajuda
        </Title3>
        <div className={styles.searchRow}>
          <SearchBox
            className={styles.searchBox}
            placeholder="Buscar na Ajuda"
            aria-label="Buscar na Ajuda"
            value={query}
            onChange={(_, data) => changeQuery(data.value)}
            onKeyDown={onSearchKeyDown}
          />
          <span className={styles.counter} aria-live="polite">
            {term ? (total > 0 ? `${safeCurrent + 1} de ${total}` : "Nenhum resultado") : ""}
          </span>
          <Button
            appearance="subtle"
            icon={<ArrowUp20Regular />}
            aria-label="Anterior"
            title="Anterior (Shift+Enter)"
            disabled={total === 0}
            onClick={() => step(-1)}
          />
          <Button
            appearance="subtle"
            icon={<ArrowDown20Regular />}
            aria-label="Próxima"
            title="Próxima (Enter)"
            disabled={total === 0}
            onClick={() => step(1)}
          />
        </div>
        <TabList selectedValue={tab} onTabSelect={(_, data) => setTab(data.value as HelpTab)}>
          <Tab value="basic">{tabLabel("Básico", counts.basic)}</Tab>
          <Tab value="advanced">{tabLabel("Avançado", counts.advanced)}</Tab>
        </TabList>
      </div>
      {tab === "basic" ? (
        <div role="tabpanel" aria-label="Básico">
          <MessageBar intent="info" className={styles.tip}>
            <MessageBarBody>{plain(HELP_IMPORT_TIP)}</MessageBarBody>
            <MessageBarActions>
              <Button onClick={showImportSection}>Ver como importar</Button>
            </MessageBarActions>
          </MessageBar>
          <Text className={styles.intro}>{plain(HELP_INTRO)}</Text>
          <ol className={styles.steps}>
            {BASIC_STEPS.map((step, index) => (
              <li key={step.title} className={styles.step}>
                <span className={styles.number} aria-hidden>
                  {index + 1}
                </span>
                <div className={styles.stepBody}>
                  <Text className={styles.stepTitle}>{plain(step.title)}</Text>
                  <Text>{marked(step.text)}</Text>
                  {step.image && image(step.image)}
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <div role="tabpanel" aria-label="Avançado" ref={advancedPanel}>
          {ADVANCED_SECTIONS.map((section) => (
            <section key={section.title} className={styles.section} data-section={section.id}>
              <Subtitle2 as="h2" className={styles.sectionTitle}>
                {plain(section.title)}
              </Subtitle2>
              {section.paragraphs.map((paragraph) => (
                <Text key={paragraph} className={styles.paragraph}>
                  {marked(paragraph)}
                </Text>
              ))}
              {section.image && image(section.image)}
            </section>
          ))}
        </div>
      )}
    </Page>
  );
}

export default HelpPage;
