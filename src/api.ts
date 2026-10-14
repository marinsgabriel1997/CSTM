// Único ponto de acesso do frontend ao backend: cada função chama um comando Tauri.
// Em caso de falha, a promessa é rejeitada com a mensagem de erro do backend.
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

import type { ItemRef } from "./actions";

export interface Folder {
  id: number;
  parentId: number | null;
  name: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/** Atalho configurado e se ele está registrado no Windows no momento. */
export interface ShortcutStatus {
  shortcut: string;
  registered: boolean;
}

/** Como as pastas se abrem no menu de colagem: ao passar o mouse (cascata) ou ao clicar. */
export type PickerNavigation = "cascade" | "click";

/** Subcoluna aberta no menu de colagem, em pixels lógicos. */
export interface PickerSubcolumn {
  /** Altura que o conteúdo ocupa, sem rolagem. */
  contentHeight: number;
  /** Distância do topo da linha da pasta ao topo da coluna anterior, já com a rolagem dela. */
  anchorY: number;
}

/** Posição de uma coluna, em pixels lógicos relativos ao canto superior esquerdo da janela. */
export interface PickerColumn {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Coberta por uma coluna mais nova: sai de vista até essa coluna fechar. */
  hidden: boolean;
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

/** Item na lixeira, com o lugar de onde saiu. */
export interface TrashItem {
  kind: ItemRef["kind"];
  id: number;
  name: string;
  /** Pastas onde o item estava, da raiz até o pai; vazio para a raiz. */
  path: string[];
  deletedAt: string;
  /** Subpastas e textos que voltam junto com uma pasta (zero para textos). */
  folders: number;
  snippets: number;
}

/** Motivo de um arquivo não ter sido importado. */
export type SkipReason = "notTxt" | "empty" | "notUtf8" | "link" | "unreadable";

/** Resultado de uma importação ou exportação. */
export interface TransferSummary {
  folders: number;
  snippets: number;
  /** Arquivos não importados, com o caminho relativo à pasta escolhida. */
  skipped: { path: string; reason: SkipReason }[];
  /** Pasta ou arquivo criado pela exportação. */
  path: string | null;
}

/** Posição de destino que coloca o item no fim da pasta (o backend limita ao fim). */
export const END = Number.MAX_SAFE_INTEGER;

export const api = {
  listFolders: () => invoke<Folder[]>("list_folders"),
  createFolder: (parentId: number | null, name: string) =>
    invoke<Folder>("create_folder", { parentId, name }),
  renameFolder: (id: number, name: string) => invoke<Folder>("rename_folder", { id, name }),
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

  // Operações sobre vários itens. Pastas levam todo o conteúdo.
  /** Move para a lixeira. */
  trashItems: (items: ItemRef[]) => invoke<void>("trash_items", { items }),
  /** Tira da lixeira, para o fim do grupo na pasta de origem (ou na raiz, se ela estiver na lixeira). */
  restoreItems: (items: ItemRef[]) => invoke<void>("restore_items", { items }),
  /** Exclui definitivamente. */
  deleteItems: (items: ItemRef[]) => invoke<void>("delete_items", { items }),
  emptyTrash: () => invoke<void>("empty_trash"),
  listTrash: () => invoke<TrashItem[]>("list_trash"),
  /** Copia para o fim do grupo em `parentId` e devolve as cópias; na mesma pasta, o nome ganha " - Cópia". */
  copyItems: (items: ItemRef[], parentId: number | null) => invoke<ItemRef[]>("copy_items", { items, parentId }),
  /**
   * Coloca as pastas e os textos em `parentId`, nessa ordem, movendo os que estão em outro lugar;
   * os demais itens do grupo ficam depois deles.
   */
  arrangeItems: (parentId: number | null, folderIds: number[], snippetIds: number[]) =>
    invoke<void>("arrange_items", { parentId, folderIds, snippetIds }),

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
  /** Abre o diálogo de configurações a pedido da bandeja. Devolve a função que remove o aviso. */
  onSettingsRequested: async (onOpen: () => void) => listen("settings-requested", () => onOpen()),

  // Atalho do menu de colagem, no formato do plugin de atalhos (`Alt+KeyQ`).
  getShortcut: () => invoke<ShortcutStatus>("get_shortcut"),
  /** Troca o atalho; em falha (combinação inválida ou recusada), o anterior continua valendo. */
  setShortcut: (shortcut: string) => invoke<ShortcutStatus>("set_shortcut", { shortcut }),
  /** Desativa o atalho enquanto uma nova combinação é gravada. */
  suspendShortcut: () => invoke<ShortcutStatus>("suspend_shortcut"),
  resumeShortcut: () => invoke<ShortcutStatus>("resume_shortcut"),

  // Importação e exportação: cada uma abre o seletor do Windows e resolve com `null`
  // se ele for cancelado. `folderId` é o destino da importação (`null` = raiz); `items`
  // são os itens exportados (vazio = biblioteca inteira).
  importTxtFiles: (folderId: number | null) => invoke<TransferSummary | null>("import_txt_files", { folderId }),
  /** Com `includeRoot`, cria a própria pasta escolhida; sem ele, importa só o seu conteúdo. */
  importFolder: (folderId: number | null, includeRoot: boolean) =>
    invoke<TransferSummary | null>("import_folder", { folderId, includeRoot }),
  importJson: (folderId: number | null) => invoke<TransferSummary | null>("import_json", { folderId }),
  exportJson: (items: ItemRef[]) => invoke<TransferSummary | null>("export_json", { items }),
  exportTxt: (items: ItemRef[]) => invoke<TransferSummary | null>("export_txt", { items }),

  // Menu de colagem (janela `picker`).
  /** Avisa a cada abertura do menu, com a posição da coluna principal. Devolve a função que remove o aviso. */
  onPickerOpened: async (onOpen: (main: PickerColumn) => void) =>
    listen<PickerColumn>("picker-opened", (event) => onOpen(event.payload)),
  /** Avisa que o menu desenhou a raiz depois de abrir: só então a coluna principal aparece. */
  pickerReady: () => invoke<void>("picker_ready"),
  hidePicker: () => invoke<void>("hide_picker"),
  /** Navegação nas pastas; `cascade` enquanto nada foi escolhido. Vale na próxima abertura do menu. */
  getPickerNavigation: () => invoke<PickerNavigation>("get_picker_navigation"),
  setPickerNavigation: (navigation: PickerNavigation) =>
    invoke<PickerNavigation>("set_picker_navigation", { navigation }),
  /**
   * Redimensiona e move a janela do menu para conter a coluna principal e as subcolunas
   * abertas (sem subcolunas, volta ao tamanho de uma coluna). Devolve a posição de cada
   * coluna, a principal primeiro; a principal não muda de lugar na tela.
   */
  layoutPicker: (columns: PickerSubcolumn[]) => invoke<PickerColumn[]>("layout_picker", { columns }),
  /** Entrega o texto escolhido no menu (copia para o clipboard) e fecha o menu. */
  chooseSnippet: (id: number) => invoke<void>("choose_snippet", { id }),
};

export type Api = typeof api;

export function errorMessage(error: unknown): string {
  return typeof error === "string" ? error : String(error);
}
