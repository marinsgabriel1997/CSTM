// Edição do texto de um item do histórico do clipboard no cadastro. Segue o salvamento dos
// textos cadastrados (grava após uma pausa na digitação, ao trocar de item e ao perder o foco
// da janela), mas sem passar pelo `DraftStore`, que trata só de textos cadastrados.
import { useCallback, useEffect, useRef, useState } from "react";

import { api, errorMessage, type ClipboardDetail } from "./api";
import { SAVE_DELAY_MS, type SaveStatus } from "./drafts";

export type ClipSaveStatus = Extract<SaveStatus, "saved" | "pending" | "saving" | "invalid" | "error">;

export interface ClipEditing {
  detail: ClipboardDetail;
  /** Texto como está no editor. */
  text: string;
  status: ClipSaveStatus;
  error: string | null;
}

interface State extends ClipEditing {
  /** Último texto gravado. */
  saved: string;
}

/**
 * Carrega o item `clipId` (`null` = nenhum) e cuida da gravação do texto editado.
 * `editing` é `null` enquanto carrega ou se o item não existe mais.
 */
export function useClipEditing(clipId: number | null, onLoadError: (message: string) => void) {
  const [state, setState] = useState<State | null>(null);
  // Sempre o estado mais recente, para gravar sem depender de uma renderização.
  const latest = useRef<State | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const saving = useRef(false);
  // `save` agendando a si mesmo depois de uma edição feita durante a gravação.
  const saveLater = useRef<() => void>(() => undefined);

  const update = useCallback((next: State | null) => {
    latest.current = next;
    setState(next);
  }, []);

  const save = useCallback(async () => {
    clearTimeout(timer.current);
    const current = latest.current;
    if (!current || saving.current || current.detail.kind !== "text") return;
    if (current.text.trim() === "" || current.text === current.saved) return;
    const { id } = current.detail;
    const sent = current.text;
    saving.current = true;
    update({ ...current, status: "saving", error: null });
    try {
      await api.updateClipboardItem(id, sent);
      saving.current = false;
      const now = latest.current;
      if (now?.detail.id !== id) return;
      // Gravar descarta a formatação que veio junto.
      const detail = { ...now.detail, formatted: false };
      update({ ...now, detail, saved: sent, status: now.text === sent ? "saved" : "pending", error: null });
      if (now.text !== sent) timer.current = setTimeout(() => saveLater.current(), SAVE_DELAY_MS);
    } catch (reason) {
      saving.current = false;
      const now = latest.current;
      if (now?.detail.id === id) update({ ...now, status: "error", error: errorMessage(reason) });
    }
  }, [update]);

  useEffect(() => {
    saveLater.current = () => void save();
  }, [save]);

  useEffect(() => {
    if (clipId === null) return;
    let current = true;
    api.getClipboardItem(clipId).then(
      (detail) => {
        if (!current) return;
        const text = detail.text ?? "";
        update({ detail, text, saved: text, status: "saved", error: null });
      },
      (reason) => {
        if (current) onLoadError(errorMessage(reason));
      },
    );
    return () => {
      current = false;
      // Ao sair do item, o que estiver pendente é gravado.
      void save();
    };
  }, [clipId, onLoadError, save, update]);

  useEffect(() => {
    const flush = () => void save();
    window.addEventListener("blur", flush);
    return () => window.removeEventListener("blur", flush);
  }, [save]);

  const edit = useCallback(
    (text: string) => {
      const current = latest.current;
      if (!current) return;
      clearTimeout(timer.current);
      const empty = text.trim() === "";
      const status: ClipSaveStatus = saving.current ? "saving" : empty ? "invalid" : text === current.saved ? "saved" : "pending";
      update({ ...current, text, status, error: null });
      if (!empty && text !== current.saved) timer.current = setTimeout(() => saveLater.current(), SAVE_DELAY_MS);
    },
    [update],
  );

  /** Esquece as alterações pendentes (o item vai para a lixeira ou foi excluído). */
  const discard = useCallback(() => {
    clearTimeout(timer.current);
    const current = latest.current;
    if (current) update({ ...current, text: current.saved, status: "saved", error: null });
  }, [update]);

  const editing: ClipEditing | null = state && state.detail.id === clipId ? state : null;
  return { editing, edit, retry: save, flush: save, discard };
}
