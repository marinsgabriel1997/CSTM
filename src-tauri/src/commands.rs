//! Comandos Tauri expostos ao frontend. Apenas delegam aos módulos `db`, `picker`, `paste` e `tray`;
//! os erros chegam ao frontend como mensagens prontas para exibição.

use std::sync::{Mutex, MutexGuard, PoisonError};

use rusqlite::Connection;
use tauri::{AppHandle, State};

use crate::db::folders::{self, Folder};
use crate::db::snippets::{self, Snippet};
use crate::paste;
use crate::picker::{self, ShortcutStatus};
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
pub fn delete_folder(state: Db, id: i64) -> CommandResult<()> {
    respond(folders::delete_folder(&lock(&state), id))
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
pub fn search_snippets(state: Db, query: String) -> CommandResult<Vec<Snippet>> {
    respond(snippets::search_snippets(&lock(&state), &query))
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
pub fn show_main_window(app: AppHandle) {
    tray::show_main_window(&app);
}

#[tauri::command]
pub fn exit_app(app: AppHandle) {
    app.exit(0);
}

#[tauri::command]
pub fn hide_picker(app: AppHandle) {
    picker::hide(&app);
}

// Assíncrono: a colagem aguarda o foco e a restauração do clipboard fora da thread principal.
#[tauri::command]
pub async fn choose_snippet(app: AppHandle, state: Db<'_>, id: i64) -> CommandResult<()> {
    let snippet = respond(snippets::get_snippet(&lock(&state), id))?;
    if paste::paste(&app, &snippet.content)? {
        // O texto já foi colado; uma falha no contador não deve aparecer como erro.
        let _ = snippets::record_use(&lock(&state), id);
    }
    Ok(())
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
            respond(folders::delete_folder(&conn, 42)),
            Err("registro não encontrado".to_string())
        );
    }
}
