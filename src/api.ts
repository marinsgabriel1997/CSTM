// Único ponto de acesso do frontend ao backend: cada função chama um comando Tauri.
// Em caso de falha, a promessa é rejeitada com a mensagem de erro do backend.
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

export interface Folder {
  id: number;
  parentId: number | null;
  name: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Snippet {
  id: number;
  folderId: number | null;
  title: string;
  content: string;
  favorite: boolean;
  useCount: number;
  lastUsedAt: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/** Posição de destino que coloca o item no fim da pasta (o backend limita ao fim). */
export const END = Number.MAX_SAFE_INTEGER;

export const api = {
  listFolders: () => invoke<Folder[]>("list_folders"),
  createFolder: (parentId: number | null, name: string) =>
    invoke<Folder>("create_folder", { parentId, name }),
  renameFolder: (id: number, name: string) => invoke<Folder>("rename_folder", { id, name }),
  deleteFolder: (id: number) => invoke<void>("delete_folder", { id }),
  moveFolder: (id: number, parentId: number | null, position: number) =>
    invoke<void>("move_folder", { id, parentId, position }),

  listSnippets: (folderId: number | null) => invoke<Snippet[]>("list_snippets", { folderId }),
  listAllSnippets: () => invoke<Snippet[]>("list_all_snippets"),
  listFavorites: () => invoke<Snippet[]>("list_favorites"),
  searchSnippets: (query: string) => invoke<Snippet[]>("search_snippets", { query }),
  createSnippet: (folderId: number | null, title: string, content: string) =>
    invoke<Snippet>("create_snippet", { folderId, title, content }),
  updateSnippet: (id: number, title: string, content: string) =>
    invoke<Snippet>("update_snippet", { id, title, content }),
  setFavorite: (id: number, favorite: boolean) =>
    invoke<Snippet>("set_favorite", { id, favorite }),
  deleteSnippet: (id: number) => invoke<void>("delete_snippet", { id }),
  moveSnippet: (id: number, folderId: number | null, position: number) =>
    invoke<void>("move_snippet", { id, folderId, position }),

  /**
   * Substitui o fechamento da janela por `onClose`: a janela nunca é fechada, pois o
   * aplicativo continua na bandeja. Devolve a função que remove o aviso.
   */
  onCloseRequested: async (onClose: () => void) =>
    getCurrentWindow().onCloseRequested((event) => {
      event.preventDefault();
      onClose();
    }),
  /** Avisa quando o usuário escolhe "Sair" na bandeja. Devolve a função que remove o aviso. */
  onQuitRequested: async (onQuit: () => void) => listen("quit-requested", () => onQuit()),
  hideWindow: () => getCurrentWindow().hide(),
  /** Mostra a janela, mesmo oculta ou minimizada, e lhe dá o foco. */
  showWindow: () => invoke<void>("show_main_window"),
  exitApp: () => invoke<void>("exit_app"),
  /** Mensagem de falha ao registrar o atalho do menu de colagem; `null` se ele está ativo. */
  shortcutError: () => invoke<string | null>("shortcut_error"),

  // Menu de colagem (janela `picker`).
  /** Avisa a cada abertura do menu. Devolve a função que remove o aviso. */
  onPickerOpened: async (onOpen: () => void) => listen("picker-opened", () => onOpen()),
  hidePicker: () => invoke<void>("hide_picker"),
  /** Entrega o texto escolhido no menu (copia para o clipboard) e fecha o menu. */
  chooseSnippet: (id: number) => invoke<void>("choose_snippet", { id }),
};

export type Api = typeof api;

export function errorMessage(error: unknown): string {
  return typeof error === "string" ? error : String(error);
}
