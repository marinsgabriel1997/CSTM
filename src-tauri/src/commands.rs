//! Comandos Tauri expostos ao frontend. Apenas delegam aos módulos `db`, `picker`, `paste`,
//! `transfer`, `tray`, `theme`, `autostart` e `clipboard_history` (e ao `tauri-plugin-opener`,
//! para o link e a pasta do Sobre); os erros chegam ao
//! frontend como mensagens prontas para exibição.

use std::path::PathBuf;
use std::sync::{Mutex, MutexGuard, PoisonError};

use rusqlite::Connection;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_dialog::{DialogExt, FileDialogBuilder, FilePath};
use tauri_plugin_opener::OpenerExt;

use crate::autostart;
use crate::cascade::{PlacedColumn, Subcolumn};
use crate::clipboard::{self, Content, TextContent};
use crate::clipboard_history;
use crate::db::clipboard::{self as history, HistoryItem};
use crate::db::folders::{self, Folder};
use crate::db::items::{self, ItemRef, TrashItem};
use crate::db::settings::{self, AfterPaste};
use crate::db::snippets::{self, Snippet};
use crate::main_window;
use crate::markdown::{self, PasteFormat};
use crate::paste;
use crate::picker::{self, ShortcutStatus};
use crate::theme;
use crate::transfer::{self, Summary};
use crate::tray;

type Db<'a> = State<'a, Mutex<Connection>>;
type CommandResult<T> = Result<T, String>;

// Um pânico durante uma operação não deixa a conexão inconsistente: transações
// abertas são desfeitas ao serem descartadas. Por isso o envenenamento é ignorado.
fn lock<'a>(state: &'a Db) -> MutexGuard<'a, Connection> {
    state.lock().unwrap_or_else(PoisonError::into_inner)
}

fn respond<T>(result: crate::db::Result<T>) -> CommandResult<T> {
    result.map_err(|error| error.to_string())
}

#[tauri::command]
pub fn list_folders(state: Db) -> CommandResult<Vec<Folder>> {
    respond(folders::list_folders(&lock(&state)))
}

#[tauri::command]
pub fn create_folder(state: Db, parent_id: Option<i64>, name: String) -> CommandResult<Folder> {
    respond(folders::create_folder(&lock(&state), parent_id, &name))
}

#[tauri::command]
pub fn rename_folder(state: Db, id: i64, name: String) -> CommandResult<Folder> {
    respond(folders::rename_folder(&lock(&state), id, &name))
}

#[tauri::command]
pub fn move_folder(
    state: Db,
    id: i64,
    parent_id: Option<i64>,
    position: usize,
) -> CommandResult<()> {
    respond(folders::move_folder(
        &mut lock(&state),
        id,
        parent_id,
        position,
    ))
}

#[tauri::command]
pub fn list_snippets(state: Db, folder_id: Option<i64>) -> CommandResult<Vec<Snippet>> {
    respond(snippets::list_snippets(&lock(&state), folder_id))
}

#[tauri::command]
pub fn list_all_snippets(state: Db) -> CommandResult<Vec<Snippet>> {
    respond(snippets::list_all_snippets(&lock(&state)))
}

#[tauri::command]
pub fn list_favorites(state: Db) -> CommandResult<Vec<Snippet>> {
    respond(snippets::list_favorites(&lock(&state)))
}

#[tauri::command]
pub fn search_snippets(
    state: Db,
    query: String,
    folder_id: Option<i64>,
) -> CommandResult<Vec<Snippet>> {
    respond(snippets::search_snippets(&lock(&state), &query, folder_id))
}

#[tauri::command]
pub fn create_snippet(
    state: Db,
    folder_id: Option<i64>,
    title: String,
    content: String,
) -> CommandResult<Snippet> {
    respond(snippets::create_snippet(
        &lock(&state),
        folder_id,
        &title,
        &content,
    ))
}

#[tauri::command]
pub fn update_snippet(
    state: Db,
    id: i64,
    title: String,
    content: String,
) -> CommandResult<Snippet> {
    respond(snippets::update_snippet(
        &lock(&state),
        id,
        &title,
        &content,
    ))
}

#[tauri::command]
pub fn set_favorite(state: Db, id: i64, favorite: bool) -> CommandResult<Snippet> {
    respond(snippets::set_favorite(&lock(&state), id, favorite))
}

#[tauri::command]
pub fn delete_snippet(state: Db, id: i64) -> CommandResult<()> {
    respond(snippets::delete_snippet(&lock(&state), id))
}

#[tauri::command]
pub fn move_snippet(
    state: Db,
    id: i64,
    folder_id: Option<i64>,
    position: usize,
) -> CommandResult<()> {
    respond(snippets::move_snippet(
        &mut lock(&state),
        id,
        folder_id,
        position,
    ))
}

#[tauri::command]
pub fn trash_items(state: Db, items: Vec<ItemRef>) -> CommandResult<()> {
    respond(items::trash(&mut lock(&state), &items))
}

#[tauri::command]
pub fn restore_items(state: Db, items: Vec<ItemRef>) -> CommandResult<()> {
    respond(items::restore(&mut lock(&state), &items))
}

#[tauri::command]
pub fn delete_items(state: Db, items: Vec<ItemRef>) -> CommandResult<()> {
    respond(items::delete(&mut lock(&state), &items))
}

#[tauri::command]
pub fn empty_trash(state: Db) -> CommandResult<()> {
    respond(items::empty_trash(&mut lock(&state)))
}

#[tauri::command]
pub fn list_trash(state: Db) -> CommandResult<Vec<TrashItem>> {
    respond(items::list_trash(&lock(&state)))
}

#[tauri::command]
pub fn copy_items(
    state: Db,
    items: Vec<ItemRef>,
    parent_id: Option<i64>,
) -> CommandResult<Vec<ItemRef>> {
    respond(items::copy(&mut lock(&state), &items, parent_id))
}

#[tauri::command]
pub fn arrange_items(
    state: Db,
    parent_id: Option<i64>,
    folder_ids: Vec<i64>,
    snippet_ids: Vec<i64>,
) -> CommandResult<()> {
    respond(items::arrange(
        &mut lock(&state),
        parent_id,
        &folder_ids,
        &snippet_ids,
    ))
}

#[tauri::command]
pub fn show_main_window(app: AppHandle) {
    tray::show_main_window(&app);
}

#[tauri::command]
pub fn exit_app(app: AppHandle) {
    main_window::save(&app);
    app.exit(0);
}

#[tauri::command]
pub fn hide_picker(app: AppHandle) {
    picker::hide(&app);
}

#[tauri::command]
pub fn get_picker_navigation(state: Db) -> CommandResult<String> {
    respond(settings::get_navigation(&lock(&state)))
}

#[tauri::command]
pub fn set_picker_navigation(state: Db, navigation: String) -> CommandResult<String> {
    picker::change_navigation(&lock(&state), &navigation)
}

#[tauri::command]
pub fn layout_picker(app: AppHandle, columns: Vec<Subcolumn>) -> CommandResult<Vec<PlacedColumn>> {
    picker::layout(&app, &columns)
}

/// O menu desenhou a raiz depois de abrir: a coluna principal pode aparecer.
#[tauri::command]
pub fn picker_ready(app: AppHandle) {
    picker::ready(&app);
}

#[tauri::command]
pub fn get_paste_format(state: Db) -> CommandResult<PasteFormat> {
    respond(settings::get_paste_format(&lock(&state)))
}

/// Grava o modo de colagem padrão e devolve o valor gravado.
#[tauri::command]
pub fn set_paste_format(state: Db, format: PasteFormat) -> CommandResult<PasteFormat> {
    respond(settings::set_paste_format(&lock(&state), format))?;
    Ok(format)
}

#[tauri::command]
pub fn get_after_paste(state: Db) -> CommandResult<AfterPaste> {
    respond(settings::get_after_paste(&lock(&state)))
}

/// Grava o que fazer com o clipboard depois de colar e devolve o valor gravado.
#[tauri::command]
pub fn set_after_paste(state: Db, value: AfterPaste) -> CommandResult<AfterPaste> {
    respond(settings::set_after_paste(&lock(&state), value))?;
    Ok(value)
}

/// Configuração de restauração do clipboard; se não puder ser lida, a colagem mantém o item.
fn after_paste(state: &Db) -> AfterPaste {
    settings::get_after_paste(&lock(state)).unwrap_or_default()
}

/// Conteúdo do texto cadastrado convertido para o modo pedido (ou o padrão configurado).
fn snippet_content(state: &Db, id: i64, format: Option<PasteFormat>) -> CommandResult<Content> {
    let conn = lock(state);
    let snippet = respond(snippets::get_snippet(&conn, id))?;
    let format = match format {
        Some(format) => format,
        None => respond(settings::get_paste_format(&conn))?,
    };
    Ok(converted_content(&snippet.content, format))
}

/// Conteúdo a escrever no clipboard para o markdown convertido ao modo pedido.
fn converted_content(md: &str, format: PasteFormat) -> Content {
    let converted = markdown::convert(md, format);
    Content::Text(TextContent {
        text: converted.text,
        html: converted.html.as_deref().map(clipboard::html_format),
        rtf: None,
    })
}

/// Conteúdo do item do Histórico: o original sem `format`; com ele, os itens de texto
/// passam por markdown e são convertidos ao modo pedido. Imagens não têm modos.
fn history_content(state: &Db, id: i64, format: Option<PasteFormat>) -> CommandResult<Content> {
    let content = respond(history::get(&lock(state), id))?;
    Ok(match (format, content) {
        (Some(format), Content::Text(item)) => {
            let md = markdown::history_markdown(&item.text, item.html.as_deref());
            converted_content(&md, format)
        }
        (_, content) => content,
    })
}

// Assíncrono: a colagem aguarda o foco e a restauração do clipboard fora da thread principal.
#[tauri::command]
pub async fn choose_snippet(
    app: AppHandle,
    state: Db<'_>,
    id: i64,
    format: Option<PasteFormat>,
) -> CommandResult<()> {
    let content = snippet_content(&state, id, format)?;
    if paste::paste(&app, &content, after_paste(&state))? {
        // O texto já foi colado; uma falha no contador não deve aparecer como erro.
        let _ = snippets::record_use(&lock(&state), id);
    }
    Ok(())
}

// Assíncrono pelo mesmo motivo: a cópia aguarda o foco voltar ao programa anterior.
#[tauri::command]
pub async fn copy_snippet(
    app: AppHandle,
    state: Db<'_>,
    id: i64,
    format: Option<PasteFormat>,
) -> CommandResult<()> {
    let content = snippet_content(&state, id, format)?;
    paste::copy(&app, &content)?;
    // Copiar pelo menu é um uso do texto, como colar; uma falha no contador não é erro.
    let _ = snippets::record_use(&lock(&state), id);
    Ok(())
}

#[tauri::command]
pub fn list_clipboard_history(state: Db) -> CommandResult<Vec<HistoryItem>> {
    respond(history::list(&lock(&state)))
}

/// O item usado sobe para o topo do histórico; uma falha nisso não é erro.
fn touch_history_item(app: &AppHandle, state: &Db, id: i64) {
    if history::touch(&lock(state), id).is_ok() {
        clipboard_history::notify(app);
    }
}

// Assíncronos como `choose_snippet` e `copy_snippet`.
#[tauri::command]
pub async fn paste_clipboard_item(
    app: AppHandle,
    state: Db<'_>,
    id: i64,
    format: Option<PasteFormat>,
) -> CommandResult<()> {
    let content = history_content(&state, id, format)?;
    paste::paste(&app, &content, after_paste(&state))?;
    touch_history_item(&app, &state, id);
    Ok(())
}

#[tauri::command]
pub async fn copy_clipboard_item(
    app: AppHandle,
    state: Db<'_>,
    id: i64,
    format: Option<PasteFormat>,
) -> CommandResult<()> {
    let content = history_content(&state, id, format)?;
    paste::copy(&app, &content)?;
    touch_history_item(&app, &state, id);
    Ok(())
}

/// Apaga o histórico e devolve quantos itens havia.
#[tauri::command]
pub fn clear_clipboard_history(app: AppHandle, state: Db) -> CommandResult<usize> {
    let cleared = respond(history::clear(&lock(&state)))?;
    clipboard_history::notify(&app);
    Ok(cleared)
}

#[tauri::command]
pub fn get_clipboard_monitoring(state: Db) -> CommandResult<bool> {
    respond(settings::get_clipboard_history(&lock(&state)))
}

#[tauri::command]
pub fn set_clipboard_monitoring(app: AppHandle, state: Db, enabled: bool) -> CommandResult<bool> {
    respond(settings::set_clipboard_history(&lock(&state), enabled))?;
    clipboard_history::set_enabled(enabled);
    clipboard_history::notify(&app);
    Ok(enabled)
}

/// Se a Ajuda deve abrir sozinha (só na primeira execução); a partir daí, não abre mais.
#[tauri::command]
pub fn take_help_prompt(state: Db) -> CommandResult<bool> {
    respond(settings::take_help_prompt(&lock(&state)))
}

/// Pasta onde ficam o banco e os demais dados do usuário.
#[tauri::command]
pub fn get_data_dir(app: AppHandle) -> CommandResult<String> {
    app.path()
        .app_data_dir()
        .map(|path| path.display().to_string())
        .map_err(|error| error.to_string())
}

// O frontend não abre URLs nem caminhos: só estes dois destinos fixos, pelo backend.

/// Repositório do CSTM; o mesmo endereço está em `bundle.homepage` de `tauri.conf.json`, que só vale ao empacotar.
const REPOSITORY_URL: &str = "https://github.com/marinsgabriel1997/CSTM";

/// Abre o repositório no navegador padrão.
#[tauri::command]
pub fn open_repository(app: AppHandle) -> CommandResult<()> {
    app.opener()
        .open_url(REPOSITORY_URL, None::<&str>)
        .map_err(|error| error.to_string())
}

/// Abre a pasta dos dados no Explorer.
#[tauri::command]
pub fn open_data_folder(app: AppHandle) -> CommandResult<()> {
    let path = get_data_dir(app.clone())?;
    app.opener()
        .open_path(path, None::<&str>)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn get_theme(state: Db) -> CommandResult<String> {
    respond(settings::get_theme(&lock(&state)))
}

#[tauri::command]
pub fn set_theme(app: AppHandle, state: Db, theme: String) -> CommandResult<String> {
    theme::change(&app, &lock(&state), &theme)
}

#[tauri::command]
pub fn get_autostart() -> CommandResult<bool> {
    autostart::is_enabled()
}

#[tauri::command]
pub fn set_autostart(enabled: bool) -> CommandResult<bool> {
    autostart::set_enabled(enabled)
}

#[tauri::command]
pub fn get_shortcut(app: AppHandle) -> ShortcutStatus {
    picker::shortcut_status(&app)
}

// Os comandos que registram atalhos são assíncronos: rodam fora da thread principal,
// onde o plugin de atalhos executa o registro e aguarda a resposta.
#[tauri::command]
pub async fn set_shortcut(
    app: AppHandle,
    state: Db<'_>,
    shortcut: String,
) -> CommandResult<ShortcutStatus> {
    picker::change_shortcut(&app, &lock(&state), &shortcut)
}

#[tauri::command]
pub async fn suspend_shortcut(app: AppHandle) -> ShortcutStatus {
    picker::suspend_shortcut(&app)
}

#[tauri::command]
pub async fn resume_shortcut(app: AppHandle) -> ShortcutStatus {
    picker::resume_shortcut(&app)
}

// Os comandos de importação e exportação são assíncronos: os seletores do Windows
// bloqueiam até a escolha e não podem rodar na thread principal. O banco só é
// travado depois da escolha. `None` significa que o seletor foi cancelado.
// Na exportação, `items` vazio exporta a biblioteca inteira.

fn transferred(result: transfer::Result<Summary>) -> CommandResult<Option<Summary>> {
    result.map(Some).map_err(|error| error.to_string())
}

/// Seletor nativo sobre a janela de cadastro.
fn dialog(app: &AppHandle) -> FileDialogBuilder<tauri::Wry> {
    let builder = app.dialog().file();
    match app.get_webview_window("main") {
        Some(window) => builder.set_parent(&window),
        None => builder,
    }
}

fn path(file: FilePath) -> CommandResult<PathBuf> {
    file.into_path()
        .map_err(|error| format!("caminho inválido: {error}"))
}

#[tauri::command]
pub async fn import_txt_files(
    app: AppHandle,
    state: Db<'_>,
    folder_id: Option<i64>,
) -> CommandResult<Option<Summary>> {
    let Some(files) = dialog(&app)
        .set_title("Importar arquivos .txt")
        .add_filter("Arquivos de texto", &["txt"])
        .blocking_pick_files()
    else {
        return Ok(None);
    };
    let paths = files
        .into_iter()
        .map(path)
        .collect::<CommandResult<Vec<_>>>()?;
    transferred(transfer::import_txt_files(
        &mut lock(&state),
        folder_id,
        &paths,
    ))
}

#[tauri::command]
pub async fn import_folder(
    app: AppHandle,
    state: Db<'_>,
    folder_id: Option<i64>,
    include_root: bool,
) -> CommandResult<Option<Summary>> {
    let title = if include_root {
        "Importar pasta"
    } else {
        "Importar conteúdo de uma pasta"
    };
    let Some(dir) = dialog(&app).set_title(title).blocking_pick_folder() else {
        return Ok(None);
    };
    transferred(transfer::import_folder(
        &mut lock(&state),
        folder_id,
        &path(dir)?,
        include_root,
    ))
}

#[tauri::command]
pub async fn import_json(
    app: AppHandle,
    state: Db<'_>,
    folder_id: Option<i64>,
) -> CommandResult<Option<Summary>> {
    let Some(file) = dialog(&app)
        .set_title("Importar backup JSON")
        .add_filter("Backup JSON", &["json"])
        .blocking_pick_file()
    else {
        return Ok(None);
    };
    transferred(transfer::import_json(
        &mut lock(&state),
        folder_id,
        &path(file)?,
    ))
}

#[tauri::command]
pub async fn export_json(
    app: AppHandle,
    state: Db<'_>,
    items: Vec<ItemRef>,
) -> CommandResult<Option<Summary>> {
    let name = transfer::json_file_name(&lock(&state), &items).map_err(|e| e.to_string())?;
    // O seletor de salvar pede a confirmação para substituir um arquivo existente.
    let Some(file) = dialog(&app)
        .set_title("Exportar backup JSON")
        .add_filter("Backup JSON", &["json"])
        .set_file_name(name)
        .blocking_save_file()
    else {
        return Ok(None);
    };
    transferred(transfer::export_json(&lock(&state), &items, &path(file)?))
}

#[tauri::command]
pub async fn export_txt(
    app: AppHandle,
    state: Db<'_>,
    items: Vec<ItemRef>,
) -> CommandResult<Option<Summary>> {
    let Some(dir) = dialog(&app)
        .set_title("Exportar como pastas e arquivos .txt")
        .blocking_pick_folder()
    else {
        return Ok(None);
    };
    transferred(transfer::export_txt(&lock(&state), &items, &path(dir)?))
}

#[cfg(test)]
mod tests {
    use serde_json::{Value, json};

    use super::*;
    use crate::db::open_in_memory;

    fn keys(value: Value) -> Vec<String> {
        let mut keys: Vec<String> = value.as_object().unwrap().keys().cloned().collect();
        keys.sort();
        keys
    }

    #[test]
    fn folder_is_serialized_in_camel_case() {
        let conn = open_in_memory().unwrap();
        let parent = folders::create_folder(&conn, None, "Pai").unwrap();
        let folder = folders::create_folder(&conn, Some(parent.id), "Filha").unwrap();

        let value = serde_json::to_value(&folder).unwrap();

        assert_eq!(
            keys(value.clone()),
            [
                "createdAt",
                "id",
                "name",
                "parentId",
                "sortOrder",
                "updatedAt"
            ]
        );
        assert_eq!(value["parentId"], json!(parent.id));
        assert_eq!(value["name"], json!("Filha"));
    }

    #[test]
    fn snippet_is_serialized_in_camel_case() {
        let conn = open_in_memory().unwrap();
        let snippet = snippets::create_snippet(&conn, None, "Título", "Conteúdo").unwrap();
        let snippet = snippets::set_favorite(&conn, snippet.id, true).unwrap();

        let value = serde_json::to_value(&snippet).unwrap();

        assert_eq!(
            keys(value.clone()),
            [
                "content",
                "createdAt",
                "favorite",
                "folderId",
                "id",
                "lastUsedAt",
                "sortOrder",
                "title",
                "updatedAt",
                "useCount"
            ]
        );
        assert_eq!(value["folderId"], Value::Null);
        assert_eq!(value["favorite"], json!(true));
        assert_eq!(value["lastUsedAt"], Value::Null);
    }

    #[test]
    fn errors_become_display_messages() {
        let conn = open_in_memory().unwrap();

        assert_eq!(
            respond(snippets::create_snippet(&conn, None, "  ", "x")),
            Err("o campo título não pode ficar vazio".to_string())
        );
        assert_eq!(
            respond(snippets::delete_snippet(&conn, 42)),
            Err("registro não encontrado".to_string())
        );
    }
}
