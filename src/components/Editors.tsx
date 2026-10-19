import {
  Badge,
  Button,
  makeStyles,
  mergeClasses,
  MessageBar,
  MessageBarActions,
  MessageBarBody,
  MessageBarTitle,
  Text,
  ToggleButton,
  Tooltip,
  tokens,
} from "@fluentui/react-components";
import {
  ArrowClockwise16Regular,
  ChevronRight12Regular,
  Delete20Regular,
  DocumentAdd20Regular,
  FolderAdd20Regular,
  Star20Filled,
  Star20Regular,
  Warning16Regular,
} from "@fluentui/react-icons";
import { useState, type ReactNode, type RefObject } from "react";

import type { ActionKey, ItemAction } from "../actions";
import type { Folder } from "../api";
import type { ClipEditing } from "../clipEditing";
import { copiedAtLabel } from "../clipboardHistory";
import type { SaveStatus } from "../drafts";
import type { FolderContents } from "../tree";
import { ItemMenuButton } from "./ItemMenu";

const useStyles = makeStyles({
  editor: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    minHeight: 0,
    height: "100%",
  },
  head: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXS,
    flex: "none",
    height: "48px",
    paddingLeft: "24px",
    paddingRight: tokens.spacingHorizontalM,
  },
  crumbs: {
    display: "flex",
    alignItems: "center",
    gap: "2px",
    minWidth: 0,
    flex: 1,
    color: tokens.colorNeutralForeground2,
  },
  crumb: { minWidth: 0, fontWeight: tokens.fontWeightRegular },
  crumbSeparator: { flex: "none", color: tokens.colorNeutralForeground3 },
  root: { color: tokens.colorNeutralForeground3, paddingLeft: "4px" },
  badge: { marginLeft: tokens.spacingHorizontalS },
  favoriteOn: { color: tokens.colorPaletteMarigoldForeground1 },
  error: { marginLeft: "28px", marginRight: "28px", marginBottom: tokens.spacingVerticalS, flex: "none" },
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
  // Título e conteúdo editados diretamente, sem caixas nem rótulos.
  title: {
    flex: "none",
    width: "100%",
    padding: "4px 0 6px",
    border: "none",
    outline: "none",
    background: "transparent",
    color: tokens.colorNeutralForeground1,
    fontFamily: tokens.fontFamilyBase,
    fontSize: "28px",
    fontWeight: tokens.fontWeightSemibold,
    lineHeight: "1.25",
    "::placeholder": { color: tokens.colorNeutralForeground4 },
  },
  rule: {
    flex: "none",
    height: "1px",
    marginTop: "6px",
    marginBottom: "14px",
    backgroundColor: tokens.colorNeutralStroke2,
  },
  content: {
    flex: 1,
    minHeight: "120px",
    width: "100%",
    padding: 0,
    border: "none",
    outline: "none",
    resize: "none",
    background: "transparent",
    color: tokens.colorNeutralForeground1,
    fontFamily: tokens.fontFamilyBase,
    fontSize: "15px",
    lineHeight: "1.65",
    "::placeholder": { color: tokens.colorNeutralForeground4 },
  },
  hint: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    flex: "none",
    marginBottom: "6px",
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorStatusWarningForeground1,
  },
  meta: { color: tokens.colorNeutralForeground2, marginTop: 0, marginBottom: "18px" },
  usage: {
    flex: "none",
    margin: 0,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
  folderActions: { display: "flex", gap: tokens.spacingHorizontalS },
  clipInfo: { flex: "none", marginBottom: tokens.spacingVerticalS },
  clipImage: {
    display: "block",
    maxWidth: "100%",
    maxHeight: "100%",
    objectFit: "contain",
    alignSelf: "flex-start",
    minHeight: 0,
  },
  welcome: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    maxWidth: "640px",
    paddingLeft: "64px",
    paddingRight: "64px",
    paddingBottom: "40px",
  },
  welcomeTitle: {
    margin: "0 0 8px",
    fontSize: "28px",
    fontWeight: tokens.fontWeightSemibold,
  },
  welcomeText: { margin: "0 0 24px", color: tokens.colorNeutralForeground2, lineHeight: "1.55" },
  steps: { display: "grid", gap: "14px", margin: 0, padding: 0, listStyle: "none" },
  step: { display: "flex", gap: tokens.spacingHorizontalM, alignItems: "flex-start" },
  stepNumber: {
    width: "26px",
    height: "26px",
    flex: "none",
    display: "grid",
    placeItems: "center",
    borderRadius: "50%",
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    backgroundColor: tokens.colorBrandBackground2,
  },
  stepTitle: { display: "block", fontWeight: tokens.fontWeightSemibold, marginBottom: "2px" },
  stepText: { color: tokens.colorNeutralForeground2, fontSize: tokens.fontSizeBase200 },
  placeholder: {
    flex: 1,
    display: "grid",
    placeItems: "center",
    color: tokens.colorNeutralForeground3,
  },
});

interface BreadcrumbsProps {
  path: Folder[];
  rootLabel: string;
  onSelectFolder: (id: number) => void;
  children?: ReactNode;
}

/** Caminho da pasta; cada parte seleciona a pasta na árvore. */
function Breadcrumbs({ path, rootLabel, onSelectFolder, children }: BreadcrumbsProps) {
  const styles = useStyles();
  return (
    <nav className={styles.crumbs} aria-label="Caminho">
      {path.length === 0 ? (
        <Text className={styles.root}>{rootLabel}</Text>
      ) : (
        path.map((folder, index) => (
          <span key={folder.id} style={{ display: "contents" }}>
            {index > 0 && <ChevronRight12Regular className={styles.crumbSeparator} />}
            <Button appearance="subtle" size="small" className={styles.crumb} onClick={() => onSelectFolder(folder.id)}>
              {folder.name}
            </Button>
          </span>
        ))
      )}
      {children}
    </nav>
  );
}

interface SnippetEditorProps {
  path: Folder[];
  title: string;
  content: string;
  status: SaveStatus;
  error: string | null;
  favorite: boolean;
  /** Quantas vezes o texto foi colado e quando, como "Usado 12 vezes · último uso em 10/10/2026". */
  usage: string;
  /** Texto novo ainda não gravado. */
  isNew: boolean;
  titleRef: RefObject<HTMLInputElement | null>;
  contentRef: RefObject<HTMLTextAreaElement | null>;
  actions: ItemAction[];
  onAction: (key: ActionKey) => void;
  onChange: (changes: { title?: string; content?: string }) => void;
  onSelectFolder: (id: number) => void;
  onToggleFavorite: () => void;
  onRetry: () => void;
}

export function SnippetEditor({
  path,
  title,
  content,
  status,
  error,
  favorite,
  usage,
  isNew,
  titleRef,
  contentRef,
  actions,
  onAction,
  onChange,
  onSelectFolder,
  onToggleFavorite,
  onRetry,
}: SnippetEditorProps) {
  const styles = useStyles();
  const invalid = status === "invalid";

  return (
    <section className={styles.editor} aria-label="Editor">
      <div className={styles.head}>
        <Breadcrumbs path={path} rootLabel="Sem pasta" onSelectFolder={onSelectFolder}>
          {isNew && (
            <Badge appearance="outline" color="informative" className={styles.badge}>
              Rascunho
            </Badge>
          )}
        </Breadcrumbs>
        <Tooltip content={isNew ? "Salve o texto para marcá-lo como favorito" : "Favorito"} relationship="description">
          <ToggleButton
            appearance="subtle"
            aria-label="Favorito"
            checked={favorite}
            disabled={isNew}
            icon={favorite ? <Star20Filled className={styles.favoriteOn} /> : <Star20Regular />}
            onClick={onToggleFavorite}
          />
        </Tooltip>
        <ItemMenuButton label="Ações do texto" actions={actions} onAction={onAction} />
      </div>

      {status === "error" && (
        <MessageBar intent="error" className={styles.error}>
          <MessageBarBody>
            <MessageBarTitle>Não foi possível salvar.</MessageBarTitle>
            Suas alterações continuam aqui e não foram perdidas. {error}
          </MessageBarBody>
          <MessageBarActions>
            <Button size="small" icon={<ArrowClockwise16Regular />} onClick={onRetry}>
              Tentar novamente
            </Button>
          </MessageBarActions>
        </MessageBar>
      )}

      <div className={styles.doc}>
        <input
          ref={titleRef}
          className={styles.title}
          aria-label="Título"
          placeholder="Sem título"
          value={title}
          onChange={(event) => onChange({ title: event.target.value })}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              contentRef.current?.focus();
            }
          }}
        />
        {!isNew && <p className={styles.usage}>{usage}</p>}
        {invalid && title.trim() === "" && (
          <div className={styles.hint}>
            <Warning16Regular /> O título é obrigatório. Enquanto estiver vazio, as alterações não são salvas.
          </div>
        )}
        <div className={styles.rule} />
        {invalid && content.trim() === "" && (
          <div className={styles.hint}>
            <Warning16Regular /> O conteúdo é obrigatório. Enquanto estiver vazio, as alterações não são salvas.
          </div>
        )}
        <textarea
          ref={contentRef}
          className={styles.content}
          aria-label="Conteúdo"
          placeholder="Escreva o texto que será colado…"
          value={content}
          onChange={(event) => onChange({ content: event.target.value })}
        />
      </div>
    </section>
  );
}

interface FolderEditorProps {
  folder: Folder;
  /** Pastas acima desta, da raiz até o pai. */
  path: Folder[];
  contents: FolderContents;
  actions: ItemAction[];
  onAction: (key: ActionKey) => void;
  onRename: (name: string) => void;
  onSelectFolder: (id: number) => void;
  onNewSnippet: () => void;
  onNewFolder: () => void;
}

function describe(contents: FolderContents): string {
  const { snippets, folders } = contents;
  if (snippets === 0 && folders === 0) return "Pasta vazia";
  const texts = `${snippets} ${snippets === 1 ? "texto" : "textos"}`;
  const subfolders =
    folders === 0 ? "nenhuma subpasta" : `${folders} ${folders === 1 ? "subpasta" : "subpastas"}`;
  return `${texts} · ${subfolders}`;
}

export function FolderEditor({
  folder,
  path,
  contents,
  actions,
  onAction,
  onRename,
  onSelectFolder,
  onNewSnippet,
  onNewFolder,
}: FolderEditorProps) {
  const styles = useStyles();
  // O nome em edição recomeça quando a pasta é renomeada por outro caminho.
  const [edited, setEdited] = useState<{ base: string; name: string } | null>(null);
  const name = edited?.base === folder.name ? edited.name : folder.name;

  function commit() {
    if (name.trim() !== "" && name !== folder.name) onRename(name);
    setEdited(null);
  }

  return (
    <section className={styles.editor} aria-label="Pasta">
      <div className={styles.head}>
        <Breadcrumbs path={path} rootLabel="Raiz" onSelectFolder={onSelectFolder} />
        <ItemMenuButton label="Ações da pasta" actions={actions} onAction={onAction} />
      </div>
      <div className={styles.doc}>
        <input
          className={styles.title}
          aria-label="Nome da pasta"
          value={name}
          onChange={(event) => setEdited({ base: folder.name, name: event.target.value })}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit();
            else if (event.key === "Escape") setEdited(null);
          }}
        />
        <p className={styles.meta}>{describe(contents)}</p>
        <div className={styles.folderActions}>
          <Button icon={<DocumentAdd20Regular />} onClick={onNewSnippet}>
            Novo texto aqui
          </Button>
          <Button icon={<FolderAdd20Regular />} onClick={onNewFolder}>
            Nova subpasta
          </Button>
        </div>
      </div>
    </section>
  );
}

interface ClipEditorProps {
  /** `null` enquanto o item carrega. */
  editing: ClipEditing | null;
  contentRef: RefObject<HTMLTextAreaElement | null>;
  onChange: (text: string) => void;
  onRetry: () => void;
  onDelete: () => void;
}

/** Item do histórico do clipboard: texto editável ou imagem só para ver. */
export function ClipEditor({ editing, contentRef, onChange, onRetry, onDelete }: ClipEditorProps) {
  const styles = useStyles();
  const detail = editing?.detail;
  const image = detail?.kind === "image";

  return (
    <section className={styles.editor} aria-label="Item do histórico">
      <div className={styles.head}>
        <Text className={styles.crumbs}>Histórico</Text>
        <Tooltip content="Excluir (Del)" relationship="description">
          <Button appearance="subtle" icon={<Delete20Regular />} onClick={onDelete}>
            Excluir
          </Button>
        </Tooltip>
      </div>

      {editing?.status === "error" && (
        <MessageBar intent="error" className={styles.error}>
          <MessageBarBody>
            <MessageBarTitle>Não foi possível salvar.</MessageBarTitle>
            Suas alterações continuam aqui e não foram perdidas. {editing.error}
          </MessageBarBody>
          <MessageBarActions>
            <Button size="small" icon={<ArrowClockwise16Regular />} onClick={onRetry}>
              Tentar novamente
            </Button>
          </MessageBarActions>
        </MessageBar>
      )}

      {editing && detail && (
        <div className={styles.doc}>
          <p className={styles.usage}>
            {copiedAtLabel(detail.copiedAt)}
            {image && ` · Imagem ${detail.width} × ${detail.height}`}
          </p>
          {!image && detail.formatted && (
            <MessageBar intent="info" className={styles.clipInfo}>
              <MessageBarBody>
                Editar remove a formatação que veio junto (negrito, links…); o texto continua.
              </MessageBarBody>
            </MessageBar>
          )}
          <div className={styles.rule} />
          {image ? (
            <img
              className={styles.clipImage}
              src={detail.image ?? undefined}
              alt={`Imagem ${detail.width} × ${detail.height}`}
            />
          ) : (
            <>
              {editing.status === "invalid" && (
                <div className={styles.hint}>
                  <Warning16Regular /> Um item do histórico não pode ficar vazio.
                </div>
              )}
              <textarea
                ref={contentRef}
                className={styles.content}
                aria-label="Conteúdo"
                value={editing.text}
                onChange={(event) => onChange(event.target.value)}
              />
            </>
          )}
        </div>
      )}
    </section>
  );
}

/** Pasta Histórico selecionada: sem nada a editar. */
export function HistoryPlaceholder() {
  const styles = useStyles();
  return (
    <section className={mergeClasses(styles.editor, styles.placeholder)} aria-label="Histórico">
      <Text>Selecione um item do histórico para ver ou editar o que foi copiado.</Text>
    </section>
  );
}

const STEPS = [
  ["Crie textos", "Saudações, assinaturas, respostas prontas, endereços."],
  ["Organize em pastas", "Agrupe por assunto e marque os mais usados como favoritos."],
  ["Cole com o atalho", "O menu de colagem abre junto ao cursor em qualquer programa."],
];

/** Apresentação exibida enquanto a biblioteca está vazia. */
export function Welcome() {
  const styles = useStyles();
  return (
    <section className={styles.welcome} aria-label="Boas-vindas">
      <h1 className={styles.welcomeTitle}>Bem-vindo ao CSTM</h1>
      <p className={styles.welcomeText}>
        Cadastre os textos que você digita toda hora e cole-os em qualquer programa pelo menu de colagem, sem sair do
        que está fazendo.
      </p>
      <ol className={styles.steps}>
        {STEPS.map(([title, text], index) => (
          <li key={title} className={styles.step}>
            <span className={styles.stepNumber}>{index + 1}</span>
            <div>
              <span className={styles.stepTitle}>{title}</span>
              <span className={styles.stepText}>{text}</span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function NoSelection() {
  const styles = useStyles();
  return (
    <section className={mergeClasses(styles.editor, styles.placeholder)} aria-label="Editor">
      <Text>Selecione um texto ou uma pasta na árvore.</Text>
    </section>
  );
}
