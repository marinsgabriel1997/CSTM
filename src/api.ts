// Único ponto de acesso do frontend ao backend: cada função chama um comando Tauri.
// Em caso de falha, a promessa é rejeitada com a mensagem de erro do backend.
import { getVersion } from "@tauri-apps/api/app";
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

/** Como um texto cadastrado é colado: sem marcação, como markdown (fonte), como rich text ou na sintaxe do Google Chat. */
export type PasteFormat = "plain" | "markdown" | "rich" | "chat";
/** O que fica no clipboard depois de colar: o texto colado ou o conteúdo anterior restaurado. */
export type AfterPaste = "keep" | "restore";

/** Páginas que ocupam a área do editor no cadastro. */
export type Page = "settings" | "help" | "about";

/** Tema das janelas: `system` segue o Windows. */
export type ThemeChoice = "system" | "light" | "dark";

/** Subcoluna aberta no menu de colagem, em pixels lógicos. */
export interface PickerSubcolumn {
  /** Altura que o conteúdo ocupa, sem rolagem. */
  contentHeight: number;
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

/** Item do histórico do clipboard, como aparece no menu de colagem (sem os dados completos). */
export interface ClipboardItem {
  id: number;
  kind: "text" | "image";
  /** Primeira linha não vazia do texto, ou "Imagem L × A". */
  title: string;
  /** Dica: o começo do texto, ou o título da imagem. */
  preview: string;
  /** Miniatura da imagem como `data:` URL. */
  thumbnail: string | null;
  width: number | null;
  height: number | null;
  /** Última cópia ou uso. */
  copiedAt: string;
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

/** Configuração da verificação de atualização. */
export interface UpdateSettings {
  enabled: boolean;
  intervalDays: number;
}

/** Resultado de "Verificar agora". */
export interface UpdateCheck {
  currentVersion: string;
  latestVersion: string;
  url: string;
  newer: boolean;
}

/** Versão mais nova publicada e a página da release. */
export interface AvailableUpdate {
  version: string;
  url: string;
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
  searchSnippets: (query: string, folderId?: number | null) =>
    invoke<Snippet[]>("search_snippets", { query, folderId: folderId ?? null }),
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
  /** Abre uma página a pedido da bandeja. Devolve a função que remove o aviso. */
  onPageRequested: async (onOpen: (page: Page) => void) =>
    listen<Page>("page-requested", (event) => onOpen(event.payload)),
  /** Se a Ajuda deve abrir sozinha: `true` só na primeira vez que é perguntado. */
  takeHelpPrompt: () => invoke<boolean>("take_help_prompt"),
  /** Versão do aplicativo instalado. */
  getVersion: () => getVersion(),
  /** Pasta onde ficam o banco e os demais dados. */
  getDataDir: () => invoke<string>("get_data_dir"),
  /** Abre o repositório do CSTM no navegador. */
  openRepository: () => invoke<void>("open_repository"),
  /** Abre a pasta dos dados no Explorer. */
  openDataFolder: () => invoke<void>("open_data_folder"),
  /** Tema escolhido nas Configurações; `system` enquanto nada foi escolhido. */
  getTheme: () => invoke<ThemeChoice>("get_theme"),
  /** Grava o tema; as duas janelas recebem `onThemeChanged`. */
  setTheme: (theme: ThemeChoice) => invoke<ThemeChoice>("set_theme", { theme }),
  /** Avisa a troca de tema em qualquer janela. Devolve a função que remove o aviso. */
  onThemeChanged: async (onChange: (theme: ThemeChoice) => void) =>
    listen<ThemeChoice>("theme-changed", (event) => onChange(event.payload)),
  /** Se o CSTM inicia com o Windows, conforme o registro (inclui o Gerenciador de Tarefas). */
  getAutostart: () => invoke<boolean>("get_autostart"),
  /** Liga ou desliga a inicialização com o Windows; devolve o estado resultante. */
  setAutostart: (enabled: boolean) => invoke<boolean>("set_autostart", { enabled }),

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
   * Posiciona as subcolunas abertas e recorta a janela do menu em volta das colunas
   * visíveis. Devolve a posição de cada coluna, a principal primeiro; a principal não
   * muda de lugar na tela.
   */
  layoutPicker: (columns: PickerSubcolumn[]) => invoke<PickerColumn[]>("layout_picker", { columns }),
  /** Modo de colagem padrão; `markdown` enquanto nada foi escolhido. Vale na próxima abertura do menu. */
  getPasteFormat: () => invoke<PasteFormat>("get_paste_format"),
  setPasteFormat: (format: PasteFormat) => invoke<PasteFormat>("set_paste_format", { format }),
  /** O que fica no clipboard depois da colagem; `keep` enquanto nada foi escolhido. */
  getAfterPaste: () => invoke<AfterPaste>("get_after_paste"),
  setAfterPaste: (value: AfterPaste) => invoke<AfterPaste>("set_after_paste", { value }),
  /** Fecha o menu e cola o texto escolhido no programa anterior; sem `format`, vale o modo padrão. */
  chooseSnippet: (id: number, format?: PasteFormat) => invoke<void>("choose_snippet", { id, format }),
  /** Fecha o menu e deixa o texto no clipboard, sem colar. Conta como uso. */
  copySnippet: (id: number) => invoke<void>("copy_snippet", { id }),

  // Histórico do clipboard.
  /** Itens do mais recente para o mais antigo. */
  listClipboardHistory: () => invoke<ClipboardItem[]>("list_clipboard_history"),
  /** Fecha o menu e cola o item (com todos os formatos) no programa anterior; o item sobe para o topo. */
  pasteClipboardItem: (id: number, format?: PasteFormat) => invoke<void>("paste_clipboard_item", { id, format }),
  /** Fecha o menu e deixa o item no clipboard, sem colar; o item sobe para o topo. */
  copyClipboardItem: (id: number, format?: PasteFormat) => invoke<void>("copy_clipboard_item", { id, format }),
  /** Apaga todos os itens e devolve quantos eram. */
  clearClipboardHistory: () => invoke<number>("clear_clipboard_history"),
  /** Se o histórico está ligado; ligado enquanto nada foi escolhido. */
  getClipboardMonitoring: () => invoke<boolean>("get_clipboard_monitoring"),
  /** Liga ou desliga o histórico na hora, sem apagar os itens; devolve o estado gravado. */
  setClipboardMonitoring: (enabled: boolean) => invoke<boolean>("set_clipboard_monitoring", { enabled }),
  /** Avisa quando o histórico muda. Devolve a função que remove o aviso. */
  onClipboardHistoryChanged: async (onChange: () => void) => listen("clipboard-history-changed", () => onChange()),

  // Verificação de atualização.
  /** Se a verificação em segundo plano está ligada e de quantos em quantos dias. */
  getUpdateSettings: () => invoke<UpdateSettings>("get_update_settings"),
  /** Grava a configuração e devolve o valor gravado, com o intervalo limitado a 1–90 dias. */
  setUpdateSettings: (enabled: boolean, intervalDays: number) =>
    invoke<UpdateSettings>("set_update_settings", { enabled, intervalDays }),
  /** Consulta o GitHub agora, mesmo com a verificação desligada; rejeita se a consulta falhar. */
  checkUpdateNow: () => invoke<UpdateCheck>("check_update_now"),
  /** Versão mais nova já encontrada, exceto a dispensada; `null` se não há. */
  getAvailableUpdate: () => invoke<AvailableUpdate | null>("get_available_update"),
  /** Esconde o aviso dessa versão; uma versão mais nova avisa de novo. */
  dismissUpdate: (version: string) => invoke<void>("dismiss_update", { version }),
  /** Abre a página da release no navegador. */
  openRelease: (url: string) => invoke<void>("open_release", { url }),
  /** Avisa quando a verificação encontra uma versão nova. Devolve a função que remove o aviso. */
  onUpdateAvailable: async (onAvailable: (update: AvailableUpdate) => void) =>
    listen<AvailableUpdate>("update-available", (event) => onAvailable(event.payload)),
};

export type Api = typeof api;

export function errorMessage(error: unknown): string {
  return typeof error === "string" ? error : String(error);
}
