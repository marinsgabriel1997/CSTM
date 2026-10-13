// Salvamento automático dos textos editados. Cada texto alterado ganha um rascunho
// em memória que é gravado após uma pausa na digitação; rascunhos inválidos ou com
// erro ficam preservados até serem corrigidos, mesmo ao trocar de item.
import { api, errorMessage, type Snippet } from "./api";

export const SAVE_DELAY_MS = 800;

export type SaveStatus = "saved" | "pending" | "saving" | "draft" | "invalid" | "error";

interface Text {
  title: string;
  content: string;
}

export interface Draft extends Text {
  /** Id do texto; negativo enquanto o texto novo não foi gravado. */
  id: number;
  folderId: number | null;
  status: SaveStatus;
  error: string | null;
  /** Última versão gravada a partir deste rascunho; `null` se nunca foi gravado. */
  saved: Text | null;
}

/** Mesma regra do backend: título e conteúdo não podem ficar vazios após remover os espaços das bordas. */
export function isValid(text: Text): boolean {
  return text.title.trim() !== "" && text.content.trim() !== "";
}

function isEmpty(text: Text): boolean {
  return text.title.trim() === "" && text.content.trim() === "";
}

function isSaved(draft: Draft): boolean {
  return draft.saved !== null && draft.title === draft.saved.title && draft.content === draft.saved.content;
}

type SavedListener = (previousId: number, snippet: Snippet) => void;

export class DraftStore {
  private drafts = new Map<number, Draft>();
  private listeners = new Set<() => void>();
  private savedListeners = new Set<SavedListener>();
  private timers = new Map<number, ReturnType<typeof setTimeout>>();
  private inFlight = new Map<number, Promise<void>>();
  // Rascunhos alterados durante uma gravação: gravados de novo assim que ela termina.
  private rerun = new Set<number>();
  // Textos novos excluídos enquanto a primeira gravação estava em andamento.
  private removedInFlight = new Set<number>();
  // Id provisório -> definitivo, para edições que cheguem com o id antigo após a gravação.
  private aliases = new Map<number, number>();
  private nextDraftId = -1;
  private openId: number | null = null;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Mapa imutável: substituído a cada mudança, para uso com `useSyncExternalStore`. */
  getSnapshot = () => this.drafts;

  /** Avisa quando um texto é gravado; `previousId` é negativo na primeira gravação de um texto novo. */
  onSaved(listener: SavedListener) {
    this.savedListeners.add(listener);
    return () => {
      this.savedListeners.delete(listener);
    };
  }

  get(id: number): Draft | undefined {
    return this.drafts.get(this.resolve(id));
  }

  /** Id atual do texto, que muda na primeira gravação de um texto novo. */
  resolve(id: number): number {
    return this.aliases.get(id) ?? id;
  }

  /** Cria um texto novo, ainda não gravado, e devolve seu id provisório. */
  create(folderId: number | null): number {
    const id = this.nextDraftId--;
    this.put({ id, folderId, title: "", content: "", saved: null, error: null, status: "draft" });
    return id;
  }

  /** Aplica uma edição; `base` é o texto gravado, usado quando ainda não há rascunho. */
  edit(id: number, base: Snippet | undefined, changes: Partial<Text>) {
    id = this.resolve(id);
    const current =
      this.drafts.get(id) ??
      (base && {
        id,
        folderId: base.folderId,
        title: base.title,
        content: base.content,
        saved: { title: base.title, content: base.content },
        error: null,
        status: "saved" as const,
      });
    if (!current) return;
    // Uma nova edição descarta o erro anterior e tenta gravar de novo.
    this.put({ ...current, ...changes, error: null });
    this.schedule(id);
  }

  /** Marca o item aberto no editor; ao sair de um texto, ele é gravado imediatamente. */
  open(id: number | null) {
    if (id !== null) id = this.resolve(id);
    const previous = this.openId;
    this.openId = id;
    if (previous === null || previous === id) return;
    void this.flush(previous);
    this.release(previous);
  }

  /** Grava agora, sem esperar a pausa na digitação. */
  flush(id: number): Promise<void> {
    id = this.resolve(id);
    this.clearTimer(id);
    return this.save(id);
  }

  async flushAll(): Promise<void> {
    await Promise.all([...this.drafts.keys()].map((id) => this.flush(id)));
  }

  setFolder(id: number, folderId: number | null) {
    id = this.resolve(id);
    const draft = this.drafts.get(id);
    if (draft) this.put({ ...draft, folderId });
  }

  remove(id: number) {
    id = this.resolve(id);
    this.clearTimer(id);
    this.rerun.delete(id);
    if (id < 0 && this.inFlight.has(id)) this.removedInFlight.add(id);
    this.delete(id);
  }

  /** Há alterações que ainda não estão no banco (rascunho novo vazio não conta). */
  hasUnsaved(): boolean {
    return [...this.drafts.values()].some(
      (draft) => draft.status !== "saved" && !(draft.id < 0 && isEmpty(draft)),
    );
  }

  private schedule(id: number) {
    this.clearTimer(id);
    const draft = this.drafts.get(id);
    if (!draft || !isValid(draft) || isSaved(draft)) return;
    this.timers.set(
      id,
      setTimeout(() => {
        this.timers.delete(id);
        void this.save(id);
      }, SAVE_DELAY_MS),
    );
  }

  private clearTimer(id: number) {
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
  }

  private save(id: number): Promise<void> {
    const running = this.inFlight.get(id);
    if (running) {
      this.rerun.add(id);
      return running;
    }
    const draft = this.drafts.get(id);
    if (!draft || !isValid(draft) || isSaved(draft) || draft.error) return Promise.resolve();
    // O erro só é descartado por uma nova edição ou por `retry`; ver `edit`.
    const task = this.persist(draft);
    this.inFlight.set(id, task);
    this.put(draft);
    return task;
  }

  /** Tenta de novo a gravação que falhou. */
  retry(id: number): Promise<void> {
    id = this.resolve(id);
    const draft = this.drafts.get(id);
    if (draft) this.put({ ...draft, error: null });
    return this.flush(id);
  }

  private async persist(draft: Draft): Promise<void> {
    const { id } = draft;
    const sent: Text = { title: draft.title, content: draft.content };
    let snippet: Snippet;
    try {
      snippet =
        id < 0
          ? await api.createSnippet(draft.folderId, sent.title, sent.content)
          : await api.updateSnippet(id, sent.title, sent.content);
    } catch (reason) {
      this.inFlight.delete(id);
      this.rerun.delete(id);
      const current = this.drafts.get(id);
      if (current) this.put({ ...current, error: errorMessage(reason) });
      return;
    }
    this.inFlight.delete(id);

    if (this.removedInFlight.delete(id)) {
      await api.deleteSnippet(snippet.id).catch(() => undefined);
      return;
    }
    const current = this.drafts.get(id);
    if (!current) return;

    // Na primeira gravação, o texto novo passa a usar o id definitivo.
    if (snippet.id !== id) {
      this.aliases.set(id, snippet.id);
      this.clearTimer(id);
      this.delete(id, false);
      if (this.openId === id) this.openId = snippet.id;
    }
    this.put({ ...current, id: snippet.id, folderId: snippet.folderId, saved: sent });
    for (const listener of this.savedListeners) listener(id, snippet);

    if (this.rerun.delete(id)) {
      await this.save(snippet.id);
    } else {
      this.schedule(snippet.id);
    }
    this.release(snippet.id);
  }

  /** Descarta o rascunho de um item que não está aberto quando não há nada a preservar. */
  private release(id: number) {
    const draft = this.drafts.get(id);
    if (!draft || id === this.openId || this.inFlight.has(id)) return;
    if (draft.status === "saved" || (id < 0 && isEmpty(draft))) this.delete(id);
  }

  private put(draft: Draft) {
    const status: SaveStatus = this.inFlight.has(draft.id)
      ? "saving"
      : isSaved(draft)
        ? "saved"
        : draft.error
          ? "error"
          : !isValid(draft)
            ? draft.id < 0
              ? "draft"
              : "invalid"
            : "pending";
    this.drafts = new Map(this.drafts).set(draft.id, { ...draft, status });
    this.notify();
  }

  private delete(id: number, notify = true) {
    if (!this.drafts.has(id)) return;
    this.drafts = new Map(this.drafts);
    this.drafts.delete(id);
    if (notify) this.notify();
  }

  private notify() {
    for (const listener of this.listeners) listener();
  }
}
