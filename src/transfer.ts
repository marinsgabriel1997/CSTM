// Opções de importação e exportação e as notificações de resultado mostradas na janela.
import type { SkipReason, TransferSummary } from "./api";

export type ImportKind = "txt" | "folder" | "folderContents" | "json";
export type ExportFormat = "json" | "txt";

const SKIP_REASONS: Record<SkipReason, string> = {
  notTxt: "não é um arquivo .txt",
  empty: "está vazio",
  notUtf8: "não está em UTF-8",
  link: "é um atalho ou link",
  unreadable: "não pôde ser lido",
};

/** Arquivos ignorados listados no aviso; os demais são resumidos numa contagem. */
export const MAX_LISTED_SKIPS = 10;

export interface TransferNotice {
  intent: "success" | "error";
  title: string;
  details?: string;
  items?: string[];
}

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/** "12 textos e 3 pastas importados", com a concordância de número e gênero. */
function amount(summary: TransferSummary, verb: "importad" | "exportad"): string {
  const { snippets, folders } = summary;
  if (snippets === 0 && folders === 0) return `Nenhum texto ${verb}o`;
  const parts = [];
  if (snippets > 0) parts.push(plural(snippets, "texto", "textos"));
  if (folders > 0) parts.push(plural(folders, "pasta", "pastas"));
  const ending = snippets > 0 ? "o" : "a";
  return `${parts.join(" e ")} ${verb}${ending}${snippets + folders > 1 ? "s" : ""}`;
}

/** Aviso de importação concluída; `target` é o destino, como "Trabalho › E-mails" ou `null` (raiz). */
export function importNotice(summary: TransferSummary, target: string | null): TransferNotice {
  const notice: TransferNotice = {
    intent: "success",
    title: `${amount(summary, "importad")} ${target ? `em ${target}` : "na raiz"}.`,
  };
  const { skipped } = summary;
  if (skipped.length > 0) {
    notice.details = `${plural(skipped.length, "arquivo ignorado", "arquivos ignorados")}:`;
    notice.items = skipped.slice(0, MAX_LISTED_SKIPS).map((skip) => `${skip.path}: ${SKIP_REASONS[skip.reason]}`);
    if (skipped.length > MAX_LISTED_SKIPS) notice.items.push(`e mais ${skipped.length - MAX_LISTED_SKIPS}`);
  }
  return notice;
}

export function exportNotice(summary: TransferSummary): TransferNotice {
  return { intent: "success", title: `${amount(summary, "exportad")}.`, details: summary.path ?? undefined };
}

export function importFailure(message: string): TransferNotice {
  return { intent: "error", title: "Não foi possível importar.", details: `${capitalize(message)}. Nada foi importado.` };
}

export function exportFailure(message: string): TransferNotice {
  return { intent: "error", title: "Não foi possível exportar.", details: `${capitalize(message)}.` };
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
